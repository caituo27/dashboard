import { sharedAdminRead } from "../services/adminQueryClient";
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readDashboardAnalyticsMock, type AnalyticsPeriod } from '../services/dashboardAnalyticsMock';
import { readRemoteTaskCenterSnapshot, readRemoteSettlementFunds } from '../services/sprixApi';
import {readDemoDashboard} from '../services/pagedAdminData';
import {aggregateDashboard} from '../services/dashboardAggregation';
import {compareRecords} from '../../mock/record-order.mjs';
const DASHBOARD_CUMULATIVE_TOTALS = {orders:1_703_286,agents:30_184,amount:10_027_643.58} as const;
export function useDashboardAnalytics(days:AnalyticsPeriod){
 return useQuery({queryKey:['sprix-admin','dashboard',days],queryFn:async({signal})=>{
  const [analytics,center,funds,demo]=await Promise.all([readDashboardAnalyticsMock(days,signal),sharedAdminRead('center',readRemoteTaskCenterSnapshot),sharedAdminRead('settlement-funds',readRemoteSettlementFunds),readDemoDashboard()]);
  const live=aggregateDashboard(analytics,center,funds);
  const executions={running:live.operations.executions.running+demo.operations.executions.running,reviewing:live.operations.executions.reviewing+demo.operations.executions.reviewing,completed:live.operations.executions.completed+demo.operations.executions.completed,terminated:live.operations.executions.terminated+demo.operations.executions.terminated,other:(live.operations.executions.other ?? 0)+(demo.operations.executions.other ?? 0)};
  const money=(a:number,b:number)=>Math.round((a+b)*100)/100;
  const categoryCounts=new Map<string,number>();
  for(const item of [...live.operations.publishedTaskCategories,...demo.operations.publishedTaskCategories]) categoryCounts.set(item.category,(categoryCounts.get(item.category)??0)+item.count);
  const publishedTaskCategories=[...categoryCounts].map(([category,count])=>({category,count})).sort((a,b)=>b.count-a.count||a.category.localeCompare(b.category,'zh-CN'));
  return {...live,latestTasks:[...live.latestTasks,...demo.latestTasks].sort((a,b)=>compareRecords('tasks',a,b)).slice(0,5),overview:{...live.overview,...DASHBOARD_CUMULATIVE_TOTALS},finance:{completedAmount:money(live.finance.completedAmount,demo.finance.completedAmount),platformFee:money(live.finance.platformFee,demo.finance.platformFee),settlementNet:money(live.finance.settlementNet,demo.finance.settlementNet),paidAmount:money(live.finance.paidAmount,demo.finance.paidAmount),remainingNet:money(live.finance.remainingNet,demo.finance.remainingNet)},operations:{...live.operations,executions,taskTotal:live.operations.taskTotal+demo.operations.taskTotal,publishedTasks:live.operations.publishedTasks+demo.operations.publishedTasks,publishedTaskCategories,paidAmount:money(live.operations.paidAmount,demo.operations.paidAmount),pendingAcceptance:(live.operations.pendingAcceptance ?? 0)+(demo.operations.pendingAcceptance ?? 0),pendingWithdrawals:live.operations.pendingWithdrawals+demo.operations.pendingWithdrawals,pendingPayouts:live.operations.pendingPayouts+demo.operations.pendingPayouts,appeals:live.operations.appeals+demo.operations.appeals,taskPublications:live.operations.taskPublications.map((d,i)=>({...d,count:d.count+(demo.operations.taskPublications[i]?.count ?? 0)}))}};
 },placeholderData:keepPreviousData,staleTime:Infinity,refetchOnWindowFocus:false,refetchOnReconnect:false,retry:1});
}
