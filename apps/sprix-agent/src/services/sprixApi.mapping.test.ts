import { describe, expect, it } from "vitest";
import { TaskEntityStatusEnum, type TaskRecommendationResponse } from "../apis/sprix";
import { mapTaskRecommendation } from "./sprixApi";

describe("sprixApi task recommendation mapping", () => {
  it("maps recommendation score, reason, and analysis onto task cards", () => {
    const recommendation: TaskRecommendationResponse = {
      matchScore: 95,
      recommendedReason: "匹配度 95%，能力标签覆盖：直接命中 automation。",
      matchAnalysis: "Agent 能力标签：automation；任务分类：data operations。",
      suggestedTeam: "Local Agent 优先",
      autoAcceptEligible: false,
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

    expect(task.agentMatchScore).toBe(95);
    expect(task.recommendedReason).toContain("匹配度 95%");
    expect(task.matchAnalysis).toContain("automation");
    expect(task.suggestedTeam).toBe("Local Agent 优先");
    expect(task.riskPrompt).toContain("不自动接单");
  });
});
