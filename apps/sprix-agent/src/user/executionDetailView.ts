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
  SETTLING: "报酬入账",
  accepted: "已接单",
  parsing: "解析任务",
  generating: "生成结果",
  generating_result: "生成结果",
  quality_checking: "质量检查",
  platform_reviewing: "平台验收",
  platform_rejected: "平台审核不通过",
  settling: "报酬入账"
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
    terminationReason: detail.terminationReason ?? ""
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

export function getOutputFailureMessage(detail: MyTaskExecutionDetail) {
  const output = detail.output;
  if (!output) return "";
  if ((output.exitCode ?? 0) !== 0) return `Agent 执行退出码：${output.exitCode}`;
  if (output.stderr?.trim()) return output.stderr.trim();
  return "";
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
  return uniqueTextItems([
    ...parseTextList(acceptance?.issues),
    ...parseTextList(payload?.issues),
    ...parseTextList(payload?.failureReasons)
  ]);
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
  return text ? [text] : [];
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

export function getTimelineTime(event: TimelineEventSnapshot) {
  return event.receivedAt ?? event.eventTimestamp ?? "";
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
