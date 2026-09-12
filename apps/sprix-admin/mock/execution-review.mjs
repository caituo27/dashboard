// Review findings are distinct from delivery status; neutral messages are not issues.
export function executionReview(task, status, reason = '') {
  if(task.submissionRows===null && status!=='terminated') return {currentNode:status==='running'?'任务执行':'交付内容待补充',acceptanceSummary:`“${task.title}”的要求已调整，尚无与此版本对应的交付内容。`,acceptanceIssues:'',acceptanceFailureReasons:'',acceptanceImprovementSuggestions:''};
  const items=task.submissionRows?.map(row=>row[0]) ?? [];
  const coverage=items.length
    ? `提交 ${items.length} 项：${items.join('、')}。\n\n交付内容摘录：\n${task.submissionRows.slice(0,3).map(([title,body])=>`• ${title}：${body}`).join('\n')}${items.length>3 ? '\n其余条目见交付附件。' : ''}`
    : `交付范围：${task.deliverables}。`;
  const acceptanceIssues=status==='terminated' ? (reason || '本次交付未通过验收，未记录具体原因。') : '';
  return {
    currentNode:({running:'任务执行',reviewing:'平台验收',completed:'已结算',terminated:'已终止'})[status],
    acceptanceSummary: status==='running' ? `正在处理“${task.title}”，尚未提交交付结果。`
      : status==='reviewing' ? `“${task.title}”已提交，待平台验收。当前尚无平台质量结论，问题和建议为空不代表验收通过。\n\n${coverage}\n\n待核验标准：${task.acceptanceCriteria || '按任务要求核对交付内容。'}`
      : status==='completed' ? `“${task.title}”已通过验收。\n\n${coverage}\n\n验收范围：${task.acceptanceCriteria || '任务约定的交付要求。'}\n此结果仅对应交付内容，不代表已验证实际业务效果。`
      : `“${task.title}”的执行已终止。${acceptanceIssues}`,
    acceptanceIssues,
    acceptanceFailureReasons:acceptanceIssues,
    acceptanceImprovementSuggestions:status==='terminated' ? (reason ? `请针对“${reason}”核对交付内容，并按任务验收标准补充说明。` : '请先确认具体未通过原因，再核对任务验收标准和提交材料。') : ''
  };
}
