import type { Agent } from "../types";

type AgentStatusInput = Pick<Agent, "authStatus" | "name" | "status">;

export function isAgentLoginRequired(agent?: Partial<AgentStatusInput> | null) {
  if (!agent || agent.status === "离线") return false;
  if (agent.authStatus === "authenticated") return false;
  if (agent.authStatus === "login_required") return true;
  return isClaudeCodeAgentName(agent.name);
}

export function isAgentSelectable(agent: AgentStatusInput) {
  return agent.status !== "离线";
}

export function isAgentReady(agent: AgentStatusInput) {
  return isAgentSelectable(agent) && !isAgentLoginRequired(agent);
}

export function getAgentStatusLabel(agent: AgentStatusInput) {
  return isAgentLoginRequired(agent) ? "待登录" : agent.status;
}

function isClaudeCodeAgentName(name?: string | null) {
  return name?.trim().toLowerCase().includes("claude") === true;
}
