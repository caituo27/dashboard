export type AdminEstimatedTokenField = {
  label: string;
  value: string;
  helper: string;
};

export function getAdminEstimatedTokenField(): AdminEstimatedTokenField {
  return {
    label: "预计 Token",
    value: "待后端字段接入",
    helper: "后端任务模型尚未提供预计 Token 字段，发布/编辑时不提交本地估算值。"
  };
}
