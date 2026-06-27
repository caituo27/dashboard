import type { Account, Agent } from "../types";

export type UserAdmissionState =
  | {
      allowed: true;
      currentAgent: Agent;
    }
  | {
      allowed: false;
      reason: string;
    };

export function getCurrentExecutionAgent(agents: Agent[]) {
  return agents.find((agent) => agent.role === "当前执行 Agent");
}

export function canVisitAgentCenterBeforeAdmission(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/agent/center";
}

export function getUserAdmissionState(account: Pick<Account, "isLoggedIn">, agents: Agent[]): UserAdmissionState {
  if (!account.isLoggedIn) {
    return {
      allowed: false,
      reason: "请先登录并设置当前执行 Agent"
    };
  }

  const currentAgent = getCurrentExecutionAgent(agents);
  if (!currentAgent) {
    return {
      allowed: false,
      reason: "请先设置当前执行 Agent"
    };
  }

  return {
    allowed: true,
    currentAgent
  };
}
