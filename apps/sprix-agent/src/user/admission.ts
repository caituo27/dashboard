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

export function canBrowseAgentRoutes(pathname: string) {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  return normalizedPathname === "/agent" || normalizedPathname.startsWith("/agent/");
}

export function isCurrentAgentExecutionAvailable(agent?: Pick<Agent, "status" | "role" | "evaluation">) {
  if (!agent || agent.status === "离线" || agent.role !== "当前执行 Agent") return false;

  const evaluationStatus = agent.evaluation?.status ?? agent.evaluation?.result?.status;
  return evaluationStatus === "completed";
}

export function getUserAdmissionState(account: Pick<Account, "isLoggedIn">, currentAgent?: Agent): UserAdmissionState {
  if (!account.isLoggedIn) {
    return {
      allowed: false,
      reason: "请先登录"
    };
  }

  if (!currentAgent) {
    return {
      allowed: false,
      reason: "请先设置当前执行 Agent"
    };
  }

  if (!isCurrentAgentExecutionAvailable(currentAgent)) {
    return {
      allowed: false,
      reason: "当前执行 Agent 测评未完成，请完成测评后再继续"
    };
  }

  return {
    allowed: true,
    currentAgent
  };
}
