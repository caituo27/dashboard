import {
  AdminAppealControllerApiFactory,
  AdminFundsControllerApiFactory,
  AdminTaskControllerApiFactory,
  AuthControllerApiFactory,
  type AcceptanceReviewRow,
  type AppealRecord,
  type AuthTokenResponse,
  type FundFlow as ApiFundFlow,
  type AdminTaskDetail,
  type SettlementRecordRow,
  type TaskEntity,
  type WithdrawalRecord,
  type WithdrawalRecordRow
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
const authApi = AuthControllerApiFactory(undefined, API_BASE_URL, http);

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
  operator?: string;
  operatorName?: string;
  createdBy?: string;
  adminName?: string;
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
  acceptanceStatus?: string;
  acceptanceScore?: number | null;
  acceptanceSummary?: string;
  acceptanceIssues?: string;
  acceptancePayload?: string;
  score?: number | null;
  summary?: string;
  issues?: string;
  acceptance?: RemoteAcceptanceSnapshot;
  currentNode?: string;
  currentNodeLabel?: string;
  progress?: string;
  terminationReason?: string;
  appealStatus?: string;
  settlementStatus?: string;
  submittedAt?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

type RemoteAcceptanceReviewRow = {
  executionId?: string;
  executionIndex?: number;
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
  acceptancePayload?: string;
  score?: number | null;
  summary?: string;
  issues?: string;
  acceptance?: RemoteAcceptanceSnapshot;
  currentNode?: string;
  currentNodeLabel?: string;
  progress?: string;
  submittedAt?: string;
  startedAt?: string;
  updatedAt?: string;
};

type RemoteAcceptanceSnapshot = {
  status?: string;
  score?: number | null;
  summary?: string;
  issues?: string;
  acceptancePayload?: string;
};

type RemoteSettlementRecord = SettlementRecordRow;

type RemoteWithdrawalRecord = WithdrawalRecordRow;

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
  const response = await authApi.adminLogin({ adminLoginRequest: { account, password } });
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
  const detail = requireValue<AdminTaskDetail>(await adminTaskApi.detail({ taskId }), "任务详情不可用") as RemoteAdminTaskDetail;
  const task = mapTask(requireObject(detail.task, "task"));
  return {
    task,
    records: mapAdminExecutionRows(listValue<RemoteAdminExecutionRow>(detail.executions)),
    operationLogs: listValue<RemoteAuditLog>(detail.operationLogs).map(mapOperationLog)
  };
}

export async function createRemoteAdminTask(payload: UpsertAdminTaskPayload): Promise<Task> {
  const task = await adminTaskApi.create({ upsertTaskRequest: payload });
  return mapTask(requireValue(task, "任务发布失败"));
}

export async function updateRemoteAdminTask(taskId: string, payload: UpsertAdminTaskPayload): Promise<Task> {
  const task = await adminTaskApi.update({ taskId, upsertTaskRequest: payload });
  return mapTask(requireValue(task, "任务保存失败"));
}

export async function offlineRemoteAdminTask(taskId: string, reason: string): Promise<Task> {
  const task = await adminTaskApi.offline({ taskId, taskStateRequest: { reason } });
  return mapTask(requireValue(task, "任务下线失败"));
}

export async function republishRemoteAdminTask(taskId: string): Promise<Task> {
  const task = await adminTaskApi.republish({ taskId });
  return mapTask(requireValue(task, "任务重新发布失败"));
}

export async function deleteRemoteAdminTask(taskId: string, reason: string): Promise<Task> {
  const task = await adminTaskApi._delete({ taskId, taskStateRequest: { reason } });
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
  const settlements = listValue<RemoteSettlementRecord>(settlementsResponse).map((item) => mapSettlement(item, taskById));
  const withdrawals = listValue<RemoteWithdrawalRecord>(withdrawalsResponse).map(mapWithdrawal);
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

export async function approveRemoteWithdrawals(withdrawalIds: string[]): Promise<WithdrawalRecord[]> {
  const response = await adminFundsApi.approveWithdrawals({ bulkWithdrawalRequest: { withdrawalIds } });
  return listValue<WithdrawalRecord>(requireValue(response, "批量提现审核失败"));
}

export async function rejectRemoteWithdrawal(withdrawalId: string, reason: string) {
  return adminFundsApi.rejectWithdrawal({ withdrawalId, withdrawalReviewRequest: { reason } });
}

export async function rejectRemoteWithdrawals(withdrawalIds: string[], reason: string): Promise<WithdrawalRecord[]> {
  const response = await adminFundsApi.rejectWithdrawals({ bulkWithdrawalReviewRequest: { withdrawalIds, reason } });
  return listValue<WithdrawalRecord>(requireValue(response, "批量提现驳回失败"));
}

export async function postRemoteSettlement(settlementId: string) {
  return adminFundsApi.postSettlement({ settlementId });
}

export async function markRemoteWithdrawalPaid(withdrawalId: string) {
  return adminFundsApi.markWithdrawalPaid({ withdrawalId });
}

export async function markRemoteWithdrawalsPaid(withdrawalIds: string[]): Promise<WithdrawalRecord[]> {
  const response = await adminFundsApi.markWithdrawalsPaid({ bulkWithdrawalRequest: { withdrawalIds } });
  return listValue<WithdrawalRecord>(requireValue(response, "批量标记已打款失败"));
}

export async function payRemoteWithdrawal(withdrawalId: string): Promise<WithdrawalRecord> {
  const response = await adminFundsApi.payWithdrawal({ withdrawalId });
  return requireValue<WithdrawalRecord>(response, "支付宝打款失败");
}

export async function queryRemoteWithdrawalPayout(withdrawalId: string): Promise<WithdrawalRecord> {
  const response = await adminFundsApi.queryWithdrawalPayout({ withdrawalId });
  return requireValue<WithdrawalRecord>(response, "支付宝打款查询失败");
}

export async function markRemoteWithdrawalPayoutFailed(withdrawalId: string) {
  return adminFundsApi.markWithdrawalPayoutFailed({ withdrawalId });
}

export async function markRemoteWithdrawalsPayoutFailed(withdrawalIds: string[], reason: string): Promise<WithdrawalRecord[]> {
  const response = await adminFundsApi.markWithdrawalsPayoutFailed({ bulkWithdrawalReviewRequest: { withdrawalIds, reason } });
  return listValue<WithdrawalRecord>(requireValue(response, "批量标记打款失败提交失败"));
}

export async function exportRemotePendingPayouts(): Promise<Withdrawal[]> {
  const response = await adminFundsApi.pendingPayoutExport();
  return listValue<RemoteWithdrawalRecord>(requireValue(response, "打款清单导出失败")).map(mapWithdrawal);
}

export async function returnRemoteWithdrawalForReview(withdrawalId: string, reason: string) {
  return adminFundsApi.returnWithdrawalForReview({ withdrawalId, withdrawalReviewRequest: { reason } });
}

export async function markRemotePayoutExceptionHandled(withdrawalId: string, reason: string) {
  return adminFundsApi.markPayoutExceptionHandled({ withdrawalId, withdrawalReviewRequest: { reason } });
}

export async function readRemoteAcceptanceReviews(): Promise<ReviewingExecution[]> {
  const response = await adminTaskApi.acceptanceReviews();
  return listValue<AcceptanceReviewRow>(response).map((item) => mapAcceptanceReview(item as RemoteAcceptanceReviewRow));
}

export async function approveRemoteAcceptanceReview(executionId: string) {
  return adminTaskApi.approveAcceptanceReview({ executionId });
}

export async function rejectRemoteAcceptanceReview(executionId: string, reason: string) {
  return adminTaskApi.rejectAcceptanceReview({ executionId, acceptanceReviewRequest: { reason } });
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
        terminatedNode: mapCurrentNode(row.currentNode, row.currentNodeLabel),
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
        currentNode: mapCurrentNode(row.currentNode, row.currentNodeLabel),
        progress: row.progress ?? "-",
        startedAt: formatDateTime(row.startedAt)
      });
    } else if (row.executionStatus === "PLATFORM_REVIEWING") {
      reviewing.push({
        executionId: requireText(row.executionId, "executionId"),
        executionIndex: row.executionIndex,
        userName: row.userName ?? "-",
        phone: row.userPhone ?? "-",
        agentName: row.agentName ?? "-",
        agentScore: row.agentScore == null ? "-" : `${row.agentScore}/100`,
        acceptanceStatus: mapAcceptanceStatus(row.acceptanceStatus ?? row.acceptance?.status),
        acceptanceScore: mapAcceptanceScore(row),
        acceptanceSummary: mapAcceptanceSummary(row),
        acceptanceIssues: mapAcceptanceIssues(row),
        currentNode: mapCurrentNode(row.currentNode, row.currentNodeLabel),
        progress: row.progress ?? "-",
        submittedAt: formatDateTime(row.submittedAt ?? row.completedAt ?? row.updatedAt)
      });
    } else {
      completed.push({
        executionId: row.executionId,
        executionIndex: row.executionIndex,
        userName: row.userName ?? "-",
        phone: row.userPhone ?? "-",
        agentName: row.agentName ?? "-",
        acceptanceStatus: row.executionStatus === "ACCEPTANCE_FAILED" ? "验收未通过" : "验收通过",
        acceptanceScore: mapAcceptanceScore(row),
        acceptanceSummary: mapAcceptanceSummary(row),
        acceptanceIssues: mapAcceptanceIssues(row),
        score: row.agentScore == null ? "-" : `${row.agentScore}/100`,
        currentNode: mapCurrentNode(row.currentNode, row.currentNodeLabel),
        progress: row.progress ?? "-",
        appealStatus: row.executionStatus === "ACCEPTANCE_FAILED" ? mapAppealStatus(row.appealStatus) : "无申诉",
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
    executionIndex: row.executionIndex,
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    taskCategory: row.taskCategory,
    userName: row.userName ?? "-",
    phone: row.userPhone ?? "-",
    agentName: row.agentName ?? "-",
    agentScore: row.agentScore == null ? "-" : `${row.agentScore}/100`,
    acceptanceStatus: mapAcceptanceStatus(row.acceptanceStatus ?? row.acceptance?.status),
    acceptanceScore: mapAcceptanceScore(row),
    acceptanceSummary: mapAcceptanceSummary(row),
    acceptanceIssues: mapAcceptanceIssues(row),
    currentNode: mapCurrentNode(row.currentNode, row.currentNodeLabel),
    progress: row.progress ?? "-",
    submittedAt: formatDateTime(row.submittedAt ?? row.updatedAt ?? row.startedAt)
  };
}

function mapOperationLog(log: RemoteAuditLog): AdminOperationLog {
  return {
    id: log.id ?? `${log.action ?? "LOG"}-${log.createdAt ?? ""}`,
    action: mapOperationAction(log.action),
    operator: log.operator ?? log.operatorName ?? log.createdBy ?? log.adminName ?? "系统",
    beforeStatus: mapOperationStatus(log.beforeStatus),
    afterStatus: mapOperationStatus(log.afterStatus),
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
    handledAt: appeal.handledAt ? formatDateTime(appeal.handledAt) : undefined,
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

function mapSettlement(settlement: RemoteSettlementRecord, taskById: Map<string, Task>): Settlement {
  const task = taskById.get(settlement.taskId ?? "");
  return {
    backendId: settlement.id,
    settlementNo: settlement.settlementNo ?? settlement.id ?? "",
    taskTitle: task?.title ?? compactId(settlement.taskId, "任务"),
    userName: settlement.userName || compactId(settlement.userId, "用户"),
    userPhone: settlement.userPhone || "-",
    agentName: settlement.agentName || compactId(settlement.agentId, "Agent"),
    taskIncome: settlement.taskIncome ?? 0,
    platformFee: settlement.platformFee ?? 0,
    netIncome: settlement.netIncome ?? 0,
    settlementStatus: mapSettlementStatus(settlement.status),
    createdAt: formatDateTime(settlement.createdAtBusiness ?? settlement.createdAt),
    paidAt: settlement.paidAt ? formatDateTime(settlement.paidAt) : "-",
    sourceAppealNo: settlement.executionId
  };
}

function mapWithdrawal(withdrawal: RemoteWithdrawalRecord): Withdrawal {
  return {
    backendId: withdrawal.id,
    withdrawalNo: withdrawal.withdrawalNo ?? withdrawal.id ?? "",
    userName: withdrawal.userName || compactId(withdrawal.userId, "用户"),
    userPhone: withdrawal.userPhone || "-",
    verifiedName: withdrawal.verifiedName || "-",
    alipayAccount: withdrawal.alipayAccount ?? "-",
    realNameMatchStatus: withdrawal.realNameMatchStatus === "PASSED" ? "可用" : "待授权",
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

function mapOperationAction(action?: string) {
  const actions: Record<string, string> = {
    CREATE_TASK: "创建任务",
    UPDATE_TASK: "编辑任务",
    OFFLINE_TASK: "下线任务",
    REPUBLISH_TASK: "重新发布任务",
    DELETE_TASK: "删除任务",
    APPROVE_ACCEPTANCE: "平台审核通过",
    REJECT_ACCEPTANCE: "平台审核不通过",
    CREATE_EXECUTION: "创建执行记录",
    CANCEL_EXECUTION: "终止执行",
    START_SETTLEMENT: "开始结算",
    POST_SETTLEMENT: "结算入账",
    CREATE_WITHDRAWAL: "创建提现申请",
    APPROVE_WITHDRAWAL: "提现审核通过",
    REJECT_WITHDRAWAL: "提现审核驳回",
    PAYOUT_WITHDRAWAL: "发起打款",
    QUERY_PAYOUT: "查询打款结果"
  };
  const normalized = action?.trim().toUpperCase();
  return normalized ? actions[normalized] ?? action : "-";
}

function mapOperationStatus(status?: string) {
  const statuses: Record<string, string> = {
    NONE: "无",
    PUBLISHED: "已发布",
    OFFLINE: "已下线",
    DELETED: "已删除",
    RUNNING: "执行中",
    PLATFORM_REVIEWING: "待平台审核",
    TERMINATED: "已终止",
    ACCEPTANCE_FAILED: "验收未通过",
    SETTLING: "结算中",
    SETTLED: "已结算",
    COMPLETED: "已完成",
    POSTED: "已入账",
    FAILED: "失败",
    PENDING: "待处理",
    PROCESSING: "处理中",
    APPROVED: "已通过",
    REJECTED: "已驳回"
  };
  const normalized = status?.trim().toUpperCase();
  return normalized ? statuses[normalized] ?? status : "-";
}

function mapAppealStatus(status?: string): AppealStatus {
  const normalized = status?.trim().toUpperCase();
  if (!normalized || normalized === "NOT_APPEALED" || normalized === "NONE") return "未申诉";
  if (normalized === "PENDING") return "待处理";
  if (normalized === "PROCESSING") return "处理中";
  if (normalized === "NEED_SUPPLEMENT") return "需补充材料";
  if (normalized === "APPROVED") return "申诉通过";
  if (normalized === "REJECTED") return "申诉不通过";
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
  const normalized = reason?.trim().toUpperCase();
  if (normalized === "FULL" || normalized === "SLOT_FULL") return "名额已满";
  if (normalized === "OFFLINE" || normalized === "ADMIN OFFLINED TASK") return "手动操作下线";
  return reason?.trim() ?? "";
}

function mapCurrentNode(node?: string, label?: string) {
  if (label?.trim()) return label.trim();

  const normalized = node?.trim().toUpperCase();
  const nodes: Record<string, string> = {
    ACCEPTED: "已接单",
    PARSING: "解析任务",
    PLATFORM_ACCEPTANCE: "平台验收",
    PLATFORM_REVIEWING: "平台审核中",
    PLATFORM_REJECTED: "平台审核不通过",
    REWARD_RECORDING: "报酬记录中",
    SETTLEMENT: "报酬入账",
    SETTLING: "报酬入账",
    GENERATING: "生成结果",
    GENERATING_RESULT: "生成结果",
    RUNTIME_PROBE: "执行探测",
    ANALYZING_TASK: "任务理解",
    RUNNING: "执行中",
    QUALITY_CHECK: "质量检查",
    QUALITY_CHECKING: "质量检查"
  };
  return normalized ? nodes[normalized] ?? node : "执行中";
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
  const normalized = status?.trim().toLowerCase();
  if (["passed", "pass", "success", "accepted", "approved"].includes(normalized ?? "")) return "本次任务评分通过";
  if (["failed", "fail", "rejected"].includes(normalized ?? "")) return "本次任务评分不通过";
  return "待平台审核";
}

function mapAcceptanceScore(row: RemoteAcceptanceReviewRow | RemoteAdminExecutionRow) {
  const payload = parseAcceptancePayload(row.acceptancePayload ?? row.acceptance?.acceptancePayload);
  const score = row.acceptanceScore ?? row.score ?? row.acceptance?.score ?? numberFromUnknown(payload?.score);
  return score == null ? "-" : `${score}/100`;
}

function mapAcceptanceSummary(row: RemoteAcceptanceReviewRow | RemoteAdminExecutionRow) {
  const payload = parseAcceptancePayload(row.acceptancePayload ?? row.acceptance?.acceptancePayload);
  return (
    textFromUnknown(row.acceptanceSummary) ||
    textFromUnknown(row.summary) ||
    textFromUnknown(row.acceptance?.summary) ||
    textFromUnknown(payload?.summary) ||
    "-"
  );
}

function mapAcceptanceIssues(row: RemoteAcceptanceReviewRow | RemoteAdminExecutionRow) {
  const payload = parseAcceptancePayload(row.acceptancePayload ?? row.acceptance?.acceptancePayload);
  const issues = parseTextList(
    row.acceptanceIssues ??
      row.issues ??
      row.acceptance?.issues ??
      payload?.issues
  );
  if (issues.length > 0) return uniqueTextItems(issues).join("；");

  const failureReasons = parseTextList(payload?.failureReasons);
  return failureReasons.length > 0 ? uniqueTextItems(failureReasons).join("；") : "-";
}

function parseAcceptancePayload(payload?: string) {
  if (!payload?.trim()) return undefined;
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function parseTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(textFromUnknown).filter(Boolean);
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key}：${textFromUnknown(item) || "-"}`);
  }

  const text = textFromUnknown(value);
  const parsedText = parseJsonText(text);
  if (parsedText !== undefined) return parseTextList(parsedText);
  return text ? [text] : [];
}

function parseJsonText(text: string) {
  if (!text || !["[", "{"].includes(text.charAt(0))) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function textFromUnknown(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? undefined : numericValue;
}

function uniqueTextItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
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
