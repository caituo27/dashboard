import type { Agent } from "../types";

export type HomeAgentState =
  | "guest"
  | "logged_in_without_agents"
  | "logged_in_with_agents_without_current"
  | "logged_in_with_current_agent";

export type HomeAgentStateResult = {
  state: HomeAgentState;
  isLoggedIn: boolean;
  agents: Agent[];
  currentAgent?: Agent;
  canOpenAgentPicker: boolean;
  primaryActionLabel: string;
};
