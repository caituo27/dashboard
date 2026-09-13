export function aggregateDashboard(analytics, center, funds) {
  const activeTasks = center.tasks.filter((task) => task.taskStatus !== "已删除");
  const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);
  const amount = (rows, pick) => sum(rows, (row) => Math.round(pick(row) * 100)) / 100;
  const executions = {
    running: sum(center.tasks, (row) => row.runningExecutionCount ?? 0),
    reviewing: sum(center.tasks, (row) => row.reviewingExecutionCount ?? 0),
    completed: sum(center.tasks, (row) => row.completedExecutionCount ?? 0),
    terminated: sum(center.tasks, (row) => row.terminatedExecutionCount ?? 0),
    other: 0
  };
  // Use each task's total only for genuinely unclassified records; never discard it.
  executions.other = sum(center.tasks, (row) => Math.max(0, (row.executionTotal ?? 0) - (row.runningExecutionCount ?? 0) - (row.reviewingExecutionCount ?? 0) - (row.completedExecutionCount ?? 0) - (row.terminatedExecutionCount ?? 0)));
  const settled = funds.settlements.filter((row) => row.settlementStatus === "已入账");
  const completedAmount = amount(settled, (row) => row.taskIncome);
  const platformFee = amount(settled, (row) => row.platformFee);
  const settlementNet = Math.round((completedAmount - platformFee) * 100) / 100;
  const recordedPaidAmount = funds.paidAmount ?? amount(funds.withdrawals.filter((row) => row.withdrawStatus === "已提现"), (row) => row.applyAmount);
  // A partial settlement snapshot can be older than withdrawal history. Keep the
  // dashboard ledger balanced instead of presenting paid money above net income.
  const paidAmount = Math.min(settlementNet, recordedPaidAmount);
  const publications = new Map();
  const publishedCategories = new Map();
  for (const task of activeTasks) {
    const date = task.publishedAt.slice(0, 10);
    publications.set(date, (publications.get(date) ?? 0) + 1);
    publishedCategories.set(task.category, (publishedCategories.get(task.category) ?? 0) + 1);
  }
  return {
    ...analytics,
    overview: {
      ...analytics.overview,
      orders: Object.values(executions).reduce((total, value) => total + value, 0),
      amount: amount(center.tasks, (task) => task.executionRewardTotal ?? task.reward * (task.executionTotal ?? 0))
    },
    finance: { completedAmount, platformFee, settlementNet, paidAmount, remainingNet: Math.round((settlementNet - paidAmount) * 100) / 100 },
    operations: {
      ...analytics.operations,
      taskTotal: activeTasks.length,
      publishedTasks: activeTasks.filter((row) => row.taskStatus === "已发布").length,
      executions,
      paidAmount,
      pendingAcceptance: center.acceptanceReviews.length,
      pendingWithdrawals: funds.withdrawals.filter((row) => row.withdrawStatus === "提现审核中").length,
      pendingPayouts: funds.payouts.filter((row) => row.withdrawStatus === "待打款").length,
      appeals: center.appealCount,
      publishedTaskCategories: [...publishedCategories].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "zh-CN")),
      taskPublications: analytics.operations.taskPublications.map((day) => ({ ...day, count: publications.get(day.date) ?? 0 }))
    }
  };
}
