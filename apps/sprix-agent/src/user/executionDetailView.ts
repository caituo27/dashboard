import type { MyTask, Task } from "../types";
import { currency } from "../utils/format";
import { getEstimatedTokenField } from "./tokenEstimateView";

export type ExecutionInfoItem = {
  label: string;
  value: string;
};

export type ExecutionReviewState =
  | {
      kind: "content";
      body: string;
    }
  | {
      kind: "empty";
      title: string;
      description: string;
    };

export type ExecutionArtifactsState =
  | {
      kind: "records";
      files: string[];
    }
  | {
      kind: "empty";
      title: string;
      description: string;
    };

export type ExecutionBackendPendingSection = {
  title: string;
  description: string;
};

export function getExecutionOverview(task: MyTask): ExecutionInfoItem[] {
  const tokenField = getEstimatedTokenField();
  return [
    { label: "执行状态", value: task.status },
    { label: "当前节点", value: task.currentNode || "-" },
    { label: "执行进度", value: task.progress || "-" },
    { label: "结算状态", value: task.settlementStatus },
    { label: "执行 Agent", value: task.agentName || "-" },
    { label: "任务奖励", value: currency(task.reward) },
    { label: tokenField.label, value: tokenField.value }
  ];
}

export function getExecutionRequirementText(task: Task) {
  return [task.description, task.deliverables, task.acceptanceCriteria].map((item) => item.trim()).filter(Boolean).join("\n");
}

export function getExecutionReviewState(task: MyTask, base: Task): ExecutionReviewState {
  const body = task.rejectReason || base.acceptanceResult;
  if (body) return { kind: "content", body };

  return {
    kind: "empty",
    title: "验收结果待后端返回",
    description: "后端尚未返回验收报告、驳回原因或结算结果。"
  };
}

export function getExecutionArtifactsState(task: Task): ExecutionArtifactsState {
  const files = [...task.resultFiles, ...task.submittedFiles].filter(Boolean);
  if (files.length > 0) return { kind: "records", files };

  return {
    kind: "empty",
    title: "交付文件待后端返回",
    description: "后端尚未返回执行日志、交付物或验收附件。"
  };
}

export function getExecutionBackendPendingSections(): ExecutionBackendPendingSection[] {
  return [
    {
      title: "同任务历史执行待后端返回",
      description: "后端尚未提供同一任务下的多次执行记录，暂不展示本地模拟历史。"
    },
    {
      title: "执行日志待后端返回",
      description: "后端尚未提供节点日志、Agent 输出流或失败原因，暂不展示前端假日志。"
    },
    {
      title: "结算明细待后端返回",
      description: "后端尚未提供本次执行的结算金额、平台费和入账时间，暂不展示本地估算。"
    }
  ];
}
