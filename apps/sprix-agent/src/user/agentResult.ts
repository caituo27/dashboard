import type { Agent } from "../types";
import { scoreText } from "../utils/format";

const evaluationDimensionLabels: Record<string, string> = {
  clarity: "表达清晰",
  completeness: "覆盖完整",
  safety: "安全边界",
  maintainability: "改动边界",
  specificity: "项目理解",
  efficiency: "执行效率"
};

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
    lastEvaluatedAt: agent.evaluation?.lastEvaluatedAt || "待后端返回",
    summary: agent.summary,
    tags: agent.tags
  };
}

export function getAgentTagLabels(tags: string[]) {
  return tags;
}

export function getAgentAbilityResult(agent?: Agent): AgentAbilityResult {
  const evaluationResult = agent?.evaluation?.result;
  const evaluationStatus = evaluationResult?.status ?? agent?.evaluation?.status;

  if (evaluationStatus === "running" || evaluationStatus === "judging") {
    return {
      kind: "empty",
      title: "能力画像生成中",
      description: "后端评测任务仍在执行或评分，关闭页面不会取消任务。"
    };
  }

  if (evaluationStatus === "failed") {
    return {
      kind: "empty",
      title: "测评失败，可重新评测",
      description: evaluationResult?.error || "本次评测未完成，可以从 Agent 列表重新发起。"
    };
  }

  if (evaluationStatus === "completed" && evaluationResult && Object.keys(evaluationResult.dimensions).length > 0) {
    return {
      kind: "profile",
      rows: Object.entries(evaluationDimensionLabels).map(([key, label]) => ({
        label,
        value: evaluationResult.dimensions[key]?.score ?? 0
      }))
    };
  }

  if (!agent?.profile) {
    return {
      kind: "empty",
      title: "暂未完成评测",
      description: "点击 Agent 列表中的开始评测后，将展示六个能力维度和改进建议。"
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

export function hasPendingAgentEvaluation(agent?: Pick<Agent, "evaluation"> | null) {
  const status = agent?.evaluation?.status ?? agent?.evaluation?.result?.status;
  return status === "running" || status === "judging";
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
