import { beforeEach, describe, expect, it, vi } from "vitest";
import { readRemoteTaskDetail } from "./sprixApi";

const apiMocks = vi.hoisted(() => ({
  taskDetail: vi.fn()
}));

vi.mock("../apis/sprix", () => ({
  AdminAppealControllerApiFactory: () => ({}),
  AdminFundsControllerApiFactory: () => ({}),
  AdminTaskControllerApiFactory: () => ({
    detail: apiMocks.taskDetail
  }),
  AuthControllerApiFactory: () => ({})
}));

function remoteTaskDetail() {
  return {
    task: {
      id: "task-1",
      title: "测试任务",
      category: "内容生成",
      sourceName: "Sprix",
      sourceType: "PLATFORM",
      description: "生成内容",
      deliverables: "文档",
      acceptanceCriteria: "质量达标",
      reward: 0.01,
      estimatedTokens: 1000,
      tokenBillingUnit: 1000,
      tokenUnitPrice: 1,
      totalAmount: 0.01,
      pricingModel: "deepseek-v4-flash",
      pricingQuoteId: "quote-1",
      pricingEstimatedAt: "2026-07-02T10:00:00+08:00",
      totalSlots: 1,
      remainingSlots: 0,
      status: "PUBLISHED",
      offlineReason: null,
      publishedAt: "2026-07-02T10:00:00+08:00"
    },
    executions: [
      {
        executionId: "execution-1",
        executionIndex: 1,
        userName: "文雪娇",
        userPhone: "18319382425",
        agentName: "OpenCode Agent",
        agentScore: 92,
        executionStatus: "SETTLING",
        acceptanceStatus: "passed",
        acceptanceScore: 92,
        acceptanceSummary: "复核通过",
        acceptanceIssues: "[]",
        acceptancePayload: "{}",
        currentNode: "review_finish",
        progress: "100%",
        appealStatus: "APPROVED",
        settlementStatus: "SETTLING",
        submittedAt: "2026-07-02T10:01:00+08:00",
        startedAt: "2026-07-02T10:00:00+08:00",
        updatedAt: "2026-07-02T10:02:00+08:00",
        completedAt: "2026-07-02T10:02:00+08:00"
      },
      {
        executionId: "execution-2",
        executionIndex: 2,
        userName: "未申诉用户",
        userPhone: "18319380000",
        agentName: "OpenCode Agent",
        agentScore: 90,
        executionStatus: "SETTLED",
        acceptanceStatus: "passed",
        acceptanceScore: 90,
        acceptanceSummary: "验收通过",
        acceptanceIssues: "[]",
        acceptancePayload: "{}",
        currentNode: "review_finish",
        progress: "100%",
        appealStatus: "NOT_APPEALED",
        settlementStatus: "SETTLED",
        submittedAt: "2026-07-02T10:03:00+08:00",
        startedAt: "2026-07-02T10:00:00+08:00",
        updatedAt: "2026-07-02T10:04:00+08:00",
        completedAt: "2026-07-02T10:04:00+08:00"
      }
    ],
    operationLogs: []
  };
}

describe("readRemoteTaskDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps approved appeal status visible after the execution enters settlement", async () => {
    apiMocks.taskDetail.mockResolvedValue(remoteTaskDetail());

    const detail = await readRemoteTaskDetail("task-1");
    const appealRecordCount = detail.records.completed.filter((record) => !["无申诉", "未申诉"].includes(record.appealStatus)).length;

    expect(detail.records.completed[0]?.appealStatus).toBe("申诉通过");
    expect(detail.records.completed[1]?.appealStatus).toBe("无申诉");
    expect(appealRecordCount).toBe(1);
  });
});
