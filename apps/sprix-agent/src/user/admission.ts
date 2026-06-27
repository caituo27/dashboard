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
  return agents.find((agent) => agent.role === "当前执行 Agent" && agent.status === "已连接");
}

export function canVisitAgentCenterBeforeAdmission(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/agent/center";
}

export function getUserAdmissionState(account: Pick<Account, "isLoggedIn">, agents: Agent[]): UserAdmissionState {
  if (!account.isLoggedIn) {
    return {
      allowed: false,
      reason: "请先登录"
    };
  }

  const currentAgent = getCurrentExecutionAgent(agents);
  if (!currentAgent) {
    return {
      allowed: false,
      reason: "请先连接并设置当前执行 Agent"
    };
  }

  return {
    allowed: true,
    currentAgent
  };
}
