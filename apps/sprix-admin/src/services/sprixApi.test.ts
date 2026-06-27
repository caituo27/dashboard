import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appeals: vi.fn(),
  flows: vi.fn(),
  markPayoutExceptionHandled: vi.fn(),
  mockAdminLogin: vi.fn(),
  rejectWithdrawal: vi.fn(),
  returnWithdrawalForReview: vi.fn(),
  settlements: vi.fn(),
  tasks: vi.fn(),
  withdrawals: vi.fn(),
  get: vi.fn()
}));

vi.mock("../apis/sprix", () => ({
  AdminAppealControllerApiFactory: () => ({ appeals: mocks.appeals }),
  AdminFundsControllerApiFactory: () => ({
    flows: mocks.flows,
    markPayoutExceptionHandled: mocks.markPayoutExceptionHandled,
    rejectWithdrawal: mocks.rejectWithdrawal,
    returnWithdrawalForReview: mocks.returnWithdrawalForReview,
    settlements: mocks.settlements,
    withdrawals: mocks.withdrawals
  }),
  AdminTaskControllerApiFactory: () => ({ tasks: mocks.tasks }),
  AuthControllerApiFactory: () => ({ mockAdminLogin: mocks.mockAdminLogin })
}));

vi.mock("../utils/http", () => ({
  http: {
    get: mocks.get
  }
}));

describe("sprix admin api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("maps task detail operation logs from the backend", async () => {
    const { readRemoteTaskDetail } = await import("./sprixApi");
    mocks.get.mockResolvedValue({
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
      executions: [],
      operationLogs: [
        {
          id: "log-1",
          action: "UPDATE_TASK",
          beforeStatus: "PUBLISHED",
          afterStatus: "PUBLISHED",
          reason: "Admin updated task",
          createdAt: "2026-06-26T12:00:00"
        }
      ]
    });

    const detail = await readRemoteTaskDetail("task-1");

    expect(detail.operationLogs).toEqual([
      {
        id: "log-1",
        action: "UPDATE_TASK",
        beforeStatus: "PUBLISHED",
        afterStatus: "PUBLISHED",
        reason: "Admin updated task",
        occurredAt: "2026-06-26 12:00"
      }
    ]);
  });

  it("does not invent execution progress or termination reason when backend fields are missing", async () => {
    const { readRemoteTaskDetail } = await import("./sprixApi");
    mocks.get.mockResolvedValue({
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
        status: "PUBLISHED"
      },
      executions: [
        {
          executionId: "running-1",
          executionStatus: "RUNNING"
        },
        {
          executionId: "terminated-1",
          executionStatus: "TERMINATED"
        }
      ],
      operationLogs: []
    });

    const detail = await readRemoteTaskDetail("task-1");

    expect(detail.records.running[0]).toMatchObject({
      executionId: "running-1",
      progress: "-"
    });
    expect(detail.records.terminated[0]).toMatchObject({
      executionId: "terminated-1",
      terminationReason: "-"
    });
  });

  it("does not invent withdrawal arrival time when admin funds data omits it", async () => {
    const { readRemoteFunds } = await import("./sprixApi");
    mocks.tasks.mockResolvedValue([]);
    mocks.settlements.mockResolvedValue([]);
    mocks.withdrawals.mockResolvedValue([
      {
        id: "withdrawal-1",
        withdrawalNo: "W-1",
        amount: 100,
        alipayAccount: "user@example.com",
        status: "REVIEWING"
      }
    ]);
    mocks.flows.mockResolvedValue([]);

    const snapshot = await readRemoteFunds();

    expect(snapshot.withdrawals[0]).toMatchObject({
      withdrawalNo: "W-1",
      estimatedArrivalTime: "-"
    });
  });

  it("does not invent task copy when admin task summary fields are missing", async () => {
    const { readRemoteTaskCenterSnapshot } = await import("./sprixApi");
    mocks.appeals.mockResolvedValue([]);
    mocks.get.mockResolvedValue([{ task: { id: "task-1", reward: 100 } }]);

    const snapshot = await readRemoteTaskCenterSnapshot();

    expect(snapshot.tasks[0]).toMatchObject({
      id: "task-1",
      title: "",
      category: "",
      sourceName: "",
      sourceType: "",
      deliverables: "",
      acceptanceCriteria: "",
      acceptanceResult: ""
    });
  });

  it("preserves backend offline reason instead of inventing a manual-offline reason", async () => {
    const { readRemoteTaskCenterSnapshot } = await import("./sprixApi");
    mocks.appeals.mockResolvedValue([]);
    mocks.get.mockResolvedValue([
      {
        task: {
          id: "task-1",
          reward: 100,
          status: "OFFLINE",
          offlineReason: "MAINTENANCE_WINDOW"
        }
      }
    ]);

    const snapshot = await readRemoteTaskCenterSnapshot();

    expect(snapshot.tasks[0].offlineReason).toBe("MAINTENANCE_WINDOW");
  });

  it("requires explicit admin login credentials instead of hidden mock defaults", async () => {
    const { authenticateAdmin } = await import("./sprixApi");

    expect(authenticateAdmin.length).toBe(2);
  });

  it("uses the generated swagger client for withdrawal rejection", async () => {
    const { rejectRemoteWithdrawal } = await import("./sprixApi");
    mocks.rejectWithdrawal.mockResolvedValue({});

    await rejectRemoteWithdrawal("withdrawal-1", "审核不通过");

    expect(mocks.rejectWithdrawal).toHaveBeenCalledWith({
      withdrawalId: "withdrawal-1",
      withdrawalReviewRequest: { reason: "审核不通过" }
    });
  });

  it("uses the generated swagger client for returning payout records to review", async () => {
    const { returnRemoteWithdrawalForReview } = await import("./sprixApi");
    mocks.returnWithdrawalForReview.mockResolvedValue({});

    await returnRemoteWithdrawalForReview("withdrawal-1", "退回重新审核");

    expect(mocks.returnWithdrawalForReview).toHaveBeenCalledWith({
      withdrawalId: "withdrawal-1",
      withdrawalReviewRequest: { reason: "退回重新审核" }
    });
  });

  it("uses the generated swagger client for marking payout exceptions handled", async () => {
    const { markRemotePayoutExceptionHandled } = await import("./sprixApi");
    mocks.markPayoutExceptionHandled.mockResolvedValue({});

    await markRemotePayoutExceptionHandled("withdrawal-1", "异常已处理");

    expect(mocks.markPayoutExceptionHandled).toHaveBeenCalledWith({
      withdrawalId: "withdrawal-1",
      withdrawalReviewRequest: { reason: "异常已处理" }
    });
  });
});
