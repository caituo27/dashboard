import type { Account, Agent, MyTask, Task } from "../types";
import { currency } from "../utils/format";
import { getEstimatedTokenField } from "./tokenEstimateView";

const processingAppealStatuses = new Set(["申诉处理中", "待处理", "处理中", "需补充材料"]);
const emptyAppealStatuses = new Set(["未申诉", "无申诉"]);
const taskAcceptQualificationMessage = "首次接单前，请先完成支付宝人脸核验并同意《自由职业者服务框架协议》。";

type TaskAcceptAccount = Pick<Account, "isLoggedIn" | "qualificationStatus" | "realPersonVerified" | "freelancerAgreementSigned">;
type TaskAcceptAgent = Pick<Agent, "id"> | undefined;
type TaskAcceptTask = Pick<Task, "id" | "taskStatus" | "remainingSlots">;

export type TaskAcceptGate =
  | {
      kind: "login";
    }
  | {
      kind: "qualification";
      path: string;
      message: string;
    }
  | {
      kind: "current-agent";
      message: string;
      path: "/agent/center";
    }
  | {
      kind: "task-unavailable";
      message: string;
    }
  | {
      kind: "ready";
    };

export type TaskAcceptQualificationGate =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      path: string;
      message: string;
    };

export function isTaskAcceptQualificationReady(
  account: Pick<Account, "qualificationStatus" | "realPersonVerified" | "freelancerAgreementSigned">
) {
  return account.qualificationStatus === "已开通" && account.realPersonVerified && account.freelancerAgreementSigned;
}

export function getTaskAcceptQualificationGate(
  account: Pick<Account, "qualificationStatus" | "realPersonVerified" | "freelancerAgreementSigned">,
  taskId: string
): TaskAcceptQualificationGate {
  if (isTaskAcceptQualificationReady(account)) {
    return {
      allowed: true
    };
  }

  return {
    allowed: false,
    path: `/agent/qualification?task=${encodeURIComponent(taskId)}`,
    message: taskAcceptQualificationMessage
  };
}

export function getTaskAcceptGate(account: TaskAcceptAccount, currentAgent: TaskAcceptAgent, task: TaskAcceptTask): TaskAcceptGate {
  if (!account.isLoggedIn) {
    return { kind: "login" };
  }

  const qualificationGate = getTaskAcceptQualificationGate(account, task.id);
  if (!qualificationGate.allowed) {
    return {
      kind: "qualification",
      path: qualificationGate.path,
      message: qualificationGate.message
    };
  }

  if (!currentAgent) {
    return {
      kind: "current-agent",
      message: "请先设置当前执行 Agent",
      path: "/agent/center"
    };
  }

  if (task.taskStatus !== "已发布" || task.remainingSlots <= 0) {
    return {
      kind: "task-unavailable",
      message: "当前任务暂不可接单"
    };
  }

  return { kind: "ready" };
}

export function getAgreementSignButtonText(secondsRemaining: number) {
  if (secondsRemaining > 0) {
    return `请阅读 ${secondsRemaining} 秒后签署`;
  }

  return "同意并签署";
}

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

export function getMyTaskMetaItems(task: Pick<MyTask, "category" | "agentName" | "startedAt" | "reward" | "estimatedTokens">) {
  const tokenField = getEstimatedTokenField(task.estimatedTokens);
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
    terminateLabel: task.status === "执行中" ? "终止执行" : undefined,
    terminateEnabled: task.status === "执行中",
    rerun: task.status === "已终止" || isFailed,
    viewLabel: isSettled ? "查看验收结果" : "查看任务"
  };
}

export function shouldShowAppealStatus(status?: string): status is string {
  return Boolean(status && !emptyAppealStatuses.has(status));
}
