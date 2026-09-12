import {adminQueryClient} from "../src/services/adminQueryClient";
// @vitest-environment node
import {readTaskPage} from "../src/services/pagedAdminData";
import {viewPage} from "./admin-views.mjs";
import { beforeEach, expect, test, vi } from "vitest";
import axios from "axios";
import { createAnalyticsSnapshot, BASELINE_AT } from "./analytics-data.mjs";
import { buildDemoLedger } from "./demo-ledger.mjs";
import { aggregateDashboard } from "../src/services/dashboardAggregation";
import * as real from "../src/services/sprixApi";
import * as source from "../src/services/adminDataSource";
vi.mock("../src/services/sprixApi", () => ({
  readRemoteTaskCenterSnapshot: vi.fn(), readRemoteFunds: vi.fn(), readRemoteAcceptanceReviews: vi.fn(), readRemoteAppeals: vi.fn(),
  approveRemoteAcceptanceReview: vi.fn(), rejectRemoteAcceptanceReview: vi.fn(), payRemoteWithdrawal: vi.fn(), deleteRemoteAdminTask: vi.fn()
}));
const analytics = createAnalyticsSnapshot(7, BASELINE_AT);
const emptyFunds = { settlements: [], withdrawals: [], payouts: [], fundExceptions: [], fundFlows: [] };
const originalTask = { id: "real-task", title: "真实任务", taskStatus: "已发布", reward: 20, executionTotal: 1, runningExecutionCount: 1, reviewingExecutionCount: 0, completedExecutionCount: 0, terminatedExecutionCount: 0, publishedAt: "2026-09-12 12:00" };
beforeEach(() => {
  adminQueryClient.clear();
  vi.restoreAllMocks();
  const ledger=buildDemoLedger(analytics);
  const dashboard=aggregateDashboard(analytics,{tasks:ledger.tasks,acceptanceReviews:ledger.acceptanceReviews,appealCount:ledger.appeals.length},ledger.funds);
  const view={ledger,dashboard,version:'test',lists:new Map()};
  vi.spyOn(axios,"get").mockImplementation(async(_,options)=>({data:options.params.kind==='dashboard'?dashboard:viewPage(view,options.params.kind,options.params)}));
  vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
  real.readRemoteTaskCenterSnapshot.mockResolvedValue({ tasks: [originalTask], acceptanceReviews: [], appealCount: 0, adminExecutionRecords: {} });
  real.readRemoteFunds.mockResolvedValue(emptyFunds);
});

test("a real claim increases executions everywhere without publishing a new task", async () => {
  const before=await readTaskPage({page:1,pageSize:8});
  real.readRemoteTaskCenterSnapshot.mockResolvedValue({tasks:[{...originalTask,executionTotal:2,runningExecutionCount:2}],acceptanceReviews:[],appealCount:0,adminExecutionRecords:{}});
  // The C-end change becomes visible on the next scheduled five-second refresh.
  const clock=vi.spyOn(Date, 'now').mockReturnValue(Date.now()+5000);
  let after;
  try { after=await readTaskPage({page:1,pageSize:8}); } finally { clock.mockRestore(); }
  expect(after.stats.executions).toBe(before.stats.executions+1);
  expect(after.stats.total).toBe(before.stats.total);

});

test("real failures remain failures, not a silent switch to synthetic data", async () => {
  real.readRemoteTaskCenterSnapshot.mockRejectedValue(new Error("backend unavailable"));
  await expect(readTaskPage({page:1,pageSize:8})).rejects.toThrow("backend unavailable");
});

test("write routing never forwards demo IDs to real APIs and preserves real arguments", async () => {
  await source.approveRemoteAcceptanceReview("demo:execution:12");
  expect(axios.post).toHaveBeenCalledWith("/mock-api/admin/actions", { id: "demo:execution:12", action: "approve", payload: {} }, expect.anything());
  expect(real.approveRemoteAcceptanceReview).not.toHaveBeenCalled();
  await source.approveRemoteAcceptanceReview("real-execution");
  expect(real.approveRemoteAcceptanceReview).toHaveBeenCalledWith("real-execution");
  await source.deleteRemoteAdminTask("real-task", "requested reason");
  expect(real.deleteRemoteAdminTask).toHaveBeenCalledWith("real-task", "requested reason");
  expect(source.payRemoteWithdrawal).toBeUndefined();
  expect(real.payRemoteWithdrawal).not.toHaveBeenCalled();
});

test("demo details, lists, acceptance and settlements share the same ledger", () => {
  const initial = buildDemoLedger(analytics);
  const record = initial.acceptanceReviews[0];
  const accepted = buildDemoLedger(analytics, { patches: { [record.executionId]: { status: "completed" } } });
  const before = initial.detail(record.taskId);
  const after = accepted.detail(record.taskId);
  expect(after.records.completed.length).toBe(before.records.completed.length + 1);
  expect(after.records.reviewing.length).toBe(before.records.reviewing.length - 1);
  expect(accepted.acceptanceReviews.some((row) => row.executionId === record.executionId)).toBe(false);
  expect(after.task.executionTotal).toBe(before.task.executionTotal);
  const totals = (ledger) => ledger.funds.settlements.reduce((sum, row) => sum + Math.round(row.taskIncome * 100), 0);
  expect(totals(accepted) - totals(initial)).toBe(Math.round(after.task.reward * 100));
});


test("module reads reuse a short cache and mutations invalidate it immediately", async () => {
  await Promise.all([readTaskPage({page:1,pageSize:8}),readTaskPage({page:2,pageSize:8})]);
  expect(real.readRemoteTaskCenterSnapshot).toHaveBeenCalledTimes(1);
  await adminQueryClient.invalidateQueries({queryKey:['sprix-admin']});
  await readTaskPage({page:1,pageSize:8});
  expect(real.readRemoteTaskCenterSnapshot).toHaveBeenCalledTimes(2);
});
