import { beforeEach, describe, expect, it } from "vitest";
import type { Task } from "../types";
import {
  buildLocalAgentAssessment,
  buildRecommendedTasks,
  getDemoAutoAcceptResult,
  localAgentOptions,
  readLocalAgentAssessment,
  saveLocalAgentAssessment
} from "./cSideExperience";

const baseTask = (patch: Partial<Task>): Task => ({
  id: "task-1",
  title: "竞品调研",
  category: "市场调研",
  sourceName: "Sprix Demo",
  sourceType: "平台",
  description: "整理竞品信息",
  cardSummary: "整理竞品信息并输出表格",
  deliverables: "表格",
  acceptanceCriteria: "字段完整",
  reward: 300,
  totalSlots: 3,
  remainingSlots: 2,
  publishedAt: "2026-06-26",
  taskStatus: "已发布",
  offlineReason: "",
  agentMatchScore: 81,
  recommendedTaskType: "资料整理",
  suggestedTeam: "单 Agent",
  matchAnalysis: "适合 Codex 执行",
  riskPrompt: "低风险",
  recommendedReason: "匹配资料整理能力",
  submittedFiles: [],
  resultFiles: [],
  acceptanceResult: "待验收",
  ...patch
});

describe("C-side homepage experience", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("builds a local Agent assessment profile for the selected Agent", () => {
    const assessment = buildLocalAgentAssessment("codex");

    expect(assessment.agentName).toBe("Codex");
    expect(assessment.profileTitle).toContain("产品型");
    expect(assessment.score).toBe(76);
    expect(assessment.question).toBe("我在你眼里的职业画像是什么？");
  });

  it("sorts published tasks by match score and adds token estimates", () => {
    const recommended = buildRecommendedTasks([
      baseTask({ id: "task-low", title: "低匹配", agentMatchScore: 61, taskStatus: "已发布" }),
      baseTask({ id: "task-high", title: "高匹配", agentMatchScore: 92, taskStatus: "已发布" }),
      baseTask({ id: "task-offline", title: "已下线", agentMatchScore: 99, taskStatus: "已下线" })
    ]);

    expect(recommended.map((task) => task.id)).toEqual(["task-high", "task-low"]);
    expect(recommended[0].tokenEstimate).toMatch(/K Token/);
    expect(recommended[0].rankLabel).toBe("推荐 1");
  });

  it("keeps auto accept as a demo scan without accepting tasks", () => {
    const result = getDemoAutoAcceptResult([
      baseTask({ id: "task-high", agentMatchScore: 92 }),
      baseTask({ id: "task-mid", agentMatchScore: 76 })
    ]);

    expect(result.threshold).toBe(80);
    expect(result.eligibleCount).toBe(1);
    expect(result.acceptedTaskIds).toEqual([]);
    expect(result.message).toContain("演示");
  });

  it("exposes detected local Agent options without a download fallback", () => {
    expect(localAgentOptions.map((agent) => agent.name)).toEqual(["Codex", "Claude Code", "OpenCode"]);
    expect(localAgentOptions.every((agent) => agent.status === "可连接")).toBe(true);
  });

  it("persists the local Agent assessment for the task detail flow", () => {
    const assessment = buildLocalAgentAssessment("codex");

    saveLocalAgentAssessment(assessment);

    expect(readLocalAgentAssessment()).toMatchObject({
      agentId: "codex",
      agentName: "Codex",
      score: 76
    });
  });
});
