export type LocalAgentClaimReturnState = {
  title: string;
  description: string;
};

export function getLocalAgentClaimReturnState(): LocalAgentClaimReturnState {
  return {
    title: "绑定完成回跳目标待后端返回",
    description: "前端只负责生成 enrollmentToken 并跳转到 8084 后端完成绑定；绑定成功后应回到哪里等待后端返回明确目标。"
  };
}
