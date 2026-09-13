import {executionReview} from './execution-review.mjs';
import {localAcceptance} from './local-acceptance.mjs';
import {executionDuration,taskScenario} from './business-scenario.mjs';
export const CONSUMER_EXECUTION_BASE=9_000_000_000;
export function consumerExecution(row,task,patch={},now=Date.now()) {
 const elapsed=Math.max(0,now-Date.parse(row.startedAt));
 const duration=executionDuration(row.index,row.category ?? task.category ?? taskScenario(Number(row.taskId.split(':')[2])).category);
 const status=patch.status ?? (elapsed>=duration?'reviewing':'running');
 const submittedAt=new Date(Date.parse(row.startedAt)+duration).toISOString();
 const localReview=localAcceptance(row.index,task,status,92,patch.reason);
 const review=executionReview(task,status,patch.reason);
 return {executionIndex:row.index,executionId:`demo:execution:${row.index}`,taskId:task.id,taskTitle:task.title,taskCategory:task.category,
  userId:`demo:consumer:${row.owner}`,userName:row.userName,phone:row.phone,virtualPhone:row.virtualPhone,userSpecialty:row.userSpecialty,agentId:row.agentId,agentName:row.agentName,
  status,startedAt:row.startedAt,submittedAt:status==='running'?undefined:submittedAt,completedAt:status==='completed'?patch.completedAt ?? submittedAt:undefined,terminatedAt:status==='terminated'?patch.terminatedAt ?? patch.completedAt ?? submittedAt:undefined,
  agentScore:'92',score:String(localReview?.score??92),acceptanceScore:String(localReview?.score??92),
  acceptanceStatus:status==='reviewing'?'待平台验收':status==='completed'?'验收通过':status==='terminated'?'验收未通过':'执行中',
  taskExecutionStatus:({running:'RUNNING',reviewing:'PLATFORM_REVIEWING',completed:'SETTLED',terminated:'TERMINATED'})[status],settlementStatusCode:status==='completed'?'POSTED':'NOT_POSTED',currentNodeCode:status==='reviewing'?'platform_reviewing':status,mappedBusinessStatus:status==='terminated'?'terminated':'platform_review_pending',localAcceptance:localReview,
  ...review,currentNode:status==='reviewing'?'平台验收':review.currentNode,progress:status==='running'?`已完成 ${Math.min(99,Math.floor(elapsed/duration*100))}%`:status==='terminated'?'执行已终止':'100%',acceptanceSummary:localReview?.summary??review.acceptanceSummary,acceptanceIssues:localReview?.issues.join('；')??review.acceptanceIssues,acceptanceFailureReasons:localReview?.failureReasons??[],acceptanceImprovementSuggestions:localReview?.improvementSuggestions??[],terminationReason:patch.reason ?? '',
  settlementStatus:status==='completed'?'已入账':'未入账',appealStatus:'无申诉'};
}
export function consumerMyTask(row) {
 return {id:row.executionId,taskId:row.taskId,title:row.taskTitle,category:row.taskCategory,reward:row.reward,
  status:{running:'执行中',reviewing:'待平台审核',completed:'已结算',terminated:'验收未通过'}[row.status],
  agentId:row.agentId,agentName:row.agentName,startedAt:row.startedAt,completedAt:row.status==='completed'?row.completedAt:undefined,
  currentNode:row.currentNode,progress:row.progress,score:row.score,appealStatus:row.appealStatus,settlementStatus:row.settlementStatus};
}
