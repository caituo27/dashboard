import { describe, expect, it } from "vitest";
import type { Agent } from "../types";
import { getAgentAbilityResult, getAgentAdmissionSummary, getAgentConnectActionLabel, getAgentConnectSuccessMessage, getAgentProfileEditAction, getAgentTagLabels, getCurrentAgentScoreMetric } from "./agentResult";

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: "agent-1",
    name: "Codex",
    status: "已连接",
    role: "当前执行 Agent",
    score: 88,
    lastEvaluatedAt: "2026-06-27 00:00",
    summary: "软件开发",
    tags: ["软件开发"],
    ...overrides
  };
}

describe("agent admission result", () => {
  it("summarizes a connected current execution agent from backend fields", () => {
    expect(getAgentAdmissionSummary(agent({}))).toEqual({
      title: "Codex",
      status: "已连接",
      role: "当前执行 Agent",
      score: "88/100",
      lastEvaluatedAt: "2026-06-27 00:00",
      summary: "软件开发",
      tags: ["软件开发"]
    });
  });

  it("uses an explicit empty ability state when backend dimensions are missing", () => {
    expect(getAgentAbilityResult(agent({ profile: undefined }))).toEqual({
      kind: "empty",
      title: "能力维度待接入",
      description: "后端尚未返回标准能力维度，暂不展示前端推导分。"
    });
  });

  it("uses backend profile dimensions when they are available", () => {
    expect(
      getAgentAbilityResult(
        agent({
          profile: {
            requirement: 80,
            stability: 81,
            delivery: 82,
            quality: 83
          }
        })
      )
    ).toEqual({
      kind: "profile",
      rows: [
        { label: "资料检索", value: 80 },
        { label: "任务执行", value: 81 },
        { label: "结构化输出", value: 82 },
        { label: "验收友好", value: 83 }
      ]
    });
  });

  it("does not render null score as a numeric metric", () => {
    expect(getCurrentAgentScoreMetric(agent({ score: null }))).toBe("-");
  });

  it("marks missing evaluation time and ability tags as backend-pending", () => {
    const summary = getAgentAdmissionSummary(agent({ lastEvaluatedAt: "", tags: [] }));

    expect(summary.lastEvaluatedAt).toBe("待后端返回");
    expect(getAgentTagLabels(summary.tags)).toEqual(["能力标签待后端返回"]);
  });

  it("shows profile editing as a disabled backend-pending action", () => {
    expect(getAgentProfileEditAction()).toEqual({
      label: "编辑职业画像（待接口）",
      disabled: true,
      description: "职业画像读取、编辑和保存接口尚未接入，前端不做本地假保存。"
    });
  });

  it("does not claim that agent evaluation completed after a plain connect call", () => {
    expect(getAgentConnectSuccessMessage(agent({ status: "可连接" }))).toBe("连接成功，能力画像和评分以后端返回为准");
    expect(getAgentConnectSuccessMessage(agent({ status: "已断开" }))).toBe("重新连接成功，能力画像和评分以后端返回为准");
  });

  it("does not label the connect action as a local evaluation", () => {
    expect(getAgentConnectActionLabel(agent({ status: "可连接" }))).toBe("连接 Agent");
    expect(getAgentConnectActionLabel(agent({ status: "已断开" }))).toBe("重新连接");
  });
});
