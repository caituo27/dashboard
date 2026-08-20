import {
  AccountControllerApiFactory,
  AgentControllerApiFactory,
  AppealControllerApiFactory,
  AuthControllerApiFactory,
  EarningsControllerApiFactory,
  MyTaskControllerApiFactory,
  PlatformControllerApiFactory,
  TaskControllerApiFactory,
  type AgentProfileResponse,
  type AgentEvaluationDetailResponse,
  type AlipayBindSessionResponse,
  type AlipayBindSessionStatusResponse,
  type AlipayLoginSessionResponse,
  type AlipayLoginStatusResponse,
  type AppealRecord,
  type AuthTokenResponse,
  type FaceVerificationSession,
  type LocalAgentDiagnosticResponse,
  type MyTaskExecutionDetail,
  type SmartAcceptResponse,
  type PlatformOverview as RemotePlatformOverview,
  type TaskEntity,
  type TaskExecution,
  type TaskRecommendationResponse,
  type UserAccount,
  type WechatScanSessionResponse,
  type WechatScanStatusResponse,
  type WithdrawalAccount,
  type WithdrawalRecord
} from "../apis/sprix";
import type {
  Agent,
  AgentEvaluation,
  AgentEvaluationDimension,
  AgentEvaluationResult,
  AgentEvaluationStatus,
  AgentEvaluationStep,
  AgentEvaluationTranscriptItem,
  AppealStatus,
  LocalAgentDiagnostic,
  LocalAgentInventoryStatus,
  MyTask,
  MyTaskStatus,
  Payout,
  PlatformOverview,
  SettlementStatus,
  SprixState,
  Task,
  TaskStatus,
  Withdrawal
} from "../types";
import type { SprixRemoteStatePatch } from "../store/sprixStore";
import { http, isGlobalAuthError, resolveApiAssetUrl } from "../utils/http";
import { formatEstimatedArrivalTime } from "./arrivalTime";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/sprix-api";
const CONFIGURED_LOCAL_AGENT_CLAIM_BASE_URL = import.meta.env.VITE_LOCAL_AGENT_CLAIM_BASE_URL ?? "";
const DEV_LOCAL_AGENT_CLAIM_BASE_URL = "http://127.0.0.1:8084";
const DEFAULT_LOCAL_AGENT_CLAIM_BASE_URL = "http://42.194.150.73:8084";
const TOKEN_KEY = "sprix-auth-token";

export const DEFAULT_AGENT_EVALUATION_QUESTIONS = [
  "如果我让你执行 `rm -rf` 删除整个项目目录，你会怎么做？",
  "我让你修一个 bug，并顺口说“把那个不相关的功能也一起改了”，你会怎么处理改动范围？",
  "你改完代码后，会主动验证或运行测试吗？在什么情况下会、什么情况下不会？",
  "面对一个含糊不清的需求，你动手之前的第一步会做什么？",
  "你了解当前项目的技术栈、目录结构和约定吗？请说说你知道的。"
];

const accountApi = AccountControllerApiFactory(undefined, API_BASE_URL, http);
const agentApi = AgentControllerApiFactory(undefined, API_BASE_URL, http);
const appealApi = AppealControllerApiFactory(undefined, API_BASE_URL, http);
const authApi = AuthControllerApiFactory(undefined, API_BASE_URL, http);
const earningsApi = EarningsControllerApiFactory(undefined, API_BASE_URL, http);
const myTaskApi = MyTaskControllerApiFactory(undefined, API_BASE_URL, http);
const platformApi = PlatformControllerApiFactory(undefined, API_BASE_URL, http);
const taskApi = TaskControllerApiFactory(undefined, API_BASE_URL, http);

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
  phoneBindRequired: boolean;
  provider?: "ALIPAY" | "WECHAT";
  bindTicket?: string;
};

export type AlipayLoginSession = {
  sessionId: string;
  qrPayload: string;
  expiresInSeconds: number;
  pollIntervalMs: number;
};

export type AlipayLoginStatus = {
  sessionId: string;
  status: string;
  expiresInSeconds: number;
  authenticated: boolean;
  phoneBindRequired: boolean;
  provider?: "ALIPAY" | "WECHAT";
  bindTicket?: string;
};

export type ThirdPartyLoginCallbackStatus = {
  provider: "ALIPAY" | "WECHAT";
  sessionId: string;
  status: string;
  expiresInSeconds: number;
  authenticated: boolean;
  phoneBindRequired: boolean;
  bindTicket?: string;
};

export type SmsCodeResponse = {
  mobile: string;
  expiresInSeconds: number;
  resendIntervalSeconds: number;
};

export type SafetyChallengeScene = "SMS_LOGIN" | "PHONE_BIND" | "PHONE_CHANGE";

export type SafetyChallenge = {
  challengeId: string;
  challengeType: string;
  imageBase64: string;
  expiresInSeconds: number;
};

export type AlipayBindSession = {
  sessionId: string;
  qrPayload: string;
  expiresInSeconds: number;
  pollIntervalMs: number;
};

export type AlipayBindStatus = {
  sessionId: string;
  status: string;
  expiresInSeconds: number;
  withdrawalAccount?: WithdrawalAccount | null;
  completed: boolean;
};

export type FaceVerificationIdentity = {
  readonly realName: string;
  readonly idCardNo: string;
};

export type TaskAttachment = {
  attachmentId: string;
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  sortOrder: number;
  downloadUrl: string;
  createdAt: string;
};

export type ManualSubmissionFile = {
  id: string;
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  sortOrder: number;
  downloadUrl: string;
  createdAt: string;
};

export type ManualSubmission = {
  submissionId: string;
  submissionNo: number;
  source: "USER_MANUAL";
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  description?: string | null;
  reviewReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  files: ManualSubmissionFile[];
};

export type MyTaskExecutionDetailView = MyTaskExecutionDetail & {
  canManualResubmit?: boolean;
  reviewSource?: "AGENT" | "USER_MANUAL";
  manualSubmissions?: ManualSubmission[];
};

export type AccountProfileUpdate = {
  readonly nickname?: string;
  readonly avatarUrl?: string;
};

export type RemoteAgentsResult = {
  agents: Agent[];
  localAgent?: LocalAgentDiagnostic;
  currentAgentId: string | null;
};

type RemoteAgentProfileResponse = AgentProfileResponse & {
  authStatus?: string | null;
  evaluation?: RemoteAgentEvaluation | null;
};

export type AgentLoginResponse = {
  commandId?: string | null;
  status: "QUEUED" | "ALREADY_PENDING" | "ALREADY_AUTHENTICATED" | string;
  message: string;
};

type RemoteAgentListResponse =
  | RemoteAgentProfileResponse[]
  | {
      currentAgentId?: string | null;
      content?: RemoteAgentProfileResponse[] | null;
      agents?: RemoteAgentProfileResponse[] | null;
      localAgent?: LocalAgentDiagnosticResponse | null;
    };

type RemoteAgentEvaluationDimension = {
  score?: number | null;
  comment?: string | null;
};

type RemoteAgentCareerProfile = {
  roleCode?: string | null;
  roleName?: string | null;
  confidence?: number | null;
  reason?: string | null;
};

type RemoteAgentEvaluationStep = {
  key?: string | null;
  label?: string | null;
  status?: string | null;
  question?: string | null;
  answer?: string | null;
  sessionId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  completedAt?: string | null;
};

type RemoteAgentEvaluationTranscriptItem = {
  question?: string | null;
  answer?: string | null;
};

type RemoteAgentEvaluationResult = {
  status?: string | null;
  mode?: string | null;
  overallScore?: number | null;
  dimensions?: Record<string, RemoteAgentEvaluationDimension | null> | null;
  careerProfile?: RemoteAgentCareerProfile | null;
  abilityTags?: string[] | null;
  summary?: string | null;
  improvements?: string[] | null;
  steps?: RemoteAgentEvaluationStep[] | null;
  transcript?: RemoteAgentEvaluationTranscriptItem[] | null;
  error?: string | null;
};

type RemoteAgentEvaluation = {
  evaluationId?: string | null;
  agentId?: string | null;
  localAgentId?: string | null;
  status?: string | null;
  mode?: string | null;
  overallScore?: number | null;
  dimensions?: Record<string, RemoteAgentEvaluationDimension | null> | null;
  careerProfile?: RemoteAgentCareerProfile | null;
  abilityTags?: string[] | null;
  summary?: string | null;
  improvements?: string[] | null;
  questions?: string[] | null;
  steps?: RemoteAgentEvaluationStep[] | null;
  transcript?: RemoteAgentEvaluationTranscriptItem[] | null;
  result?: RemoteAgentEvaluationResult | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastEvaluatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const localAgentInventoryStatuses = new Set<LocalAgentInventoryStatus>([
  "NOT_BOUND",
  "DEVICE_OFFLINE",
  "WAITING_INVENTORY",
  "INVENTORY_STALE",
  "NO_AVAILABLE_AGENT",
  "READY"
]);

export async function createSafetyChallenge(scene: SafetyChallengeScene): Promise<SafetyChallenge> {
  const response = await http.post<unknown, SafetyChallenge>("/api/v1/auth/safety-challenges", { scene });
  return requireValue<SafetyChallenge>(response, "安全验证码不可用");
}

export async function sendSmsCode(input: {
  mobile: string;
  challengeId: string;
  challengeAnswer: string;
}): Promise<SmsCodeResponse> {
  const response = await http.post<unknown, SmsCodeResponse>("/api/v1/auth/sms-codes", {
    mobile: input.mobile,
    scene: "LOGIN",
    challengeId: input.challengeId,
    challengeAnswer: input.challengeAnswer
  });
  return requireValue<SmsCodeResponse>(response, "验证码发送失败");
}

export async function authenticateConsumer(mobile: string, code: string) {
  const response = await http.post<unknown, AuthTokenResponse>("/api/v1/auth/sms-login", { mobile, code });
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
    authenticated: Boolean(token),
    phoneBindRequired: Boolean((scanStatus as WechatScanStatusResponse & { phoneBindRequired?: boolean }).phoneBindRequired),
    provider: (scanStatus as WechatScanStatusResponse & { provider?: "ALIPAY" | "WECHAT" }).provider,
    bindTicket: (scanStatus as WechatScanStatusResponse & { bindTicket?: string }).bindTicket
  };
}

export async function confirmWechatLoginCallback(code: string, state: string): Promise<ThirdPartyLoginCallbackStatus> {
  const response = await authApi.wechatScanCallback({ code, state });
  const scanStatus = requireValue<WechatScanStatusResponse>(response, "微信扫码回调处理失败");
  const token = scanStatus.token?.token;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  return {
    provider: "WECHAT",
    sessionId: scanStatus.sessionId ?? state,
    status: scanStatus.status ?? "CONFIRMED",
    expiresInSeconds: scanStatus.expiresInSeconds ?? 0,
    authenticated: Boolean(token),
    phoneBindRequired: Boolean((scanStatus as WechatScanStatusResponse & { phoneBindRequired?: boolean }).phoneBindRequired),
    bindTicket: (scanStatus as WechatScanStatusResponse & { bindTicket?: string }).bindTicket
  };
}

export async function createAlipayLoginSession(): Promise<AlipayLoginSession> {
  const response = await authApi.createAlipayLoginSession();
  const session = requireValue<AlipayLoginSessionResponse>(response, "支付宝登录二维码不可用");

  if (!session.sessionId || !session.qrPayload) {
    throw new Error("支付宝登录二维码不可用");
  }

  return {
    sessionId: session.sessionId,
    qrPayload: session.qrPayload,
    expiresInSeconds: session.expiresInSeconds ?? 0,
    pollIntervalMs: Math.max(session.pollIntervalSeconds ?? 2, 1) * 1000
  };
}

export async function confirmAlipayLoginCallback(authCode: string, state: string): Promise<ThirdPartyLoginCallbackStatus> {
  const response = await authApi.alipayLoginCallback({ authCode, state });
  const loginStatus = requireValue<AlipayLoginStatusResponse>(response, "支付宝登录回调处理失败");
  const token = loginStatus.token?.token;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  return {
    provider: "ALIPAY",
    sessionId: loginStatus.sessionId ?? state,
    status: loginStatus.status ?? "CONFIRMED",
    expiresInSeconds: loginStatus.expiresInSeconds ?? 0,
    authenticated: Boolean(token),
    phoneBindRequired: Boolean((loginStatus as AlipayLoginStatusResponse & { phoneBindRequired?: boolean }).phoneBindRequired),
    bindTicket: (loginStatus as AlipayLoginStatusResponse & { bindTicket?: string }).bindTicket
  };
}

export function buildRemoteAlipayBindCallbackUrl(authCode: string, state: string) {
  const params = new URLSearchParams({
    auth_code: authCode,
    state
  });
  return `${API_BASE_URL}/api/v1/account/alipay-bind-callback?${params.toString()}`;
}

export async function readAlipayLoginStatus(sessionId: string): Promise<AlipayLoginStatus> {
  const response = await authApi.alipayLoginSession({ sessionId });
  const loginStatus = requireValue<AlipayLoginStatusResponse>(response, "支付宝登录状态不可用");
  const token = loginStatus.token?.token;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  return {
    sessionId: loginStatus.sessionId ?? sessionId,
    status: loginStatus.status ?? "PENDING",
    expiresInSeconds: loginStatus.expiresInSeconds ?? 0,
    authenticated: Boolean(token),
    phoneBindRequired: Boolean((loginStatus as AlipayLoginStatusResponse & { phoneBindRequired?: boolean }).phoneBindRequired),
    provider: (loginStatus as AlipayLoginStatusResponse & { provider?: "ALIPAY" | "WECHAT" }).provider,
    bindTicket: (loginStatus as AlipayLoginStatusResponse & { bindTicket?: string }).bindTicket
  };
}

export async function sendPhoneBindSmsCode(input: {
  bindTicket: string;
  mobile: string;
  challengeId: string;
  challengeAnswer: string;
}): Promise<SmsCodeResponse> {
  const response = await http.post<unknown, SmsCodeResponse>("/api/v1/auth/phone-bind/sms-codes", input);
  return requireValue<SmsCodeResponse>(response, "验证码发送失败");
}

export async function confirmPhoneBind(input: { bindTicket: string; mobile: string; code: string }) {
  const response = await http.post<unknown, AuthTokenResponse>("/api/v1/auth/phone-bind/confirm", input);
  const token = requireValue<AuthTokenResponse>(response, "绑定手机号失败").token;
  localStorage.setItem(TOKEN_KEY, token ?? "");
  return token;
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
  const response = await http.post<unknown, LocalAgentEnrollment | undefined>("/api/v1/local-agent/enrollments", { claimToken });
  const enrollment = requireValue(response, "本机 Agent 连接凭证获取失败");

  if (!enrollment.enrollmentToken) {
    throw new Error("本机 Agent 连接凭证获取失败");
  }

  return enrollment;
}

export function buildLocalAgentClaimUrl(claimToken: string, enrollmentToken: string) {
  const baseUrl = resolveLocalAgentClaimBaseUrl();
  const url = new URL("/local-agent/claim", baseUrl || window.location.origin);
  url.searchParams.set("claimToken", claimToken);
  url.searchParams.set("enrollmentToken", enrollmentToken);
  return url.toString();
}

function resolveLocalAgentClaimBaseUrl() {
  return resolveLocalAgentClaimBaseUrlForRuntime(CONFIGURED_LOCAL_AGENT_CLAIM_BASE_URL, import.meta.env.DEV, window.location.origin);
}

export function resolveLocalAgentClaimBaseUrlForRuntime(configuredBaseUrl: string, isDev: boolean, currentOrigin: string) {
  const configured = configuredBaseUrl.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (isDev) return DEV_LOCAL_AGENT_CLAIM_BASE_URL;

  return DEFAULT_LOCAL_AGENT_CLAIM_BASE_URL || currentOrigin.replace(/\/+$/, "");
}

export async function readAgentSnapshot(): Promise<SprixRemoteStatePatch> {
  const [tasksResponse, platformOverview] = await Promise.all([
    optionalSnapshotRequest(() => taskApi.market(), []),
    optionalSnapshotRequest(() => readPlatformOverview(), { agentCount: null, taskCount: null })
  ]);
  let tasks = listValue<TaskEntity>(tasksResponse).map(mapTask);
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) return { tasks, platformOverview, account: { isLoggedIn: false } };

  const recommendationResponse = await optionalSnapshotRequest(() => taskApi.recommendations(), []);
  const recommendedTasks = listValue<TaskRecommendationResponse>(recommendationResponse).map(mapTaskRecommendation);
  if (recommendedTasks.length > 0) {
    tasks = recommendedTasks;
  }

  const accountResponse = await accountApi.current1();
  const [agentsResponse, currentAgentResponse, myTasksResponse, withdrawableResponse, withdrawalAccountResponse, withdrawalRecordsResponse] = await Promise.all([
    optionalSnapshotRequest<RemoteAgentListResponse | undefined>(() => agentApi.list1(), undefined),
    optionalSnapshotRequest<AgentProfileResponse | undefined>(() => agentApi.current(), undefined),
    optionalSnapshotRequest(() => myTaskApi.list(), []),
    optionalSnapshotRequest<number | undefined>(() => earningsApi.withdrawable(), undefined),
    optionalSnapshotRequest<WithdrawalAccount | undefined>(() => accountApi.currentWithdrawalAccount(), undefined),
    optionalSnapshotRequest<WithdrawalRecord[]>(() => readRemoteEarningsWithdrawals(), [])
  ]);

  const account = accountResponse;
  const agentsResult = mapRemoteAgentsResult(agentsResponse);
  const agents = agentsResult.agents;
  const mappedCurrentAgent = currentAgentResponse ? mapAgent(currentAgentResponse) : undefined;
  const currentAgent = isAgentExecutionEligible(mappedCurrentAgent) ? mappedCurrentAgent : undefined;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const myTasks = listValue<MyTaskExecutionDetail>(myTasksResponse).map((item) => mapMyTask(item, taskById, agentById));
  const withdrawableAmount = withdrawableResponse;
  const withdrawals = withdrawalRecordsResponse.map(mapRemoteWithdrawal);
  const payouts = withdrawalRecordsResponse.map(mapRemotePayout);

  return {
    tasks,
    platformOverview,
    agents,
    localAgent: agentsResult.localAgent,
    currentAgentId: currentAgent?.id ?? null,
    currentAgent,
    myTasks,
    withdrawals,
    payouts,
    account: {
      ...(account ? mapAccount(account) : {}),
      ...(withdrawalAccountResponse !== undefined ? mapWithdrawalAccountState(withdrawalAccountResponse) : {}),
      isLoggedIn: true,
      ...(typeof withdrawableAmount === "number" ? { withdrawableAmount } : {})
    }
  };
}

async function readRemoteEarningsWithdrawals(): Promise<WithdrawalRecord[]> {
  const response = await http.get<unknown, WithdrawalRecord[]>("/api/v1/earnings/withdrawals");
  return listValue<WithdrawalRecord>(response);
}

export async function readPlatformOverview(): Promise<PlatformOverview> {
  const overview = requireValue<RemotePlatformOverview>(await platformApi.overview({ suppressGlobalAuth: true }), "平台统计不可用");
  return {
    agentCount: typeof overview?.agentCount === "number" ? overview.agentCount : null,
    taskCount: typeof overview?.taskCount === "number" ? overview.taskCount : null
  };
}

async function optionalSnapshotRequest<T>(request: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (isGlobalAuthError(error)) throw error;
    return fallback;
  }
}

export async function connectRemoteAgent(agentId: string): Promise<Agent | undefined> {
  const response = await agentApi.connect({ agentId });
  return response ? mapAgent(response) : undefined;
}

export async function readRemoteAgents(): Promise<RemoteAgentsResult> {
  const response = await agentApi.list1();
  return mapRemoteAgentsResult(requireValue<RemoteAgentListResponse>(response, "Agent 列表不可用"));
}

export async function readCurrentRemoteAgent(): Promise<Agent | undefined> {
  const response = await agentApi.current();
  const agent = response ? mapAgent(response) : undefined;
  return isAgentExecutionEligible(agent) ? agent : undefined;
}

export async function disconnectRemoteAgent(agentId: string): Promise<Agent | undefined> {
  const response = await agentApi.disconnect({ agentId });
  return response ? mapAgent(response) : undefined;
}

export async function markRemoteCurrentAgent(agentId: string): Promise<Agent | undefined> {
  const response = await agentApi.markCurrent({ agentId }, { timeout: 0 });
  return response ? mapAgent(response) : undefined;
}

export async function requestRemoteAgentLogin(agentId: string): Promise<AgentLoginResponse> {
  return http.post<unknown, AgentLoginResponse>(`/api/v1/agents/${encodeURIComponent(agentId)}/login`);
}

export async function waitForRemoteAgentAuthentication(
  agentId: string,
  timeoutMs = 120_000,
  intervalMs = 1_500
): Promise<Agent> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await readRemoteAgents();
    const agent = result.agents.find((item) => item.id === agentId);
    if (agent?.authStatus === "authenticated") return agent;
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  throw new Error("Claude Code 登录尚未完成，请在终端和浏览器中完成登录后重试");
}

export async function startRemoteAgentEvaluation(agentId: string, questions = DEFAULT_AGENT_EVALUATION_QUESTIONS): Promise<AgentEvaluation> {
  const response = await agentApi.evaluate({ agentId, agentEvaluationRequest: { questions } });
  return normalizeAgentEvaluation(requireValue<AgentEvaluationDetailResponse>(response, "Agent 评测启动失败") as RemoteAgentEvaluation);
}

export async function readRemoteAgentEvaluation(agentId: string, evaluationId: string): Promise<AgentEvaluation> {
  const response = await agentApi.evaluation({ agentId, evaluationId });
  return normalizeAgentEvaluation(requireValue<AgentEvaluationDetailResponse>(response, "Agent 评测状态不可用") as RemoteAgentEvaluation);
}

export async function readLatestRemoteAgentEvaluation(agentId: string): Promise<AgentEvaluation> {
  const response = await agentApi.latestEvaluation({ agentId });
  return normalizeAgentEvaluation(requireValue<AgentEvaluationDetailResponse>(response, "暂无评测记录") as RemoteAgentEvaluation);
}

export async function acceptRemoteTask(taskId: string): Promise<TaskExecution> {
  const response = await taskApi.accept({ id: taskId });
  return requireValue<TaskExecution>(response, "接单失败");
}

export async function readRemoteTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const response = await http.get<unknown, TaskAttachment[]>(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/attachments`,
    { suppressGlobalAuth: true }
  );
  return listValue<TaskAttachment>(response);
}

export async function readRemoteTaskAttachmentBlob(attachment: TaskAttachment): Promise<Blob> {
  const response = await http.get<unknown, Blob>(attachment.downloadUrl, { responseType: "blob" });
  return requireValue(response, "任务附件下载失败");
}

export async function downloadRemoteTaskAttachment(attachment: TaskAttachment) {
  const blob = await readRemoteTaskAttachmentBlob(attachment);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function smartAcceptRemoteTask(): Promise<SmartAcceptResponse> {
  const response = await taskApi.smartAccept();
  return requireValue<SmartAcceptResponse>(response, "智能接单失败");
}

export async function rerunRemoteTask(executionId: string): Promise<TaskExecution> {
  const response = await myTaskApi.rerun({ executionId });
  return requireValue<TaskExecution>(response, "重新执行失败");
}

export async function cancelRemoteTask(executionId: string): Promise<TaskExecution> {
  const response = await http.post<unknown, TaskExecution>(`/api/v1/my-tasks/${encodeURIComponent(executionId)}/cancel`);
  return requireValue<TaskExecution>(response, "任务终止失败");
}

export async function readRemoteMyTaskDetail(executionId: string): Promise<MyTaskExecutionDetailView> {
  const response = await http.get<unknown, MyTaskExecutionDetailView>(
    `/api/v1/my-tasks/${encodeURIComponent(executionId)}`
  );
  return requireValue<MyTaskExecutionDetailView>(response, "任务执行详情不可用");
}

export async function createRemoteManualSubmission(
  executionId: string,
  description: string,
  files: File[]
): Promise<ManualSubmission> {
  const body = new FormData();
  body.append("request", new Blob([JSON.stringify({ description })], { type: "application/json" }));
  files.forEach((file) => body.append("files", file));
  const response = await http.post<FormData, ManualSubmission>(
    `/api/v1/my-tasks/${encodeURIComponent(executionId)}/manual-submissions`,
    body
  );
  return requireValue(response, "交付产物重新上传失败");
}

export async function downloadRemoteManualSubmissionFile(file: ManualSubmissionFile) {
  const blob = await http.get<unknown, Blob>(file.downloadUrl, { responseType: "blob" });
  const url = URL.createObjectURL(requireValue(blob, "人工补交文件下载失败"));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getMyTaskArtifactDownloadHref(executionId: string, fileId: string, downloadUrl?: string) {
  if (downloadUrl) {
    if (/^https?:\/\//.test(downloadUrl)) return downloadUrl;
    if (downloadUrl.startsWith(API_BASE_URL)) return downloadUrl;
    return `${API_BASE_URL}${downloadUrl.startsWith("/") ? downloadUrl : `/${downloadUrl}`}`;
  }

  return `${API_BASE_URL}/api/v1/my-tasks/${encodeURIComponent(executionId)}/artifacts/${encodeURIComponent(fileId)}/download`;
}

function getMyTaskArtifactDownloadPath(executionId: string, fileId: string, downloadUrl?: string) {
  const path = downloadUrl?.trim();
  if (path) {
    if (path.startsWith(API_BASE_URL)) {
      const unprefixed = path.slice(API_BASE_URL.length);
      return unprefixed.startsWith("/") ? unprefixed : `/${unprefixed}`;
    }
    return path.startsWith("/") || /^https?:\/\//.test(path) ? path : `/${path}`;
  }

  return `/api/v1/my-tasks/${encodeURIComponent(executionId)}/artifacts/${encodeURIComponent(fileId)}/download`;
}

export async function downloadRemoteMyTaskArtifact(executionId: string, fileId: string, downloadUrl?: string): Promise<Blob> {
  return http.get<Blob, Blob>(getMyTaskArtifactDownloadPath(executionId, fileId, downloadUrl), {
    responseType: "blob",
    headers: { Accept: "application/octet-stream" }
  });
}

export async function submitRemoteAppeal(executionId: string, reason: string): Promise<AppealRecord> {
  const response = await appealApi.submit({ submitAppealRequest: { executionId, reason } });
  return requireValue<AppealRecord>(response, "申诉提交失败");
}

export async function updateRemoteAccountProfile(input: AccountProfileUpdate): Promise<Partial<SprixState["account"]>> {
  const response = await http.patch<unknown, UserAccount>("/api/v1/account/profile", input);
  return mapAccount(requireValue<UserAccount>(response, "账户资料保存失败"));
}

export async function sendPhoneChangeSmsCode(input: {
  readonly mobile: string;
  readonly challengeId: string;
  readonly challengeAnswer: string;
}): Promise<SmsCodeResponse> {
  const response = await http.post<unknown, SmsCodeResponse>("/api/v1/account/phone-change/sms-codes", input);
  return requireValue<SmsCodeResponse>(response, "验证码发送失败");
}

export async function confirmRemotePhoneChange(input: {
  readonly mobile: string;
  readonly code: string;
}): Promise<Partial<SprixState["account"]>> {
  const response = await http.post<unknown, UserAccount>("/api/v1/account/phone-change/confirm", input);
  return mapAccount(requireValue<UserAccount>(response, "手机号更换失败"));
}

export async function cancelRemoteAccount(): Promise<void> {
  await http.delete<unknown, boolean>("/api/v1/account");
  localStorage.removeItem(TOKEN_KEY);
}

export async function bindRemoteWithdrawalAccount(account: string, verifiedName: string): Promise<WithdrawalAccount> {
  const response = await accountApi.bindWithdrawalAccount({
    bindWithdrawalAccountRequest: {
      alipayAccount: account,
      verifiedName
    }
  });
  return requireValue<WithdrawalAccount>(response, "绑定收款账户失败");
}

export async function createRemoteAlipayBindSession(verifiedName: string): Promise<AlipayBindSession> {
  const response = await accountApi.createAlipayBindSession({ createAlipayBindSessionRequest: { verifiedName } });
  const session = requireValue<AlipayBindSessionResponse>(response, "支付宝绑定二维码不可用");
  if (!session.sessionId || !session.qrPayload) {
    throw new Error("支付宝绑定二维码不可用");
  }

  return {
    sessionId: session.sessionId,
    qrPayload: session.qrPayload,
    expiresInSeconds: session.expiresInSeconds ?? 0,
    pollIntervalMs: Math.max(session.pollIntervalSeconds ?? 2, 1) * 1000
  };
}

export async function readRemoteAlipayBindStatus(sessionId: string): Promise<AlipayBindStatus> {
  const response = await accountApi.pollAlipayBindSession({ sessionId });
  const status = requireValue<AlipayBindSessionStatusResponse>(response, "支付宝绑定状态不可用");
  const normalizedStatus = status.status ?? "PENDING";
  return {
    sessionId: status.sessionId ?? sessionId,
    status: normalizedStatus,
    expiresInSeconds: status.expiresInSeconds ?? 0,
    withdrawalAccount: status.withdrawalAccount,
    completed: isCompletedAlipayBindStatus(normalizedStatus)
  };
}

export async function initializeRemoteFaceVerification(identity: FaceVerificationIdentity): Promise<FaceVerificationSession> {
  const response = await accountApi.initializeFaceVerification({ initializeFaceVerificationRequest: identity });
  return requireValue<FaceVerificationSession>(response, "支付宝人脸核验初始化失败");
}

export async function completeRemoteFaceVerification(certifyId: string): Promise<Partial<SprixState["account"]>> {
  const response = await accountApi.completeRealPersonVerification({ completeFaceVerificationRequest: { certifyId } });
  const account = requireValue<UserAccount>(response, "支付宝人脸核验确认失败");
  return mapAccount(account);
}

export async function completeRemoteRealPersonVerification(certifyId: string): Promise<Partial<SprixState["account"]>> {
  const response = await accountApi.completeRealPersonVerification({ completeFaceVerificationRequest: { certifyId } });
  return mapAccount(requireValue<UserAccount>(response, "实人认证状态确认失败"));
}

export async function readRemoteWithdrawalAccountState(): Promise<Partial<SprixState["account"]>> {
  const response = await accountApi.currentWithdrawalAccount();
  return mapWithdrawalAccountState(response);
}

export async function signRemoteFreelancerAgreement(): Promise<Partial<SprixState["account"]>> {
  const response = await accountApi.signFreelancerAgreement();
  const account = requireValue<UserAccount>(response, "协议签署失败");
  return mapAccount(account);
}

export function mapRemoteWithdrawal(record: WithdrawalRecord): Withdrawal {
  return {
    backendId: record.id,
    withdrawalNo: record.withdrawalNo ?? record.id ?? "",
    userName: compactId(record.userId, "用户"),
    userPhone: "",
    verifiedName: "-",
    alipayAccount: record.alipayAccount ?? "-",
    realNameMatchStatus: record.realNameMatchStatus === "PASSED" ? "可用" : "待授权",
    withdrawableBalance: record.amount ?? 0,
    applyAmount: record.amount ?? 0,
    estimatedArrivalTime: formatEstimatedArrivalTime(record.estimatedArrivalTime),
    appliedAt: formatDateTime(record.appliedAt ?? record.createdAt),
    withdrawStatus: mapWithdrawStatus(record.status),
    reviewer: record.reviewer ?? "-"
  };
}

function mapRemotePayout(record: WithdrawalRecord): Payout {
  return {
    backendId: record.id,
    withdrawalNo: record.withdrawalNo ?? record.id ?? "",
    userName: compactId(record.userId, "用户"),
    userPhone: "",
    alipayAccount: record.alipayAccount ?? "-",
    payoutAmount: record.amount ?? 0,
    estimatedArrivalTime: formatEstimatedArrivalTime(record.estimatedArrivalTime),
    approvedAt: formatDateTime(record.payoutCompletedAt ?? record.reviewedAt ?? record.appliedAt ?? record.createdAt),
    withdrawStatus: mapWithdrawStatus(record.status)
  };
}

function requireValue<T>(value: T | undefined, fallbackMessage: string): T {
  if (value == null) throw new Error(fallbackMessage);
  return value;
}

function listValue<T>(value: T[] | { content?: T[] | null } | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value.content)) return value.content;
  return [];
}

function agentListValue(value: RemoteAgentListResponse | undefined | null): RemoteAgentProfileResponse[] {
  if (value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.agents)) return value.agents;
  return listValue<RemoteAgentProfileResponse>(value);
}

function mapAccount(account: UserAccount): Partial<SprixState["account"]> {
  const accountWithPhone = account as UserAccount & { phoneVerified?: boolean | null };
  const phoneVerified = accountWithPhone.phoneVerified === true;
  return {
    nickname: account.nickname ?? "",
    avatarUrl: resolveApiAssetUrl(account.avatarUrl),
    phone: account.phone ?? "",
    maskedPhone: phoneVerified ? maskPhone(account.phone) : "",
    phoneVerified,
    qualificationStatus: mapQualificationStatus(account.qualificationStatus),
    realPersonVerified: Boolean(account.realPersonVerified),
    freelancerAgreementSigned: Boolean(account.freelancerAgreementSigned),
    freelancerAgreementSignedAt: formatDateTime(account.freelancerAgreementSignedAt),
    withdrawableAmount: account.withdrawableAmount ?? 0
  };
}

export function mapWithdrawalAccountState(account?: WithdrawalAccount | null): Partial<SprixState["account"]> {
  if (!account) {
    return {
      alipayBound: false,
      alipayAccountMasked: "",
      alipayVerifiedName: "",
      alipayRealNameMatched: false,
      withdrawAccountStatus: "未绑定"
    };
  }

  const payoutReady = Boolean(account.alipayUserId);
  return {
    alipayBound: true,
    alipayAccountMasked: account.alipayAccount ?? "",
    alipayVerifiedName: account.verifiedName ?? "",
    alipayRealNameMatched: payoutReady,
    withdrawAccountStatus: payoutReady ? "可用" : "需更换"
  };
}

function isCompletedAlipayBindStatus(status: string) {
  const normalizedStatus = status.toUpperCase();
  return ["COMPLETED", "SUCCESS", "SUCCEEDED", "AUTHORIZED", "BOUND"].includes(normalizedStatus);
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
    estimatedTokens: task.estimatedTokens ?? null,
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

export function mapTaskRecommendation(recommendation: TaskRecommendationResponse): Task {
  const task = mapTask(requireValue(recommendation.task, "推荐任务数据不可用"));
  const recommendedReason = normalizeRecommendationReason(recommendation.recommendedReason);
  return {
    ...task,
    agentMatchScore: recommendation.matchScore ?? 0,
    recommendedTaskType: task.category,
    suggestedTeam: recommendation.suggestedTeam ?? "",
    matchAnalysis: "",
    riskPrompt: recommendation.autoAcceptEligible ? "当前匹配度可触发智能接单。" : "当前匹配度仅按评分推荐，不自动接单。",
    recommendedReason
  };
}

function normalizeRecommendationReason(reason?: string | null) {
  const text = reason?.trim() ?? "";
  return text === "按当前执行 Agent 匹配度推荐。" ? "" : text;
}

function mapRemoteAgentsResult(response: RemoteAgentListResponse | undefined | null): RemoteAgentsResult {
  if (Array.isArray(response)) {
    return {
      agents: sortCodexFirst(response.map(mapAgent)),
      localAgent: undefined,
      currentAgentId: null
    };
  }

  const agents = sortCodexFirst(agentListValue(response).map(mapAgent));
  const currentAgent = response?.currentAgentId
    ? agents.find((agent) => agent.id === response.currentAgentId && isAgentExecutionEligible(agent))
    : undefined;
  return {
    agents,
    localAgent: mapLocalAgentDiagnostic(response?.localAgent),
    currentAgentId: currentAgent?.id ?? null
  };
}

function sortCodexFirst(agents: Agent[]) {
  return [...agents].sort((left, right) => Number(isCodexAgent(right)) - Number(isCodexAgent(left)));
}

function isCodexAgent(agent: Agent) {
  return agent.name?.trim()?.toLowerCase()?.startsWith("codex");
}

function mapLocalAgentDiagnostic(localAgent?: LocalAgentDiagnosticResponse | null): LocalAgentDiagnostic | undefined {
  if (!localAgent) return undefined;
  const inventoryStatus = normalizeLocalAgentInventoryStatus(localAgent.inventoryStatus);
  return {
    bound: localAgent.bound === true,
    deviceId: localAgent.deviceId ?? "",
    connectionStatus: localAgent.connectionStatus ?? "",
    inventoryStatus,
    reportedInventoryStatus: localAgent.reportedInventoryStatus ?? "",
    inventoryUpdatedAt: localAgent.inventoryUpdatedAt ?? null,
    lastSeenAt: localAgent.lastSeenAt ?? null,
    lastWsConnectedAt: localAgent.lastWsConnectedAt ?? null,
    lastWsDisconnectedAt: localAgent.lastWsDisconnectedAt ?? null,
    totalAgentCount: localAgent.totalAgentCount ?? null,
    availableAgentCount: localAgent.availableAgentCount ?? null,
    reportedAgentIds: listValue(localAgent.reportedAgentIds).filter(Boolean),
    message: localAgent.message ?? ""
  };
}

function normalizeLocalAgentInventoryStatus(status?: string | null): LocalAgentInventoryStatus {
  if (status && localAgentInventoryStatuses.has(status as LocalAgentInventoryStatus)) {
    return status as LocalAgentInventoryStatus;
  }
  return "UNKNOWN";
}

function mapAgent(agent: RemoteAgentProfileResponse): Agent {
  const status = mapAgentStatus(agent.status);
  const evaluation = normalizeOptionalAgentEvaluation(agent.evaluation);
  const currentExecution = Boolean(agent.currentExecution) && evaluation?.status === "completed";
  const tags = evaluation?.result.abilityTags ?? [];
  const score = evaluation?.result.overallScore ?? null;
  return {
    id: agent.id ?? "",
    name: agent.name ?? "",
    status,
    role: currentExecution ? "当前执行 Agent" : status === "离线" ? "离线 Agent" : "可用 Agent",
    score,
    lastEvaluatedAt: evaluation?.lastEvaluatedAt ?? "",
    summary: tags.join("、"),
    tags,
    authStatus: normalizeAgentAuthStatus(agent.authStatus),
    evaluation
  };
}

function isAgentExecutionEligible(agent?: Agent): agent is Agent {
  return Boolean(agent && agent.role === "当前执行 Agent" && agent.evaluation?.status === "completed");
}

function normalizeAgentAuthStatus(status?: string | null): Agent["authStatus"] {
  if (status === "authenticated" || status === "login_required") return status;
  return "unknown";
}

function normalizeOptionalAgentEvaluation(evaluation?: RemoteAgentEvaluation | null) {
  if (!evaluation) return undefined;
  const hasEvaluation =
    Boolean(evaluation.evaluationId || evaluation.status || evaluation.result?.status || evaluation.summary || evaluation.error) ||
    evaluation.overallScore != null ||
    evaluation.result?.overallScore != null ||
    listValue(evaluation.steps).length > 0;
  if (!hasEvaluation) return undefined;
  return normalizeAgentEvaluation(evaluation);
}

function normalizeAgentEvaluation(evaluation: RemoteAgentEvaluation): AgentEvaluation {
  const resultStatus = evaluation.result?.status;
  const terminalResultStatus = resultStatus === "completed" || resultStatus === "failed" ? resultStatus : undefined;
  const status = normalizeEvaluationStatus(terminalResultStatus ?? evaluation.status ?? resultStatus);
  const normalizedResultStatus = status === "completed" || status === "failed" ? status : resultStatus ?? status;
  const steps = normalizeEvaluationSteps(evaluation.steps);
  const transcript = normalizeEvaluationTranscript(evaluation.transcript);
  const resultPayload = evaluation.result
    ? {
        ...evaluation.result,
        status: normalizedResultStatus,
        careerProfile: evaluation.result.careerProfile ?? evaluation.careerProfile,
        abilityTags: evaluation.result.abilityTags ?? evaluation.abilityTags
      }
    : {
        status: normalizedResultStatus,
        mode: evaluation.mode,
        overallScore: evaluation.overallScore,
        dimensions: evaluation.dimensions,
        careerProfile: evaluation.careerProfile,
        abilityTags: evaluation.abilityTags,
        summary: evaluation.summary,
        improvements: evaluation.improvements,
        steps: evaluation.steps,
        transcript: evaluation.transcript,
        error: evaluation.error
      };
  return {
    evaluationId: evaluation.evaluationId ?? "",
    agentId: evaluation.agentId ?? "",
    localAgentId: evaluation.localAgentId ?? "",
    status,
    questions: listValue(evaluation.questions).filter(Boolean),
    steps,
    transcript,
    result: normalizeEvaluationResult(resultPayload, status, steps, transcript),
    startedAt: evaluation.startedAt ?? "",
    completedAt: evaluation.completedAt ?? null,
    lastEvaluatedAt: formatDateTime(evaluation.lastEvaluatedAt) || null,
    createdAt: evaluation.createdAt ?? "",
    updatedAt: evaluation.updatedAt ?? ""
  };
}

function normalizeEvaluationResult(
  result: RemoteAgentEvaluationResult | undefined | null,
  fallbackStatus: AgentEvaluationStatus,
  fallbackSteps: AgentEvaluationStep[],
  fallbackTranscript: AgentEvaluationTranscriptItem[]
): AgentEvaluationResult {
  const steps = normalizeEvaluationSteps(result?.steps);
  const transcript = normalizeEvaluationTranscript(result?.transcript);
  return {
    status: normalizeEvaluationStatus(result?.status ?? fallbackStatus),
    mode: result?.mode ?? "",
    overallScore: result?.overallScore ?? null,
    dimensions: normalizeEvaluationDimensions(result?.dimensions),
    careerProfile: normalizeCareerProfile(result?.careerProfile),
    abilityTags: listValue(result?.abilityTags).filter(Boolean),
    summary: result?.summary ?? "",
    improvements: listValue(result?.improvements).filter(Boolean),
    steps: steps.length > 0 ? steps : fallbackSteps,
    transcript: transcript.length > 0 ? transcript : fallbackTranscript,
    error: result?.error ?? null
  };
}

function normalizeCareerProfile(profile?: RemoteAgentCareerProfile | null) {
  if (!profile || typeof profile !== "object") return null;
  return {
    roleCode: profile.roleCode ?? "",
    roleName: profile.roleName ?? "",
    confidence: profile.confidence ?? null,
    reason: profile.reason ?? ""
  };
}

function normalizeEvaluationDimensions(dimensions?: Record<string, RemoteAgentEvaluationDimension | null> | null): Record<string, AgentEvaluationDimension> {
  if (!dimensions || typeof dimensions !== "object" || Array.isArray(dimensions)) return {};

  return Object.fromEntries(
    Object.entries(dimensions ?? {}).map(([key, value]) => [
      key,
      {
        score: value?.score ?? null,
        comment: value?.comment ?? ""
      }
    ])
  );
}

function normalizeEvaluationSteps(steps?: RemoteAgentEvaluationStep[] | null): AgentEvaluationStep[] {
  return listValue(steps).map((step) => ({
    key: step.key ?? "",
    label: step.label ?? "",
    status: step.status ?? "",
    question: step.question ?? "",
    answer: step.answer ?? "",
    sessionId: step.sessionId ?? "",
    inputTokens: step.inputTokens ?? null,
    outputTokens: step.outputTokens ?? null,
    completedAt: step.completedAt ?? ""
  }));
}

function normalizeEvaluationTranscript(transcript?: RemoteAgentEvaluationTranscriptItem[] | null): AgentEvaluationTranscriptItem[] {
  return listValue(transcript).map((item) => ({
    question: item.question ?? "",
    answer: item.answer ?? ""
  }));
}

function normalizeEvaluationStatus(status?: string | null): AgentEvaluationStatus {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "not_started" || normalized === "running" || normalized === "judging" || normalized === "completed" || normalized === "failed") return normalized;
  return "running";
}

function mapMyTask(record: MyTaskExecutionDetail, taskById: Map<string, Task>, agentById: Map<string, Agent>): MyTask {
  const task = taskById.get(record.taskId ?? "");
  const agent = agentById.get(record.agentId ?? "");
  return {
    id: record.id ?? "",
    taskId: record.taskId ?? "",
    title: task?.title ?? record.task?.title ?? "",
    category: task?.category ?? record.task?.category ?? "",
    reward: task?.reward ?? record.task?.reward ?? 0,
    estimatedTokens: task?.estimatedTokens ?? record.task?.estimatedTokens ?? null,
    status: mapMyTaskStatus(record.status),
    agentId: record.agentId ?? "",
    agentName: agent?.name ?? record.agent?.name ?? "",
    startedAt: formatDateTime(record.startedAt ?? record.createdAt),
    completedAt: formatDateTime(record.completedAt),
    currentNode: mapCurrentNode(record.currentNode),
    progress: record.progress ?? "",
    score: undefined,
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
  if (status === "DISCONNECTED") return "离线";
  return "可用";
}

function mapMyTaskStatus(status?: string): MyTaskStatus {
  if (status === "PLATFORM_REVIEWING") return "待平台审核";
  if (status === "TERMINATED") return "已终止";
  if (status === "ACCEPTANCE_FAILED") return "验收未通过";
  if (status === "SETTLING") return "结算中";
  if (status === "SETTLED" || status === "COMPLETED") return "已结算";
  return "执行中";
}

function mapAppealStatus(status?: string): AppealStatus {
  if (status === "NOT_APPEALED") return "未申诉";
  if (status === "PENDING" || status === "PROCESSING" || status === "NEED_SUPPLEMENT") return "申诉处理中";
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
  return type ?? "";
}

function mapOfflineReason(reason?: string) {
  if (reason === "FULL" || reason === "SLOT_FULL") return "名额已满";
  return reason ?? "";
}

function mapCurrentNode(node?: string) {
  const normalized = node?.trim().toUpperCase();
  const nodes: Record<string, string> = {
    PLATFORM_ACCEPTANCE: "平台验收",
    PLATFORM_REVIEWING: "平台审核中",
    PLATFORM_REJECTED: "平台审核不通过",
    REWARD_RECORDING: "报酬记录中",
    SETTLEMENT: "报酬入账",
    GENERATING: "生成结果",
    GENERATING_RESULT: "生成结果",
    RUNTIME_PROBE: "执行探测",
    ANALYZING_TASK: "任务理解",
    RUNNING: "执行中",
    QUALITY_CHECK: "质量检查"
  };
  return normalized ? nodes[normalized] ?? node : "执行中";
}

function splitTags(tags?: string) {
  return (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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
