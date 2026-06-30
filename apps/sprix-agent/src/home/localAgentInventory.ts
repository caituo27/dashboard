import type { LocalAgentDiagnostic, LocalAgentInventoryStatus } from "../types";

export function shouldPollLocalAgentInventory(status?: LocalAgentInventoryStatus) {
  return status === "WAITING_INVENTORY" || status === "INVENTORY_STALE";
}

export function getLocalAgentEmptyMessage(localAgent?: LocalAgentDiagnostic) {
  if (localAgent?.message) return localAgent.message;

  switch (localAgent?.inventoryStatus) {
    case "NOT_BOUND":
      return "未连接本地客户端，请安装或完成绑定";
    case "DEVICE_OFFLINE":
      return "本地客户端未在线，请重启客户端或重新绑定";
    case "WAITING_INVENTORY":
      return "正在检测本机 Agent";
    case "INVENTORY_STALE":
      return "正在刷新本地 Agent 状态";
    case "NO_AVAILABLE_AGENT":
      return "未检测到可用的 codex、opencode 或 claude";
    case "READY":
      return "暂无可展示 Agent";
    default:
      return "暂无 Agent";
  }
}

export function getLocalAgentPrimaryActionLabel(localAgent?: LocalAgentDiagnostic) {
  if (shouldPollLocalAgentInventory(localAgent?.inventoryStatus)) return "检测中";
  if (localAgent?.inventoryStatus === "DEVICE_OFFLINE") return "重新检测本地客户端";
  if (localAgent?.inventoryStatus === "NO_AVAILABLE_AGENT") return "安装可用 CLI";
  return "连接本地 Agent";
}
