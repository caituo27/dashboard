import { describe, expect, it } from "vitest";
import type { Account, Agent } from "../types";
import { canVisitAgentCenterBeforeAdmission, getUserAdmissionState } from "./admission";

const loggedOutAccount = { isLoggedIn: false } as Account;
const loggedInAccount = { isLoggedIn: true } as Account;

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: "agent-1",
    name: "Codex",
    status: "已连接",
    role: "当前执行 Agent",
    score: 88,
    lastEvaluatedAt: "2026-06-26 12:00",
    summary: "",
    tags: [],
    ...overrides
  };
}

describe("getUserAdmissionState", () => {
  it("blocks formal pages when the user has not logged in", () => {
    expect(getUserAdmissionState(loggedOutAccount, [agent({})])).toEqual({
      allowed: false,
      reason: "请先登录"
    });
  });

  it("blocks formal pages until the backend reports a connected current execution agent", () => {
    expect(getUserAdmissionState(loggedInAccount, [agent({ role: "已连接 Agent" })])).toEqual({
      allowed: false,
      reason: "请先连接并设置当前执行 Agent"
    });
  });

  it("allows formal pages only for a logged-in user with a connected current execution agent", () => {
    expect(getUserAdmissionState(loggedInAccount, [agent({})])).toEqual({
      allowed: true,
      currentAgent: agent({})
    });
  });
});

describe("canVisitAgentCenterBeforeAdmission", () => {
  it("allows Agent Center to show connection state before a current execution Agent is set", () => {
    expect(canVisitAgentCenterBeforeAdmission("/agent/center")).toBe(true);
  });

  it("does not open formal work pages before Agent admission is complete", () => {
    expect(canVisitAgentCenterBeforeAdmission("/agent/market")).toBe(false);
    expect(canVisitAgentCenterBeforeAdmission("/agent/task/task-1")).toBe(false);
  });
});
