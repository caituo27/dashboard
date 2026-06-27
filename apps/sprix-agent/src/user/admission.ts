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

export function getConnectedAgent(agents: Agent[]) {
  return agents.find((agent) => agent.status === "已连接" || agent.status === "可连接");
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

  const connectedCurrentAgent = agents.find((agent) => agent.role === "当前执行 Agent" && (agent.status === "已连接" || agent.status === "可连接"));
  const connectedAgent = connectedCurrentAgent ?? getConnectedAgent(agents);
  if (!connectedAgent) {
    return {
      allowed: false,
      reason: "请先安装并启动本地 Agent"
    };
  }

  return {
    allowed: true,
    currentAgent: connectedAgent
  };
}
