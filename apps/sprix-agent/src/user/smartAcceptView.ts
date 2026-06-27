import type { Agent } from "../types";

export type SmartAcceptUnavailableRow = {
  label: string;
  tone: "agent" | "pending";
};

export type SmartAcceptPendingAction = {
  label: string;
  disabled: true;
  reason: string;
};

export function getSmartAcceptUnavailableRows(currentAgent?: Agent): SmartAcceptUnavailableRow[] {
  return [
    {
      label: currentAgent?.name || "未设置当前执行 Agent",
      tone: currentAgent ? "agent" : "pending"
    },
    {
      label: "阈值待后端返回",
      tone: "pending"
    },
    {
      label: "等待接口接入",
      tone: "pending"
    }
  ];
}

export function getSmartAcceptPendingActions(): SmartAcceptPendingAction[] {
  return [
    { label: "开启智能接单", disabled: true, reason: "开关状态接口待接入" },
    { label: "保存接单阈值", disabled: true, reason: "阈值配置接口待接入" },
    { label: "查看命中结果", disabled: true, reason: "命中任务和自动接单结果接口待接入" }
  ];
}
