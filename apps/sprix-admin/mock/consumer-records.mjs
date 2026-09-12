import {executionDuration,taskScenario} from './business-scenario.mjs';
export const CONSUMER_EXECUTION_BASE=9_000_000_000;
export function consumerExecution(row,task,patch={},now=Date.now()) {
 const elapsed=Math.max(0,now-Date.parse(row.startedAt));
 const duration=executionDuration(row.index,row.category ?? task.category ?? taskScenario(Number(row.taskId.split(':')[2])).category);
 const status=patch.status ?? (elapsed>=duration?'reviewing':'running');
 const submittedAt=new Date(Date.parse(row.startedAt)+duration).toISOString();
 return {executionIndex:row.index,executionId:`demo:execution:${row.index}`,taskId:task.id,taskTitle:task.title,taskCategory:task.category,
  userId:`demo:consumer:${row.owner}`,userName:row.userName,phone:row.phone,agentId:row.agentId,agentName:row.agentName,
  status,startedAt:row.startedAt,submittedAt:status==='running'?undefined:submittedAt,completedAt:status==='completed'?patch.completedAt ?? submittedAt:undefined,terminatedAt:status==='terminated'?patch.terminatedAt ?? patch.completedAt ?? submittedAt:undefined,
  agentScore:'92',score:'92',acceptanceScore:'92',currentNode:status==='running'?'执行中':'交付检查',
  progress:status==='running'?`已完成 ${Math.min(99,Math.floor(elapsed/duration*100))}%`:'已完成交付',
  acceptanceStatus:status==='reviewing'?'待平台验收':status==='completed'?'验收通过':status==='terminated'?'验收未通过':'执行中',
  acceptanceSummary:`已提交${task.deliverables}`,acceptanceIssues:'未发现格式问题',terminationReason:patch.reason ?? '',
  settlementStatus:status==='completed'?'已入账':'未入账',appealStatus:'无申诉'};
}
export function consumerMyTask(row) {
 return {id:row.executionId,taskId:row.taskId,title:row.taskTitle,category:row.taskCategory,reward:row.reward,
  status:{running:'执行中',reviewing:'待平台审核',completed:'已结算',terminated:'验收未通过'}[row.status],
  agentId:row.agentId,agentName:row.agentName,startedAt:row.startedAt,completedAt:row.status==='completed'?row.completedAt:undefined,
  currentNode:row.currentNode,progress:row.progress,score:row.score,appealStatus:row.appealStatus,settlementStatus:row.settlementStatus};
}
