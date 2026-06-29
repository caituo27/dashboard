export type RecommendationPendingState = {
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
};

export const SMART_ACCEPT_THRESHOLD = 95;

export function getRecommendationPendingState(matchedTaskCount = 0): RecommendationPendingState {
  return {
    title: "智能接单",
    description: `系统会自动接取匹配度大于 ${SMART_ACCEPT_THRESHOLD}% 的任务；当前暂无超过阈值的任务。`,
    metrics: [
      { label: "自动阈值", value: `>${SMART_ACCEPT_THRESHOLD}%` },
      { label: "命中任务", value: `${matchedTaskCount}` },
      { label: "当前状态", value: "已开启" }
    ]
  };
}
