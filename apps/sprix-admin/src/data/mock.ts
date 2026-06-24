import type {
  Account,
  AdminAppeal,
  AdminExecutionRecords,
  Agent,
  AppealStatus,
  FundException,
  FundFlow,
  MyTask,
  Payout,
  Settlement,
  SprixState,
  Task,
  Withdrawal
} from "../types";

export const nowText = "2026-06-23 20:19";

const summarize = (text: string) => text.slice(0, 80);

export const account: Account = {
  isLoggedIn: false,
  nickname: "Xiaoxiao",
  email: "vyneleven@gmail.com",
  maskedPhone: "138****8624",
  phone: "13800008624",
  phoneVerified: true,
  qualificationStatus: "未开通",
  realPersonVerified: false,
  freelancerAgreementSigned: false,
  alipayBound: false,
  alipayAccountMasked: "",
  alipayRealNameMatched: false,
  withdrawAccountStatus: "未绑定",
  withdrawableAmount: 640
};

export const agents: Agent[] = [
  {
    id: "codex",
    name: "Codex Agent",
    status: "已连接",
    role: "当前执行 Agent",
    score: 92,
    lastEvaluatedAt: "2026-06-23 20:19",
    summary: "研发与网页生成",
    tags: ["软件开发", "网页生成", "代码修复"],
    profile: { requirement: 88, stability: 86, delivery: 90, quality: 91 }
  },
  {
    id: "workbuddy",
    name: "WorkBuddy Agent",
    status: "已断开",
    role: "曾连接 Agent",
    score: 89,
    lastEvaluatedAt: "2026-06-23 15:07",
    summary: "流程执行与办公自动化",
    tags: ["流程执行", "文档处理", "自动化办公"],
    profile: { requirement: 84, stability: 89, delivery: 86, quality: 87 }
  },
  {
    id: "openclaw",
    name: "OpenClaw Agent",
    status: "已断开",
    role: "曾连接 Agent",
    score: 88,
    lastEvaluatedAt: "2026-06-23 15:07",
    summary: "检索、归纳与事实校验",
    tags: ["信息检索", "报告归纳", "事实校验"],
    profile: { requirement: 86, stability: 85, delivery: 88, quality: 89 }
  },
  {
    id: "dataflow",
    name: "DataFlow Agent",
    status: "可连接",
    role: "待连接",
    score: null,
    lastEvaluatedAt: "未有记录",
    summary: "数据处理与流程编排",
    tags: []
  }
];

const descriptions = [
  "根据企业官网、招聘页和公开线索表，补全公司名称、联系人、业务分类、官网地址、城市、邮箱与字段置信度，并输出可复核的结构化表格。",
  "采集跨境电商竞品页面中的商品卖点、价格区间、物流承诺、评价关键词和差异化标签，形成竞品信息对比表。",
  "将候选人简历中的教育经历、工作经历、技能标签、项目成果和风险提示归档为统一结构，便于招聘团队快速筛选。",
  "阅读指定金融资讯，生成摘要、行业标签、风险标签和事实依据，帮助运营同学快速判断资讯优先级。",
  "对 SaaS 客户反馈进行主题聚类，识别高频问题、影响模块、情绪强度和可跟进建议，输出产品改进线索。",
  "校验本地生活商家的营业状态、地址、联系电话、营业时间和服务项目，标注信息冲突和待人工确认项。",
  "抽取法律合同中的核心条款、权责边界、违约条款、续约条件和风险提示，生成面向业务方的要点清单。",
  "根据客服知识库问答对，校准问题意图、标准答案、跳转链接和边界场景，提升智能客服回答稳定性。"
];

export const tasks: Task[] = [
  "企业官网线索清洗与字段补全",
  "跨境电商竞品页面信息采集",
  "招聘候选人简历结构化归档",
  "金融资讯摘要与风险标签标注",
  "SaaS 客户反馈主题聚类",
  "本地生活商家资料校验",
  "法律合同条款要点抽取",
  "智能客服知识库问答校准"
].map((title, index) => {
  const id = [
    "task-leads-cleaning",
    "task-competitor-collection",
    "task-resume-archive",
    "task-finance-tags",
    "task-feedback-cluster",
    "task-merchant-check",
    "task-contract-extract",
    "task-kb-calibration"
  ][index];
  const totalSlots = [12, 10, 8, 16, 18, 20, 9, 14][index];
  const remainingSlots = [8, 0, 5, 11, 12, 7, 3, 9][index];
  const offlineFull = index === 1;
  const description = descriptions[index];
  return {
    id,
    title,
    category: ["数据处理", "市场研究", "HR 招聘", "金融资讯", "客户反馈", "本地生活", "法律合同", "智能客服"][index],
    sourceName: "Sprix AI 平台",
    sourceType: ["平台任务", "平台任务", "企业协作", "平台任务", "企业协作", "平台任务", "企业协作", "平台任务"][index],
    description,
    cardSummary: summarize(description),
    deliverables: "提交结构化结果表、字段依据说明和需要人工复核的异常清单。",
    acceptanceCriteria: "字段完整、来源可追溯、异常标注清晰，抽样复核通过率不低于 90%。",
    reward: [180, 240, 160, 210, 200, 120, 260, 150][index],
    totalSlots,
    remainingSlots,
    publishedAt: `2026-06-${23 - (index % 4)} 10:${10 + index}`,
    taskStatus: offlineFull ? "已下线" : "已发布",
    offlineReason: offlineFull ? "名额已满" : "",
    agentMatchScore: [96, 92, 89, 91, 94, 87, 88, 90][index],
    recommendedTaskType: ["数据清洗", "信息采集", "结构化归档", "资讯标注"][index % 4],
    suggestedTeam: index % 2 === 0 ? "Codex Agent + DataFlow Agent" : "WorkBuddy Agent + OpenClaw Agent",
    matchAnalysis: "当前执行 Agent 对字段整理、流程拆解和质量自检能力匹配度较高，适合直接执行。",
    riskPrompt: "请保持来源链接、字段置信度和异常说明完整，避免缺少复核依据。",
    recommendedReason: "与当前 Agent 能力画像匹配，任务边界清晰，交付标准明确。",
    submittedFiles: ["result-table.xlsx", "evidence-notes.md"],
    resultFiles: ["accepted-output.xlsx"],
    acceptanceResult: "平台验收认为字段覆盖完整，抽样复核结果稳定。"
  };
});

export const myTasks: MyTask[] = [
  {
    id: "exec-1001",
    taskId: "task-leads-cleaning",
    title: "企业官网线索清洗与字段补全",
    category: "数据处理",
    reward: 180,
    status: "验收未通过",
    agentId: "codex",
    agentName: "Codex Agent",
    startedAt: "2026-06-22 17:20",
    completedAt: "2026-06-22 18:45",
    currentNode: "平台验收",
    progress: "100%",
    score: "72/100",
    appealStatus: "未申诉",
    appealNo: "AP20260623001",
    settlementStatus: "未入账",
    rejectReason: "部分字段缺少来源说明，异常线索未完整标注。"
  },
  {
    id: "exec-1002",
    taskId: "task-feedback-cluster",
    title: "SaaS 客户反馈主题聚类",
    category: "客户反馈",
    reward: 200,
    status: "结算中",
    agentId: "codex",
    agentName: "Codex Agent",
    startedAt: "2026-06-23 09:20",
    completedAt: "2026-06-23 10:40",
    currentNode: "报酬入账",
    progress: "100%",
    score: "91/100",
    appealStatus: "无申诉" as AppealStatus,
    settlementStatus: "结算中"
  },
  {
    id: "exec-1003",
    taskId: "task-merchant-check",
    title: "本地生活商家资料校验",
    category: "本地生活",
    reward: 120,
    status: "已结算",
    agentId: "workbuddy",
    agentName: "WorkBuddy Agent",
    startedAt: "2026-06-22 19:10",
    completedAt: "2026-06-22 20:12",
    currentNode: "报酬入账",
    progress: "100%",
    score: "92/100",
    appealStatus: "无申诉" as AppealStatus,
    settlementStatus: "已入账"
  }
];

export const adminExecutionRecords: AdminExecutionRecords = {
  "task-leads-cleaning": {
    running: [
      {
        userName: "Xiaoxiao",
        phone: "13800008624",
        agentName: "Codex Agent",
        agentScore: "92/100",
        currentNode: "生成结果",
        progress: "65%",
        startedAt: "2026-06-23 11:18"
      }
    ],
    terminated: [
      {
        userName: "林知",
        phone: "13900006621",
        agentName: "WorkBuddy Agent",
        terminationReason: "Agent 连接断开",
        terminatedNode: "生成结果",
        terminatedAt: "2026-06-22 16:21"
      }
    ],
    completed: [
      {
        userName: "周明",
        phone: "13700001234",
        agentName: "Codex Agent",
        acceptanceStatus: "验收未通过",
        score: "72/100",
        appealStatus: "未申诉",
        settlementStatus: "未入账",
        completedAt: "2026-06-22 18:45"
      },
      {
        userName: "陈可",
        phone: "13600007888",
        agentName: "DataFlow Agent",
        acceptanceStatus: "验收未通过",
        score: "76/100",
        appealStatus: "申诉处理中",
        settlementStatus: "未入账",
        completedAt: "2026-06-22 20:10"
      },
      {
        userName: "王言",
        phone: "13500004567",
        agentName: "Codex Agent",
        acceptanceStatus: "验收通过",
        score: "91/100",
        appealStatus: "无申诉",
        settlementStatus: "结算中",
        completedAt: "2026-06-23 10:40"
      },
      {
        userName: "赵宁",
        phone: "13800009876",
        agentName: "WorkBuddy Agent",
        acceptanceStatus: "验收通过",
        score: "92/100",
        appealStatus: "无申诉",
        settlementStatus: "已入账",
        completedAt: "2026-06-22 20:12"
      }
    ]
  }
};

export const adminAppeals: AdminAppeal[] = [
  {
    appealNo: "AP20260623001",
    taskTitle: "企业官网线索清洗与字段补全",
    taskCategory: "数据处理",
    userName: "Xiaoxiao",
    userPhone: "13800008624",
    agentName: "Codex Agent",
    issueSummary: "用户认为字段来源已在补充说明中列明",
    appealReason: "交付内容包含企业官网链接和字段置信度，验收结果可能遗漏补充说明。",
    appealStatus: "待处理",
    priority: "普通",
    submittedAt: "2026-06-23 10:15",
    handler: "-",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "72/100",
    originalRejectReason: "部分字段缺少来源说明",
    linkedMyTaskId: "exec-1001",
    processLogs: ["用户提交申诉，等待平台处理"]
  },
  {
    appealNo: "AP20260623002",
    taskTitle: "简历筛选",
    taskCategory: "HR 招聘",
    userName: "陈可",
    userPhone: "13600007888",
    agentName: "DataFlow Agent",
    issueSummary: "用户认为匹配依据来自 JD 和简历原文",
    appealReason: "候选人排序已注明风险点和依据，部分评分项可能被重复扣分。",
    appealStatus: "处理中",
    priority: "加急",
    submittedAt: "2026-06-23 09:40",
    handler: "平台运营管理员",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "76/100",
    originalRejectReason: "部分候选人风险说明不够完整",
    processLogs: ["平台运营管理员开始处理"]
  },
  {
    appealNo: "AP20260623003",
    taskTitle: "客服知识库校准",
    taskCategory: "智能客服",
    userName: "许安",
    userPhone: "13900001111",
    agentName: "OpenClaw Agent",
    issueSummary: "用户认为边界问题已覆盖",
    appealReason: "标准答案中已补充跳转链接和边界说明。",
    appealStatus: "待处理",
    priority: "普通",
    submittedAt: "2026-06-23 11:22",
    handler: "-",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "74/100",
    originalRejectReason: "边界问答覆盖不足",
    processLogs: []
  },
  {
    appealNo: "AP20260623004",
    taskTitle: "门店资料校验",
    taskCategory: "本地生活",
    userName: "沈佳",
    userPhone: "13100003333",
    agentName: "WorkBuddy Agent",
    issueSummary: "用户补充门店营业截图",
    appealReason: "截图可证明营业状态与地址信息有效。",
    appealStatus: "需补充材料",
    priority: "普通",
    submittedAt: "2026-06-23 12:30",
    handler: "平台运营管理员",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "70/100",
    originalRejectReason: "缺少可核验材料",
    processLogs: ["已要求用户补充材料"]
  },
  {
    appealNo: "AP20260622007",
    taskTitle: "Logo 设计",
    taskCategory: "设计创意",
    userName: "王言",
    userPhone: "13500004567",
    agentName: "Codex Agent",
    issueSummary: "平台复核后认可交付满足文字方案要求",
    appealReason: "任务要求为设计方向和说明，不要求最终视觉稿。",
    appealStatus: "申诉通过",
    priority: "普通",
    submittedAt: "2026-06-22 16:20",
    handler: "平台运营管理员",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "78/100",
    originalRejectReason: "视觉落地不足",
    resultDescription: "复核后确认交付符合文字方案标准，任务进入结算中。",
    processLogs: ["复核通过"]
  },
  {
    appealNo: "AP20260622005",
    taskTitle: "市场分析报告",
    taskCategory: "数据分析",
    userName: "林知",
    userPhone: "13900006621",
    agentName: "WorkBuddy Agent",
    issueSummary: "用户认为引用信息已覆盖关键市场数据",
    appealReason: "报告中已列明多个公开信息来源。",
    appealStatus: "申诉不通过",
    priority: "普通",
    submittedAt: "2026-06-22 11:30",
    handler: "平台运营管理员",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "69/100",
    originalRejectReason: "核心数据来源缺少可追溯链接",
    resultDescription: "复核后维持原验收结论。",
    processLogs: ["复核不通过"]
  },
  {
    appealNo: "AP20260623006",
    taskTitle: "合同条款抽取",
    taskCategory: "法律合同",
    userName: "陆遥",
    userPhone: "13200004444",
    agentName: "OpenClaw Agent",
    issueSummary: "合同条款争议较大",
    appealReason: "用户认为违约责任条款已完整覆盖。",
    appealStatus: "高风险",
    priority: "高风险",
    submittedAt: "2026-06-23 13:11",
    handler: "平台运营管理员",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "68/100",
    originalRejectReason: "条款风险提示不完整",
    processLogs: ["已转高风险处理"]
  },
  {
    appealNo: "AP20260623008",
    taskTitle: "金融资讯风险标签",
    taskCategory: "金融资讯",
    userName: "季禾",
    userPhone: "13300005555",
    agentName: "Codex Agent",
    issueSummary: "用户认为风险标签映射正确",
    appealReason: "标签与资讯原文存在对应依据。",
    appealStatus: "处理中",
    priority: "普通",
    submittedAt: "2026-06-23 14:05",
    handler: "平台运营管理员",
    expectedProcessTime: "1-3 个工作日",
    originalScore: "75/100",
    originalRejectReason: "风险依据不充分",
    processLogs: ["平台运营管理员开始处理"]
  }
];

export const settlements: Settlement[] = [
  {
    settlementNo: "ST20260623001",
    taskTitle: "SaaS 客户反馈主题聚类",
    userName: "王言",
    userPhone: "13500004567",
    agentName: "Codex Agent",
    taskIncome: 200,
    platformFee: 20,
    netIncome: 180,
    settlementStatus: "结算中",
    createdAt: "2026-06-23 10:50",
    paidAt: "-"
  },
  {
    settlementNo: "ST20260623002",
    taskTitle: "Logo 设计",
    userName: "王言",
    userPhone: "13500004567",
    agentName: "Codex Agent",
    taskIncome: 260,
    platformFee: 26,
    netIncome: 234,
    settlementStatus: "结算中",
    createdAt: "2026-06-23 12:10",
    paidAt: "-"
  },
  ...[1, 2, 3].map((item) => ({
    settlementNo: `ST2026062200${item}`,
    taskTitle: ["本地生活商家资料校验", "智能客服知识库问答校准", "金融资讯摘要与风险标签标注"][item - 1],
    userName: ["赵宁", "沈佳", "季禾"][item - 1],
    userPhone: ["13800009876", "13100003333", "13300005555"][item - 1],
    agentName: ["WorkBuddy Agent", "OpenClaw Agent", "Codex Agent"][item - 1],
    taskIncome: [120, 150, 210][item - 1],
    platformFee: [12, 15, 21][item - 1],
    netIncome: [108, 135, 189][item - 1],
    settlementStatus: "已入账" as const,
    createdAt: "2026-06-22 20:30",
    paidAt: "2026-06-22 22:10"
  })),
  {
    settlementNo: "ST20260621009",
    taskTitle: "市场分析报告",
    userName: "林知",
    userPhone: "13900006621",
    agentName: "WorkBuddy Agent",
    taskIncome: 240,
    platformFee: 24,
    netIncome: 216,
    settlementStatus: "结算异常",
    createdAt: "2026-06-21 19:30",
    paidAt: "-"
  }
];

export const withdrawals: Withdrawal[] = [
  {
    withdrawalNo: "WD20260623001",
    userName: "Xiaoxiao",
    userPhone: "13800008624",
    verifiedName: "齐**",
    alipayAccount: "xia***@alipay.com",
    realNameMatchStatus: "已通过",
    withdrawableBalance: 640,
    applyAmount: 640,
    estimatedArrivalTime: "1-3 个工作日",
    appliedAt: "2026-06-23 12:20",
    withdrawStatus: "提现审核中",
    reviewer: "-"
  },
  ...[2, 3, 4, 5].map((item) => ({
    withdrawalNo: `WD2026062300${item}`,
    userName: ["王言", "赵宁", "沈佳", "陆遥"][item - 2],
    userPhone: ["13500004567", "13800009876", "13100003333", "13200004444"][item - 2],
    verifiedName: ["王*", "赵*", "沈*", "陆*"][item - 2],
    alipayAccount: ["yan***@alipay.com", "zhao***@alipay.com", "shen***@alipay.com", "lu***@alipay.com"][item - 2],
    realNameMatchStatus: item === 5 ? ("未通过" as const) : ("已通过" as const),
    withdrawableBalance: [980, 420, 760, 550][item - 2],
    applyAmount: [500, 420, 600, 550][item - 2],
    estimatedArrivalTime: "1-3 个工作日",
    appliedAt: `2026-06-23 1${item}:20`,
    withdrawStatus: item === 5 ? ("需更换账户" as const) : ("提现审核中" as const),
    reviewer: "-"
  }))
];

export const payouts: Payout[] = [1, 2, 3, 4].map((item) => ({
  withdrawalNo: `WD2026062200${item}`,
  userName: ["陈可", "林知", "季禾", "许安"][item - 1],
  userPhone: ["13600007888", "13900006621", "13300005555", "13900001111"][item - 1],
  alipayAccount: ["chen***@alipay.com", "lin***@alipay.com", "ji***@alipay.com", "xu***@alipay.com"][item - 1],
  payoutAmount: [520, 780, 340, 430][item - 1],
  estimatedArrivalTime: "1-3 个工作日",
  approvedAt: "2026-06-22 16:40",
  withdrawStatus: "待打款"
}));

export const fundExceptions: FundException[] = [
  "支付宝账户异常",
  "实名一致性失败",
  "打款失败",
  "提现金额异常"
].map((type, index) => ({
  exceptionNo: `EX2026062300${index + 1}`,
  withdrawalNo: `WD2026062100${index + 1}`,
  userName: ["林知", "陆遥", "沈佳", "王言"][index],
  userPhone: ["13900006621", "13200004444", "13100003333", "13500004567"][index],
  alipayAccount: ["lin***@alipay.com", "lu***@alipay.com", "shen***@alipay.com", "yan***@alipay.com"][index],
  exceptionType: type,
  exceptionAmount: [240, 550, 600, 920][index],
  currentStatus: "待处理",
  occurredAt: `2026-06-23 1${index}:08`
}));

export const fundFlows: FundFlow[] = [
  "任务结算入账",
  "申诉通过入账",
  "提现申请处理中",
  "提现审核通过",
  "提现驳回退回",
  "打款成功",
  "打款失败退回",
  "人工调整",
  "补结算",
  "提现申请处理中"
].map((type, index) => ({
  flowNo: `FL20260623${String(index + 1).padStart(3, "0")}`,
  flowType: type,
  userName: ["Xiaoxiao", "王言", "赵宁", "陈可", "林知"][index % 5],
  taskTitle: tasks[index % tasks.length].title,
  withdrawalNo: index > 1 ? `WD2026062300${index}` : "-",
  amount: [180, 234, -640, -500, 420, -780, 600, 120, 216, -320][index],
  beforeStatus: ["结算中", "申诉通过", "可提现", "提现审核中", "提现审核中"][index % 5],
  afterStatus: ["已入账", "结算中", "提现审核中", "待打款", "已驳回"][index % 5],
  operator: index < 3 ? "系统" : "平台运营管理员",
  occurredAt: `2026-06-23 ${10 + index}:20`,
  remark: "状态按平台资金规则同步。"
}));

export function createMockState(): SprixState {
  return structuredClone({
    account,
    agents,
    tasks,
    myTasks,
    adminExecutionRecords,
    adminAppeals,
    settlements,
    withdrawals,
    payouts,
    fundExceptions,
    fundFlows,
    signedAgreements: []
  });
}
