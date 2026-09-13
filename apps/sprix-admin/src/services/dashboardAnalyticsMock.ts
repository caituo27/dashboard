import axios from "axios";

export type AnalyticsPeriod = 7 | 28 | 30;
export type AnalyticsRange = { days: AnalyticsPeriod } | { startDate: string; endDate: string };
export type BusinessTaskType={type:string;tasks:number;daily:number[];amount:number;passRate:number|null;autoDeliveryAmount:number;manualDeliveryAmount:number;pureAgentPending:number;hybridPending:number};
export type BusinessAgentType={type:string;count:number;daily:number[]};
export type BusinessWeek={label:string;startDate:string;endDate:string;newAgents:number;heterogeneousRate:number;acceptedGmv:number;effectiveAgents:number;deliveredTasks:number;masterTasks:number;slots:number;averageGmvPerEffectiveAgent:number;dailyNewAgents:{date:string;total:number}[];dailyDelivery:{date:string;tasks:number;effectiveAgents:number}[];agentTypes:BusinessAgentType[];taskTypes:BusinessTaskType[]};
export type BusinessMetrics={
  snapshotVersion:string;
  generatedAt:string;
  periodStart:string;
  periodEnd:string;
  source:{file:string;sheet:string;rows:string;note:string};
  weeks:BusinessWeek[];
  summary:{newAgents:number;heterogeneousRate:number|null;acceptedGmv:number;effectiveAgents:number|null;averageGmvPerEffectiveAgent:number|null;deliveredTasks:number;masterTasks:number;slots:number;executions:number;remainingSlots:number;autoDeliveryAmount:number;manualDeliveryAmount:number;pureAgentPending:number;hybridPending:number};
};
export type DashboardMetric = { value: number; previous: number; change: number };
export type DashboardTrendMetric = "acceptedGmv" | "publishedTasks" | "acceptedTasks" | "completedTasks" | "averageTaskValue";
export type DashboardTrendPoint = { startDate: string; endDate: string; days?: number; value: number; previous?: number };
export type DashboardBehavior = { name: string; eventName: string; users: number; count: number; conversion: number };
export type AnalyticsDay = {
  date: string;
  pv: number;
  uv: number;
  clicks: number;
  funnel: number[];
  buttons: { name: string; page: string; clicks: number; users: number }[];
};
export type DashboardAnalyticsSnapshot = {
  snapshotVersion?:string;
  businessMetrics?:BusinessMetrics;
  daily: AnalyticsDay[];
  period: number;
  periodStart: string;
  periodEnd: string;
  comparisonAvailable?: boolean;
  finance: { completedAmount: number; platformFee: number; settlementNet: number; paidAmount: number; remainingNet: number };
  operations: {
    taskTotal: number;
    publishedTasks: number;
    executions: { running: number; reviewing: number; completed: number; terminated: number; other?: number };
    paidAmount: number;
    pendingAcceptance?: number;
    pendingWithdrawals: number;
    pendingPayouts: number;
    appeals: number;
    publishedTaskCategories: { category: string; count: number }[];
    taskPublications: { date: string; count: number }[];
  };
  generatedAt: string;
  overview: {
    orders: number;
    tasks: number;
    agents: number;
    amount: number;
    operatingDays: number;
    startedAt: string;
  };
  businessResults: {
    acceptedGmv: DashboardMetric;
    activePublishingUsers: DashboardMetric;
    averagePublishingFrequency: DashboardMetric;
    averageTaskValue: DashboardMetric;
    acceptedTasks: DashboardMetric;
    fulfillmentRate: DashboardMetric;
    activeAgents: DashboardMetric;
    averageAcceptedTasksPerAgent: DashboardMetric;
  };
  taskOperations: {
    publishedTasks: number;
    acceptedTasks: number;
    completedTasks: number;
    acceptancePassedTasks: number;
    acceptanceRate: DashboardMetric;
    completionRate: DashboardMetric;
    acceptancePassedRate: DashboardMetric;
  };
  businessTrends: Record<DashboardTrendMetric, DashboardTrendPoint[]>;
  agentEcosystem: {
    totalAgents: number;
    activeAgents: DashboardMetric;
    acceptingAgents: DashboardMetric;
    averageAcceptedTasksPerAgent: DashboardMetric;
    daily: { date: string; activeAgents: number; acceptingAgents: number }[];
  };
  behaviors: DashboardBehavior[];
  pv: number;
  uv: number;
  clicks: number;
  visits: number[];
  buttons: { name: string; page: string; clicks: number; users: number }[];
  funnel: number[];
};

function shanghaiTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
}

export function dashboardPeriodEnd(data: Pick<DashboardAnalyticsSnapshot, "periodEnd" | "generatedAt">) {
  const refreshedAt = shanghaiTime(data.generatedAt);
  return refreshedAt.slice(0, 10) === data.periodEnd ? refreshedAt : `${data.periodEnd} 23:59:59`;
}

export function dashboardPeriodRange(data: Pick<DashboardAnalyticsSnapshot, "periodStart" | "periodEnd" | "generatedAt">) {
  return `${data.periodStart} 00:00:00 至 ${dashboardPeriodEnd(data)}`;
}

export async function readDashboardAnalyticsMock(range: AnalyticsRange, signal?: AbortSignal): Promise<DashboardAnalyticsSnapshot> {
  try {
    const response = await axios.get<DashboardAnalyticsSnapshot>("/mock-api/dashboard/analytics", {
      params: range,
      signal,
      timeout: 15_000
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message ?? "用户行为分析请求失败，请稍后重试");
    }
    throw error;
  }
}
