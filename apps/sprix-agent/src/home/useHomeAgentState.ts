import type { Agent, Account, LocalAgentDiagnostic } from "../types";
import { getLocalAgentPrimaryActionLabel } from "./localAgentInventory";
import type { HomeAgentStateResult } from "./homeTypes";

export function useHomeAgentState(account: Account, agents: Agent[], currentAgent?: Agent, localAgent?: LocalAgentDiagnostic): HomeAgentStateResult {
  if (!account.isLoggedIn) {
    return {
      state: "guest",
      isLoggedIn: false,
      agents,
      localAgent,
      currentAgent: undefined,
      canOpenAgentPicker: false,
      primaryActionLabel: "登录/注册"
    };
  }

  if (currentAgent) {
    return {
      state: "logged_in_with_current_agent",
      isLoggedIn: true,
      agents,
      localAgent,
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
      localAgent,
      currentAgent: undefined,
      canOpenAgentPicker: true,
      primaryActionLabel: "设置当前执行 Agent"
    };
  }

  return {
    state: "logged_in_without_agents",
    isLoggedIn: true,
    agents,
    localAgent,
    currentAgent: undefined,
    canOpenAgentPicker: false,
    primaryActionLabel: getLocalAgentPrimaryActionLabel(localAgent)
  };
}
