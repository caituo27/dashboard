import type { AcceptanceSnapshot, ArtifactSnapshot, MyTaskExecutionDetail, TimelineEventSnapshot } from "../apis/sprix";
import type { AppealStatus, MyTaskStatus, SettlementStatus } from "../types";
import { currency } from "../utils/format";

const terminalStatuses = new Set(["COMPLETED", "FAILED", "TERMINATED", "CANCELED", "CANCELLED", "SETTLED"]);

const statusLabels: Record<string, MyTaskStatus> = {
  PLATFORM_REVIEWING: "待平台审核",
  ACCEPTANCE_FAILED: "验收未通过",
  SETTLING: "结算中",
  SETTLED: "已结算",
  COMPLETED: "已结算",
  TERMINATED: "已终止",
  FAILED: "验收未通过",
  CANCELED: "已终止",
  CANCELLED: "已终止"
};

const appealLabels: Record<string, AppealStatus> = {
  NOT_APPEALED: "未申诉",
  PENDING: "申诉处理中",
  PROCESSING: "申诉处理中",
  NEED_SUPPLEMENT: "申诉处理中",
  APPROVED: "申诉通过",
  REJECTED: "申诉不通过",
  NONE: "无申诉"
};

const settlementLabels: Record<string, SettlementStatus> = {
  SETTLING: "结算中",
  POSTED: "已入账",
  SETTLED: "已入账",
  FAILED: "结算异常"
};

const nodeLabels: Record<string, string> = {
  ACCEPTED: "已接单",
  PARSING: "解析任务",
  GENERATING: "生成结果",
  GENERATING_RESULT: "生成结果",
  QUALITY_CHECK: "质量检查",
  QUALITY_CHECKING: "质量检查",
  PLATFORM_REVIEWING: "平台验收",
  PLATFORM_REJECTED: "平台审核不通过",
  MANUAL_RESUBMITTED: "人工补交待审核",
  SETTLING: "报酬入账",
  accepted: "已接单",
  parsing: "解析任务",
  generating: "生成结果",
  generating_result: "生成结果",
  quality_checking: "质量检查",
  platform_reviewing: "平台验收",
  platform_rejected: "平台审核不通过",
  manual_resubmitted: "人工补交待审核",
  settling: "报酬入账"
};

const terminationReasonLabels: Record<string, string> = {
  AGENT_SWITCHED_DURING_EXECUTION: "执行中切换 Agent，任务已终止",
  agent_switched_during_execution: "执行中切换 Agent，任务已终止",
  AGENT_DISCONNECTED_DURING_EXECUTION: "执行中 Agent 连接断开，任务已终止",
  agent_disconnected_during_execution: "执行中 Agent 连接断开，任务已终止",
  USER_CANCELLED: "用户主动终止任务",
  user_cancelled: "用户主动终止任务",
  CANCELLED_BY_USER: "用户主动终止任务",
  cancelled_by_user: "用户主动终止任务",
  LOCAL_PROCESS_FAILED: "平台异常终止",
  local_process_failed: "平台异常终止",
  PLATFORM_ERROR: "平台异常终止",
  platform_error: "平台异常终止",
  INPUT_DOWNLOAD_FAILED: "平台异常终止",
  input_download_failed: "平台异常终止",
  ARTIFACT_UPLOAD_FAILED: "平台异常终止",
  artifact_upload_failed: "平台异常终止",
  LOCAL_ACCEPTANCE_FAILED: "平台异常终止",
  local_acceptance_failed: "平台异常终止"
};

export type ExecutionSummary = {
  title: string;
  status: MyTaskStatus;
  appealStatus: AppealStatus;
  settlementStatus: SettlementStatus;
  progress: string;
  currentNode: string;
  agentName: string;
  reward: string;
  startedAt: string;
  completedAt: string;
  terminationReason: string;
};

export function getExecutionSummary(detail: MyTaskExecutionDetail): ExecutionSummary {
  return {
    title: detail.task?.title ?? detail.id ?? "任务执行详情",
    status: mapExecutionStatus(detail.status),
    appealStatus: mapAppealStatus(detail.appealStatus),
    settlementStatus: mapSettlementStatus(detail.settlementStatus),
    progress: detail.progress ?? "-",
    currentNode: getCurrentNodeLabel(detail.currentNode),
    agentName: detail.agent?.name ?? detail.agentId ?? "-",
    reward: currency(detail.task?.reward ?? 0),
    startedAt: formatDateTime(detail.startedAt ?? detail.createdAt),
    completedAt: formatDateTime(detail.completedAt),
    terminationReason: getTerminationReasonLabel(detail.terminationReason)
  };
}

export function isExecutionTerminal(status?: string) {
  return terminalStatuses.has((status ?? "").toUpperCase());
}

export function mapExecutionStatus(status?: string): MyTaskStatus {
  return statusLabels[(status ?? "").toUpperCase()] ?? "执行中";
}

export function mapAppealStatus(status?: string): AppealStatus {
  return appealLabels[(status ?? "").toUpperCase()] ?? "无申诉";
}

export function mapSettlementStatus(status?: string): SettlementStatus {
  return settlementLabels[(status ?? "").toUpperCase()] ?? "未入账";
}

export function getCurrentNodeLabel(node?: string) {
  if (!node) return "-";
  const normalized = node.trim();
  return nodeLabels[normalized] ?? nodeLabels[normalized.toUpperCase()] ?? node;
}

function getTerminationReasonLabel(reason?: string) {
  if (!reason?.trim()) return "";
  const normalized = reason.trim();
  const mappedReason = terminationReasonLabels[normalized] ?? terminationReasonLabels[normalized.toUpperCase()];
  if (mappedReason) return mappedReason;
  if (isMachineReasonCode(normalized)) return "平台异常终止";
  return normalized;
}

function isMachineReasonCode(reason: string) {
  return /[A-Za-z_]/.test(reason);
}

export function getTaskRequirementRows(detail: MyTaskExecutionDetail) {
  const task = detail.task;
  return [
    { label: "任务描述", value: task?.description },
    { label: "交付要求", value: task?.deliverables },
    { label: "验收标准", value: task?.acceptanceCriteria },
    { label: "任务分类", value: task?.category },
    { label: "任务来源", value: task?.sourceName }
  ].filter((item) => Boolean(item.value?.trim()));
}

export function getTokenUsage(detail: MyTaskExecutionDetail) {
  const input = detail.output?.inputTokens ?? 0;
  const output = detail.output?.outputTokens ?? 0;
  const total = input + output;
  return total > 0 ? `${total.toLocaleString("zh-CN")} tokens（输入 ${input} / 输出 ${output}）` : "-";
}

export function getArtifactTitle(artifact: ArtifactSnapshot) {
  return artifact.name || artifact.localRelativePath || artifact.fileId || artifact.artifactId || "未命名文件";
}

export function formatBytes(value?: number) {
  if (!value || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function getAcceptanceIssues(acceptance?: AcceptanceSnapshot) {
  const payload = parseAcceptancePayload(acceptance?.acceptancePayload);
  const payloadIssues = parseTextList(payload?.issues);
  if (payloadIssues.length > 0) return uniqueTextItems(payloadIssues);

  const snapshotIssues = parseTextList(acceptance?.issues);
  if (snapshotIssues.length > 0) return uniqueTextItems(snapshotIssues);

  return uniqueTextItems(parseTextList(payload?.failureReasons));
}

export function getAcceptanceSuggestions(acceptance?: AcceptanceSnapshot) {
  const payload = parseAcceptancePayload(acceptance?.acceptancePayload);
  return uniqueTextItems(parseTextList(payload?.improvementSuggestions));
}

export function getAcceptanceSummary(acceptance?: AcceptanceSnapshot) {
  const payload = parseAcceptancePayload(acceptance?.acceptancePayload);
  return acceptance?.summary?.trim() || textValue(payload?.summary);
}

export function getReadableAcceptanceStatus(status?: string) {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (["passed", "pass", "success", "accepted", "approved"].includes(normalized) || normalized.includes("通过")) {
    return "验收通过";
  }
  if (["failed", "fail", "rejected"].includes(normalized) || normalized.includes("失败") || normalized.includes("未通过")) {
    return "验收未通过";
  }
  if (normalized.includes("pending") || normalized.includes("review")) {
    return "待平台审核";
  }
  return status ?? "";
}

function parseAcceptancePayload(payload?: string) {
  if (!payload?.trim()) return undefined;
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function parseTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean);
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => `${key}：${textValue(item) || "-"}`);
  }
  const text = textValue(value);
  const parsedText = parseJsonText(text);
  if (parsedText !== undefined) return parseTextList(parsedText);
  return text ? [text] : [];
}

function parseJsonText(text: string) {
  if (!text || !["[", "{"].includes(text.charAt(0))) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function uniqueTextItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function getSortedTimeline(detail: MyTaskExecutionDetail): TimelineEventSnapshot[] {
  return [...(detail.timeline ?? [])].sort((a, b) => getTimelineTime(a).localeCompare(getTimelineTime(b)));
}

export type TimelineDisplayItem = {
  event: TimelineEventSnapshot;
  narrative: boolean;
  operations: TimelineEventSnapshot[];
};

export type TimelineOperationSummary = {
  commandCount: number;
  toolCount: number;
};

export function getTimelineDisplayItems(detail: MyTaskExecutionDetail): TimelineDisplayItem[] {
  const items: TimelineDisplayItem[] = [];
  let pendingOperations: TimelineEventSnapshot[] = [];
  let activeItem: TimelineDisplayItem | undefined;

  for (const event of getSortedTimeline(detail)) {
    const activityType = getTimelineActivityType(event);
    if (activityType === "command" || activityType === "tool") {
      if (activeItem) activeItem.operations.push(event);
      else pendingOperations.push(event);
      continue;
    }
    if (isDuplicateFinalNarrative(event, detail.output?.finalMessage, activityType)) continue;

    const item: TimelineDisplayItem = {
      event,
      narrative: activityType === "narrative" || activityType === "reasoning_summary",
      operations: pendingOperations
    };
    pendingOperations = [];
    items.push(item);
    activeItem = item;
  }

  if (pendingOperations.length > 0 && activeItem) activeItem.operations.push(...pendingOperations);
  return items;
}

export function getTimelineOperationSummary(operations: TimelineEventSnapshot[]): TimelineOperationSummary {
  const summary = {
    command: { running: 0, completed: 0 },
    tool: { running: 0, completed: 0 }
  };
  for (const event of operations) {
    const type = getTimelineActivityType(event);
    if (type !== "command" && type !== "tool") continue;
    const status = getTimelineActivityStatus(event) === "completed" ? "completed" : "running";
    summary[type][status] += 1;
  }
  return {
    commandCount: Math.max(summary.command.running, summary.command.completed),
    toolCount: Math.max(summary.tool.running, summary.tool.completed)
  };
}

function getTimelineActivityType(event: TimelineEventSnapshot) {
  return event.activityType?.trim() || textValue(readTimelinePayload(event.payload)?.activityType);
}

function getTimelineActivityStatus(event: TimelineEventSnapshot) {
  return event.activityStatus?.trim() || textValue(readTimelinePayload(event.payload)?.status);
}

function readTimelinePayload(payload?: string) {
  if (!payload?.trim()) return undefined;
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function isDuplicateFinalNarrative(event: TimelineEventSnapshot, finalMessage: string | undefined, activityType: string) {
  if (activityType !== "narrative" || !event.message?.trim() || !finalMessage?.trim()) return false;
  const narrative = event.message.trim().replace(/…$/, "");
  const finalText = finalMessage.trim();
  return finalText === narrative || finalText.startsWith(narrative);
}

export function getTimelineTime(event: TimelineEventSnapshot) {
  return event.receivedAt ?? event.eventTimestamp ?? "";
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const normalizedValue = value.replace(/(\.\d{3})\d+(?=Z$|[+-]\d{2}:?\d{2}$)/, "$1");
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return value;

  const padTimePart = (part: number) => String(part).padStart(2, "0");
  const datePart = [date.getFullYear(), padTimePart(date.getMonth() + 1), padTimePart(date.getDate())].join("-");
  const timePart = [padTimePart(date.getHours()), padTimePart(date.getMinutes())].join(":");
  return `${datePart} ${timePart}`;
}
