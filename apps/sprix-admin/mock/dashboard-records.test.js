import {test,expect,vi} from 'vitest';
import {readRealOrders} from '../src/services/dashboardRecords';
import {mergePage} from '../src/services/pagedAdminData';
import {compareRecords,filterRecords} from './record-order.mjs';
function mockFetch(kind,rows,calls){return async params=>{
 calls.push(params);
 const selected=filterRecords(kind,rows,params).sort((a,b)=>compareRecords(kind,a,b));
 return {rows:selected.slice(params.offset,params.offset+params.limit),total:selected.length,version:'fixed'};
};}
test('mixed pages equal a full chronological sort, including ties, empty sides and deep pages',async()=>{
 for(const sizes of [[0,53],[41,0],[21,87],[87,21],[2,1500]]){
  const make=(n,prefix)=>Array.from({length:n},(_,i)=>({id:`${prefix}:${i}`,publishedAt:`2026-09-${String(1+i%28).padStart(2,'0')} ${String(i%24).padStart(2,'0')}:00:00`,taskStatus:'已发布'}));
  const live=make(sizes[0],'live'),demo=make(sizes[1],'demo');
  const all=[...live,...demo].sort((a,b)=>compareRecords('tasks',a,b));
  const calls=[];
  for(const page of [1,2,Math.ceil(all.length/8),99999]){
   const result=await mergePage('tasks',live,{page,pageSize:8},mockFetch('tasks',demo,calls));
   expect(result.rows).toEqual(all.slice((result.page-1)*8,result.page*8));
   expect(result.total).toBe(all.length);
  }
  expect(calls.every(p=>p.limit<=8)).toBe(true);
 }
});
test('filters apply before pagination and timezone-equivalent ties have stable identity ordering',async()=>{
 const rows=[{id:'demo:2',taskStatus:'已下线',publishedAt:'2026-09-12 12:00:00'},{id:'demo:1',taskStatus:'已发布',publishedAt:'2026-09-12T04:00:00Z'}];
 expect(compareRecords('tasks',rows[0],rows[1])).toBeGreaterThan(0);
 const result=await mergePage('tasks',[],{page:1,pageSize:8,status:'已发布'},mockFetch('tasks',rows,[]));
 expect(result.rows).toEqual([rows[1]]);
});
test('pending acceptance records stay ahead of completed history and support status filtering',async()=>{
 const completed={executionId:'demo:completed',acceptanceStatus:'验收通过',submittedAt:'2026-09-12 12:00:00'};
 const pending={executionId:'real:pending',acceptanceStatus:'待平台审核',submittedAt:'2026-09-01 12:00:00'};
 expect([completed,pending].sort((a,b)=>compareRecords('acceptance',a,b))).toEqual([pending,completed]);
 expect(filterRecords('acceptance',[completed,pending],{status:'待平台审核'})).toEqual([pending]);
});
test('real executions use actual start time, not parent publication order, with bounded fanout',async()=>{
 const tasks=[{id:'old',title:'old',executionTotal:1,runningExecutionCount:1,reward:5},{id:'new',title:'new',executionTotal:1,runningExecutionCount:1,reward:6}];
 const detail=vi.fn(async task=>({records:{running:[{executionId:task.id,userName:'u',agentName:'a',startedAt:task.id==='old'?'2026-09-12 12:00:00':'2026-09-11 12:00:00'}],reviewing:[],completed:[],terminated:[]}}));
 const rows=await readRealOrders({status:'running',search:''},{center:async()=>({tasks}),detail});
 const page=await mergePage('orders',rows,{page:1,pageSize:20},mockFetch('orders',[],[]));
 expect(page.rows.map(r=>r.taskId)).toEqual(['old','new']);
 expect(detail).toHaveBeenCalledTimes(2);
});
