import type { MyTask } from "../types";
import { currency } from "../utils/format";
import { getEstimatedTokenField } from "./tokenEstimateView";

const processingAppealStatuses = new Set(["申诉处理中", "待处理", "处理中", "需补充材料"]);

export function getQualificationSuccessAction(search: string) {
  const sourceTaskId = new URLSearchParams(search).get("task")?.trim();
  if (sourceTaskId) {
    return {
      label: "返回任务并接单",
      path: `/agent/task/${encodeURIComponent(sourceTaskId)}`
    };
  }

  return {
    label: "去任务市场",
    path: "/agent/market"
  };
}

export function getMyTaskMetaItems(task: Pick<MyTask, "category" | "agentName" | "startedAt" | "reward">) {
  const tokenField = getEstimatedTokenField();
  return [task.category, task.agentName, task.startedAt, currency(task.reward), `${tokenField.label}：${tokenField.value}`].filter(Boolean);
}

export function getMyTaskActions(task: Pick<MyTask, "status" | "appealStatus">) {
  const isFailed = task.status === "验收未通过";
  const isSettled = task.status === "结算中" || task.status === "已结算";
  const appealStatus = task.appealStatus ?? "未申诉";
  const appealReadonly = processingAppealStatuses.has(appealStatus) || appealStatus === "申诉不通过" || appealStatus === "申诉通过";
  const appealLabel = isFailed
    ? processingAppealStatuses.has(appealStatus)
      ? "申诉处理中"
      : appealStatus === "申诉不通过" || appealStatus === "申诉通过"
        ? appealStatus
        : "申诉"
    : undefined;

  return {
    appealLabel,
    appealEnabled: Boolean(isFailed && appealLabel === "申诉" && !appealReadonly),
    terminateLabel: task.status === "执行中" ? "终止执行（待接口）" : undefined,
    terminateEnabled: false,
    rerun: task.status === "已终止" || isFailed,
    viewLabel: isSettled ? "查看验收结果" : "查看任务"
  };
}
