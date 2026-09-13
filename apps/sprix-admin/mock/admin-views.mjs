import {taskForOrder,indexAt} from "./business-scenario.mjs";
import {readDemoState} from './demo-state.mjs';
import {buildDemoLedger,createDemoLedgerSeed} from './demo-ledger.mjs';
import {compareRecords,filterRecords,timestamp} from './record-order.mjs';
import {BUSINESS_CUTOFF_AT,BUSINESS_SNAPSHOT_ID,businessTaskCount,businessExecutionCount,businessAppealCount,businessTaskRecord,businessExecutionRecord,businessAcceptanceRecord,businessAppealRecord,businessTaskDetail,businessAcceptanceDetail,businessAppealDetail} from './business-metrics.mjs';
const snapshots=new Map();

export async function getView(version) {
 if(version===BUSINESS_SNAPSHOT_ID&&!snapshots.has(version)) {
   const state=await readDemoState();
   snapshots.set(version,{version,business:true,state,stateKey:JSON.stringify(state.patches??{}),ledger:buildDemoLedger(createDemoLedgerSeed(BUSINESS_CUTOFF_AT),state),lists:new Map()});
 }
 if(version) {
   if(!snapshots.has(version)) throw new Error('SNAPSHOT_EXPIRED');
   const view=snapshots.get(version);
   if(view.business){const state=await readDemoState(),stateKey=JSON.stringify(state.patches??{});if(stateKey!==view.stateKey){view.state=state;view.stateKey=stateKey;view.lists.clear();}}
   return view;
 }
 const state=await readDemoState();
 const at=BUSINESS_CUTOFF_AT;
 const key=BUSINESS_SNAPSHOT_ID;
 if(!snapshots.has(key)) {
   const seed=createDemoLedgerSeed(at);
   const ledger=buildDemoLedger(seed,state);
   const view={version:key,business:true,state,stateKey:JSON.stringify(state.patches??{}),ledger,lists:new Map()};
   snapshots.set(key,view);
   while(snapshots.size>12) snapshots.delete(snapshots.keys().next().value);
 }
 return snapshots.get(key);
}
const allowed=['tasks','acceptance','appeals','settlements','withdrawals','payouts','fundExceptions','fundFlows','orders'];
function businessPage(view,kind,options,offset,limit){
 const key=JSON.stringify(['business',kind,options.status??'',options.search??'',options.date??'',options.startDate??'',options.endDate??'',options.endAt??'',options.category??'',options.lifecycleStage??'']);
 if(!view.lists.has(key)){
  const total=kind==='tasks'?businessTaskCount:kind==='appeals'?businessAppealCount:businessExecutionCount;
  const record=index=>{const id=kind==='tasks'?`demo:business-task:${index}`:kind==='orders'?`demo:business-order:${index}`:kind==='acceptance'?`demo:business-execution:${index}`:`demo:business-appeal:${index}`,patch=view.state?.patches?.[id]??{};return kind==='tasks'?businessTaskRecord(index,patch,view.state?.patches??{}):kind==='orders'?businessExecutionRecord(index,patch):kind==='acceptance'?businessAcceptanceRecord(index,patch):businessAppealRecord(index,patch);};
  const indexes=[];
  for(let index=1;index<=total;index++){const row=record(index);if(kind==='tasks'&&row.taskStatus==='已删除')continue;if(kind==='acceptance'&&row.status!=='reviewing')continue;if(filterRecords(kind,[row],options).length)indexes.push(index);}
  indexes.sort((a,b)=>compareRecords(kind,record(a),record(b)));
  view.lists.set(key,indexes);
 }
 const indexes=view.lists.get(key);
  const rows=indexes.slice(offset,offset+limit).map(index=>{const id=kind==='tasks'?`demo:business-task:${index}`:kind==='orders'?`demo:business-order:${index}`:kind==='acceptance'?`demo:business-execution:${index}`:`demo:business-appeal:${index}`,patch=view.state?.patches?.[id]??{};return kind==='tasks'?businessTaskRecord(index,patch,view.state?.patches??{}):kind==='orders'?businessExecutionRecord(index,patch):kind==='acceptance'?businessAcceptanceRecord(index,patch):businessAppealRecord(index,patch);});
 return {version:view.version,total:indexes.length,rows};
}
function taskCategoryForIndex(ledger,index) {
 const taskId=ledger.consumerRows.get(index)?.taskId;
 const taskIndex=taskId?Number(taskId.split(':')[2]):taskForOrder(index);
 return ledger.taskMeta(taskIndex)?.category;
}
function taskPage(view,options,offset,limit) {
 const {ledger}=view;
 const filter={status:options.status,search:options.search,date:options.date,startDate:options.startDate,endDate:options.endDate,endAt:options.endAt,category:options.category,lifecycleStage:options.lifecycleStage,availableOnly:options.availableOnly};
 if(typeof ledger.taskMeta!=='function'){
  const key=JSON.stringify(['tasks-array',filter]);
  if(!view.lists.has(key))view.lists.set(key,filterRecords('tasks',ledger.tasks??[],filter).filter(task=>!filter.availableOnly||(task.taskStatus==='\u5df2\u53d1\u5e03'&&task.remainingSlots>0)).sort((a,b)=>compareRecords('tasks',a,b)));
  const rows=view.lists.get(key);
  return {version:view.version,total:rows.length,rows:rows.slice(offset,offset+limit)};
 }
 const key=JSON.stringify(['tasks',filter]);
 if(!view.lists.has(key)) {
   const indexes=[];
   for(let index=1;index<=ledger.taskCount;index++) {
     const meta=ledger.taskMeta(index);
     if(!meta||meta.taskStatus==='已删除') continue;
     if(filter.availableOnly&&(meta.taskStatus!=='已发布'||meta.remainingSlots<=0)) continue;
     if(filter.category&&meta.category!==filter.category) continue;
     if(filter.status&&!['all','全部'].includes(filter.status)&&meta.taskStatus!==filter.status) continue;
     const date=String(meta.publishedAt).slice(0,10);
     if(filter.date&&date!==filter.date) continue;
     if(filter.startDate&&date<filter.startDate) continue;
     if(filter.endDate&&date>filter.endDate) continue;
     if(filter.endAt&&timestamp(meta.publishedAt)>timestamp(filter.endAt)) continue;
     if(filter.search&&!ledger.taskSearchText(index).includes(String(filter.search).trim().toLowerCase())) continue;
     if(filter.lifecycleStage&&!filterRecords('tasks',[ledger.taskAt(index)],{lifecycleStage:filter.lifecycleStage,endAt:filter.endAt}).length) continue;
     indexes.push(index);
   }
   indexes.sort((a,b)=>timestamp(ledger.taskMeta(b).publishedAt)-timestamp(ledger.taskMeta(a).publishedAt)||String(ledger.taskMeta(a).id).localeCompare(String(ledger.taskMeta(b).id)));
   if(view.lists.size>20) view.lists.clear();
   view.lists.set(key,indexes);
 }
 const indexes=view.lists.get(key);
 return {version:view.version,total:indexes.length,rows:indexes.slice(offset,offset+limit).map(ledger.taskAt)};
}
export function businessDetail(id,state={}){
 const match=/^demo:business-task:(\d+)$/.exec(id??'');
 return match?businessTaskDetail(Number(match[1]),state.patches?.[id]??{},state.patches??{}):null;
}
export {businessAcceptanceDetail,businessAppealDetail};
export function viewPage(view,kind,options={}) {
 if(!allowed.includes(kind)) throw new Error('INVALID_KIND');
 const offset=Number(options.offset ?? 0),limit=Number(options.limit ?? 20);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100) throw new Error('INVALID_PAGE');
 const {ledger}=view;
 if(view.business&&['tasks','orders','acceptance','appeals'].includes(kind))return businessPage(view,kind,options,offset,limit);
 if(kind==='tasks') return taskPage(view,options,offset,limit);
 if(kind==='withdrawals') {
   if(options.status && !['全部','all','已提现'].includes(options.status)) return {version:view.version,total:0,rows:[]};
   let indexes=settledIndexes(view);
   if(options.search || options.date || options.startDate || options.endDate || options.endAt || options.category) {
     const key=JSON.stringify(['withdrawals',options.search,options.date,options.startDate,options.endDate,options.endAt,options.category]);
     if(!view.lists.has(key))view.lists.set(key,indexes.filter(index=>(!options.category||taskCategoryForIndex(ledger,index)===options.category)&&filterRecords(kind,[ledger.withdrawalRecord(index)],{...options,category:undefined}).length));
     indexes=view.lists.get(key);
   }
   return {version:view.version,total:indexes.length,rows:indexes.slice(offset,offset+limit).map(ledger.withdrawalRecord)};
 }
 if(kind==='orders' || kind==='settlements') return executionPage(view,kind,options,offset,limit);
 const filter={status:options.status,search:options.search,date:options.date,startDate:options.startDate,endDate:options.endDate,endAt:options.endAt,category:options.category,lifecycleStage:options.lifecycleStage,done:options.done,availableOnly:options.availableOnly};
 const key=JSON.stringify([kind,filter]);
 if(!view.lists.has(key)) {
   const all=kind==='acceptance'?ledger.acceptanceReviews:kind==='appeals'?ledger.appeals:kind==='fundFlows'?ledger.fundFlows:[];
   const rows=filterRecords(kind,all,filter).sort((a,b)=>compareRecords(kind,a,b));
   if(view.lists.size>20) view.lists.clear();
   view.lists.set(key,rows);
 }
 const rows=view.lists.get(key);
 return {version:view.version,total:rows.length,rows:rows.slice(offset,offset+limit)};
}
let settlementIndex;
function settledIndexes(view) {
 const now=Date.parse(view.ledger.generatedAt),key=view.ledger.stateKey;
 const previous=settlementIndex?.key===key && settlementIndex.at<=now ? settlementIndex : null;
 if(previous?.at===now) return previous.indexes;
 const from=previous?indexAt(previous.at-3*86400000)+1:1;
 const indexes=view.ledger.executionIndexes('completed',from);
 const times=new Float64Array((view.ledger.orders??0)+1),extras=new Map();
 const timeFor=index=>index<times.length?times[index]:extras.get(index);
 const additions=indexes.filter(index=>{
   const time=view.ledger.recordTime(index,'settlements');
   if(previous && ((view.ledger.settledAt?.(index) ?? time)<=previous.at || previous.future.has(index)))return false;
   if(index<times.length)times[index]=time;else extras.set(index,time);return true;
 });
 const compare=(a,b)=>(timeFor(b) || view.ledger.recordTime(b,'settlements'))-(timeFor(a) || view.ledger.recordTime(a,'settlements')) || String(a).localeCompare(String(b));
 additions.sort(compare);
 let result=additions;
 if(previous) {
   result=[];let i=0,j=0;
   while(i<previous.indexes.length && j<additions.length) {
     if(compare(previous.indexes[i],additions[j])<=0)result.push(previous.indexes[i++]);else result.push(additions[j++]);
   }
   while(i<previous.indexes.length)result.push(previous.indexes[i++]);
   while(j<additions.length)result.push(additions[j++]);
 }
 const future=new Set(previous?.future ?? []);
 for(const index of additions) if((view.ledger.settledAt?.(index) ?? timeFor(index))>now)future.add(index);
 settlementIndex={key,at:now,indexes:result,future};return result;
}
function executionPage(view,kind,options,offset,limit) {
 const ledger=view.ledger;
 const status=kind==='settlements'?'completed':options.status ?? 'all';
 if(!['all','running','reviewing','completed','terminated'].includes(status)) throw new Error('INVALID_STATUS');
 const key=JSON.stringify([kind,status,options.search ?? '',options.date ?? '',options.startDate ?? '',options.endDate ?? '',options.endAt ?? '',options.category ?? '',options.status ?? '']);
 const record=kind==='settlements'?ledger.settlementRecord:ledger.orderRecord;
 if(kind==='settlements' && !options.search && !options.date && !options.startDate && !options.endDate && !options.endAt && !options.category && (!options.status || ['全部','已入账'].includes(options.status))) {
   const indexes=settledIndexes(view);
   return {version:view.version,total:indexes.length,rows:indexes.slice(offset,offset+limit).map(record)};
 }
 if(!view.lists.has(key)) {
   let indexes=ledger.executionIndexes(status==='all'?undefined:status);
   if(kind==='orders' && options.search) {
     const search=String(options.search).toLowerCase();
     const matching=new Set();
     for(let index=1;index<=ledger.taskCount;index++) if(ledger.taskIdentityText(index).includes(search)) matching.add(index);
     indexes=indexes.filter(index=>matching.has((ledger.consumerRows.get(index)?Number(ledger.consumerRows.get(index).taskId.split(":")[2]):taskForOrder(index))));
   }
   if(options.category) indexes=indexes.filter(index=>taskCategoryForIndex(ledger,index)===options.category);
   const times=new Float64Array((ledger.orders ?? 0)+1),extraTimes=new Map();
   const timeFor=index=>index<times.length?times[index]:extraTimes.get(index);
   for(const index of indexes) {
     if(index<times.length) times[index]=ledger.recordTime(index,kind);else extraTimes.set(index,ledger.recordTime(index,kind));
   }
   if(options.startDate || options.endDate || options.endAt) {
     const start=options.startDate?Date.parse(`${options.startDate}T00:00:00+08:00`):-Infinity;
     const end=options.endAt?timestamp(options.endAt)+1000:options.endDate?Date.parse(`${options.endDate}T00:00:00+08:00`)+86400000:Infinity;
     indexes=indexes.filter(index=>{const time=timeFor(index);return time>=start&&time<end;});
   }
   if((kind!=='orders' && options.search) || options.date || (kind==='settlements' && options.status && options.status!=='全部'))
     indexes=indexes.filter(index=>filterRecords(kind,[record(index)],options).length);
   indexes.sort((a,b)=>timeFor(b)-timeFor(a) || (kind==='orders' && taskForOrder(a)!==taskForOrder(b) ? String(taskForOrder(a)).localeCompare(String(taskForOrder(b))) : String(a).localeCompare(String(b))));
   view.lists.set(key,indexes);
 }
 const indexes=view.lists.get(key);
 return {version:view.version,total:indexes.length,rows:indexes.slice(offset,offset+limit).map(record)};
}
