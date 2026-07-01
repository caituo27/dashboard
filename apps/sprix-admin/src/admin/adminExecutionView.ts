export type AdminExecutionRecordKind = "running" | "terminated" | "completed";

export type AdminExecutionRecordAction = {
  label: string;
  disabled: true;
  reason: string;
};

const noAppealStatuses = new Set(["无申诉", "未申诉"]);
const settlementActionStatuses = new Set(["结算中", "已结算", "已入账"]);

function hasAppealRecord(status?: string) {
  const normalizedStatus = status?.trim();
  return Boolean(normalizedStatus && !noAppealStatuses.has(normalizedStatus));
}

function hasSettlementRecord(status?: string) {
  const normalizedStatus = status?.trim();
  return Boolean(normalizedStatus && settlementActionStatuses.has(normalizedStatus));
}

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

  if (hasAppealRecord(options.appealStatus)) {
    actions.push({ label: "查看申诉", disabled: true, reason: "执行记录到申诉详情的关联字段待后端返回" });
  }

  if (hasSettlementRecord(options.settlementStatus)) {
    actions.push({ label: "查看结算", disabled: true, reason: "后台执行记录结算详情接口待接入" });
  }

  return actions;
}
