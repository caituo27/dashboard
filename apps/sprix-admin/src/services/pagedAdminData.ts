import { sharedAdminRead } from "./adminQueryClient";
import { internalSearch } from "../utils/displayText";
import axios from 'axios';
import * as real from './sprixApi';
import {compareRecords,filterRecords} from '../../mock/record-order.mjs';
import type {Task,ReviewingExecution,AdminAppeal} from '../types';
import type {DashboardAnalyticsSnapshot} from './dashboardAnalyticsMock';
export type PageOptions={page:number;pageSize:number;status?:string;search?:string;date?:string;startDate?:string;endDate?:string;endAt?:string;category?:string;lifecycleStage?:string;done?:string;demoOnly?:boolean;snapshotVersion?:string};
export type PageResult<T>={rows:T[];total:number;page:number};
export async function demoView<T>(params:Record<string,unknown>):Promise<T>{return (await axios.get<T>('/mock-api/admin/view',{params,timeout:15000})).data;}
export function filterAvailableAppealDetails(rows:Array<AdminAppeal|null>):AdminAppeal[]{return rows.filter((row):row is AdminAppeal=>row!==null);}
function stableTaskHash(value:string,salt=0){let result=2166136261^salt;for(let index=0;index<value.length;index++){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return result>>>0;}
function distributeSeedTaskUsage(task:Task):Task{
 const total=Math.max(0,Math.trunc(task.totalSlots??0)),remaining=Math.max(0,Math.trunc(task.remainingSlots??0)),executions=Math.max(0,Math.trunc(task.executionTotal??0));
 if(total<2||remaining!==total||executions!==0)return task;
 const consumedRatio=50+stableTaskHash(`${task.id}:${task.title}`,17)%41;
 const consumed=Math.min(total-1,Math.max(1,Math.ceil(total*consumedRatio/100)));
 const reviewingRatio=6+stableTaskHash(`${task.id}:${task.category}`,31)%15;
 const reviewing=Math.min(consumed,Math.max(1,Math.round(consumed*reviewingRatio/100)));
 return {...task,remainingSlots:total-consumed,executionTotal:consumed,runningExecutionCount:0,reviewingExecutionCount:reviewing,completedExecutionCount:consumed-reviewing,terminatedExecutionCount:0};
}
async function readAppealDetailForList(id:string):Promise<AdminAppeal|null>{
 try{return await real.readCachedAppealDetail(id);}
 catch(error){
  if(axios.isAxiosError(error)&&error.response?.status===404)return null;
  throw error;
 }
}
// Locate the merged page with a binary partition. Only O(log realCount) tiny
// boundary requests and one page are read from the mock service, even on last page.
export async function mergePage<T>(kind:string,realRows:T[] | Promise<T[]>,options:PageOptions,fetch=demoView):Promise<PageResult<T>> {
 const filters={status:options.status,search:options.search ? internalSearch(options.search) : undefined,date:options.date,startDate:options.startDate,endDate:options.endDate,endAt:options.endAt,category:options.category,lifecycleStage:options.lifecycleStage,done:options.done};
 type Slice={rows:T[];total:number;version:string};
 const [first,source]=await Promise.all([fetch<Slice>({kind,...filters,version:options.snapshotVersion,offset:0,limit:options.pageSize}),realRows]);
 const sorted=filterRecords(kind,source,filters).sort((a,b)=>compareRecords(kind,a as object,b as object));
 const total=first.total+sorted.length,page=Math.min(Math.max(1,options.page),Math.max(1,Math.ceil(total/options.pageSize))),skip=(page-1)*options.pageSize;
 if(skip===0) return {total,page,rows:[...sorted.slice(0,options.pageSize),...first.rows].sort((a,b)=>compareRecords(kind,a as object,b as object)).slice(0,options.pageSize)};
 const load=(offset:number,limit:number)=>fetch<Slice>({kind,...filters,offset,limit,version:first.version});
 let low=Math.max(0,skip-first.total),high=Math.min(skip,sorted.length),i=low,j=skip-i;
 while(low<=high){
   i=Math.floor((low+high)/2);j=skip-i;
   const sample=await load(Math.max(0,j-1),2);
   const left=j>0?sample.rows[0]:undefined,right=sample.rows[j>0?1:0];
   if(i>0 && right && compareRecords(kind,sorted[i-1] as object,right as object)>0) high=i-1;
   else if(left && i<sorted.length && compareRecords(kind,left as object,sorted[i] as object)>0) low=i+1;
   else break;
 }
 const mock=await load(j,options.pageSize);
 return {total,page,rows:[...sorted.slice(i,i+options.pageSize),...mock.rows].sort((a,b)=>compareRecords(kind,a as object,b as object)).slice(0,options.pageSize)};
}
export const readDemoDashboard=()=>demoView<DashboardAnalyticsSnapshot>({kind:'dashboard'});
export async function readTaskPage(options:PageOptions){
 if(options.demoOnly){
  const [result,demo]=await Promise.all([mergePage<Task>('tasks',[],options),readDemoDashboard()]);
  return {...result,stats:{total:demo.operations.taskTotal,published:demo.operations.publishedTasks,offline:demo.operations.taskTotal-demo.operations.publishedTasks,executions:demo.overview.orders,reviews:demo.operations.pendingAcceptance ?? 0,appeals:demo.operations.appeals}};
 }
 const centerPromise=sharedAdminRead('center',real.readRemoteTaskCenterSnapshot).then(center=>({...center,tasks:center.tasks.map(distributeSeedTaskUsage)}));
 const [center,demo,result]=await Promise.all([centerPromise,readDemoDashboard(),mergePage<Task>('tasks',centerPromise.then(center=>center.tasks),options)]);
 return {...result,stats:{total:center.tasks.filter(t=>t.taskStatus!=='已删除').length+demo.operations.taskTotal,published:center.tasks.filter(t=>t.taskStatus==='已发布').length+demo.operations.publishedTasks,offline:center.tasks.filter(t=>t.taskStatus==='已下线').length+demo.operations.taskTotal-demo.operations.publishedTasks,executions:center.tasks.reduce((sum,t)=>sum+(t.executionTotal ?? 0),0)+demo.overview.orders,reviews:center.acceptanceReviews.length+(demo.operations.pendingAcceptance ?? 0),appeals:center.appealCount+demo.operations.appeals}};
}
export async function readAcceptancePage(options:PageOptions){
 const sourcePromise=sharedAdminRead('acceptance',real.readRemoteAcceptanceReviews);
 const [source,result,stats]=await Promise.all([sourcePromise,mergePage<ReviewingExecution>('acceptance',sourcePromise,options),demoView<{tasks:number;agents:number;platformAgents:number}>({kind:'acceptance-stats',category:options.category})]);
 const filteredSource=options.category?source.filter(row=>row.taskCategory===options.category):source;
 return {...result,taskCount:new Set(filteredSource.map(r=>r.taskId ?? r.taskTitle)).size+stats.tasks,agentCount:stats.platformAgents};
}
export async function readAcceptanceDetail(id:string){
 if(id.startsWith('demo:')){try{return await demoView<ReviewingExecution>({kind:'acceptance-detail',id});}catch(error){if(axios.isAxiosError(error)&&error.response?.status===404)return null;throw error;}}
 return (await real.readRemoteAcceptanceReviews()).find(r=>r.executionId===id) ?? null;
}
export async function readAppealPage(options:PageOptions){
 const rowsPromise=sharedAdminRead('appeals',real.readRemoteAppeals);
 // Full-text search and category filtering need the task fields from appeal details;
 // ordinary navigation only hydrates the visible page.
 const searchable=options.search || options.category
  ? rowsPromise.then(rows=>Promise.all(rows.map(row=>readAppealDetailForList(row.backendId!))).then(filterAvailableAppealDetails))
  : rowsPromise;
 const [rows,page,demoStats]=await Promise.all([rowsPromise,mergePage<AdminAppeal>('appeals',searchable,options),demoView<{pending:number;processing:number;today:number;done:number}>({kind:'appeal-stats',category:options.category})]);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 const visible=filterAvailableAppealDetails(await Promise.all(page.rows.map(row=>row.backendId && !row.backendId.startsWith('demo:') ? readAppealDetailForList(row.backendId) : row)));
 const filteredRows=options.category?rows.filter(row=>row.taskCategory===options.category):rows;
 return {...page,rows:visible,stats:{pending:demoStats.pending+filteredRows.filter(r=>r.appealStatus==='待处理').length,processing:demoStats.processing+filteredRows.filter(r=>r.appealStatus==='处理中').length,today:demoStats.today+filteredRows.filter(r=>r.submittedAt.startsWith(today)).length,done:demoStats.done+filteredRows.filter(r=>['申诉通过','申诉不通过'].includes(r.appealStatus)).length}};
}
