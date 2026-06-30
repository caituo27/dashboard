export type TaskStatus = "已发布" | "已下线" | "已删除";
export type OfflineReason = string;
export type AgentStatus = "可连接" | "已连接" | "已断开";
export type AgentRole = "当前执行 Agent" | "已连接 Agent" | "曾连接 Agent" | "待连接";
export type MyTaskStatus = "执行中" | "已终止" | "验收未通过" | "结算中" | "已结算";
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
  email: string;
  maskedPhone: string;
  phone: string;
  phoneVerified: boolean;
  qualificationStatus: "未开通" | "已开通" | "已冻结";
  realPersonVerified: boolean;
  freelancerAgreementSigned: boolean;
  alipayBound: boolean;
  alipayAccountMasked: string;
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

export type Agent = {
  id: string;
  name: string;
  status: AgentStatus;
  role: AgentRole;
  score: number | null;
  lastEvaluatedAt: string;
  summary: string;
  tags: string[];
  profile?: AgentProfile;
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
  executionTotal?: number;
  runningExecutionCount?: number;
  reviewingExecutionCount?: number;
  completedExecutionCount?: number;
  terminatedExecutionCount?: number;
};

export type MyTask = {
  id: string;
  taskId: string;
  title: string;
  category: string;
  reward: number;
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
  executionId?: string;
  executionIndex?: number;
  userName: string;
  phone: string;
  agentName: string;
  agentScore: string;
  currentNode: string;
  progress: string;
  startedAt: string;
};

export type TerminatedExecution = {
  executionId?: string;
  executionIndex?: number;
  userName: string;
  phone: string;
  agentName: string;
  terminationReason: string;
  terminatedNode: string;
  terminatedAt: string;
};

export type ReviewingExecution = {
  executionId: string;
  taskId?: string;
  taskTitle?: string;
  taskCategory?: string;
  userName: string;
  phone: string;
  agentName: string;
  agentScore: string;
  acceptanceStatus: string;
  acceptanceScore: string;
  acceptanceSummary: string;
  acceptanceIssues: string;
  currentNode: string;
  progress: string;
  submittedAt: string;
};

export type CompletedExecution = {
  executionId?: string;
  executionIndex?: number;
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
    reviewing: ReviewingExecution[];
    terminated: TerminatedExecution[];
    completed: CompletedExecution[];
  }
>;

export type AdminOperationLog = {
  id: string;
  action: string;
  beforeStatus: string;
  afterStatus: string;
  reason: string;
  occurredAt: string;
};

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
  expectedProcessTime?: string;
  originalScore?: string;
  originalRejectReason?: string;
  userSupplement?: string;
  resultDescription?: string;
  linkedMyTaskId?: string;
  executionId?: string;
  executionIndex?: number;
  deliverables?: string;
  acceptanceCriteria?: string;
  processLogs: string[];
};

export type Settlement = {
  backendId?: string;
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
  reviewReason?: string;
  payoutFailureReason?: string;
  exceptionRemark?: string;
  payoutProvider?: string;
  payoutOutBizNo?: string;
  payoutOrderId?: string;
  payoutStatus?: string;
  payoutRequestedAt?: string;
  payoutCompletedAt?: string;
  payoutLastQueriedAt?: string;
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
  payoutProvider?: string;
  payoutOutBizNo?: string;
  payoutOrderId?: string;
  payoutStatus?: string;
  payoutRequestedAt?: string;
  payoutCompletedAt?: string;
  payoutLastQueriedAt?: string;
};

export type FundException = {
  backendId?: string;
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

export type SprixState = {
  account: Account;
  agents: Agent[];
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
