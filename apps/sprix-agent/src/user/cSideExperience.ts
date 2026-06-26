import type { Task } from "../types";

export type LocalAgentId = "codex" | "claude-code" | "opencode";

export type LocalAgentOption = {
  id: LocalAgentId;
  name: string;
  vendor: string;
  status: "可连接";
  summary: string;
  tags: string[];
};

export type LocalAgentAssessment = {
  agentId: LocalAgentId;
  agentName: string;
  question: string;
  profileTitle: string;
  profileSummary: string;
  score: number;
  dimensions: { label: string; value: number }[];
  recommendedDirection: string;
};

export type RecommendedTask = Task & {
  rankLabel: string;
  tokenEstimate: string;
};

export type DemoAutoAcceptResult = {
  threshold: number;
  eligibleCount: number;
  acceptedTaskIds: string[];
  message: string;
};

const LOCAL_AGENT_ASSESSMENT_STORAGE_KEY = "sprix-local-agent-assessment-v1";

export const localAgentOptions: LocalAgentOption[] = [
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    status: "可连接",
    summary: "擅长产品拆解、代码实现、资料整理和自动化验证。",
    tags: ["产品理解", "代码执行", "资料整理"]
  },
  {
    id: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic",
    status: "可连接",
    summary: "适合长文档分析、需求推理和结构化交付。",
    tags: ["长上下文", "需求推理", "文档生成"]
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "Local",
    status: "可连接",
    summary: "适合本地脚本、批量处理和轻量自动化任务。",
    tags: ["本地执行", "批处理", "轻量自动化"]
  }
];

export function buildLocalAgentAssessment(agentId: LocalAgentId): LocalAgentAssessment {
  const agent = localAgentOptions.find((item) => item.id === agentId) ?? localAgentOptions[0];
  return {
    agentId: agent.id,
    agentName: agent.name,
    question: "我在你眼里的职业画像是什么？",
    profileTitle: "产品型创意技术建设者",
    profileSummary: "你更像能把产品想法、技术实现和交付验证串起来的人，适合承接调研、原型、代码辅助和结构化内容生产类任务。",
    score: 76,
    dimensions: [
      { label: "产品判断", value: 82 },
      { label: "技术协作", value: 78 },
      { label: "资料整理", value: 75 },
      { label: "交付稳定", value: 70 }
    ],
    recommendedDirection: "优先推荐产品调研、竞品分析、原型整理、代码辅助和内容结构化任务。"
  };
}

export function buildRecommendedTasks(tasks: Task[]): RecommendedTask[] {
  return tasks
    .filter((task) => task.taskStatus === "已发布")
    .sort((left, right) => right.agentMatchScore - left.agentMatchScore)
    .map((task, index) => ({
      ...task,
      rankLabel: `推荐 ${index + 1}`,
      tokenEstimate: estimateTaskTokens(task)
    }));
}

export function getDemoAutoAcceptResult(tasks: Pick<Task, "agentMatchScore" | "id">[], threshold = 80): DemoAutoAcceptResult {
  const eligibleCount = tasks.filter((task) => task.agentMatchScore >= threshold).length;
  return {
    threshold,
    eligibleCount,
    acceptedTaskIds: [],
    message: `已扫描 ${tasks.length} 个推荐任务，发现 ${eligibleCount} 个匹配率超过 ${threshold}% 的任务。本版本为演示模式，暂不自动接单。`
  };
}

export function saveLocalAgentAssessment(assessment: LocalAgentAssessment) {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(LOCAL_AGENT_ASSESSMENT_STORAGE_KEY, JSON.stringify(assessment));
}

export function readLocalAgentAssessment(): LocalAgentAssessment | null {
  if (!hasBrowserStorage()) return null;
  const stored = window.localStorage.getItem(LOCAL_AGENT_ASSESSMENT_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as LocalAgentAssessment;
    if (!localAgentOptions.some((agent) => agent.id === parsed.agentId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function estimateTaskTokens(task: Task): string {
  const complexity = task.description.length + task.deliverables.length + task.acceptanceCriteria.length;
  const base = task.agentMatchScore >= 88 ? 18 : task.agentMatchScore >= 75 ? 14 : 10;
  const extra = Math.min(10, Math.ceil(complexity / 120));
  return `${base + extra}K Token`;
}

function hasBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
