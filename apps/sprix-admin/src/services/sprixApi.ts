import {
  AdminAppealControllerApiFactory,
  AdminFundsControllerApiFactory,
  AdminTaskControllerApiFactory,
  type AppealRecord,
  type AuthTokenResponse,
  type FundFlow as ApiFundFlow,
  type SettlementRecord,
  type TaskEntity,
  type WithdrawalRecord
} from "../apis/sprix";
import type {
  AdminAppeal,
  AdminExecutionRecords,
  AdminOperationLog,
  AppealStatus,
  CompletedExecution,
  FundException,
  FundFlow,
  Payout,
  ReviewingExecution,
  RunningExecution,
  Settlement,
  SettlementStatus,
  Task,
  TaskStatus,
  TerminatedExecution,
  Withdrawal,
  WithdrawStatus
} from "../types";
import { http } from "../utils/http";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/sprix-api";
const TOKEN_KEY = "sprix-admin-auth-token";

const adminAppealApi = AdminAppealControllerApiFactory(undefined, API_BASE_URL, http);
const adminFundsApi = AdminFundsControllerApiFactory(undefined, API_BASE_URL, http);
const adminTaskApi = AdminTaskControllerApiFactory(undefined, API_BASE_URL, http);

export type UpsertAdminTaskPayload = {
  title: string;
  category: string;
  sourceType: string;
  description: string;
  deliverables: string;
  acceptanceCriteria: string;
  reward: number;
  totalSlots: number;
};

export type AdminTaskCenterSnapshot = {
  tasks: Task[];
  adminExecutionRecords: AdminExecutionRecords;
  acceptanceReviews: ReviewingExecution[];
  appealCount: number;
};

export type AdminTaskDetailView = {
  task: Task;
  records: AdminExecutionRecords[string];
  operationLogs: AdminOperationLog[];
};

export type AdminFundsSnapshot = {
  settlements: Settlement[];
  withdrawals: Withdrawal[];
  payouts: Payout[];
  fundExceptions: FundException[];
  fundFlows: FundFlow[];
};

type RemoteAdminTaskDetail = {
  task: TaskEntity;
  executions: RemoteAdminExecutionRow[];
  operationLogs?: RemoteAuditLog[];
};

type RemoteAuditLog = {
  id?: string;
  action?: string;
  beforeStatus?: string;
  afterStatus?: string;
  reason?: string;
  createdAt?: string;
};

type RemoteAdminTaskSummary = {
  task: TaskEntity;
  executionTotal?: number;
  runningExecutionCount?: number;
  reviewingExecutionCount?: number;
  completedExecutionCount?: number;
  terminatedExecutionCount?: number;
};

type RemoteAdminExecutionRow = {
  executionId?: string;
  executionIndex?: number;
  userName?: string;
  userPhone?: string;
  agentName?: string;
  agentScore?: number | null;
  executionStatus?: string;
  currentNode?: string;
  progress?: string;
  terminationReason?: string;
  appealStatus?: string;
  settlementStatus?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

type RemoteAcceptanceReviewRow = {
  executionId?: string;
  taskId?: string;
  taskTitle?: string;
  taskCategory?: string;
  userName?: string;
  userPhone?: string;
  agentName?: string;
  agentScore?: number | null;
  acceptanceStatus?: string;
  acceptanceScore?: number | null;
  acceptanceSummary?: string;
  acceptanceIssues?: string;
  currentNode?: string;
  progress?: string;
  submittedAt?: string;
  startedAt?: string;
  updatedAt?: string;
};

type RemoteAdminAppealDetail = {
  appeal: AppealRecord;
  executionId: string;
  executionIndex: number;
  taskTitle: string;
  taskCategory: string;
  taskReward: string;
  deliverables: string;
  acceptanceCriteria: string;
  userName: string;
  userPhone: string;
  agentName: string;
  agentScore?: number | null;
  executionStatus?: string;
  currentNode?: string;
  progress?: string;
  settlementStatus?: string;
};

export async function authenticateAdmin(account: string, password: string) {
  const response = await http.post<unknown, AuthTokenResponse>("/api/v1/auth/admin-login", { account, password });
  const token = requireValue<AuthTokenResponse>(response, "后台登录失败").token;
  localStorage.setItem(TOKEN_KEY, token ?? "");
  return token;
}

export async function logoutAdmin() {
  try {
    await http.post<unknown, boolean>("/api/v1/auth/logout", {});
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function readRemoteTaskCenterSnapshot(): Promise<AdminTaskCenterSnapshot> {
  const [taskSummaries, acceptanceReviews, appealsResponse] = await Promise.all([
    http.get<unknown, RemoteAdminTaskSummary[]>("/api/v1/admin/tasks/summaries"),
    readRemoteAcceptanceReviews(),
    adminAppealApi.appeals()
  ]);
  const tasks = listValue<RemoteAdminTaskSummary>(taskSummaries).map(mapTaskSummary);
  return {
    tasks,
    adminExecutionRecords: {},
    acceptanceReviews,
    appealCount: listValue<AppealRecord>(appealsResponse).length
  };
}

export async function readRemoteTaskDetail(taskId: string): Promise<AdminTaskDetailView> {
  const detail = await http.get<unknown, RemoteAdminTaskDetail>(`/api/v1/admin/tasks/${encodeURIComponent(taskId)}`);
  const task = mapTask(requireObject(detail.task, "task"));
  return {
    task,
    records: mapAdminExecutionRows(listValue<RemoteAdminExecutionRow>(detail.executions)),
    operationLogs: listValue<RemoteAuditLog>(detail.operationLogs).map(mapOperationLog)
  };
}

export async function createRemoteAdminTask(payload: UpsertAdminTaskPayload): Promise<Task> {
  const task = await http.post<unknown, TaskEntity>("/api/v1/admin/tasks", payload);
  return mapTask(requireValue(task, "任务发布失败"));
}

export async function updateRemoteAdminTask(taskId: string, payload: UpsertAdminTaskPayload): Promise<Task> {
  const task = await http.put<unknown, TaskEntity>(`/api/v1/admin/tasks/${encodeURIComponent(taskId)}`, payload);
  return mapTask(requireValue(task, "任务保存失败"));
}

export async function offlineRemoteAdminTask(taskId: string, reason: string): Promise<Task> {
  const task = await http.post<unknown, TaskEntity>(`/api/v1/admin/tasks/${encodeURIComponent(taskId)}/offline`, { reason });
  return mapTask(requireValue(task, "任务下线失败"));
}

export async function republishRemoteAdminTask(taskId: string): Promise<Task> {
  const task = await http.post<unknown, TaskEntity>(`/api/v1/admin/tasks/${encodeURIComponent(taskId)}/republish`);
  return mapTask(requireValue(task, "任务重新发布失败"));
}

export async function deleteRemoteAdminTask(taskId: string, reason: string): Promise<Task> {
  const task = await http.delete<unknown, TaskEntity>(`/api/v1/admin/tasks/${encodeURIComponent(taskId)}`, { data: { reason } });
  return mapTask(requireValue(task, "任务删除失败"));
}

export async function readRemoteAppeals(): Promise<AdminAppeal[]> {
  const appealsResponse = await adminAppealApi.appeals();
  return Promise.all(
    listValue<AppealRecord>(appealsResponse).map((appeal) =>
      readRemoteAppealDetail(requireValue(appeal.id, "申诉记录缺少 id"))
    )
  );
}

export async function readRemoteFunds(): Promise<AdminFundsSnapshot> {
  const [tasksResponse, settlementsResponse, withdrawalsResponse, flowsResponse] = await Promise.all([
    adminTaskApi.tasks(),
    adminFundsApi.settlements(),
    adminFundsApi.withdrawals(),
    adminFundsApi.flows()
  ]);
  const tasks = listValue<TaskEntity>(tasksResponse).map(mapTask);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const settlements = listValue<SettlementRecord>(settlementsResponse).map((item) => mapSettlement(item, taskById));
  const withdrawals = listValue<WithdrawalRecord>(withdrawalsResponse).map(mapWithdrawal);
  return {
    settlements,
    withdrawals,
    payouts: mapPayouts(withdrawals),
    fundExceptions: mapFundExceptions(withdrawals),
    fundFlows: listValue<ApiFundFlow>(flowsResponse).map((item) => mapFundFlow(item, taskById))
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

export async function readRemoteAppealDetail(appealId: string): Promise<AdminAppeal> {
  const detail = await http.get<unknown, RemoteAdminAppealDetail>(`/api/v1/admin/appeals/${encodeURIComponent(appealId)}`);
  return mapAppealDetail(detail);
}

export async function approveRemoteWithdrawal(withdrawalId: string) {
  return adminFundsApi.approveWithdrawal({ withdrawalId });
}

export async function rejectRemoteWithdrawal(withdrawalId: string, reason: string) {
  return adminFundsApi.rejectWithdrawal({ withdrawalId, withdrawalReviewRequest: { reason } });
}

export async function postRemoteSettlement(settlementId: string) {
  return adminFundsApi.postSettlement({ settlementId });
}

export async function markRemoteWithdrawalPaid(withdrawalId: string) {
  return adminFundsApi.markWithdrawalPaid({ withdrawalId });
}

export async function payRemoteWithdrawal(withdrawalId: string): Promise<WithdrawalRecord> {
  const response = await http.post<unknown, WithdrawalRecord>(`/api/v1/admin/funds/withdrawals/${encodeURIComponent(withdrawalId)}/payout`, {});
  return requireValue<WithdrawalRecord>(response, "支付宝打款失败");
}

export async function queryRemoteWithdrawalPayout(withdrawalId: string): Promise<WithdrawalRecord> {
  const response = await http.post<unknown, WithdrawalRecord>(`/api/v1/admin/funds/withdrawals/${encodeURIComponent(withdrawalId)}/payout-query`, {});
  return requireValue<WithdrawalRecord>(response, "支付宝打款查询失败");
}

export async function markRemoteWithdrawalPayoutFailed(withdrawalId: string) {
  return adminFundsApi.markWithdrawalPayoutFailed({ withdrawalId });
}

export async function returnRemoteWithdrawalForReview(withdrawalId: string, reason: string) {
  return adminFundsApi.returnWithdrawalForReview({ withdrawalId, withdrawalReviewRequest: { reason } });
}

export async function markRemotePayoutExceptionHandled(withdrawalId: string, reason: string) {
  return adminFundsApi.markPayoutExceptionHandled({ withdrawalId, withdrawalReviewRequest: { reason } });
}

export async function readRemoteAcceptanceReviews(): Promise<ReviewingExecution[]> {
  const response = await http.get<unknown, RemoteAcceptanceReviewRow[]>("/api/v1/admin/tasks/acceptance-reviews");
  return listValue<RemoteAcceptanceReviewRow>(response).map(mapAcceptanceReview);
}

export async function approveRemoteAcceptanceReview(executionId: string) {
  return http.post<unknown, unknown>(`/api/v1/admin/tasks/executions/${encodeURIComponent(executionId)}/acceptance/approve`, {});
}

export async function rejectRemoteAcceptanceReview(executionId: string, reason: string) {
  return http.post<unknown, unknown>(`/api/v1/admin/tasks/executions/${encodeURIComponent(executionId)}/acceptance/reject`, { reason });
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
    title: task.title ?? "",
    category: task.category ?? "",
    sourceName: task.sourceName ?? "",
    sourceType: mapSourceType(task.sourceType),
    description,
    cardSummary: description.slice(0, 86),
    deliverables: task.deliverables ?? "",
    acceptanceCriteria: task.acceptanceCriteria ?? "",
    reward: task.reward ?? 0,
    totalSlots: task.totalSlots ?? 0,
    remainingSlots: task.remainingSlots ?? 0,
    publishedAt: formatDateTime(task.publishedAt ?? task.createdAt),
    taskStatus: mapTaskStatus(task.status),
    offlineReason: mapOfflineReason(task.offlineReason),
    agentMatchScore: 0,
    recommendedTaskType: task.category ?? "",
    suggestedTeam: "",
    matchAnalysis: "",
    riskPrompt: "",
    recommendedReason: "",
    submittedFiles: [],
    resultFiles: [],
    acceptanceResult: ""
  };
}

function mapTaskSummary(summary: RemoteAdminTaskSummary): Task {
  return {
    ...mapTask(requireObject(summary.task, "task")),
    executionTotal: numberValue(summary.executionTotal),
    runningExecutionCount: numberValue(summary.runningExecutionCount),
    reviewingExecutionCount: numberValue(summary.reviewingExecutionCount),
    completedExecutionCount: numberValue(summary.completedExecutionCount),
    terminatedExecutionCount: numberValue(summary.terminatedExecutionCount)
  };
}

function mapAdminExecutionRows(rows: RemoteAdminExecutionRow[]): AdminExecutionRecords[string] {
  const running: RunningExecution[] = [];
  const reviewing: ReviewingExecution[] = [];
  const terminated: TerminatedExecution[] = [];
  const completed: CompletedExecution[] = [];

  for (const row of rows) {
    if (row.executionStatus === "TERMINATED") {
      terminated.push({
        executionId: row.executionId,
        executionIndex: row.executionIndex,
        userName: row.userName ?? "-",
        phone: row.userPhone ?? "-",
        agentName: row.agentName ?? "-",
        terminationReason: row.terminationReason ?? "-",
        terminatedNode: mapCurrentNode(row.currentNode),
        terminatedAt: formatDateTime(row.completedAt ?? row.updatedAt)
      });
    } else if (row.executionStatus === "RUNNING") {
      running.push({
        executionId: row.executionId,
        executionIndex: row.executionIndex,
        userName: row.userName ?? "-",
        phone: row.userPhone ?? "-",
        agentName: row.agentName ?? "-",
        agentScore: row.agentScore == null ? "-" : `${row.agentScore}/100`,
        currentNode: mapCurrentNode(row.currentNode),
        progress: row.progress ?? "-",
        startedAt: formatDateTime(row.startedAt)
      });
    } else if (row.executionStatus === "PLATFORM_REVIEWING") {
      reviewing.push({
        executionId: requireText(row.executionId, "executionId"),
        userName: row.userName ?? "-",
        phone: row.userPhone ?? "-",
        agentName: row.agentName ?? "-",
        agentScore: row.agentScore == null ? "-" : `${row.agentScore}/100`,
        acceptanceStatus: "待平台审核",
        acceptanceScore: "-",
        acceptanceSummary: "-",
        acceptanceIssues: "-",
        currentNode: mapCurrentNode(row.currentNode),
        progress: row.progress ?? "-",
        submittedAt: formatDateTime(row.completedAt ?? row.updatedAt)
      });
    } else {
      completed.push({
        executionId: row.executionId,
        executionIndex: row.executionIndex,
        userName: row.userName ?? "-",
        phone: row.userPhone ?? "-",
        agentName: row.agentName ?? "-",
        acceptanceStatus: row.executionStatus === "ACCEPTANCE_FAILED" ? "验收未通过" : "验收通过",
        score: row.agentScore == null ? "-" : `${row.agentScore}/100`,
        appealStatus: mapAppealStatus(row.appealStatus),
        settlementStatus: mapSettlementStatus(row.settlementStatus),
        completedAt: formatDateTime(row.completedAt ?? row.updatedAt)
      });
    }
  }

  return { running, reviewing, terminated, completed };
}

function mapAcceptanceReview(row: RemoteAcceptanceReviewRow): ReviewingExecution {
  const executionId = requireText(row.executionId, "executionId");
  return {
    executionId,
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    taskCategory: row.taskCategory,
    userName: row.userName ?? "-",
    phone: row.userPhone ?? "-",
    agentName: row.agentName ?? "-",
    agentScore: row.agentScore == null ? "-" : `${row.agentScore}/100`,
    acceptanceStatus: mapAcceptanceStatus(row.acceptanceStatus),
    acceptanceScore: row.acceptanceScore == null ? "-" : `${row.acceptanceScore}/100`,
    acceptanceSummary: row.acceptanceSummary || "-",
    acceptanceIssues: mapAcceptanceIssues(row.acceptanceIssues),
    currentNode: mapCurrentNode(row.currentNode),
    progress: row.progress ?? "-",
    submittedAt: formatDateTime(row.submittedAt ?? row.updatedAt ?? row.startedAt)
  };
}

function mapOperationLog(log: RemoteAuditLog): AdminOperationLog {
  return {
    id: log.id ?? `${log.action ?? "LOG"}-${log.createdAt ?? ""}`,
    action: log.action ?? "-",
    beforeStatus: log.beforeStatus ?? "-",
    afterStatus: log.afterStatus ?? "-",
    reason: log.reason ?? "-",
    occurredAt: formatDateTime(log.createdAt)
  };
}

function mapAppealDetail(detail: RemoteAdminAppealDetail): AdminAppeal {
  const appeal = requireObject(detail.appeal, "appeal");
  const appealId = requireText(appeal.id, "appeal.id");
  const appealNo = requireText(appeal.appealNo, "appeal.appealNo");
  const reason = requireText(appeal.reason, "appeal.reason");
  return {
    backendId: appealId,
    appealNo,
    taskTitle: requireText(detail.taskTitle, "taskTitle"),
    taskCategory: requireText(detail.taskCategory, "taskCategory"),
    userName: requireText(detail.userName, "userName"),
    userPhone: requireText(detail.userPhone, "userPhone"),
    agentName: requireText(detail.agentName, "agentName"),
    issueSummary: reason.slice(0, 32),
    appealReason: reason,
    appealStatus: mapAppealStatus(appeal.status),
    priority: appeal.priority === "HIGH" ? "高风险" : appeal.priority === "URGENT" ? "加急" : "普通",
    submittedAt: formatDateTime(appeal.submittedAt ?? appeal.createdAt),
    handler: appeal.handler ?? "",
    originalScore: detail.agentScore == null ? undefined : `${detail.agentScore}/100`,
    resultDescription: appeal.resultDescription,
    linkedMyTaskId: requireText(detail.executionId, "executionId"),
    executionId: requireText(detail.executionId, "executionId"),
    executionIndex: requireNumber(detail.executionIndex, "executionIndex"),
    deliverables: requireText(detail.deliverables, "deliverables"),
    acceptanceCriteria: requireText(detail.acceptanceCriteria, "acceptanceCriteria"),
    processLogs: appeal.resultDescription ? [appeal.resultDescription] : []
  };
}

function mapSettlement(settlement: SettlementRecord, taskById: Map<string, Task>): Settlement {
  const task = taskById.get(settlement.taskId ?? "");
  return {
    backendId: settlement.id,
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
    verifiedName: "-",
    alipayAccount: withdrawal.alipayAccount ?? "-",
    realNameMatchStatus: withdrawal.realNameMatchStatus === "PASSED" ? "已通过" : "未通过",
    withdrawableBalance: withdrawal.amount ?? 0,
    applyAmount: withdrawal.amount ?? 0,
    estimatedArrivalTime: withdrawal.estimatedArrivalTime ?? "-",
    appliedAt: formatDateTime(withdrawal.appliedAt ?? withdrawal.createdAt),
    withdrawStatus: mapWithdrawStatus(withdrawal.status),
    reviewer: withdrawal.reviewer ?? "-",
    reviewReason: readString(withdrawal, "reviewReason"),
    payoutFailureReason: readString(withdrawal, "payoutFailureReason"),
    exceptionRemark: readString(withdrawal, "exceptionRemark"),
    payoutProvider: readString(withdrawal, "payoutProvider"),
    payoutOutBizNo: readString(withdrawal, "payoutOutBizNo"),
    payoutOrderId: readString(withdrawal, "payoutOrderId"),
    payoutStatus: readString(withdrawal, "payoutStatus"),
    payoutRequestedAt: formatDateTime(readString(withdrawal, "payoutRequestedAt")),
    payoutCompletedAt: formatDateTime(readString(withdrawal, "payoutCompletedAt")),
    payoutLastQueriedAt: formatDateTime(readString(withdrawal, "payoutLastQueriedAt"))
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
      withdrawStatus: item.withdrawStatus,
      payoutProvider: item.payoutProvider,
      payoutOutBizNo: item.payoutOutBizNo,
      payoutOrderId: item.payoutOrderId,
      payoutStatus: item.payoutStatus,
      payoutRequestedAt: item.payoutRequestedAt,
      payoutCompletedAt: item.payoutCompletedAt,
      payoutLastQueriedAt: item.payoutLastQueriedAt
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
  return type ?? "";
}

function mapOfflineReason(reason?: string) {
  if (reason === "FULL" || reason === "SLOT_FULL") return "名额已满";
  return reason ?? "";
}

function mapCurrentNode(node?: string) {
  const nodes: Record<string, string> = {
    PLATFORM_ACCEPTANCE: "平台验收",
    PLATFORM_REVIEWING: "平台审核中",
    platform_reviewing: "平台审核中",
    platform_rejected: "平台审核不通过",
    reward_recording: "报酬记录中",
    SETTLEMENT: "报酬入账",
    GENERATING: "生成结果",
    GENERATING_RESULT: "生成结果",
    QUALITY_CHECK: "质量检查"
  };
  return node ? nodes[node] ?? node : "执行中";
}

function mapFlowType(type?: string) {
  const types: Record<string, string> = {
    TASK_SETTLEMENT_INCOME: "任务结算入账",
    SETTLEMENT_POSTED: "任务结算入账",
    PLATFORM_REVIEW_APPROVED_SETTLEMENT: "平台审核通过结算入账",
    APPEAL_APPROVED_SETTLEMENT: "申诉通过结算入账",
    WITHDRAWAL_REVIEWING: "提现申请处理中",
    WITHDRAWAL_PAID: "提现打款完成",
    WITHDRAWAL_FAILED: "提现打款失败",
    WITHDRAWAL_APPROVED: "提现审核通过",
    WITHDRAWAL_REJECTED: "提现驳回退回",
    WITHDRAWAL_PAYOUT_FAILED: "打款失败退回",
    WITHDRAWAL_EXCEPTION_HANDLED: "异常处理"
  };
  return type ? types[type] ?? type : "-";
}

function mapAcceptanceStatus(status?: string) {
  if (status === "passed") return "Agent 评分通过";
  if (status === "failed") return "Agent 评分不通过";
  return "待平台审核";
}

function mapAcceptanceIssues(value?: string) {
  if (!value) return "-";
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .filter(Boolean)
        .join("；") || "无";
    }
  } catch {
    return value;
  }
  return value;
}

function readString(source: unknown, key: string) {
  if (source && typeof source === "object" && key in source) {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function requireObject<T extends object>(value: T | null | undefined, field: string): T {
  if (!value) throw new Error(`接口缺少 ${field}`);
  return value;
}

function requireText(value: string | null | undefined, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`申诉详情接口缺少 ${field}`);
  }
  return value;
}

function requireNumber(value: number | null | undefined, field: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`申诉详情接口缺少 ${field}`);
  }
  return value;
}

function numberValue(value: number | null | undefined) {
  return typeof value === "number" && !Number.isNaN(value) ? value : 0;
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
