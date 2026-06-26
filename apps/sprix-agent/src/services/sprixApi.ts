import {
  AccountControllerApiFactory,
  AgentControllerApiFactory,
  AppealControllerApiFactory,
  AuthControllerApiFactory,
  EarningsControllerApiFactory,
  MyTaskControllerApiFactory,
  TaskControllerApiFactory,
  WithdrawalControllerApiFactory,
  type AgentProfileResponse,
  type AppealRecord,
  type AuthTokenResponse,
  type TaskEntity,
  type TaskExecution,
  type UserAccount,
  type WechatScanSessionResponse,
  type WechatScanStatusResponse,
  type WithdrawalAccount,
  type WithdrawalRecord
} from "../apis/sprix";
import type { Agent, AppealStatus, MyTask, MyTaskStatus, SettlementStatus, SprixState, Task, TaskStatus, Withdrawal } from "../types";
import type { SprixRemoteStatePatch } from "../store/sprixStore";
import { http } from "../utils/http";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/sprix-api";
const LOCAL_AGENT_CLAIM_BASE_URL = import.meta.env.VITE_LOCAL_AGENT_CLAIM_BASE_URL ?? (import.meta.env.DEV ? "http://42.194.150.73:8084" : "");
const TOKEN_KEY = "sprix-auth-token";

const accountApi = AccountControllerApiFactory(undefined, API_BASE_URL, http);
const agentApi = AgentControllerApiFactory(undefined, API_BASE_URL, http);
const appealApi = AppealControllerApiFactory(undefined, API_BASE_URL, http);
const authApi = AuthControllerApiFactory(undefined, API_BASE_URL, http);
const earningsApi = EarningsControllerApiFactory(undefined, API_BASE_URL, http);
const myTaskApi = MyTaskControllerApiFactory(undefined, API_BASE_URL, http);
const taskApi = TaskControllerApiFactory(undefined, API_BASE_URL, http);
const withdrawalApi = WithdrawalControllerApiFactory(undefined, API_BASE_URL, http);

export type WechatLoginSession = {
  sessionId: string;
  qrPayload: string;
  expiresInSeconds: number;
  pollIntervalMs: number;
};

export type WechatLoginStatus = {
  sessionId: string;
  status: string;
  expiresInSeconds: number;
  authenticated: boolean;
};

const tagText: Record<string, string> = {
  "software-development": "软件开发",
  "web-generation": "网页生成",
  "code-repair": "代码修复",
  workflow: "流程执行",
  documents: "文档处理",
  automation: "自动化办公",
  search: "信息检索",
  research: "报告归纳",
  "fact-checking": "事实校验",
  "data-processing": "数据处理"
};

export async function authenticateConsumer(identity = "agent@sprix.ai", code = "123456") {
  const response = await authApi.mockLogin({ mockLoginRequest: { email: identity, code } });
  const token = requireValue<AuthTokenResponse>(response, "登录失败").token;
  localStorage.setItem(TOKEN_KEY, token ?? "");
  return token;
}

export async function createWechatLoginSession(): Promise<WechatLoginSession> {
  const response = await authApi.createWechatScanSession();
  const session = requireValue<WechatScanSessionResponse>(response, "微信扫码登录二维码不可用");

  if (!session.sessionId || !session.qrPayload) {
    throw new Error("微信扫码登录二维码不可用");
  }

  return {
    sessionId: session.sessionId,
    qrPayload: session.qrPayload,
    expiresInSeconds: session.expiresInSeconds ?? 0,
    pollIntervalMs: Math.max(session.pollIntervalSeconds ?? 2, 1) * 1000
  };
}

export async function readWechatLoginStatus(sessionId: string): Promise<WechatLoginStatus> {
  const response = await authApi.wechatScanSession({ sessionId });
  const scanStatus = requireValue<WechatScanStatusResponse>(response, "微信扫码状态不可用");
  const token = scanStatus.token?.token;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  return {
    sessionId: scanStatus.sessionId ?? sessionId,
    status: scanStatus.status ?? "PENDING",
    expiresInSeconds: scanStatus.expiresInSeconds ?? 0,
    authenticated: Boolean(token)
  };
}

export async function logoutConsumer() {
  try {
    await authApi.logout();
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function hasStoredAuthToken() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export type LocalAgentEnrollment = {
  enrollmentToken: string;
};

export async function createLocalAgentEnrollment(claimToken: string): Promise<LocalAgentEnrollment> {
  const response = await http.post("/api/v1/local-agent/enrollments", { claimToken });
  const enrollment = requireValue(response as unknown as LocalAgentEnrollment | undefined, "本机 Agent 连接凭证获取失败");

  if (!enrollment.enrollmentToken) {
    throw new Error("本机 Agent 连接凭证获取失败");
  }

  return enrollment;
}

export function buildLocalAgentClaimUrl(claimToken: string, enrollmentToken: string) {
  const baseUrl = LOCAL_AGENT_CLAIM_BASE_URL.replace(/\/$/, "");
  const url = new URL(`${baseUrl || window.location.origin}/local-agent/claim`);
  url.searchParams.set("claimToken", claimToken);
  url.searchParams.set("enrollmentToken", enrollmentToken);
  return baseUrl ? url.toString() : `${url.pathname}${url.search}`;
}

export async function readAgentSnapshot(): Promise<SprixRemoteStatePatch> {
  const tasksResponse = await taskApi.market();
  const tasks = listValue<TaskEntity>(tasksResponse).map(mapTask);
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) return { tasks };

  const [accountResponse, agentsResponse, myTasksResponse, withdrawableResponse] = await Promise.all([
    accountApi.current(),
    agentApi.list1(),
    myTaskApi.list(),
    earningsApi.withdrawable()
  ]);

  const account = accountResponse;
  const agents = listValue<AgentProfileResponse>(agentsResponse).map(mapAgent);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const myTasks = listValue<TaskExecution>(myTasksResponse).map((item) => mapMyTask(item, taskById, agentById));
  const withdrawableAmount = withdrawableResponse;

  return {
    tasks,
    agents,
    myTasks,
    account: {
      ...(account ? mapAccount(account) : {}),
      isLoggedIn: true,
      ...(typeof withdrawableAmount === "number" ? { withdrawableAmount } : {})
    }
  };
}

export async function connectRemoteAgent(agentId: string): Promise<Agent | undefined> {
  const response = await agentApi.connect({ agentId });
  return response ? mapAgent(response) : undefined;
}

export async function disconnectRemoteAgent(agentId: string): Promise<Agent | undefined> {
  const response = await agentApi.disconnect({ agentId });
  return response ? mapAgent(response) : undefined;
}

export async function markRemoteCurrentAgent(agentId: string): Promise<Agent | undefined> {
  const response = await agentApi.markCurrent({ agentId });
  return response ? mapAgent(response) : undefined;
}

export async function acceptRemoteTask(taskId: string): Promise<TaskExecution> {
  const response = await taskApi.accept({ id: taskId });
  return requireValue<TaskExecution>(response, "接单失败");
}

export async function rerunRemoteTask(executionId: string): Promise<TaskExecution> {
  const response = await myTaskApi.rerun({ executionId });
  return requireValue<TaskExecution>(response, "重新执行失败");
}

export async function submitRemoteAppeal(executionId: string, reason: string): Promise<AppealRecord> {
  const response = await appealApi.submit({ submitAppealRequest: { executionId, reason } });
  return requireValue<AppealRecord>(response, "申诉提交失败");
}

export async function bindRemoteWithdrawalAccount(account: string): Promise<WithdrawalAccount> {
  const response = await accountApi.bindWithdrawalAccount({
    bindWithdrawalAccountRequest: {
      alipayAccount: account,
      verifiedName: "Xiaoxiao"
    }
  });
  return requireValue<WithdrawalAccount>(response, "绑定收款账户失败");
}

export async function applyRemoteWithdrawal(amount: number): Promise<WithdrawalRecord> {
  const response = await withdrawalApi.apply({ applyWithdrawalRequest: { amount } });
  return requireValue<WithdrawalRecord>(response, "提现申请提交失败");
}

export async function initializeRemoteFaceVerification() {
  return accountApi.initializeFaceVerification();
}

export async function completeRemoteRealPersonVerification(): Promise<Partial<SprixState["account"]>> {
  const response = await accountApi.completeRealPersonVerification();
  return mapAccount(requireValue<UserAccount>(response, "实人认证失败"));
}

export async function signRemoteFreelancerAgreement(): Promise<Partial<SprixState["account"]>> {
  const response = await accountApi.signFreelancerAgreement();
  return mapAccount(requireValue<UserAccount>(response, "签署协议失败"));
}

export function mapRemoteWithdrawal(record: WithdrawalRecord): Withdrawal {
  return {
    backendId: record.id,
    withdrawalNo: record.withdrawalNo ?? record.id ?? "",
    userName: compactId(record.userId, "用户"),
    userPhone: "",
    verifiedName: "已实名用户",
    alipayAccount: record.alipayAccount ?? "-",
    realNameMatchStatus: record.realNameMatchStatus === "PASSED" ? "已通过" : "未通过",
    withdrawableBalance: record.amount ?? 0,
    applyAmount: record.amount ?? 0,
    estimatedArrivalTime: record.estimatedArrivalTime ?? "1-3 个工作日",
    appliedAt: formatDateTime(record.appliedAt ?? record.createdAt),
    withdrawStatus: mapWithdrawStatus(record.status),
    reviewer: record.reviewer ?? "-"
  };
}

function requireValue<T>(value: T | undefined, fallbackMessage: string): T {
  if (value == null) throw new Error(fallbackMessage);
  return value;
}

function listValue<T>(value: T[] | undefined): T[] {
  return value ?? [];
}

function mapAccount(account: UserAccount): Partial<SprixState["account"]> {
  return {
    nickname: account.nickname ?? "Xiaoxiao",
    email: account.email ?? "",
    phone: account.phone ?? "",
    maskedPhone: maskPhone(account.phone),
    phoneVerified: Boolean(account.phone),
    qualificationStatus: mapQualificationStatus(account.qualificationStatus),
    realPersonVerified: Boolean(account.realPersonVerified),
    freelancerAgreementSigned: Boolean(account.freelancerAgreementSigned),
    withdrawableAmount: account.withdrawableAmount ?? 0
  };
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

function mapAgent(agent: AgentProfileResponse): Agent {
  const status = mapAgentStatus(agent.status);
  const tags = splitTags(agent.abilityTags);
  const score = agent.score ?? null;
  return {
    id: agent.id ?? "",
    name: agent.name ?? "Unnamed Agent",
    status,
    role: agent.currentExecution ? "当前执行 Agent" : status === "已连接" ? "已连接 Agent" : status === "已断开" ? "曾连接 Agent" : "待连接",
    score,
    lastEvaluatedAt: formatDateTime(agent.lastEvaluatedAt) || "未有记录",
    summary: tags.length ? tags.join("、") : "等待能力评测",
    tags,
    profile:
      typeof score === "number"
        ? {
            requirement: clamp(score - 4),
            stability: clamp(score - 2),
            delivery: clamp(score),
            quality: clamp(score - 1)
          }
        : undefined
  };
}

function mapMyTask(record: TaskExecution, taskById: Map<string, Task>, agentById: Map<string, Agent>): MyTask {
  const task = taskById.get(record.taskId ?? "");
  const agent = agentById.get(record.agentId ?? "");
  return {
    id: record.id ?? "",
    taskId: record.taskId ?? "",
    title: task?.title ?? "未命名任务",
    category: task?.category ?? "未分类",
    reward: task?.reward ?? 0,
    status: mapMyTaskStatus(record.status),
    agentId: record.agentId ?? "",
    agentName: agent?.name ?? "Agent",
    startedAt: formatDateTime(record.startedAt ?? record.createdAt),
    completedAt: formatDateTime(record.completedAt),
    currentNode: mapCurrentNode(record.currentNode),
    progress: record.progress ?? "0%",
    score: record.status === "ACCEPTANCE_FAILED" ? "72/100" : undefined,
    appealStatus: mapAppealStatus(record.appealStatus),
    settlementStatus: mapSettlementStatus(record.settlementStatus),
    rejectReason: record.status === "ACCEPTANCE_FAILED" ? "后端验收结果未通过，可发起申诉。" : undefined
  };
}

function mapTaskStatus(status?: string): TaskStatus {
  if (status === "OFFLINE") return "已下线";
  if (status === "DELETED") return "已删除";
  return "已发布";
}

function mapAgentStatus(status?: string): Agent["status"] {
  if (status === "CONNECTED") return "已连接";
  if (status === "DISCONNECTED") return "已断开";
  return "可连接";
}

function mapMyTaskStatus(status?: string): MyTaskStatus {
  if (status === "TERMINATED") return "已终止";
  if (status === "ACCEPTANCE_FAILED") return "验收未通过";
  if (status === "SETTLING") return "结算中";
  if (status === "SETTLED" || status === "COMPLETED") return "已结算";
  return "执行中";
}

function mapAppealStatus(status?: string): AppealStatus {
  if (status === "NOT_APPEALED") return "未申诉";
  if (status === "PENDING") return "待处理";
  if (status === "PROCESSING") return "处理中";
  if (status === "APPROVED") return "申诉通过";
  if (status === "REJECTED") return "申诉不通过";
  if (status === "NONE") return "无申诉";
  return "无申诉";
}

function mapSettlementStatus(status?: string): SettlementStatus {
  if (status === "SETTLING") return "结算中";
  if (status === "POSTED" || status === "SETTLED") return "已入账";
  if (status === "FAILED") return "结算异常";
  return "未入账";
}

function mapWithdrawStatus(status?: string): Withdrawal["withdrawStatus"] {
  if (status === "PENDING_PAYOUT") return "待打款";
  if (status === "PAID") return "已提现";
  if (status === "PAYOUT_FAILED") return "打款失败";
  if (status === "REJECTED") return "已驳回";
  if (status === "NEED_ACCOUNT_CHANGE" || status === "ACCOUNT_CHANGE_REQUIRED") return "需更换账户";
  return "提现审核中";
}

function mapQualificationStatus(status?: string): SprixState["account"]["qualificationStatus"] {
  if (status === "VERIFIED" || status === "ACTIVE") return "已开通";
  if (status === "FROZEN") return "已冻结";
  return "未开通";
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

function splitTags(tags?: string) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tagText[tag] ?? tag);
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

function maskPhone(phone?: string) {
  if (!phone || phone.length < 7) return phone ?? "";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function compactId(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  return `${fallback}-${value.slice(-4)}`;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
