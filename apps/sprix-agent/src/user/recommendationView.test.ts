import { describe, expect, it } from "vitest";
import type { Agent, Task } from "../types";
import { getRecommendationPanelState, getSmartAcceptMessage } from "./recommendationView";

const agent: Agent = {
  id: "agent-1",
  name: "Local Agent",
  status: "已连接",
  role: "当前执行 Agent",
  score: 92,
  lastEvaluatedAt: "2026-06-29 10:00",
  summary: "自动化办公",
  tags: ["automation"]
};

const task: Task = {
  id: "task-1",
  title: "整理线索表",
  category: "data operations",
  sourceName: "Sprix AI Platform",
  sourceType: "平台任务",
  description: "清洗并归档线索数据",
  cardSummary: "清洗并归档线索数据",
  deliverables: "结构化表格",
  acceptanceCriteria: "字段完整",
  reward: 20,
  totalSlots: 2,
  remainingSlots: 1,
  publishedAt: "2026-06-29 10:00",
  taskStatus: "已发布",
  offlineReason: "",
  agentMatchScore: 92,
  recommendedTaskType: "data operations",
  suggestedTeam: "Local Agent 优先",
  matchAnalysis: "",
  riskPrompt: "当前匹配度可触发智能接单。",
  recommendedReason: "按当前执行 Agent 匹配度推荐。",
  submittedFiles: [],
  resultFiles: [],
  acceptanceResult: ""
};

describe("recommendationView", () => {
  it("summarizes best score and smart accept not-triggered state", () => {
    const state = getRecommendationPanelState({
      tasks: [task],
      currentAgent: agent,
      isLoggedIn: true,
      smartAcceptMessage: "未自动接单"
    });

    expect(state.bestTask?.id).toBe("task-1");
    expect(state.metrics).toContainEqual({ label: "最高匹配度", value: "92%" });
    expect(state.metrics).toContainEqual({ label: "推荐任务数", value: "1" });
    expect(state.metrics).toContainEqual({ label: "智能接单", value: "未自动接单" });
  });

  it("keeps backend not-accepted message for smart accept feedback", () => {
    expect(getSmartAcceptMessage(false, "已按评分推荐，最高匹配度未达到自动接单条件，未自动接单。")).toContain("未自动接单");
  });
});
