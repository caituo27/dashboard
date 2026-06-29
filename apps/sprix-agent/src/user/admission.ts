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

export function canVisitAgentCenterBeforeAdmission(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/agent/center";
}

export function getUserAdmissionState(account: Pick<Account, "isLoggedIn">, currentAgent?: Agent): UserAdmissionState {
  if (!account.isLoggedIn) {
    return {
      allowed: false,
      reason: "请先登录"
    };
  }

  if (!currentAgent || currentAgent.status === "离线") {
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
