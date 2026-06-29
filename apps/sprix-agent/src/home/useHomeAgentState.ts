import type { Agent, Account } from "../types";
import type { HomeAgentStateResult } from "./homeTypes";

export function useHomeAgentState(account: Account, agents: Agent[], currentAgent?: Agent): HomeAgentStateResult {
  if (!account.isLoggedIn) {
    return {
      state: "guest",
      isLoggedIn: false,
      agents,
      currentAgent: undefined,
      canOpenAgentPicker: false,
      primaryActionLabel: "登录后连接 Agent"
    };
  }

  if (currentAgent) {
    return {
      state: "logged_in_with_current_agent",
      isLoggedIn: true,
      agents,
      currentAgent,
      canOpenAgentPicker: false,
      primaryActionLabel: "进入任务市场"
    };
  }

  if (agents.length > 0) {
    return {
      state: "logged_in_with_agents_without_current",
      isLoggedIn: true,
      agents,
      currentAgent: undefined,
      canOpenAgentPicker: true,
      primaryActionLabel: "设置当前执行 Agent"
    };
  }

  return {
    state: "logged_in_without_agents",
    isLoggedIn: true,
    agents,
    currentAgent: undefined,
    canOpenAgentPicker: false,
    primaryActionLabel: "连接本地 Agent"
  };
}
