import type { Agent, Task } from "../types";

export type RecommendationPanelState = {
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
  bestTask?: Task;
  bestReason: string;
  smartAcceptStatus: string;
};

type RecommendationPanelInput = {
  tasks: Task[];
  currentAgent?: Agent;
  isLoggedIn: boolean;
  smartAcceptMessage?: string;
};

export function getRecommendationPanelState({
  tasks,
  currentAgent,
  isLoggedIn,
  smartAcceptMessage
}: RecommendationPanelInput): RecommendationPanelState {
  const recommendedTasks = tasks.filter((task) => task.agentMatchScore > 0);
  const bestTask = recommendedTasks[0];
  const bestScore = bestTask ? `${bestTask.agentMatchScore}%` : "-";
  const smartAcceptStatus = smartAcceptMessage ?? (bestTask ? "未触发" : "-");

  if (!isLoggedIn) {
    return {
      title: "登录后查看 Agent 匹配推荐",
      description: "游客可浏览公开任务；登录并设置当前执行 Agent 后，任务会按匹配度排序并展示推荐理由。",
      metrics: [
        { label: "最高匹配度", value: "-" },
        { label: "推荐任务数", value: "-" },
        { label: "智能接单", value: "-" }
      ],
      bestReason: "",
      smartAcceptStatus: "-"
    };
  }

  if (!currentAgent) {
    return {
      title: "设置当前执行 Agent 后推荐任务",
      description: "连接并设置当前执行 Agent 后，系统会根据 Agent 评分、能力标签和任务文本计算匹配度。",
      metrics: [
        { label: "最高匹配度", value: "-" },
        { label: "推荐任务数", value: "-" },
        { label: "智能接单", value: "-" }
      ],
      bestReason: "",
      smartAcceptStatus: "-"
    };
  }

  return {
    title: "Agent 匹配推荐",
    description: bestTask
      ? `${currentAgent.name} 当前最高匹配任务为「${bestTask.title}」，可在确认后尝试智能接单。`
      : `${currentAgent.name} 暂无可推荐任务。`,
    metrics: [
      { label: "最高匹配度", value: bestScore },
      { label: "推荐任务数", value: recommendedTasks.length ? String(recommendedTasks.length) : "-" },
      { label: "智能接单", value: smartAcceptStatus }
    ],
    bestTask,
    bestReason: bestTask?.recommendedReason ?? "",
    smartAcceptStatus
  };
}

export function getSmartAcceptMessage(accepted?: boolean, message?: string) {
  if (message) return message;
  return accepted ? "已自动接单并进入执行中。" : "已按评分推荐，未自动接单。";
}
