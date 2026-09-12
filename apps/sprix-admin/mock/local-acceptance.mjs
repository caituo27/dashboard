import {hash} from './business-scenario.mjs';

const clampScore = value => Math.max(0,Math.min(100,Math.round(value)));

export function localAcceptance(index,task,status,baseScore,reason='') {
  if(status==='running') return null;
  const failed=task.submissionRows===null||status==='terminated'||(status==='reviewing'&&hash(index,83)%5===0);
  const score=failed?58+hash(index,84)%12:clampScore(Number(baseScore));
  const focus=task.submissionRows?.at(-1)?.[0]??task.deliverables??'任务验收要求';
  const mildIssue=!failed?`“${focus}”的来源位置可以进一步细化，当前不影响交付使用。`:'';
  const failureReason=reason||(task.submissionRows===null?'任务要求调整后，当前交付内容与最新版本不匹配。':`交付内容未完整说明“${focus}”的核对依据。`);
  const suggestion=`补充“${focus}”对应的来源、验证过程和结论后重新提交。`;
  const scores={
    overall:score,
    accuracy:clampScore(score+(hash(index,86)%7)-3),
    completeness:clampScore(score+(failed?-5:(hash(index,87)%5)-2)),
    deliverability:clampScore(score+(hash(index,88)%7)-3),
    standardization:clampScore(score+(hash(index,89)%5)-2)
  };
  const issues=failed?[failureReason]:(mildIssue?[mildIssue]:[]);
  const failureReasons=failed?[failureReason]:[];
  const improvementSuggestions=failed?[suggestion]:(mildIssue?[`在交付明细中补充“${focus}”的具体来源位置，便于平台复核。`]:[]);
  return {
    status:failed?'failed':'passed',
    acceptanceStatus:failed?'failed':'passed',
    score,
    scores,
    summary:failed
      ? `本地验收未通过：${failureReason}`
      : `本地验收已通过，交付内容覆盖任务要求，现提交平台复核。`,
    issues,
    failureReasons,
    improvementSuggestions
  };
}
