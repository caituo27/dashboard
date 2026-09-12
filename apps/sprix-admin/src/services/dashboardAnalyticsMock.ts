import axios from "axios";

export type AnalyticsPeriod = 7 | 28 | 30;
export type AnalyticsRange = { days: AnalyticsPeriod } | { startDate: string; endDate: string };
export type DashboardMetric = { value: number; previous: number; change: number };
export type DashboardTrendMetric = "acceptedGmv" | "publishedTasks" | "acceptedTasks" | "completedTasks" | "averageTaskValue";
export type DashboardTrendPoint = { startDate: string; endDate: string; value: number; previous?: number };
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
  daily: AnalyticsDay[];
  period: number;
  periodStart: string;
  periodEnd: string;
  latestTasks: { id: string; title: string; taskStatus: string; reward: number; publishedAt: string }[];
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
    users: number;
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
