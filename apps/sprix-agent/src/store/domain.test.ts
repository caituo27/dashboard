import { describe, expect, it } from "vitest";
import { createInitialSprixState, logOut } from "./domain";

describe("Sprix local state shell", () => {
  it("starts without local mock records", () => {
    const state = createInitialSprixState();

    expect(state.account.isLoggedIn).toBe(false);
    expect(state.tasks).toEqual([]);
    expect(state.agents).toEqual([]);
    expect(state.myTasks).toEqual([]);
    expect(state.withdrawals).toEqual([]);
  });

  it("clears user-scoped data on logout while keeping public task cache", () => {
    const state = createInitialSprixState();
    const next = logOut({
      ...state,
      account: { ...state.account, isLoggedIn: true, nickname: "Xiaoxiao", withdrawableAmount: 640 },
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
      agents: [
        {
          id: "agent-1",
          name: "Codex Agent",
          status: "已连接",
          role: "当前执行 Agent",
          score: 92,
          lastEvaluatedAt: "2026-06-25 00:00",
          summary: "Remote agent",
          tags: ["软件开发"]
        }
      ],
      myTasks: [
        {
          id: "exec-1",
          taskId: "task-1",
          title: "Remote task",
          category: "数据处理",
          reward: 100,
          status: "执行中",
          agentId: "agent-1",
          agentName: "Codex Agent",
          startedAt: "2026-06-25 00:00",
          currentNode: "执行中",
          progress: "20%",
          settlementStatus: "未入账"
        }
      ]
    });

    expect(next.account.isLoggedIn).toBe(false);
    expect(next.account.nickname).toBe("");
    expect(next.tasks).toHaveLength(1);
    expect(next.agents).toEqual([]);
    expect(next.myTasks).toEqual([]);
  });
});
