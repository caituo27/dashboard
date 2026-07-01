import { describe, expect, it } from "vitest";
import { TaskEntityStatusEnum, type TaskRecommendationResponse } from "../apis/sprix";
import { mapTaskRecommendation } from "./sprixApi";

describe("sprixApi task recommendation mapping", () => {
  it("maps recommendation score and ignores backend analysis text", () => {
    const recommendation: TaskRecommendationResponse = {
      matchScore: 92,
      recommendedReason: "按当前执行 Agent 匹配度推荐。",
      matchAnalysis: "Agent 能力标签：automation；任务分类：data operations；命中依据：分类分 0。",
      suggestedTeam: "Local Agent 优先",
      autoAcceptEligible: true,
      task: {
        id: "task-1",
        title: "整理线索表",
        category: "data operations",
        sourceName: "Sprix AI Platform",
        sourceType: "PLATFORM",
        description: "清洗并归档线索数据",
        deliverables: "结构化表格",
        acceptanceCriteria: "字段完整",
        reward: 20,
        totalSlots: 2,
        remainingSlots: 1,
        status: TaskEntityStatusEnum.Published,
        publishedAt: "2026-06-29T10:00:00Z"
      }
    };

    const task = mapTaskRecommendation(recommendation);

    expect(task.agentMatchScore).toBe(92);
    expect(task.recommendedReason).toBe("");
    expect(task.matchAnalysis).toBe("");
    expect(task.suggestedTeam).toBe("Local Agent 优先");
    expect(task.riskPrompt).toContain("可触发智能接单");
  });
});
