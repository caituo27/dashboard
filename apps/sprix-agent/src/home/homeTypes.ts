import type { Agent, LocalAgentDiagnostic } from "../types";

export type HomeAgentState =
  | "guest"
  | "logged_in_without_agents"
  | "logged_in_with_agents_without_current"
  | "logged_in_with_current_agent";

export type HomeAgentStateResult = {
  state: HomeAgentState;
  isLoggedIn: boolean;
  agents: Agent[];
  localAgent?: LocalAgentDiagnostic;
  currentAgent?: Agent;
  canOpenAgentPicker: boolean;
  primaryActionLabel: string;
};
