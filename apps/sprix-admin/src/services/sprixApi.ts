import {
  AdminAppealControllerApiFactory,
  AdminFundsControllerApiFactory,
  AdminTaskControllerApiFactory,
  AuthControllerApiFactory,
  type AppealRecord,
  type AuthTokenResponse,
  type FundFlow as ApiFundFlow,
  type SettlementRecord,
  type TaskEntity,
  type TaskExecution,
  type WithdrawalRecord
} from "../apis/sprix";
import type {
  AdminAppeal,
  AdminExecutionRecords,
  AppealStatus,
  CompletedExecution,
  FundException,
  FundFlow,
  Payout,
  RunningExecution,
  Settlement,
  SettlementStatus,
  Task,
  TaskStatus,
  TerminatedExecution,
  Withdrawal,
  WithdrawStatus
} from "../types";
import type { SprixRemoteStatePatch } from "../store/sprixStore";
import { http } from "../utils/http";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/sprix-api";
const TOKEN_KEY = "sprix-admin-auth-token";

const adminAppealApi = AdminAppealControllerApiFactory(undefined, API_BASE_URL, http);
const adminFundsApi = AdminFundsControllerApiFactory(undefined, API_BASE_URL, http);
const adminTaskApi = AdminTaskControllerApiFactory(undefined, API_BASE_URL, http);
const authApi = AuthControllerApiFactory(undefined, API_BASE_URL, http);

export async function authenticateAdmin(identity = "admin@sprix.ai", code = "123456") {
  const response = await authApi.mockAdminLogin({ mockLoginRequest: { email: identity, code } });
  const token = requireValue<AuthTokenResponse>(response, "后台登录失败").token;
  localStorage.setItem(TOKEN_KEY, token ?? "");
  return token;
}

export async function readAdminSnapshot(): Promise<SprixRemoteStatePatch> {
  if (!localStorage.getItem(TOKEN_KEY)) {
    await authenticateAdmin();
  }

  const [tasksResponse, appealsResponse, settlementsResponse, withdrawalsResponse, flowsResponse] = await Promise.all([
    adminTaskApi.tasks(),
    adminAppealApi.appeals(),
    adminFundsApi.settlements(),
    adminFundsApi.withdrawals(),
    adminFundsApi.flows()
  ]);

  const tasks = listValue<TaskEntity>(tasksResponse).map(mapTask);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const executionLists = await Promise.all(
    tasks.map(async (task) => {
      const response = await adminTaskApi.executions({ taskId: task.id });
      return [task.id, listValue<TaskExecution>(response)] as const;
    })
  );
  const adminExecutionRecords = Object.fromEntries(executionLists.map(([taskId, records]) => [taskId, mapExecutionRecords(records, taskById)])) as AdminExecutionRecords;
  const settlements = listValue<SettlementRecord>(settlementsResponse).map((item) => mapSettlement(item, taskById));
  const withdrawals = listValue<WithdrawalRecord>(withdrawalsResponse).map(mapWithdrawal);
  const fundFlows = listValue<ApiFundFlow>(flowsResponse).map((item) => mapFundFlow(item, taskById));

  return {
    tasks,
    adminExecutionRecords,
    adminAppeals: listValue<AppealRecord>(appealsResponse).map((item) => mapAppeal(item, taskById)),
    settlements,
    withdrawals,
    payouts: mapPayouts(withdrawals),
    fundExceptions: mapFundExceptions(withdrawals),
    fundFlows,
    account: {
      isLoggedIn: true,
      nickname: "Platform Operator",
      email: "ops@sprix.ai",
      qualificationStatus: "已开通"
    }
  };
}

export async function startRemoteAppeal(appealId: string) {
  return adminAppealApi.start({ appealId });
}

export async function approveRemoteAppeal(appealId: string) {
  return adminAppealApi.approve({ appealId });
}

export async function rejectRemoteAppeal(appealId: string) {
  return adminAppealApi.reject({ appealId });
}

export async function approveRemoteWithdrawal(withdrawalId: string) {
  return adminFundsApi.approveWithdrawal({ withdrawalId });
}

export async function rejectRemoteWithdrawal(withdrawalId: string, reason: string) {
  return http.post<WithdrawalRecord>(`/api/v1/admin/funds/withdrawals/${encodeURIComponent(withdrawalId)}/reject`, { reason });
}

export async function markRemoteWithdrawalPaid(withdrawalId: string) {
  return adminFundsApi.markWithdrawalPaid({ withdrawalId });
}

export async function markRemoteWithdrawalPayoutFailed(withdrawalId: string) {
  return adminFundsApi.markWithdrawalPayoutFailed({ withdrawalId });
}

export async function returnRemoteWithdrawalForReview(withdrawalId: string, reason: string) {
  return http.post<WithdrawalRecord>(`/api/v1/admin/funds/withdrawals/${encodeURIComponent(withdrawalId)}/return-review`, { reason });
}

export async function markRemotePayoutExceptionHandled(withdrawalId: string, reason: string) {
  return http.post<WithdrawalRecord>(`/api/v1/admin/funds/withdrawals/${encodeURIComponent(withdrawalId)}/exception-handled`, { reason });
}

function requireValue<T>(value: T | undefined, fallbackMessage: string): T {
  if (value == null) throw new Error(fallbackMessage);
  return value;
}

function listValue<T>(value: T[] | undefined): T[] {
  return value ?? [];
}

function mapTask(task: TaskEntity): Task {
  const description = task.description ?? "";
  return {
    id: task.id ?? "",
    title: task.title ?? "未命名任务",
    category: task.category ?? "未分类",
    sourceName: task.sourceName ?? "Sprix AI Platform",
    sourceType: mapSourceType(task.sourceType),
    description,
    cardSummary: description.slice(0, 86),
    deliverables: task.deliverables ?? "按任务要求提交结构化交付物。",
    acceptanceCriteria: task.acceptanceCriteria ?? "平台按任务验收标准进行复核。",
    reward: task.reward ?? 0,
    totalSlots: task.totalSlots ?? 0,
    remainingSlots: task.remainingSlots ?? 0,
    publishedAt: formatDateTime(task.publishedAt ?? task.createdAt),
    taskStatus: mapTaskStatus(task.status),
    offlineReason: task.offlineReason === "FULL" ? "名额已满" : task.offlineReason ? "手动下线" : "",
    agentMatchScore: 92,
    recommendedTaskType: task.category ?? "通用任务",
    suggestedTeam: "Codex Agent + DataFlow Agent",
    matchAnalysis: "后端任务已同步，当前 Agent 将按任务描述、交付标准与验收标准执行。",
    riskPrompt: "请保留来源、证据和异常说明，便于平台复核。",
    recommendedReason: "任务来自真实后端，交付边界清晰。",
    submittedFiles: [],
    resultFiles: [],
    acceptanceResult: "平台将根据真实执行结果返回验收状态。"
  };
}

function mapExecutionRecords(records: TaskExecution[], taskById: Map<string, Task>): AdminExecutionRecords[string] {
  const running: RunningExecution[] = [];
  const terminated: TerminatedExecution[] = [];
  const completed: CompletedExecution[] = [];

  for (const record of records) {
    const task = taskById.get(record.taskId ?? "");
    const userName = compactId(record.userId, "用户");
    const agentName = compactId(record.agentId, "Agent");
    if (record.status === "TERMINATED") {
      terminated.push({
        userName,
        phone: "-",
        agentName,
        terminationReason: record.terminationReason ?? "执行终止",
        terminatedNode: mapCurrentNode(record.currentNode),
        terminatedAt: formatDateTime(record.completedAt ?? record.updatedAt)
      });
    } else if (record.status === "RUNNING") {
      running.push({
        userName,
        phone: "-",
        agentName,
        agentScore: "-",
        currentNode: mapCurrentNode(record.currentNode),
        progress: record.progress ?? "0%",
        startedAt: formatDateTime(record.startedAt ?? record.createdAt)
      });
    } else {
      completed.push({
        userName,
        phone: "-",
        agentName,
        acceptanceStatus: record.status === "ACCEPTANCE_FAILED" ? "验收未通过" : "验收通过",
        score: record.status === "ACCEPTANCE_FAILED" ? "72/100" : "91/100",
        appealStatus: mapAppealStatus(record.appealStatus),
        settlementStatus: mapSettlementStatus(record.settlementStatus),
        completedAt: formatDateTime(record.completedAt ?? record.updatedAt ?? task?.publishedAt)
      });
    }
  }

  return { running, terminated, completed };
}

function mapAppeal(appeal: AppealRecord, taskById: Map<string, Task>): AdminAppeal {
  const task = taskById.get(appeal.taskId ?? "");
  return {
    backendId: appeal.id,
    appealNo: appeal.appealNo ?? appeal.id ?? "",
    taskTitle: task?.title ?? compactId(appeal.taskId, "任务"),
    taskCategory: task?.category ?? "未分类",
    userName: compactId(appeal.userId, "用户"),
    userPhone: "-",
    agentName: compactId(appeal.agentId, "Agent"),
    issueSummary: (appeal.reason ?? "用户提交申诉").slice(0, 32),
    appealReason: appeal.reason ?? "用户提交申诉",
    appealStatus: mapAppealStatus(appeal.status),
    priority: appeal.priority === "HIGH" ? "高风险" : appeal.priority === "URGENT" ? "加急" : "普通",
    submittedAt: formatDateTime(appeal.submittedAt ?? appeal.createdAt),
    handler: appeal.handler ?? "-",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "72/100",
    originalRejectReason: "平台验收未通过",
    resultDescription: appeal.resultDescription,
    linkedMyTaskId: appeal.executionId,
    processLogs: [appeal.resultDescription ?? "后端申诉记录已同步"]
  };
}

function mapSettlement(settlement: SettlementRecord, taskById: Map<string, Task>): Settlement {
  const task = taskById.get(settlement.taskId ?? "");
  return {
    settlementNo: settlement.settlementNo ?? settlement.id ?? "",
    taskTitle: task?.title ?? compactId(settlement.taskId, "任务"),
    userName: compactId(settlement.userId, "用户"),
    userPhone: "-",
    agentName: compactId(settlement.agentId, "Agent"),
    taskIncome: settlement.taskIncome ?? 0,
    platformFee: settlement.platformFee ?? 0,
    netIncome: settlement.netIncome ?? 0,
    settlementStatus: mapSettlementStatus(settlement.status),
    createdAt: formatDateTime(settlement.createdAtBusiness ?? settlement.createdAt),
    paidAt: settlement.paidAt ? formatDateTime(settlement.paidAt) : "-",
    sourceAppealNo: settlement.executionId
  };
}

function mapWithdrawal(withdrawal: WithdrawalRecord): Withdrawal {
  return {
    backendId: withdrawal.id,
    withdrawalNo: withdrawal.withdrawalNo ?? withdrawal.id ?? "",
    userName: compactId(withdrawal.userId, "用户"),
    userPhone: "-",
    verifiedName: "已实名用户",
    alipayAccount: withdrawal.alipayAccount ?? "-",
    realNameMatchStatus: withdrawal.realNameMatchStatus === "PASSED" ? "已通过" : "未通过",
    withdrawableBalance: withdrawal.amount ?? 0,
    applyAmount: withdrawal.amount ?? 0,
    estimatedArrivalTime: withdrawal.estimatedArrivalTime ?? "1-3 个工作日",
    appliedAt: formatDateTime(withdrawal.appliedAt ?? withdrawal.createdAt),
    withdrawStatus: mapWithdrawStatus(withdrawal.status),
    reviewer: withdrawal.reviewer ?? "-"
  };
}

function mapPayouts(withdrawals: Withdrawal[]): Payout[] {
  return withdrawals
    .filter((item) => item.withdrawStatus === "待打款" || item.withdrawStatus === "已提现")
    .map((item) => ({
      backendId: item.backendId,
      withdrawalNo: item.withdrawalNo,
      userName: item.userName,
      userPhone: item.userPhone,
      alipayAccount: item.alipayAccount,
      payoutAmount: item.applyAmount,
      estimatedArrivalTime: item.estimatedArrivalTime,
      approvedAt: item.appliedAt,
      withdrawStatus: item.withdrawStatus
    }));
}

function mapFundExceptions(withdrawals: Withdrawal[]): FundException[] {
  return withdrawals
    .filter((item) => item.withdrawStatus === "打款失败" || item.withdrawStatus === "需更换账户")
    .map((item) => ({
      backendId: item.backendId,
      exceptionNo: `EX-${item.withdrawalNo}`,
      withdrawalNo: item.withdrawalNo,
      userName: item.userName,
      userPhone: item.userPhone,
      alipayAccount: item.alipayAccount,
      exceptionType: "打款失败",
      exceptionAmount: item.applyAmount,
      currentStatus: item.withdrawStatus === "需更换账户" ? "已处理" : item.withdrawStatus,
      occurredAt: item.appliedAt
    }));
}

function mapFundFlow(flow: ApiFundFlow, taskById: Map<string, Task>): FundFlow {
  return {
    flowNo: flow.flowNo ?? flow.id ?? "",
    flowType: mapFlowType(flow.flowType),
    userName: compactId(flow.userId, "用户"),
    taskTitle: taskById.get(flow.taskId ?? "")?.title ?? "-",
    withdrawalNo: flow.withdrawalId ? compactId(flow.withdrawalId, "WD") : "-",
    amount: flow.amount ?? 0,
    beforeStatus: flow.beforeStatus ?? "-",
    afterStatus: flow.afterStatus ?? "-",
    operator: flow.operator ?? "系统",
    occurredAt: formatDateTime(flow.occurredAt ?? flow.createdAt),
    remark: flow.remark ?? ""
  };
}

function mapTaskStatus(status?: string): TaskStatus {
  if (status === "OFFLINE") return "已下线";
  if (status === "DELETED") return "已删除";
  return "已发布";
}

function mapAppealStatus(status?: string): AppealStatus {
  if (status === "NOT_APPEALED") return "未申诉";
  if (status === "PENDING") return "待处理";
  if (status === "PROCESSING") return "处理中";
  if (status === "APPROVED") return "申诉通过";
  if (status === "REJECTED") return "申诉不通过";
  if (status === "NONE") return "无申诉";
  return "待处理";
}

function mapSettlementStatus(status?: string): SettlementStatus {
  if (status === "SETTLING") return "结算中";
  if (status === "POSTED" || status === "SETTLED") return "已入账";
  if (status === "FAILED") return "结算异常";
  return "未入账";
}

function mapWithdrawStatus(status?: string): WithdrawStatus {
  if (status === "PENDING_PAYOUT") return "待打款";
  if (status === "PAID") return "已提现";
  if (status === "PAYOUT_FAILED") return "打款失败";
  if (status === "REJECTED") return "已驳回";
  if (status === "NEED_ACCOUNT_CHANGE" || status === "ACCOUNT_CHANGE_REQUIRED") return "需更换账户";
  return "提现审核中";
}

function mapSourceType(type?: string) {
  if (type === "PLATFORM") return "平台任务";
  if (type === "ENTERPRISE") return "企业协作";
  return type ?? "平台任务";
}

function mapCurrentNode(node?: string) {
  const nodes: Record<string, string> = {
    PLATFORM_ACCEPTANCE: "平台验收",
    SETTLEMENT: "报酬入账",
    GENERATING: "生成结果",
    QUALITY_CHECK: "质量检查"
  };
  return node ? nodes[node] ?? node : "执行中";
}

function mapFlowType(type?: string) {
  const types: Record<string, string> = {
    TASK_SETTLEMENT_INCOME: "任务结算入账",
    WITHDRAWAL_REVIEWING: "提现申请处理中",
    WITHDRAWAL_PAID: "提现打款完成",
    WITHDRAWAL_FAILED: "提现打款失败"
  };
  return type ? types[type] ?? type : "-";
}

function compactId(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  return `${fallback}-${value.slice(-4)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
