export type AdminEstimatedTokenField = {
  label: string;
  value: string;
  helper: string;
};

export function getAdminEstimatedTokenField(): AdminEstimatedTokenField {
  return {
    label: "预计 Token",
    value: "-",
    helper: "由后端任务模型返回的预计 Token。"
  };
}
