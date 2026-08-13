export type TaskStatus = "已发布" | "已下线" | "已删除";
export type OfflineReason = string;
export type AgentStatus = "可用" | "已连接" | "离线";
export type AgentRole = "当前执行 Agent" | "可用 Agent" | "离线 Agent";
export type AgentAuthStatus = "authenticated" | "login_required" | "unknown";
export type LocalAgentInventoryStatus =
  | "UNKNOWN"
  | "NOT_BOUND"
  | "DEVICE_OFFLINE"
  | "WAITING_INVENTORY"
  | "INVENTORY_STALE"
  | "NO_AVAILABLE_AGENT"
  | "READY";
export type AgentEvaluationStatus = "not_started" | "running" | "judging" | "completed" | "failed";
export type MyTaskStatus = "执行中" | "待平台审核" | "已终止" | "验收未通过" | "结算中" | "已结算";
export type AppealStatus =
  | "无申诉"
  | "未申诉"
  | "申诉处理中"
  | "待处理"
  | "处理中"
  | "需补充材料"
  | "申诉通过"
  | "申诉不通过"
  | "高风险";
export type SettlementStatus = "未入账" | "结算中" | "已入账" | "结算异常";
export type WithdrawStatus =
  | "提现审核中"
  | "待打款"
  | "已提现"
  | "打款失败"
  | "已驳回"
  | "需更换账户";

export type Account = {
  isLoggedIn: boolean;
  nickname: string;
  avatarUrl: string;
  maskedPhone: string;
  phone: string;
  phoneVerified: boolean;
  qualificationStatus: "未开通" | "已开通" | "已冻结";
  realPersonVerified: boolean;
  freelancerAgreementSigned: boolean;
  freelancerAgreementSignedAt: string;
  alipayBound: boolean;
  alipayAccountMasked: string;
  alipayVerifiedName: string;
  alipayRealNameMatched: boolean;
  withdrawAccountStatus: "未绑定" | "可用" | "需更换";
  withdrawableAmount: number;
};

export type AgentProfile = {
  requirement: number;
  stability: number;
  delivery: number;
  quality: number;
};

export type AgentEvaluationDimension = {
  score: number | null;
  comment: string;
};

export type AgentCareerProfile = {
  roleCode: string;
  roleName: string;
  confidence: number | null;
  reason: string;
};

export type AgentEvaluationStep = {
  key: string;
  label: string;
  status: string;
  question: string;
  answer: string;
  sessionId: string;
  inputTokens: number | null;
  outputTokens: number | null;
  completedAt: string;
};

export type AgentEvaluationTranscriptItem = {
  question: string;
  answer: string;
};

export type AgentEvaluationResult = {
  status: AgentEvaluationStatus;
  mode: string;
  overallScore: number | null;
  dimensions: Record<string, AgentEvaluationDimension>;
  careerProfile: AgentCareerProfile | null;
  abilityTags: string[];
  summary: string;
  improvements: string[];
  steps: AgentEvaluationStep[];
  transcript: AgentEvaluationTranscriptItem[];
  error: string | null;
};

export type AgentEvaluation = {
  evaluationId: string;
  agentId: string;
  localAgentId: string;
  status: AgentEvaluationStatus;
  questions: string[];
  steps: AgentEvaluationStep[];
  transcript: AgentEvaluationTranscriptItem[];
  result: AgentEvaluationResult;
  startedAt: string;
  completedAt: string | null;
  lastEvaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Agent = {
  id: string;
  name: string;
  status: AgentStatus;
  role: AgentRole;
  score: number | null;
  lastEvaluatedAt: string;
  summary: string;
  tags: string[];
  authStatus?: AgentAuthStatus;
  profile?: AgentProfile;
  evaluation?: AgentEvaluation;
};

export type LocalAgentDiagnostic = {
  bound: boolean;
  deviceId: string;
  connectionStatus: string;
  inventoryStatus: LocalAgentInventoryStatus;
  reportedInventoryStatus: string;
  inventoryUpdatedAt: string | null;
  lastSeenAt: string | null;
  lastWsConnectedAt: string | null;
  lastWsDisconnectedAt: string | null;
  totalAgentCount: number | null;
  availableAgentCount: number | null;
  reportedAgentIds: string[];
  message: string;
};

export type Task = {
  id: string;
  title: string;
  category: string;
  sourceName: string;
  sourceType: string;
  description: string;
  cardSummary: string;
  deliverables: string;
  acceptanceCriteria: string;
  reward: number;
  estimatedTokens: number | null;
  totalSlots: number;
  remainingSlots: number;
  publishedAt: string;
  taskStatus: TaskStatus;
  offlineReason: OfflineReason;
  agentMatchScore: number;
  recommendedTaskType: string;
  suggestedTeam: string;
  matchAnalysis: string;
  riskPrompt: string;
  recommendedReason: string;
  submittedFiles: string[];
  resultFiles: string[];
  acceptanceResult: string;
};

export type MyTask = {
  id: string;
  taskId: string;
  title: string;
  category: string;
  reward: number;
  estimatedTokens: number | null;
  status: MyTaskStatus;
  agentId: string;
  agentName: string;
  startedAt: string;
  completedAt?: string;
  currentNode: string;
  progress: string;
  score?: string;
  appealStatus?: AppealStatus;
  appealNo?: string;
  settlementStatus: SettlementStatus;
  rejectReason?: string;
};

export type RunningExecution = {
  userName: string;
  phone: string;
  agentName: string;
  agentScore: string;
  currentNode: string;
  progress: string;
  startedAt: string;
};

export type TerminatedExecution = {
  userName: string;
  phone: string;
  agentName: string;
  terminationReason: string;
  terminatedNode: string;
  terminatedAt: string;
};

export type CompletedExecution = {
  userName: string;
  phone: string;
  agentName: string;
  acceptanceStatus: string;
  score: string;
  appealStatus: string;
  settlementStatus: string;
  completedAt: string;
};

export type AdminExecutionRecords = Record<
  string,
  {
    running: RunningExecution[];
    terminated: TerminatedExecution[];
    completed: CompletedExecution[];
  }
>;

export type AdminAppeal = {
  backendId?: string;
  appealNo: string;
  taskTitle: string;
  taskCategory: string;
  userName: string;
  userPhone: string;
  agentName: string;
  issueSummary: string;
  appealReason: string;
  appealStatus: AppealStatus;
  priority: "普通" | "加急" | "高风险";
  submittedAt: string;
  handler: string;
  expectedProcessTime: string;
  originalScore: string;
  originalRejectReason: string;
  userSupplement?: string;
  resultDescription?: string;
  linkedMyTaskId?: string;
  processLogs: string[];
};

export type Settlement = {
  settlementNo: string;
  taskTitle: string;
  userName: string;
  userPhone: string;
  agentName: string;
  taskIncome: number;
  platformFee: number;
  netIncome: number;
  settlementStatus: SettlementStatus;
  createdAt: string;
  paidAt: string;
  sourceAppealNo?: string;
};

export type Withdrawal = {
  backendId?: string;
  withdrawalNo: string;
  userName: string;
  userPhone: string;
  verifiedName: string;
  alipayAccount: string;
  realNameMatchStatus: "可用" | "待授权";
  withdrawableBalance: number;
  applyAmount: number;
  estimatedArrivalTime: string;
  appliedAt: string;
  withdrawStatus: WithdrawStatus;
  reviewer: string;
};

export type Payout = {
  backendId?: string;
  withdrawalNo: string;
  userName: string;
  userPhone: string;
  alipayAccount: string;
  payoutAmount: number;
  estimatedArrivalTime: string;
  approvedAt: string;
  withdrawStatus: WithdrawStatus;
};

export type FundException = {
  exceptionNo: string;
  withdrawalNo: string;
  userName: string;
  userPhone: string;
  alipayAccount: string;
  exceptionType: string;
  exceptionAmount: number;
  currentStatus: string;
  occurredAt: string;
};

export type FundFlow = {
  flowNo: string;
  flowType: string;
  userName: string;
  taskTitle: string;
  withdrawalNo: string;
  amount: number;
  beforeStatus: string;
  afterStatus: string;
  operator: string;
  occurredAt: string;
  remark: string;
};

export type PlatformOverview = {
  agentCount: number | null;
  taskCount: number | null;
};

export type SprixState = {
  account: Account;
  platformOverview: PlatformOverview;
  agents: Agent[];
  localAgent?: LocalAgentDiagnostic;
  currentAgentId?: string | null;
  currentAgent?: Agent;
  smartAcceptEnabled: boolean;
  tasks: Task[];
  myTasks: MyTask[];
  adminExecutionRecords: AdminExecutionRecords;
  adminAppeals: AdminAppeal[];
  settlements: Settlement[];
  withdrawals: Withdrawal[];
  payouts: Payout[];
  fundExceptions: FundException[];
  fundFlows: FundFlow[];
  signedAgreements: string[];
};
