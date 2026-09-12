import axios from "axios";

export type AnalyticsPeriod = 7 | 30;
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
  period: AnalyticsPeriod;
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
    taskPublications: { date: string; count: number }[];
  };
  generatedAt: string;
  overview: {
    orders: number;
    agents: number;
    amount: number;
    operatingDays: number;
    startedAt: string;
  };
  pv: number;
  uv: number;
  clicks: number;
  visits: number[];
  buttons: { name: string; page: string; clicks: number; users: number }[];
  funnel: number[];
};

export async function readDashboardAnalyticsMock(days: AnalyticsPeriod, signal?: AbortSignal): Promise<DashboardAnalyticsSnapshot> {
  try {
    const response = await axios.get<DashboardAnalyticsSnapshot>("/mock-api/dashboard/analytics", {
      params: { days },
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
