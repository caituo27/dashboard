import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Modal, Spin, message } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Download, RotateCw } from "lucide-react";
import type { ArtifactSnapshot, MyTaskExecutionDetail } from "../apis/sprix";
import { ActionButton, EmptyState, SecondaryButton, SoftTag, StatusTag, Surface } from "../components/Primitives";
import {
  cancelRemoteTask,
  downloadRemoteTaskAttachment,
  readRemoteMyTaskDetail,
  readRemoteTaskAttachments,
  type TaskAttachment
} from "../services/sprixApi";
import { isGlobalAuthError } from "../utils/http";
import { ArtifactDownloadButton } from "./ArtifactDownloadButton";
import {
  formatBytes,
  formatDateTime,
  getAcceptanceIssues,
  getAcceptanceSuggestions,
  getAcceptanceSummary,
  getArtifactTitle,
  getCurrentNodeLabel,
  getExecutionSummary,
  getReadableAcceptanceStatus,
  getSortedTimeline,
  getTaskRequirementRows,
  getTimelineTime,
  getTokenUsage,
  mapExecutionStatus
} from "./executionDetailView";
import { getMyTaskActions, shouldShowAppealStatus } from "./userFlowRules";
import { useRerunTask } from "./useRerunTask";

type MyTaskDetailPageProps = {
  openAppeal: (executionId: string) => void;
};

export function MyTaskDetailPage({ openAppeal }: MyTaskDetailPageProps) {
  const { id } = useParams();
  const rerunTask = useRerunTask();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<MyTaskExecutionDetail>();
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");

  const loadDetail = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) {
        setLoading(true);
      }
      setError("");

      try {
        setDetail(await readRemoteMyTaskDetail(id));
      } catch (loadError) {
        if (isGlobalAuthError(loadError)) return;
        const messageText = loadError instanceof Error ? loadError.message : "任务执行详情加载失败";
        setError(messageText);
        if (silent) message.error(messageText);
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    setDetail(undefined);
    void loadDetail(false);
  }, [loadDetail]);

  useEffect(() => {
    if (!detail || !shouldAutoRefreshExecutionDetail(detail)) return;
    const timer = window.setInterval(() => {
      void loadDetail(true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [detail, loadDetail]);

  const summary = useMemo(() => (detail ? getExecutionSummary(detail) : undefined), [detail]);
  const actions = useMemo(
    () => (summary ? getMyTaskActions({ status: summary.status, appealStatus: summary.appealStatus }) : undefined),
    [summary]
  );
  const showPrimaryStatus = Boolean(summary && !shouldHidePrimaryStatus(summary.status, summary.appealStatus));
  const cancelTask = () => {
    const executionId = detail?.id ?? id;
    if (!executionId) return;

    Modal.confirm({
      title: "确认终止任务",
      content: "终止后本次执行会进入已终止状态，后续可在任务记录中重新执行。",
      okText: "确认终止",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        setCanceling(true);
        try {
          await cancelRemoteTask(executionId);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["sprix-agent"] }),
            loadDetail(true)
          ]);
          message.success("任务已终止");
        } catch (cancelError) {
          if (isGlobalAuthError(cancelError)) return;
          message.error(cancelError instanceof Error ? `任务终止失败：${cancelError.message}` : "任务终止失败");
        } finally {
          setCanceling(false);
        }
      }
    });
  };

  if (!id) {
    return <EmptyState title="执行记录不存在" description="缺少执行记录 ID，无法读取任务详情。" action={<SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>} />;
  }

  if (loading && !detail) {
    return (
      <Surface className="p-8 text-center">
        <Spin />
        <p className="mt-4 text-sm text-ink-soft">正在加载任务执行详情</p>
      </Surface>
    );
  }

  if (error && !detail) {
    return (
      <EmptyState
        title="任务执行详情加载失败"
        description={error}
        action={
          <div className="flex justify-center gap-2">
            <SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>
            <ActionButton onClick={() => void loadDetail(false)}>重新加载</ActionButton>
          </div>
        }
      />
    );
  }

  if (!detail || !summary) {
    return <EmptyState title="执行记录不存在" description="该任务记录暂不可访问。" action={<SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>} />;
  }

  return (
    <div className="sprix-task-detail-page">
      <div className="sprix-task-detail-shell">
        <div className="sprix-detail-back-row">
          <SecondaryButton href="/agent/my-tasks" icon={<ChevronLeft size={16} />}>
            返回我的任务
          </SecondaryButton>
        </div>

        <Surface className="sprix-execution-hero p-6">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              {showPrimaryStatus && <StatusTag status={summary.status} />}
              {shouldShowAppealStatus(summary.appealStatus) && <StatusTag status={summary.appealStatus} />}
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-ink">{summary.title}</h1>
            <p className="mt-3 text-sm leading-7 text-ink-soft">
              {detail.task?.category || "-"} · {summary.agentName} · {summary.reward}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-ink-soft">
              <span>开始：{summary.startedAt}</span>
              <span>完成：{summary.completedAt}</span>
              <span>结算：{summary.settlementStatus}</span>
            </div>
            {summary.terminationReason && (summary.status === "已终止" || summary.status === "验收未通过") && (
              <div className="mt-4 rounded-2xl border border-[#ffd9d9] bg-[#fff4f4] px-4 py-3 text-sm leading-7 text-[#b42318]">
                {summary.terminationReason}
              </div>
            )}
          </div>
          <div className="sprix-execution-hero-side">
            <div className="sprix-execution-hero-progress">
              <span>执行进度</span>
              <strong>{summary.progress}</strong>
            </div>
            {actions?.terminateLabel && (
              <SecondaryButton danger disabled={!actions.terminateEnabled || canceling} loading={canceling} onClick={cancelTask}>
                {actions.terminateLabel}
              </SecondaryButton>
            )}
            {actions?.rerun && (
              <SecondaryButton icon={<RotateCw size={15} />} onClick={() => rerunTask(detail.id ?? id)}>
                重新执行
              </SecondaryButton>
            )}
          </div>
        </Surface>

        <div className="sprix-execution-detail-layout">
          <div className="sprix-execution-main-stack">
            <OutputSection detail={detail} />
            <AcceptanceSection
              detail={detail}
              action={
                actions?.appealLabel ? (
                  <ActionButton disabled={!actions.appealEnabled} onClick={() => actions.appealEnabled && openAppeal(detail.id ?? id)}>
                    {actions.appealLabel}
                  </ActionButton>
                ) : undefined
              }
            />
            <ArtifactsSection compact executionId={detail.id ?? id} artifacts={detail.artifacts ?? []} />
          </div>
          <aside className="sprix-execution-side-rail">
            <TaskRequirementSection detail={detail} />
            <TaskAttachmentsSection taskId={detail.task?.id ?? detail.taskId} />
            <TimelineSection detail={detail} />
            <HistorySection detail={detail} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function shouldHidePrimaryStatus(status: string, appealStatus: string) {
  return status === "验收未通过" && shouldShowAppealStatus(appealStatus);
}

function TaskRequirementSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const rows = getTaskRequirementRows(detail);
  return (
    <Surface className="sprix-task-requirements-panel p-5">
      <SectionTitle title="任务要求" />
      {rows.length > 0 ? (
        <div className="sprix-requirement-list">
          {rows.map((row) => (
            <div key={row.label} className="sprix-requirement-row">
              <p>{row.label}</p>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <InlineEmpty title="暂无任务要求" description="详情接口暂未返回任务描述、交付要求或验收标准。" />
      )}
    </Surface>
  );
}

function TaskAttachmentsSection({ taskId }: { taskId?: string }) {
  const [downloadingId, setDownloadingId] = useState<string>();
  const taskAttachmentsQuery = useQuery({
    queryKey: ["sprix-agent", "task-attachments", taskId],
    queryFn: () => readRemoteTaskAttachments(taskId as string),
    enabled: Boolean(taskId),
    retry: 1
  });

  const downloadAttachment = async (attachment: TaskAttachment) => {
    setDownloadingId(attachment.attachmentId);
    try {
      await downloadRemoteTaskAttachment(attachment);
    } catch (downloadError) {
      if (isGlobalAuthError(downloadError)) return;
      message.error(downloadError instanceof Error ? downloadError.message : "任务附件下载失败");
    } finally {
      setDownloadingId(undefined);
    }
  };

  return (
    <Surface className="p-5">
      <div className="sprix-section-heading">
        <SectionTitle title="任务附件" />
        {taskAttachmentsQuery.data?.length ? <SoftTag tone="neutral">{taskAttachmentsQuery.data.length} 个文件</SoftTag> : null}
      </div>
      {!taskId ? (
        <InlineEmpty title="暂无任务附件" description="当前执行详情未返回任务 ID。" />
      ) : taskAttachmentsQuery.isLoading ? (
        <div className="mt-4 text-center">
          <Spin size="small" />
        </div>
      ) : taskAttachmentsQuery.isError ? (
        <InlineEmpty title="附件加载失败" description="任务附件暂时无法读取，请稍后重试。" />
      ) : taskAttachmentsQuery.data?.length ? (
        <div className="sprix-artifact-compact-list">
          {taskAttachmentsQuery.data.map((attachment) => (
            <div key={attachment.attachmentId} className="sprix-artifact-compact-row">
              <div className="min-w-0">
                <p title={attachment.filename}>{attachment.filename}</p>
                <span>{[attachment.mimeType || "未知类型", formatBytes(attachment.sizeBytes)].filter(Boolean).join(" · ")}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                <SecondaryButton
                  size="small"
                  icon={<Download size={14} />}
                  loading={downloadingId === attachment.attachmentId}
                  onClick={() => void downloadAttachment(attachment)}
                >
                  下载
                </SecondaryButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <InlineEmpty title="暂无任务附件" description="发布该任务时没有上传附件。" />
      )}
    </Surface>
  );
}

function OutputSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const output = detail.output;

  return (
    <Surface className="sprix-output-section p-6">
      <SectionTitle title="Agent 输出" />
      {output ? (
        <div className="mt-4 space-y-4">
          <FormattedOutputMessage text={output.finalMessage || "暂无 Agent 输出"} />
          <div className="sprix-output-metrics">
            <InfoPill label="Token 用量" value={getTokenUsage(detail)} />
            <InfoPill label="接收时间" value={formatDateTime(output.receivedAt)} />
          </div>
        </div>
      ) : (
        <InlineEmpty title="暂无 Agent 输出" description="Agent 输出还未回传。" />
      )}
    </Surface>
  );
}

type FormattedOutputBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; lines: string[] };

function FormattedOutputMessage({ text }: { text: string }) {
  const blocks = parseFormattedOutputBlocks(text);
  return (
    <div className="sprix-output-message">
      {blocks.map((block, blockIndex) => {
        if (block.type === "code") {
          return (
            <pre key={`code-${blockIndex}`} className="sprix-output-code-block">
              {block.lines.join("\n")}
            </pre>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={`list-${blockIndex}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${blockIndex}-${itemIndex}`}>{renderInlineCode(item, `${blockIndex}-${itemIndex}`)}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={`paragraph-${blockIndex}`}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={`${blockIndex}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInlineCode(line, `${blockIndex}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function parseFormattedOutputBlocks(text: string): FormattedOutputBlock[] {
  const blocks: FormattedOutputBlock[] = [];
  const paragraphLines: string[] = [];
  let listBlock: Extract<FormattedOutputBlock, { type: "list" }> | undefined;
  let codeLines: string[] | undefined;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", lines: [...paragraphLines] });
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (!listBlock) return;
    blocks.push(listBlock);
    listBlock = undefined;
  };

  const flushCode = () => {
    if (!codeLines) return;
    blocks.push({ type: "code", lines: codeLines });
    codeLines = undefined;
  };

  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();

      if (codeLines) {
        if (trimmed.startsWith("```")) {
          flushCode();
          return;
        }
        codeLines.push(line);
        return;
      }

      if (trimmed.startsWith("```")) {
        flushParagraph();
        flushList();
        codeLines = [];
        return;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      const unorderedItem = line.match(/^\s*[-*]\s+(.+)$/);
      const orderedItem = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unorderedItem || orderedItem) {
        const ordered = Boolean(orderedItem);
        const value = (orderedItem?.[1] ?? unorderedItem?.[1] ?? "").trim();
        flushParagraph();
        if (!listBlock || listBlock.ordered !== ordered) {
          flushList();
          listBlock = { type: "list", ordered, items: [] };
        }
        listBlock.items.push(value);
        return;
      }

      flushList();
      paragraphLines.push(line.trimEnd());
    });

  flushParagraph();
  flushList();
  flushCode();

  return blocks.length > 0 ? blocks : [{ type: "paragraph", lines: [text] }];
}

function renderInlineCode(text: string, keyPrefix: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (/^`[^`]+`$/.test(part)) {
      return <code key={`${keyPrefix}-code-${index}`}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={`${keyPrefix}-text-${index}`}>{part}</Fragment>;
  });
}

function ArtifactsSection({ executionId, artifacts, compact = false }: { executionId: string; artifacts: ArtifactSnapshot[]; compact?: boolean }) {
  return (
    <Surface className={compact ? "p-5" : "p-6"}>
      <SectionTitle title="交付文件" />
      {artifacts.length > 0 ? (
        <div className={compact ? "sprix-artifact-compact-list" : "mt-4 space-y-3"}>
          {artifacts.map((artifact) => {
            const fileId = artifact.fileId ?? artifact.artifactId ?? "";
            if (compact) {
              return (
                <div key={artifact.artifactId ?? artifact.fileId ?? getArtifactTitle(artifact)} className="sprix-artifact-compact-row">
                  <div className="min-w-0">
                    <p>{getArtifactTitle(artifact)}</p>
                    <span>{[artifact.role, formatBytes(artifact.sizeBytes), artifact.localRelativePath].filter(Boolean).join(" · ")}</span>
                  </div>
                  {fileId && <ArtifactDownloadButton executionId={executionId} artifact={artifact} fileId={fileId} />}
                </div>
              );
            }
            return (
              <div key={artifact.artifactId ?? artifact.fileId ?? getArtifactTitle(artifact)} className="rounded-2xl border border-line bg-white px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{getArtifactTitle(artifact)}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {[artifact.role, artifact.mimeType, formatBytes(artifact.sizeBytes)].filter(Boolean).join(" · ")}
                    </p>
                    {artifact.localRelativePath && <p className="mt-1 truncate text-xs text-ink-soft">{artifact.localRelativePath}</p>}
                  </div>
                  {fileId && <ArtifactDownloadButton executionId={executionId} artifact={artifact} fileId={fileId} />}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <InlineEmpty title="暂无交付文件" description="任务完成后，交付文件会在这里展示并支持下载。" />
      )}
    </Surface>
  );
}

function AcceptanceSection({ detail, action }: { detail: MyTaskExecutionDetail; action?: ReactNode }) {
  const acceptance = detail.acceptance;
  const issues = getAcceptanceIssues(acceptance);
  const suggestions = getAcceptanceSuggestions(acceptance);
  const summary = getAcceptanceSummary(acceptance);
  const readableStatus = getReadableAcceptanceStatus(acceptance?.status);
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const visibleIssues = issuesExpanded ? issues : issues.slice(0, 4);
  const hiddenIssueCount = issues.length - visibleIssues.length;
  return (
    <Surface className="sprix-acceptance-panel p-6">
      <div className="sprix-section-heading">
        <SectionTitle title="验收结果" />
        <div className="sprix-section-actions">
          {readableStatus && <SoftTag tone={getAcceptanceStatusTone(readableStatus)}>{readableStatus}</SoftTag>}
          {action}
        </div>
      </div>
      {acceptance ? (
        <div className="mt-4 space-y-4">
          <div className="sprix-acceptance-score-row">
            <p className="sprix-acceptance-summary">{summary || "暂无验收摘要"}</p>
            <div className="sprix-acceptance-score-card">
              <p>评分</p>
              <strong>{acceptance.score == null ? "-" : `${acceptance.score}`}</strong>
            </div>
          </div>
          {issues.length > 0 && (
            <div className="sprix-acceptance-issues">
              <div className="sprix-acceptance-issues-head">
                <b>未满足交付目标</b>
                <SoftTag tone="red">{issues.length} 项问题</SoftTag>
              </div>
              <ul>
                {visibleIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              {issues.length > 4 && (
                <button type="button" className="sprix-acceptance-expand" onClick={() => setIssuesExpanded((expanded) => !expanded)}>
                  {issuesExpanded ? "收起问题" : `展开全部 ${issues.length} 项问题`}
                  {!issuesExpanded && hiddenIssueCount > 0 ? <span>还有 {hiddenIssueCount} 项</span> : null}
                </button>
              )}
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="sprix-acceptance-suggestions">
              <div className="sprix-acceptance-suggestions-head">
                <b>改进建议</b>
                <SoftTag tone="neutral">{suggestions.length} 项建议</SoftTag>
              </div>
              <ul>
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <InlineEmpty title="暂无验收结果" description="平台验收完成后，会展示验收状态、评分和问题摘要。" />
      )}
    </Surface>
  );
}

function TimelineSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const events = getSortedTimeline(detail);
  return (
    <Surface className="sprix-timeline-panel p-5">
      <div className="sprix-section-heading">
        <SectionTitle title="执行时间线" />
        {events.length > 0 && <SoftTag tone="neutral">{events.length} 条事件</SoftTag>}
      </div>
      {events.length > 0 ? (
        <div className="sprix-timeline-list">
          {events.map((event, index) => (
            <div key={event.eventId ?? `${event.eventType}-${index}`} className="sprix-timeline-event">
              <span className={`sprix-timeline-dot ${index === events.length - 1 ? "is-current" : ""}`} />
              <div className={`sprix-timeline-card ${index === events.length - 1 ? "is-current" : ""}`}>
                <div className="sprix-timeline-content">
                  <p className="sprix-timeline-title">{getTimelineEventTitle(event)}</p>
                  {event.message && <p className="sprix-timeline-message">{event.message}</p>}
                </div>
                <div className="sprix-timeline-meta">
                  <SoftTag tone="neutral">{formatDateTime(getTimelineTime(event))}</SoftTag>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <InlineEmpty title="暂无时间线" description="执行节点进度回传后，会按时间展示在这里。" />
      )}
    </Surface>
  );
}

function getTimelineEventTitle(event: NonNullable<MyTaskExecutionDetail["timeline"]>[number]) {
  const nodeLabel = event.currentNodeLabel || event.currentNode;
  return nodeLabel ? getCurrentNodeLabel(nodeLabel) : event.message || event.eventType || "执行事件";
}
function getAcceptanceStatusTone(status: string): "teal" | "red" {
  const normalized = status.toLowerCase();
  return normalized.includes("fail") || status.includes("失败") || status.includes("未通过") ? "red" : "teal";
}

function shouldAutoRefreshExecutionDetail(detail: MyTaskExecutionDetail) {
  return (detail.status ?? "").toUpperCase() === "RUNNING" && !detail.completedAt;
}

function HistorySection({ detail }: { detail: MyTaskExecutionDetail }) {
  const histories = detail.historyExecutions ?? [];
  return (
    <Surface className="sprix-history-panel p-6">
      <div className="sprix-section-heading">
        <SectionTitle title="历史执行" />
        {histories.length > 0 && <SoftTag tone="neutral">{histories.length} 次执行</SoftTag>}
      </div>
      {histories.length > 0 ? (
        <div className="sprix-history-list">
          {histories.map((history) => (
            <Link
              key={history.id}
              to={`/agent/my-tasks/${history.id}`}
              className={`sprix-history-row ${history.current ? "is-current" : ""}`}
            >
              <div className="sprix-history-main">
                <strong>{getHistoryExecutionTitle(history.status)}</strong>
              </div>
              <div className="sprix-history-detail">
                <span className="sprix-history-time">{formatDateTime(history.startedAt ?? history.createdAt)}</span>
                <span className="sprix-history-progress">{history.progress || "-"}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <InlineEmpty title="暂无历史执行" description="同一任务产生重跑记录后，会在这里展示。" />
      )}
    </Surface>
  );
}

function getHistoryExecutionTitle(status?: string) {
  return status ? mapExecutionStatus(status) : "执行记录";
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-lg font-semibold text-ink">{title}</h3>;
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fafafa] px-4 py-3">
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function InlineEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">
      <b className="block text-ink">{title}</b>
      <span>{description}</span>
    </div>
  );
}
