import {taskForOrder,indexAt} from "./business-scenario.mjs";
import {createHash} from 'node:crypto';
import {readDemoState} from './demo-state.mjs';
import {createAnalyticsSnapshot} from './analytics-data.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';
import {aggregateDashboard} from './dashboard-aggregation.mjs';
import {compareRecords,filterRecords} from './record-order.mjs';
const snapshots=new Map();
export async function getView(version) {
 if(version) {if(!snapshots.has(version)) throw new Error('SNAPSHOT_EXPIRED'); return snapshots.get(version);}
 const state=await readDemoState(),seed=createAnalyticsSnapshot(7);
 const key=`${seed.generatedAt}-${createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0,12)}`;
 if(!snapshots.has(key)) {
   const ledger=buildDemoLedger(seed,state);
   const center={tasks:ledger.tasks,acceptanceReviews:ledger.acceptanceReviews,appealCount:ledger.appeals.length};
   let dashboard;
   snapshots.set(key,{version:key,ledger,get dashboard(){return dashboard ??= aggregateDashboard(seed,center,ledger.funds);},lists:new Map()});
   while(snapshots.size>3) snapshots.delete(snapshots.keys().next().value);
 }
 return snapshots.get(key);
}
const allowed=['tasks','acceptance','appeals','settlements','withdrawals','payouts','fundExceptions','fundFlows','orders'];
export function viewPage(view,kind,options={}) {
 if(!allowed.includes(kind)) throw new Error('INVALID_KIND');
 const offset=Number(options.offset ?? 0),limit=Number(options.limit ?? 20);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100) throw new Error('INVALID_PAGE');
 const {ledger}=view;
 if(kind==='withdrawals') {
   if(options.status && !['全部','all','已提现'].includes(options.status)) return {version:view.version,total:0,rows:[]};
   let indexes=settledIndexes(view);
   if(options.search || options.date) {
     const key=JSON.stringify(['withdrawals',options.search,options.date]);
     if(!view.lists.has(key))view.lists.set(key,indexes.filter(index=>filterRecords(kind,[ledger.withdrawalRecord(index)],options).length));
     indexes=view.lists.get(key);
   }
   return {version:view.version,total:indexes.length,rows:indexes.slice(offset,offset+limit).map(ledger.withdrawalRecord)};
 }
 if(kind==='orders' || kind==='settlements') return executionPage(view,kind,options,offset,limit);
 const filter={status:options.status,search:options.search,date:options.date,done:options.done,availableOnly:options.availableOnly};
 const key=JSON.stringify([kind,filter]);
 if(!view.lists.has(key)) {
   const all=kind==='tasks'?ledger.tasks:kind==='acceptance'?ledger.acceptanceReviews:kind==='appeals'?ledger.appeals:ledger.funds[kind];
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
 const status=kind==='settlements'?'completed':options.status ?? 'all';
 if(!['all','running','reviewing','completed','terminated'].includes(status)) throw new Error('INVALID_STATUS');
 const key=JSON.stringify([kind,status,options.search ?? '',options.date ?? '',options.status ?? '']);
 const record=kind==='settlements'?view.ledger.settlementRecord:view.ledger.orderRecord;
 if(kind==='settlements' && !options.search && !options.date && (!options.status || ['全部','已入账'].includes(options.status))) {
   const indexes=settledIndexes(view);
   return {version:view.version,total:indexes.length,rows:indexes.slice(offset,offset+limit).map(record)};
 }
 if(!view.lists.has(key)) {
   let indexes=view.ledger.executionIndexes(status==='all'?undefined:status);
   if(kind==='orders' && options.search) {
     const search=String(options.search).toLowerCase();
     const matching=new Set(view.ledger.tasks.filter(task=>`${task.id} ${task.title}`.toLowerCase().includes(search)).map(task=>Number(task.id.split(':')[2])));
     indexes=indexes.filter(index=>matching.has((view.ledger.consumerRows.get(index)?Number(view.ledger.consumerRows.get(index).taskId.split(":")[2]):taskForOrder(index))));
   }
   const times=new Float64Array((view.ledger.orders ?? view.dashboard.overview.orders)+1),extraTimes=new Map();
   const timeFor=index=>index<times.length?times[index]:extraTimes.get(index);
   for(const index of indexes) {
     if(index<times.length) times[index]=view.ledger.recordTime(index,kind);else extraTimes.set(index,view.ledger.recordTime(index,kind));
   }
   if((kind!=='orders' && options.search) || options.date || (kind==='settlements' && options.status && options.status!=='全部'))
     indexes=indexes.filter(index=>filterRecords(kind,[record(index)],options).length);
   indexes.sort((a,b)=>timeFor(b)-timeFor(a) || (kind==='orders' && taskForOrder(a)!==taskForOrder(b) ? String(taskForOrder(a)).localeCompare(String(taskForOrder(b))) : String(a).localeCompare(String(b))));
   view.lists.set(key,indexes);
 }
 const indexes=view.lists.get(key);
 return {version:view.version,total:indexes.length,rows:indexes.slice(offset,offset+limit).map(record)};
}
