import { createMockState, nowText } from "../data/mock";
import type { AdminAppeal, FundFlow, MyTask, Settlement, SprixState, Withdrawal } from "../types";

export function createInitialSprixState(): SprixState {
  return createMockState();
}

function clone(state: SprixState): SprixState {
  return JSON.parse(JSON.stringify(state)) as SprixState;
}

function nextId(prefix: string, count: number) {
  return `${prefix}${String(count + 1).padStart(5, "0")}`;
}

export function logIn(state: SprixState): SprixState {
  const next = clone(state);
  next.account.isLoggedIn = true;
  return next;
}

export function logOut(state: SprixState): SprixState {
  const next = clone(state);
  next.account.isLoggedIn = false;
  return next;
}

export function completeQualification(state: SprixState): SprixState {
  const next = clone(state);
  next.account.qualificationStatus = "已开通";
  next.account.realPersonVerified = true;
  next.account.freelancerAgreementSigned = true;
  next.signedAgreements = Array.from(new Set([...next.signedAgreements, "自由职业者服务框架协议"]));
  return next;
}

export function bindAlipay(state: SprixState, account = "xia***@alipay.com"): SprixState {
  const next = clone(state);
  next.account.alipayBound = true;
  next.account.alipayAccountMasked = account;
  next.account.alipayRealNameMatched = true;
  next.account.withdrawAccountStatus = "可用";
  return next;
}

export function connectAgent(state: SprixState, agentId: string): SprixState {
  const next = clone(state);
  const hasCurrent = next.agents.some((agent) => agent.role === "当前执行 Agent" && agent.status === "已连接");
  next.agents = next.agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    return {
      ...agent,
      status: "已连接",
      role: hasCurrent ? "已连接 Agent" : "当前执行 Agent",
      score: agent.score ?? 90,
      lastEvaluatedAt: nowText,
      tags: agent.tags.length ? agent.tags : ["数据处理", "流程执行", "质量自检"],
      profile: agent.profile ?? { requirement: 84, stability: 85, delivery: 88, quality: 86 }
    };
  });
  return next;
}

export function setCurrentAgent(state: SprixState, agentId: string): SprixState {
  const next = clone(state);
  next.agents = next.agents.map((agent) => {
    if (agent.id === agentId && agent.status === "已连接") {
      return { ...agent, role: "当前执行 Agent" };
    }
    if (agent.role === "当前执行 Agent") {
      return { ...agent, role: agent.status === "已连接" ? "已连接 Agent" : "曾连接 Agent" };
    }
    return agent;
  });
  return next;
}

export function disconnectAgent(state: SprixState, agentId: string): SprixState {
  const next = clone(state);
  next.agents = next.agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    return {
      ...agent,
      status: "已断开",
      role: agent.role === "当前执行 Agent" ? "曾连接 Agent" : "曾连接 Agent"
    };
  });
  return next;
}

export function acceptTask(state: SprixState, taskId: string): SprixState {
  const next = clone(state);
  const task = next.tasks.find((item) => item.id === taskId);
  const currentAgent = next.agents.find((agent) => agent.role === "当前执行 Agent" && agent.status === "已连接");
  if (!task || !currentAgent || task.taskStatus !== "已发布" || task.remainingSlots <= 0) return next;

  task.remainingSlots -= 1;
  if (task.remainingSlots === 0) {
    task.taskStatus = "已下线";
    task.offlineReason = "名额已满";
  }

  const record: MyTask = {
    id: nextId("exec-", next.myTasks.length),
    taskId: task.id,
    title: task.title,
    category: task.category,
    reward: task.reward,
    status: "执行中",
    agentId: currentAgent.id,
    agentName: currentAgent.name,
    startedAt: nowText,
    currentNode: "生成结果",
    progress: "65%",
    settlementStatus: "未入账"
  };
  next.myTasks.unshift(record);

  const executions = (next.adminExecutionRecords[task.id] ??= {
    running: [],
    terminated: [],
    completed: []
  });
  executions.running.unshift({
    userName: next.account.nickname,
    phone: next.account.phone,
    agentName: currentAgent.name,
    agentScore: `${currentAgent.score ?? 90}/100`,
    currentNode: "生成结果",
    progress: "65%",
    startedAt: nowText
  });
  return next;
}

export function terminateTask(state: SprixState, executionId: string): SprixState {
  const next = clone(state);
  const record = next.myTasks.find((item) => item.id === executionId);
  if (record) {
    record.status = "已终止";
    record.currentNode = "执行终止";
    record.progress = "100%";
  }
  return next;
}

export function submitAppeal(state: SprixState, executionId: string, reason: string): SprixState {
  const next = clone(state);
  const record = next.myTasks.find((item) => item.id === executionId);
  if (!record || record.status !== "验收未通过" || record.appealStatus === "申诉不通过") return next;
  const appealNo = `AP20260623${String(next.adminAppeals.length + 1).padStart(3, "0")}`;
  record.appealStatus = "申诉处理中";
  record.appealNo = appealNo;
  const appeal: AdminAppeal = {
    appealNo,
    taskTitle: record.title,
    taskCategory: record.category,
    userName: next.account.nickname,
    userPhone: next.account.phone,
    agentName: record.agentName,
    issueSummary: reason.slice(0, 32),
    appealReason: reason,
    appealStatus: "待处理",
    priority: "普通",
    submittedAt: nowText,
    handler: "-",
    expectedProcessTime: "1-3 个工作日",
    originalScore: record.score ?? "72/100",
    originalRejectReason: record.rejectReason ?? "验收结果未通过",
    linkedMyTaskId: record.id,
    processLogs: ["用户提交申诉，等待平台处理"]
  };
  next.adminAppeals.unshift(appeal);
  return next;
}

export function startAppeal(state: SprixState, appealNo: string): SprixState {
  const next = clone(state);
  const appeal = next.adminAppeals.find((item) => item.appealNo === appealNo);
  if (appeal) {
    appeal.appealStatus = "处理中";
    appeal.handler = "平台运营管理员";
    appeal.processLogs.unshift("平台运营管理员开始处理");
  }
  return next;
}

export function passAppeal(state: SprixState, appealNo: string): SprixState {
  const next = clone(state);
  const appeal = next.adminAppeals.find((item) => item.appealNo === appealNo);
  if (!appeal) return next;
  appeal.appealStatus = "申诉通过";
  appeal.handler = "平台运营管理员";
  appeal.resultDescription = "复核后确认交付符合标准，任务进入结算中。";
  appeal.processLogs.unshift("申诉通过，任务进入结算中");

  const linkedTask = next.myTasks.find((item) => item.id === appeal.linkedMyTaskId || item.appealNo === appealNo);
  if (linkedTask) {
    linkedTask.status = "结算中";
    linkedTask.appealStatus = "申诉通过";
    linkedTask.settlementStatus = "结算中";
  }

  const settlement: Settlement = {
    settlementNo: nextId("ST20260623", next.settlements.length),
    taskTitle: appeal.taskTitle,
    userName: appeal.userName,
    userPhone: appeal.userPhone,
    agentName: appeal.agentName,
    taskIncome: linkedTask?.reward ?? 180,
    platformFee: Math.round((linkedTask?.reward ?? 180) * 0.1),
    netIncome: Math.round((linkedTask?.reward ?? 180) * 0.9),
    settlementStatus: "结算中",
    createdAt: nowText,
    paidAt: "-",
    sourceAppealNo: appealNo
  };
  next.settlements.unshift(settlement);
  return next;
}

export function rejectAppeal(state: SprixState, appealNo: string): SprixState {
  const next = clone(state);
  const appeal = next.adminAppeals.find((item) => item.appealNo === appealNo);
  if (!appeal) return next;
  appeal.appealStatus = "申诉不通过";
  appeal.handler = "平台运营管理员";
  appeal.resultDescription = "复核后维持原验收结论。";
  const linkedTask = next.myTasks.find((item) => item.id === appeal.linkedMyTaskId || item.appealNo === appealNo);
  if (linkedTask) linkedTask.appealStatus = "申诉不通过";
  return next;
}

export function submitWithdrawal(state: SprixState, amount: number): SprixState {
  const next = clone(state);
  const safeAmount = Math.max(0, Math.min(amount, next.account.withdrawableAmount));
  if (safeAmount <= 0) return next;
  const withdrawalNo = nextId("WD20260623", next.withdrawals.length);
  const withdrawal: Withdrawal = {
    withdrawalNo,
    userName: next.account.nickname,
    userPhone: next.account.phone,
    verifiedName: "齐**",
    alipayAccount: next.account.alipayAccountMasked || "xia***@alipay.com",
    realNameMatchStatus: "已通过",
    withdrawableBalance: next.account.withdrawableAmount,
    applyAmount: safeAmount,
    estimatedArrivalTime: "1-3 个工作日",
    appliedAt: nowText,
    withdrawStatus: "提现审核中",
    reviewer: "-"
  };
  const flow: FundFlow = {
    flowNo: nextId("FL20260623", next.fundFlows.length),
    flowType: "提现申请处理中",
    userName: next.account.nickname,
    taskTitle: "-",
    withdrawalNo,
    amount: -safeAmount,
    beforeStatus: "可提现",
    afterStatus: "提现审核中",
    operator: "系统",
    occurredAt: nowText,
    remark: "用户提交提现申请，等待平台审核。"
  };
  next.withdrawals.unshift(withdrawal);
  next.fundFlows.unshift(flow);
  next.account.withdrawableAmount -= safeAmount;
  return next;
}

export function approveWithdrawal(state: SprixState, withdrawalNo: string): SprixState {
  const next = clone(state);
  const withdrawal = next.withdrawals.find((item) => item.withdrawalNo === withdrawalNo);
  if (withdrawal) {
    withdrawal.withdrawStatus = "待打款";
    withdrawal.reviewer = "平台运营管理员";
    next.payouts.unshift({
      withdrawalNo,
      userName: withdrawal.userName,
      userPhone: withdrawal.userPhone,
      alipayAccount: withdrawal.alipayAccount,
      payoutAmount: withdrawal.applyAmount,
      estimatedArrivalTime: withdrawal.estimatedArrivalTime,
      approvedAt: nowText,
      withdrawStatus: "待打款"
    });
  }
  return next;
}

export function markPayoutSuccess(state: SprixState, withdrawalNo: string): SprixState {
  const next = clone(state);
  const payout = next.payouts.find((item) => item.withdrawalNo === withdrawalNo);
  const withdrawal = next.withdrawals.find((item) => item.withdrawalNo === withdrawalNo);
  if (payout) payout.withdrawStatus = "已提现";
  if (withdrawal) withdrawal.withdrawStatus = "已提现";
  return next;
}
