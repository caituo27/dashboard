export type AdminExecutionRecordKind = "running" | "terminated" | "completed";

export type AdminExecutionRecordAction = {
  label: string;
  disabled: true;
  reason: string;
};

export function getAdminExecutionRecordActions(
  kind: AdminExecutionRecordKind,
  options: { appealStatus?: string; settlementStatus?: string } = {}
): AdminExecutionRecordAction[] {
  if (kind === "running") {
    return [
      { label: "查看执行详情", disabled: true, reason: "后台执行详情接口待接入" },
      { label: "查看 Agent 信息", disabled: true, reason: "后台执行记录关联 Agent 详情接口待接入" }
    ];
  }

  if (kind === "terminated") {
    return [
      { label: "查看执行记录", disabled: true, reason: "后台执行详情接口待接入" },
      { label: "查看用户信息", disabled: true, reason: "后台执行记录关联用户详情接口待接入" },
      { label: "查看 Agent 信息", disabled: true, reason: "后台执行记录关联 Agent 详情接口待接入" }
    ];
  }

  const actions: AdminExecutionRecordAction[] = [
    { label: "查看结果", disabled: true, reason: "后台执行结果文件接口待接入" },
    { label: "查看验收详情", disabled: true, reason: "后台验收报告详情接口待接入" }
  ];

  if (options.appealStatus && !["无申诉", "未申诉"].includes(options.appealStatus)) {
    actions.push({ label: "查看申诉", disabled: true, reason: "执行记录到申诉详情的关联字段待后端返回" });
  }

  if (options.settlementStatus && ["结算中", "已入账"].includes(options.settlementStatus)) {
    actions.push({ label: "查看结算", disabled: true, reason: "后台执行记录结算详情接口待接入" });
  }

  return actions;
}
