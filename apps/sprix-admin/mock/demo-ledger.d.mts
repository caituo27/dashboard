import type { Task, ReviewingExecution, AdminAppeal } from "../src/types";
import type { AdminFundsSnapshot, AdminTaskDetailView } from "../src/services/sprixApi";
import type { DashboardAnalyticsSnapshot } from "../src/services/dashboardAnalyticsMock";
export type DemoState = { patches?: Record<string, Record<string, unknown>>; events?: { id: string; action: string; reason?: string; at: string }[] };
export type DemoLedgerSeed = Pick<DashboardAnalyticsSnapshot, "generatedAt"> & {
  operations: Pick<DashboardAnalyticsSnapshot["operations"], "executions">;
};
export function isDemoId(id: unknown): boolean;
export function createDemoLedgerSeed(at?: number): DemoLedgerSeed;
export function buildDemoLedger(snapshot: DemoLedgerSeed, state?: DemoState): {
  tasks: Task[]; acceptanceReviews: ReviewingExecution[]; appeals: AdminAppeal[]; funds: AdminFundsSnapshot;
  taskCount: number;
  taskAt(index: number): Task | null;
  taskMeta(index: number): { id: string; index: number; category: string; publishedAt: string; taskStatus: string; remainingSlots: number; executionTotal: number } | null;
  detail(id: string): AdminTaskDetailView | null;
  execution(index: number): ReviewingExecution;
  generatedAt: string;
};
