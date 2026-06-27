import { describe, expect, it } from "vitest";
import { createInitialSprixState, logOut } from "./domain";

describe("Sprix local state shell", () => {
  it("starts without local mock records", () => {
    const state = createInitialSprixState();

    expect(state.account.isLoggedIn).toBe(false);
    expect(state.tasks).toEqual([]);
    expect(state.adminAppeals).toEqual([]);
    expect(state.settlements).toEqual([]);
    expect(state.fundFlows).toEqual([]);
  });

  it("clears operator-scoped data on logout while keeping public task cache", () => {
    const state = createInitialSprixState();
    const next = logOut({
      ...state,
      account: { ...state.account, isLoggedIn: true, nickname: "Operator" },
      tasks: [
        {
          id: "task-1",
          title: "Remote task",
          category: "数据处理",
          sourceName: "Sprix",
          sourceType: "平台任务",
          description: "From API",
          cardSummary: "From API",
          deliverables: "CSV",
          acceptanceCriteria: "字段完整",
          reward: 100,
          totalSlots: 10,
          remainingSlots: 8,
          publishedAt: "2026-06-25 00:00",
          taskStatus: "已发布",
          offlineReason: "",
          agentMatchScore: 0,
          recommendedTaskType: "数据处理",
          suggestedTeam: "",
          matchAnalysis: "",
          riskPrompt: "保留来源",
          recommendedReason: "",
          submittedFiles: [],
          resultFiles: [],
          acceptanceResult: "待验收"
        }
      ],
      adminAppeals: [
        {
          backendId: "appeal-1",
          appealNo: "AP1",
          taskTitle: "Remote task",
          taskCategory: "数据处理",
          userName: "Xiaoxiao",
          userPhone: "-",
          agentName: "Codex Agent",
          issueSummary: "复核",
          appealReason: "需要复核",
          appealStatus: "待处理",
          priority: "普通",
          submittedAt: "2026-06-25 00:00",
          handler: "-",
          expectedProcessTime: "后端返回时限",
          originalScore: "-",
          originalRejectReason: "未通过",
          processLogs: []
        }
      ]
    });

    expect(next.account.isLoggedIn).toBe(false);
    expect(next.account.nickname).toBe("");
    expect(next.tasks).toHaveLength(1);
    expect(next.adminAppeals).toEqual([]);
  });
});
