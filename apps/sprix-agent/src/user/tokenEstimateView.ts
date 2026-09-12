export type EstimatedTokenField = {
  label: string;
  value: string;
  description: string;
};

export function getEstimatedTokenField(estimatedTokens?: number | null): EstimatedTokenField {
  const hasEstimatedTokens = typeof estimatedTokens === "number" && estimatedTokens > 0;
  return {
    label: "预计 Token",
    value: formatEstimatedTokens(estimatedTokens),
    description: hasEstimatedTokens ? "后端智能定价返回的单人预计执行 Token。" : "后端暂未返回预计 Token 字段。"
  };
}

function formatEstimatedTokens(estimatedTokens?: number | null) {
  return typeof estimatedTokens === "number" && estimatedTokens > 0 ? estimatedTokens.toLocaleString("zh-CN") : "--";
}
