import { describe, expect, it } from "vitest";
import type { Agent } from "../types";
import { getSmartAcceptPendingActions, getSmartAcceptUnavailableRows } from "./smartAcceptView";

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: "agent-1",
    name: "Codex",
    status: "已连接",
    role: "当前执行 Agent",
    score: 90,
    lastEvaluatedAt: "2026-06-27 00:00",
    summary: "",
    tags: [],
    ...overrides
  };
}

describe("smart accept unavailable view", () => {
  it("does not invent a threshold before the backend returns smart accept config", () => {
    expect(getSmartAcceptUnavailableRows(agent({}))).toEqual([
      { label: "Codex", tone: "agent" },
      { label: "阈值待后端返回", tone: "pending" },
      { label: "等待接口接入", tone: "pending" }
    ]);
  });

  it("shows missing current agent without fallback data", () => {
    expect(getSmartAcceptUnavailableRows(undefined)[0]).toEqual({
      label: "未设置当前执行 Agent",
      tone: "pending"
    });
  });

  it("exposes smart accept controls as disabled backend-pending actions", () => {
    expect(getSmartAcceptPendingActions()).toEqual([
      { label: "开启智能接单", disabled: true, reason: "开关状态接口待接入" },
      { label: "保存接单阈值", disabled: true, reason: "阈值配置接口待接入" },
      { label: "查看命中结果", disabled: true, reason: "命中任务和自动接单结果接口待接入" }
    ]);
  });
});
