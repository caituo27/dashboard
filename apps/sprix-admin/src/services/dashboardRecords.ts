import {readRemoteTaskCenterSnapshot,readRemoteTaskDetail} from './sprixApi';
import {mergePage} from './pagedAdminData';
import type {AdminTaskCenterSnapshot,AdminTaskDetailView} from './sprixApi';
import type {Task} from '../types';
export const executionLabels={all:'全部订单',running:'执行中',reviewing:'待验收',completed:'已完成',terminated:'已终止'};
export type ExecutionFilter=keyof typeof executionLabels;
export type OrderRange={startDate:string;endDate:string};
export type OrderRow={id:string;taskId:string;taskTitle:string;executionId:string;status:Exclude<ExecutionFilter,'all'>;userName:string;agentName:string;time:string;reward:number};
const states=['running','reviewing','completed','terminated'] as const;
export type OrderSource={center:()=>Promise<AdminTaskCenterSnapshot>;detail:(task:Task)=>Promise<AdminTaskDetailView>};
export async function readRealOrders(options:{status:ExecutionFilter;search:string}&OrderRange,source:OrderSource):Promise<OrderRow[]> {
 const center=await source.center(),keyword=options.search.trim().toLowerCase();
 const tasks=center.tasks.filter(task=>(options.status==='all'?task.executionTotal:task[`${options.status}ExecutionCount`]) && (!keyword || `${task.id} ${task.title}`.toLowerCase().includes(keyword)));
 const rows:OrderRow[]=[];
 let cursor=0;
 // The existing backend only exposes per-task executions. Bound fanout while
 // constructing its much smaller real index; synthetic executions stay on server.
 await Promise.all(Array.from({length:Math.min(6,tasks.length)},async()=>{
  while(cursor<tasks.length){
   const task=tasks[cursor++],detail=await source.detail(task);
   for(const status of states) if(options.status==='all'||status===options.status) detail.records[status].forEach((row,index)=>{
    const time=status==='running' && 'startedAt' in row?row.startedAt:status==='reviewing'&&'submittedAt' in row?(row.submittedAt ?? '—'):status==='completed'&&'completedAt' in row?row.completedAt:'terminatedAt' in row?row.terminatedAt:'—';
    const date=time.slice(0,10);
    if(date<options.startDate||date>options.endDate)return;
    rows.push({id:`${task.id}:${row.executionId ?? `${status}:${index}`}`,taskId:task.id,taskTitle:task.title,executionId:row.executionId ?? '—',status,userName:row.userName,agentName:row.agentName,time,reward:task.reward});
   });
  }
 }));
 return rows;
}
export async function readOrderPage(options:{status:ExecutionFilter;page:number;search:string}&OrderRange,source:OrderSource={center:readRemoteTaskCenterSnapshot,detail:task=>readRemoteTaskDetail(task.id)}) {
 return mergePage<OrderRow>('orders',await readRealOrders(options,source),{...options,pageSize:20});
}
