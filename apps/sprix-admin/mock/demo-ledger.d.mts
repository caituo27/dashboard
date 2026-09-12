import type { Task, ReviewingExecution, AdminAppeal } from "../src/types";
import type { AdminFundsSnapshot, AdminTaskDetailView } from "../src/services/sprixApi";
import type { DashboardAnalyticsSnapshot } from "../src/services/dashboardAnalyticsMock";
export type DemoState = { patches?: Record<string, Record<string, unknown>>; events?: { id: string; action: string; reason?: string; at: string }[] };
export function isDemoId(id: unknown): boolean;
export function buildDemoLedger(snapshot: DashboardAnalyticsSnapshot, state?: DemoState): {
  tasks: Task[]; acceptanceReviews: ReviewingExecution[]; appeals: AdminAppeal[]; funds: AdminFundsSnapshot;
  detail(id: string): AdminTaskDetailView | null;
  execution(index: number): ReviewingExecution;
  generatedAt: string;
};
