export type RecommendationPendingState = {
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
};

export function getRecommendationPendingState(): RecommendationPendingState {
  return {
    title: "推荐/匹配能力待后端接入",
    description: "当前任务市场按后端已发布任务展示；推荐排序、匹配度、推荐理由和画像依据待后端接口返回后再展示。",
    metrics: [
      { label: "推荐排序", value: "待接口" },
      { label: "匹配度", value: "待接口" },
      { label: "推荐理由", value: "待接口" }
    ]
  };
}
