import type { Agent } from "../types";
import { scoreText } from "../utils/format";

export type AgentAdmissionSummary = {
  title: string;
  status: Agent["status"];
  role: Agent["role"];
  score: string;
  lastEvaluatedAt: string;
  summary: string;
  tags: string[];
};

export type AgentAbilityResult =
  | {
      kind: "profile";
      rows: Array<{ label: string; value: number }>;
    }
  | {
      kind: "empty";
      title: string;
      description: string;
    };

export type AgentProfileEditAction = {
  label: string;
  disabled: boolean;
  description: string;
};

export function getAgentAdmissionSummary(agent: Agent): AgentAdmissionSummary {
  return {
    title: agent.name,
    status: agent.status,
    role: agent.role,
    score: scoreText(agent.score),
    lastEvaluatedAt: agent.lastEvaluatedAt || "待后端返回",
    summary: agent.summary,
    tags: agent.tags
  };
}

export function getAgentTagLabels(tags: string[]) {
  return tags.length > 0 ? tags : ["能力标签待后端返回"];
}

export function getAgentAbilityResult(agent?: Agent): AgentAbilityResult {
  if (!agent?.profile) {
    return {
      kind: "empty",
      title: "能力维度待接入",
      description: "后端尚未返回标准能力维度，暂不展示前端推导分。"
    };
  }

  return {
    kind: "profile",
    rows: [
      { label: "资料检索", value: agent.profile.requirement },
      { label: "任务执行", value: agent.profile.stability },
      { label: "结构化输出", value: agent.profile.delivery },
      { label: "验收友好", value: agent.profile.quality }
    ]
  };
}

export function getCurrentAgentScoreMetric(agent?: Agent) {
  return scoreText(agent?.score);
}

export function getAgentProfileEditAction(): AgentProfileEditAction {
  return {
    label: "编辑职业画像（待接口）",
    disabled: true,
    description: "职业画像读取、编辑和保存接口尚未接入，前端不做本地假保存。"
  };
}
