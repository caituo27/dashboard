import { sharedAdminRead } from "../services/adminQueryClient";
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { readDashboardAnalyticsMock, type AnalyticsRange } from '../services/dashboardAnalyticsMock';
import { readRemoteTaskCenterSnapshot, readRemoteSettlementFunds } from '../services/sprixApi';
import {readDemoDashboard} from '../services/pagedAdminData';
import {aggregateDashboard} from '../services/dashboardAggregation';
import {compareRecords} from '../../mock/record-order.mjs';
const DAY=86_400_000,CHINA_OFFSET=8*3_600_000;
function millisecondsUntilNextDashboardRefresh(){
 const now=Date.now();
 const next=Math.floor((now+CHINA_OFFSET)/DAY+1)*DAY-CHINA_OFFSET+1_000;
 return next-now;
}
export function useDashboardAnalytics(range:AnalyticsRange){
 return useQuery({queryKey:['sprix-admin','dashboard',range],queryFn:async({signal})=>{
  const [analytics,center,funds,demo]=await Promise.all([readDashboardAnalyticsMock(range,signal),sharedAdminRead('center',readRemoteTaskCenterSnapshot),sharedAdminRead('settlement-funds',readRemoteSettlementFunds),readDemoDashboard()]);
  const live=aggregateDashboard(analytics,center,funds);
  const executions={running:live.operations.executions.running+demo.operations.executions.running,reviewing:live.operations.executions.reviewing+demo.operations.executions.reviewing,completed:live.operations.executions.completed+demo.operations.executions.completed,terminated:live.operations.executions.terminated+demo.operations.executions.terminated,other:(live.operations.executions.other ?? 0)+(demo.operations.executions.other ?? 0)};
  const money=(a:number,b:number)=>Math.round((a+b)*100)/100;
  return {...live,latestTasks:[...live.latestTasks,...demo.latestTasks].sort((a,b)=>compareRecords('tasks',a,b)).slice(0,5),overview:analytics.overview,businessResults:analytics.businessResults,taskOperations:analytics.taskOperations,businessTrends:analytics.businessTrends,agentEcosystem:analytics.agentEcosystem,behaviors:analytics.behaviors,daily:analytics.daily,pv:analytics.pv,uv:analytics.uv,visits:analytics.visits,finance:{completedAmount:money(live.finance.completedAmount,demo.finance.completedAmount),platformFee:money(live.finance.platformFee,demo.finance.platformFee),settlementNet:money(live.finance.settlementNet,demo.finance.settlementNet),paidAmount:money(live.finance.paidAmount,demo.finance.paidAmount),remainingNet:money(live.finance.remainingNet,demo.finance.remainingNet)},operations:{...live.operations,executions,taskTotal:live.operations.taskTotal+demo.operations.taskTotal,publishedTasks:analytics.operations.publishedTasks,publishedTaskCategories:analytics.operations.publishedTaskCategories,paidAmount:money(live.operations.paidAmount,demo.operations.paidAmount),pendingAcceptance:(live.operations.pendingAcceptance ?? 0)+(demo.operations.pendingAcceptance ?? 0),pendingWithdrawals:live.operations.pendingWithdrawals+demo.operations.pendingWithdrawals,pendingPayouts:live.operations.pendingPayouts+demo.operations.pendingPayouts,appeals:live.operations.appeals+demo.operations.appeals,taskPublications:analytics.operations.taskPublications}};
 },placeholderData:keepPreviousData,staleTime:millisecondsUntilNextDashboardRefresh(),refetchInterval:millisecondsUntilNextDashboardRefresh,refetchIntervalInBackground:false,refetchOnWindowFocus:false,refetchOnReconnect:false,retry:1});
}
