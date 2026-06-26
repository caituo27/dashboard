import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appeals: vi.fn(),
  tasks: vi.fn(),
  get: vi.fn()
}));

vi.mock("../apis/sprix", () => ({
  AdminAppealControllerApiFactory: () => ({ appeals: mocks.appeals }),
  AdminFundsControllerApiFactory: () => ({}),
  AdminTaskControllerApiFactory: () => ({ tasks: mocks.tasks }),
  AuthControllerApiFactory: () => ({})
}));

vi.mock("../utils/http", () => ({
  http: {
    get: mocks.get
  }
}));

describe("sprix admin api", () => {
  it("loads the task center from summary data without per-task detail requests", async () => {
    const { readRemoteTaskCenterSnapshot } = await import("./sprixApi");
    mocks.tasks.mockRejectedValue(new Error("task list endpoint should not be used by the task center"));
    mocks.appeals.mockResolvedValue([{ id: "appeal-1" }]);
    mocks.get.mockImplementation((url: string) => {
      if (url !== "/api/v1/admin/tasks/summaries") {
        throw new Error(`unexpected detail request: ${url}`);
      }
      return Promise.resolve([
        {
          task: {
            id: "task-1",
            title: "Task one",
            category: "Research",
            sourceName: "Sprix",
            sourceType: "PLATFORM",
            description: "Short description",
            deliverables: "Sheet",
            acceptanceCriteria: "Complete rows",
            reward: 100,
            totalSlots: 10,
            remainingSlots: 8,
            status: "PUBLISHED",
            publishedAt: "2026-06-26T00:00:00Z"
          },
          executionTotal: 3,
          runningExecutionCount: 1,
          completedExecutionCount: 1,
          terminatedExecutionCount: 1
        }
      ]);
    });

    const snapshot = await readRemoteTaskCenterSnapshot();

    expect(snapshot.appealCount).toBe(1);
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0].executionTotal).toBe(3);
    expect(snapshot.adminExecutionRecords).toEqual({});
    expect(mocks.tasks).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
