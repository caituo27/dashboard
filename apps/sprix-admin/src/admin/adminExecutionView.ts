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
    return [{ label: "查看执行详情（待接口）", disabled: true, reason: "后台 execution 详情接口待接入" }];
  }

  if (kind === "terminated") {
    return [{ label: "查看执行记录（待接口）", disabled: true, reason: "后台 execution 详情接口待接入" }];
  }

  const actions: AdminExecutionRecordAction[] = [
    { label: "查看结果（待接口）", disabled: true, reason: "后台执行结果文件接口待接入" },
    { label: "查看验收详情（待接口）", disabled: true, reason: "后台验收报告详情接口待接入" }
  ];

  if (options.appealStatus && options.appealStatus !== "无申诉") {
    actions.push({ label: "查看申诉（待接口）", disabled: true, reason: "执行记录到申诉详情的关联字段待后端返回" });
  }

  if (options.settlementStatus && ["结算中", "已入账"].includes(options.settlementStatus)) {
    actions.push({ label: "查看结算（待接口）", disabled: true, reason: "后台 execution 结算详情接口待接入" });
  }

  return actions;
}
