export type EstimatedTokenField = {
  label: string;
  value: string;
  description: string;
};

export function getEstimatedTokenField(): EstimatedTokenField {
  return {
    label: "预计 Token",
    value: "待后端字段接入",
    description: "后端尚未返回预计 Token 字段，前端不做本地估算。"
  };
}
