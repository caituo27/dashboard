import { consumerMockEnabled, isMockExecution } from "../services/consumerMock";
import { ConsumerMyTaskDetailPage } from "./ConsumerMyTaskDetailPage";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ChangeEvent, MouseEvent, ReactNode } from "react";
import { Input, Modal, Spin, message } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Bot, CheckCircle2, ChevronDown, ChevronLeft, CircleAlert, Clock3, Copy, Download, FileText, History as HistoryIcon, Lightbulb, Paperclip, RotateCw, UploadCloud, X } from "lucide-react";
import type { ArtifactSnapshot, MyTaskExecutionDetail } from "../apis/sprix";
import { ActionButton, EmptyState, SecondaryButton, SoftTag, StatusTag, Surface } from "../components/Primitives";
import {
  cancelRemoteTask,
  createRemoteManualSubmission,
  downloadRemoteManualSubmissionFile,
  downloadRemoteTaskAttachment,
  readRemoteMyTaskDetail,
  readRemoteTaskAttachments,
  type ManualSubmission,
  type MyTaskExecutionDetailView,
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
  getTimelineDisplayItems,
  getTaskRequirementRows,
  getTimelineTime,
  mapExecutionStatus
} from "./executionDetailView";
import { getMyTaskActions, shouldShowAppealStatus } from "./userFlowRules";
import { parseExecutionProgress, useExecutionDisplayProgress } from "./useExecutionDisplayProgress";
import { useRerunTask } from "./useRerunTask";

type MyTaskDetailPageProps = {
  openAppeal: (executionId: string) => void;
};

const manualSubmissionMaxFileCount = 10;
const manualSubmissionMaxFileSizeBytes = 50 * 1024 * 1024;
const manualSubmissionMaxFileCountMessage = `每次最多上传 ${manualSubmissionMaxFileCount} 个交付文件`;
const executionVideoWidth = 240;
const executionVideoHeight = 171;
const executionVideoPlaybackRate = 1.5;

function validateManualSubmissionFile(file: File) {
  if (file.size === 0) return "文件不能为空";
  if (file.size > manualSubmissionMaxFileSizeBytes) return "单个文件不能超过 50 MiB";
  return null;
}

function getPageScrollContainer() {
  const container = document.querySelector<HTMLElement>(".sprix-main");
  if (!container) return null;

  const overflowY = window.getComputedStyle(container).overflowY;
  const canScroll = container.scrollHeight > container.clientHeight;
  return canScroll && overflowY !== "visible" && overflowY !== "clip" ? container : null;
}

function scrollPageToTop() {
  const scrollContainer = getPageScrollContainer();
  if (scrollContainer) {
    scrollContainer.scrollTo({ top: 0, behavior: "auto" });
    return;
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

export function MyTaskDetailPage(props: MyTaskDetailPageProps) {
  const { id } = useParams();
  return consumerMockEnabled && id && isMockExecution(id)
    ? <ConsumerMyTaskDetailPage {...props} />
    : <RemoteMyTaskDetailPage {...props} />;
}

function RemoteMyTaskDetailPage({ openAppeal }: MyTaskDetailPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const rerunTask = useRerunTask();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<MyTaskExecutionDetailView>();
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

  useLayoutEffect(() => {
    scrollPageToTop();
  }, [id]);

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
  const actualProgress = parseExecutionProgress(detail?.progress);
  const isExecutionRunning = Boolean(detail && shouldAutoRefreshExecutionDetail(detail));
  const displayProgress = useExecutionDisplayProgress({
    executionId: detail?.id ?? id,
    actualProgress,
    isRunning: isExecutionRunning
  });

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
  const returnToMyTasks = () => {
    navigate("/agent/my-tasks");
  };

  if (!id) {
    return (
      <EmptyState
        title="执行记录不存在"
        description="缺少执行记录 ID，无法读取任务详情。"
        action={<SecondaryButton onClick={returnToMyTasks}>返回我的任务</SecondaryButton>}
      />
    );
  }

  if (loading && !detail) {
    return <MyTaskDetailSkeleton />;
  }

  if (error && !detail) {
    return (
      <EmptyState
        title="任务执行详情加载失败"
        description={error}
        action={
          <div className="flex justify-center gap-2">
            <SecondaryButton onClick={returnToMyTasks}>返回我的任务</SecondaryButton>
            <ActionButton onClick={() => void loadDetail(false)}>重新加载</ActionButton>
          </div>
        }
      />
    );
  }

  if (!detail || !summary) {
    return (
      <EmptyState
        title="执行记录不存在"
        description="该任务记录暂不可访问。"
        action={<SecondaryButton onClick={returnToMyTasks}>返回我的任务</SecondaryButton>}
      />
    );
  }

  return (
    <div className="sprix-task-detail-page">
      <div className="sprix-task-detail-shell sprix-my-task-detail-shell">
        <div className="sprix-detail-back-row">
          <Link to="/agent/my-tasks" className="sprix-detail-back-button">
            <ChevronLeft size={18} />
            返回我的任务
          </Link>
        </div>

        <Surface className="sprix-execution-overview-panel p-0">
          <section className="sprix-execution-hero">
            <div className="sprix-execution-hero-copy">
              <div className="mb-3 flex flex-wrap gap-2">
                {showPrimaryStatus && <StatusTag status={summary.status} />}
                {shouldShowAppealStatus(summary.appealStatus) && <StatusTag status={summary.appealStatus} />}
              </div>
              <h1 className="text-2xl font-semibold leading-tight text-ink">{summary.title}</h1>
              <p className="mt-3 text-sm leading-7 text-ink-soft">
                {detail.task?.category || "-"} · {summary.agentName} · {summary.reward}
              </p>
              <div className="sprix-execution-hero-meta">
                <span>开始：{summary.startedAt}</span>
                <span>完成：{summary.completedAt}</span>
                <span>结算：{summary.settlementStatus}</span>
                {summary.terminationReason && (summary.status === "已终止" || summary.status === "验收未通过") ? (
                  <span className="sprix-execution-hero-meta-note">{summary.terminationReason}</span>
                ) : null}
              </div>
            </div>
            <div className="sprix-execution-hero-side">
              <div className="sprix-execution-hero-progress">
                <div className="sprix-execution-hero-progress-head">
                  <strong>
                    {isExecutionRunning && displayProgress !== undefined ? `${displayProgress}%` : summary.progress}
                  </strong>
                </div>
              </div>
              <div className="sprix-execution-hero-actions">
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
            </div>
            {summary.status === "执行中" ? (
              <div
                className="sprix-execution-hero-video-frame"
                style={{ width: executionVideoWidth, height: executionVideoHeight }}
                aria-hidden="true"
              >
                <video
                  className="sprix-execution-hero-video"
                  width={executionVideoWidth}
                  height={executionVideoHeight}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  poster="/doing.svg"
                  onLoadedMetadata={(event) => {
                    event.currentTarget.defaultPlaybackRate = executionVideoPlaybackRate;
                    event.currentTarget.playbackRate = executionVideoPlaybackRate;
                  }}
                >
                  <source src="/execution-background.mp4" type="video/mp4" />
                </video>
              </div>
            ) : (
              <img className="sprix-execution-hero-illustration" src="/done.svg" alt="" aria-hidden="true" />
            )}
          </section>

          <div className="sprix-execution-detail-layout">
            <div className="sprix-execution-main-stack">
              <Surface className="sprix-execution-primary-panel p-0">
                <TimelineSection detail={detail} />
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
                <ArtifactsSection executionId={detail.id ?? id} artifacts={detail.artifacts ?? []} />
                <ManualSubmissionsSection
                  executionId={detail.id ?? id}
                  detail={detail}
                  onSubmitted={() => loadDetail(true)}
                />
              </Surface>
            </div>
            <aside className="sprix-execution-side-rail">
              <Surface className="sprix-execution-side-panel p-0">
                <TaskRequirementSection detail={detail} />
                <TaskAttachmentsSection taskId={detail.task?.id ?? detail.taskId} />
                <HistorySection
                  detail={detail}
                  displayProgress={isExecutionRunning ? displayProgress : undefined}
                />
              </Surface>
            </aside>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function shouldHidePrimaryStatus(status: string, appealStatus: string) {
  return status === "验收未通过" && shouldShowAppealStatus(appealStatus);
}

function MyTaskDetailSkeleton() {
  return (
    <div className="sprix-task-detail-page">
      <div className="sprix-task-detail-shell sprix-my-task-detail-shell">
        <div className="sprix-detail-back-row">
          <Link to="/agent/my-tasks" className="sprix-detail-back-button">
            <ChevronLeft size={18} />
            返回我的任务
          </Link>
        </div>

        <Surface className="sprix-execution-overview-panel sprix-execution-overview-panel-loading p-0">
          <section className="sprix-execution-hero sprix-detail-skeleton-hero">
            <div className="sprix-execution-hero-copy">
              <div className="sprix-skeleton-pill" />
              <div className="sprix-skeleton-line is-title" />
              <div className="sprix-skeleton-line is-meta" />
              <div className="sprix-skeleton-line is-meta-short" />
            </div>
            <div className="sprix-execution-hero-side">
              <div className="sprix-skeleton-line is-progress" />
              <div className="sprix-skeleton-button" />
            </div>
          </section>

          <div className="sprix-execution-detail-layout">
            <div className="sprix-execution-main-stack">
              <Surface className="sprix-execution-primary-panel p-0">
                <section className="sprix-detail-skeleton-section is-large" />
                <section className="sprix-detail-skeleton-section is-medium" />
                <section className="sprix-detail-skeleton-section is-medium" />
              </Surface>
            </div>
            <aside className="sprix-execution-side-rail">
              <Surface className="sprix-execution-side-panel p-0">
                <section className="sprix-detail-skeleton-side-section is-tall" />
                <section className="sprix-detail-skeleton-side-section is-medium" />
                <section className="sprix-detail-skeleton-side-section is-small" />
              </Surface>
            </aside>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function TaskRequirementSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const rows = getTaskRequirementRows(detail);
  const longRows = rows.filter((row) => ["任务描述", "交付要求", "验收标准"].includes(row.label));
  const metaRows = rows.filter((row) => !["任务描述", "交付要求", "验收标准"].includes(row.label));
  return (
    <section className="sprix-task-requirements-panel">
      <SectionTitle title="任务要求" icon={<FileText size={16} />} />
      <div className="sprix-section-body sprix-task-requirements-body">
        {rows.length > 0 ? (
          <>
            <div className="sprix-requirement-list">
              {longRows.map((row) => (
                <div key={row.label} className="sprix-requirement-row sprix-requirement-block">
                  <p className="sprix-requirement-block-label">{row.label}</p>
                  <div className="sprix-requirement-block-text">{row.value}</div>
                </div>
              ))}
            </div>
            {metaRows.length > 0 ? (
              <div className="sprix-requirement-meta-list">
                {metaRows.map((row) => (
                  <div key={row.label} className="sprix-requirement-meta-row">
                    <span>{row.label}</span>
                    <b>{row.value}</b>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <InlineEmpty title="暂无任务要求" description="详情接口暂未返回任务描述、交付要求或验收标准。" />
        )}
      </div>
    </section>
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
    <section className="sprix-task-attachments-panel">
      <div className="sprix-section-heading">
        <SectionTitle title="任务附件" icon={<Paperclip size={16} />} />
        {taskAttachmentsQuery.data?.length ? <SoftTag tone="neutral">{taskAttachmentsQuery.data.length} 个文件</SoftTag> : null}
      </div>
      {!taskId ? (
        <InlineEmpty title="暂无任务附件" description="当前执行详情未返回任务 ID。" />
      ) : taskAttachmentsQuery.isLoading ? (
        <div className="sprix-task-attachment-skeleton-list" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="sprix-task-attachment-skeleton-item">
              <div className="sprix-task-attachment-skeleton-copy">
                <div className="sprix-skeleton-line is-file-name" />
                <div className="sprix-skeleton-line is-file-meta" />
              </div>
              <div className="sprix-skeleton-icon" />
            </div>
          ))}
        </div>
      ) : taskAttachmentsQuery.isError ? (
        <InlineEmpty title="附件加载失败" description="任务附件暂时无法读取，请稍后重试。" />
      ) : taskAttachmentsQuery.data?.length ? (
        <div className="sprix-artifact-compact-list sprix-task-attachment-list">
          {taskAttachmentsQuery.data.map((attachment) => {
            const attachmentMeta = [attachment.mimeType || "未知类型", formatBytes(attachment.sizeBytes)].filter(Boolean).join(" · ");
            const isDownloading = downloadingId === attachment.attachmentId;
            return (
              <div key={attachment.attachmentId} className="sprix-task-attachment-item">
                <div className="min-w-0">
                  <p title={attachment.filename}>{attachment.filename}</p>
                  <span title={attachmentMeta}>{attachmentMeta}</span>
                </div>
                <button
                  type="button"
                  className="sprix-attachment-download-button"
                  aria-label={`下载 ${attachment.filename}`}
                  disabled={isDownloading}
                  onClick={() => void downloadAttachment(attachment)}
                >
                  {isDownloading ? <Spin size="small" /> : <Download size={16} />}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <InlineEmpty description="发布该任务时没有上传附件。" />
      )}
    </section>
  );
}

function OutputSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const output = detail.output;
  const outputText = output?.finalMessage || "暂无 Agent 输出";
  const inputTokens = output?.inputTokens ?? null;
  const outputTokens = output?.outputTokens ?? null;
  const copyOutput = async () => {
    if (!output?.finalMessage) return;
    try {
      await navigator.clipboard.writeText(output.finalMessage);
      message.success("Agent 输出已复制");
    } catch {
      message.error("复制失败，请手动选择内容");
    }
  };

  return (
    <section className="sprix-output-section">
      <div className="sprix-section-heading">
        <SectionTitle title="Agent 输出" icon={<Bot size={16} />} />
      </div>
      <div className="sprix-section-body sprix-output-body">
        {output ? (
          <div className="sprix-output-panel">
            <div className="sprix-output-metrics">
              <div className="sprix-output-metric">
                <span>输入 Token</span>
                <strong>{formatTokenValue(inputTokens)}</strong>
              </div>
              <div className="sprix-output-metric">
                <span>输出 Token</span>
                <strong>{formatTokenValue(outputTokens)}</strong>
              </div>
            </div>
            <div className={`sprix-output-scroll ${output?.finalMessage ? "has-copy" : ""}`}>
              {output?.finalMessage ? (
                <button type="button" className="sprix-output-copy-button" aria-label="复制 Agent 输出" onClick={() => void copyOutput()}>
                  <Copy size={15} />
                </button>
              ) : null}
              <FormattedOutputMessage text={outputText} />
            </div>
          </div>
        ) : (
          <InlineEmpty description="Agent 输出还未回传。" />
        )}
      </div>
    </section>
  );
}

function formatTokenValue(value?: number | null) {
  return value && value > 0 ? value.toLocaleString("zh-CN") : "-";
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

function ArtifactsSection({ executionId, artifacts }: { executionId: string; artifacts: ArtifactSnapshot[] }) {
  const preview = artifacts.length > 0 ? `共 ${artifacts.length} 个交付文件` : "暂无交付文件";
  return (
    <CollapsibleSection
      title="交付文件"
      icon={<FileText size={16} />}
      preview={preview}
    >
      {artifacts.length > 0 ? (
        <div className="sprix-artifact-compact-list">
          {artifacts.map((artifact) => {
            const fileId = artifact.fileId ?? artifact.artifactId ?? "";
            return (
              <div key={artifact.artifactId ?? artifact.fileId ?? getArtifactTitle(artifact)} className="sprix-artifact-compact-row">
                <p className="min-w-0">
                  {getArtifactTitle(artifact)}
                  <span>{formatBytes(artifact.sizeBytes)}</span>
                </p>
                {fileId && <ArtifactDownloadButton executionId={executionId} artifact={artifact} fileId={fileId} />}
              </div>
            );
          })}
        </div>
      ) : (
        <InlineEmpty description="任务完成后，交付文件会在这里展示并支持下载。" />
      )}
    </CollapsibleSection>
  );
}

function ManualSubmissionsSection({
  executionId,
  detail,
  onSubmitted
}: {
  executionId: string;
  detail: MyTaskExecutionDetailView;
  onSubmitted: () => Promise<unknown>;
}) {
  const submissions = detail.manualSubmissions ?? [];
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const preview = submissions.length > 0 ? `共 ${submissions.length} 次人工补交` : "暂无人工补交记录";

  const handleUploadPickerClick = (event: MouseEvent<HTMLLabelElement>) => {
    if (files.length < manualSubmissionMaxFileCount) return;

    event.preventDefault();
    message.warning(manualSubmissionMaxFileCountMessage);
  };

  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    const availableSlots = manualSubmissionMaxFileCount - files.length;

    if (availableSlots <= 0) {
      message.warning(manualSubmissionMaxFileCountMessage);
      return;
    }

    const existingKeys = new Set(files.map(manualSubmissionFileKey));
    const addedFiles = selectedFiles.filter((file) => {
      const validationError = validateManualSubmissionFile(file);
      if (validationError) {
        message.error(`${file.name}：${validationError}`);
        return false;
      }

      const key = manualSubmissionFileKey(file);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    const nextFiles = [...files, ...addedFiles];
    if (addedFiles.length > availableSlots || nextFiles.length > manualSubmissionMaxFileCount) {
      message.warning(manualSubmissionMaxFileCountMessage);
    }
    setFiles(nextFiles.slice(0, manualSubmissionMaxFileCount));
  };

  const submit = async () => {
    if (files.length === 0) {
      message.warning("请至少选择一个交付文件");
      return;
    }
    if (files.length > manualSubmissionMaxFileCount) {
      message.warning(manualSubmissionMaxFileCountMessage);
      return;
    }
    const invalidFile = files.find((file) => validateManualSubmissionFile(file));
    if (invalidFile) {
      message.warning(`${invalidFile.name}：${validateManualSubmissionFile(invalidFile)}`);
      return;
    }
    setUploading(true);
    try {
      await createRemoteManualSubmission(executionId, description, files);
      await onSubmitted();
      setOpen(false);
      setDescription("");
      setFiles([]);
      message.success("交付产物已重新上传，等待平台人工审核");
    } catch (error) {
      if (isGlobalAuthError(error)) return;
      message.error(error instanceof Error ? error.message : "交付产物重新上传失败");
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (file: ManualSubmission["files"][number]) => {
    try {
      await downloadRemoteManualSubmissionFile(file);
    } catch (error) {
      if (isGlobalAuthError(error)) return;
      message.error(error instanceof Error ? error.message : "人工补交文件下载失败");
    }
  };

  return (
    <>
      <CollapsibleSection
        title="人工补交记录"
        icon={<UploadCloud size={16} />}
        preview={preview}
        action={
          detail.canManualResubmit ? (
            <ActionButton icon={<UploadCloud size={15} />} onClick={() => setOpen(true)}>
              发起补交
            </ActionButton>
          ) : undefined
        }
      >
        {detail.reviewSource === "USER_MANUAL" && (
          <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-6 text-ink-soft">
            <InfoCircleOutlined className="mt-1" aria-hidden="true" />
            <span>人工补交文件不会触发自动验收或 Agent 评估，由平台管理员人工审核。</span>
          </p>
        )}
        {submissions.length > 0 ? (
          <div className="mt-2 divide-y divide-line">
            {submissions.map((submission) => (
              <div key={submission.submissionId} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    {submission.files.map((file, index) => (
                      <span key={file.id ?? file.fileId} className="truncate text-[15px] font-semibold text-ink">
                        {index > 0 ? "、" : ""}
                        {file.filename}
                        <span className="ml-1.5 text-xs font-normal text-ink-soft">{formatBytes(file.sizeBytes)}</span>
                      </span>
                    ))}
                    <SoftTag tone={submission.status === "REJECTED" ? "red" : submission.status === "APPROVED" ? "teal" : "neutral"}>
                      {manualSubmissionStatusLabel(submission.status)}
                    </SoftTag>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-ink-soft">{formatDateTime(submission.submittedAt)}</span>
                    {submission.files.map((file) => (
                      <button key={file.id ?? file.fileId} type="button" className="sprix-icon-action" aria-label={`下载${file.filename}`} title="下载" onClick={() => void downloadFile(file)}>
                        <Download size={16} />
                      </button>
                    ))}
                  </div>
                </div>
                {submission.description && <p className="mt-1.5 text-sm leading-7 text-ink-soft">{submission.description}</p>}
                {submission.reviewReason && <p className="mt-1.5 text-sm leading-7 text-[#b42318]">审核说明：{submission.reviewReason}</p>}
              </div>
            ))}
          </div>
        ) : (
          <InlineEmpty description="只有平台审核不通过后，才可以手工重新上传交付产物。" />
        )}
      </CollapsibleSection>
      <Modal
        title="重新上传交付产物"
        open={open}
        okText="提交人工审核"
        cancelText="取消"
        confirmLoading={uploading}
        onOk={() => void submit()}
        onCancel={() => !uploading && setOpen(false)}
      >
        <p className="mb-3 text-sm leading-7 text-ink-soft">上传后将进入平台人工审核，不会触发自动验收或 Agent 评估。</p>
        <Input.TextArea
          value={description}
          maxLength={2000}
          rows={4}
          showCount
          placeholder="可填写本次修改内容和补交说明"
          onChange={(event) => setDescription(event.target.value)}
        />
        <label
          className="group mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-[#fafafa] p-4 text-sm text-ink-soft transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 hover:bg-card hover:shadow-soft active:translate-y-0 active:scale-[0.995] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"
          onClick={handleUploadPickerClick}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-card text-ink-soft transition-colors duration-200 group-hover:border-accent/30 group-hover:text-accent">
            <UploadCloud size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-ink">
              {files.length > 0 ? "继续添加交付文件" : "选择交付文件"}
            </span>
            <span className="mt-1 block text-xs text-ink-soft">
              最多 {manualSubmissionMaxFileCount} 个，单文件不超过 50 MiB
            </span>
          </span>
          <input
            className="sr-only"
            type="file"
            multiple
            disabled={files.length >= manualSubmissionMaxFileCount}
            onChange={selectFiles}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {files.map((file) => (
              <li key={manualSubmissionFileKey(file)} className="flex items-center justify-between gap-3 rounded-xl bg-[#fafafa] px-3 py-2">
                <span className="min-w-0 truncate">{file.name} · {formatBytes(file.size)}</span>
                <button
                  type="button"
                  aria-label={`移除 ${file.name}`}
                  className="shrink-0 rounded-full p-1 text-ink-soft hover:bg-white hover:text-ink"
                  onClick={() => setFiles((currentFiles) => currentFiles.filter((currentFile) => manualSubmissionFileKey(currentFile) !== manualSubmissionFileKey(file)))}
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

function manualSubmissionFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function manualSubmissionStatusLabel(status: ManualSubmission["status"]) {
  if (status === "APPROVED") return "人工审核通过";
  if (status === "REJECTED") return "人工审核不通过";
  return "等待人工审核";
}

function AcceptanceSection({ detail, action }: { detail: MyTaskExecutionDetail; action?: ReactNode }) {
  const acceptance = detail.acceptance;
  const issues = getAcceptanceIssues(acceptance);
  const suggestions = getAcceptanceSuggestions(acceptance);
  const summary = getAcceptanceSummary(acceptance);
  const readableStatus = getReadableAcceptanceStatus(acceptance?.status);
  const summaryText = summary || "暂无验收摘要";
  const preview = acceptance
    ? [readableStatus, acceptance.score == null ? "" : `${acceptance.score} 分`].filter(Boolean).join(" · ") || "查看验收摘要"
    : "暂无验收结果";
  return (
    <CollapsibleSection
      title={(detail as MyTaskExecutionDetailView).manualSubmissions?.length ? "历史自动验收结果" : "验收结果"}
      icon={<CheckCircle2 size={16} />}
      preview={preview}
      action={action}
    >
      {acceptance ? (
        <div className="sprix-acceptance-content space-y-4">
          <div className="sprix-section-heading sprix-acceptance-head">
            <span className="sprix-acceptance-score-inline">
              评分 <b>{acceptance.score == null ? "-" : acceptance.score}</b>
            </span>
            {readableStatus && (
              <SoftTag className="sprix-acceptance-status" tone={getAcceptanceStatusTone(readableStatus)}>
                {readableStatus}
              </SoftTag>
            )}
          </div>
          <p className="sprix-acceptance-summary">{summaryText}</p>
          {issues.length > 0 && (
            <div className="sprix-acceptance-issues">
              <div className="sprix-acceptance-issues-head">
                <b><CircleAlert size={15} aria-hidden="true" />未满足交付目标</b>
                <SoftTag tone="red">{issues.length} 项问题</SoftTag>
              </div>
              <ul>
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="sprix-acceptance-suggestions">
              <div className="sprix-acceptance-suggestions-head">
                <b><Lightbulb size={15} aria-hidden="true" />改进建议</b>
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
        <InlineEmpty description="平台验收完成后，会展示验收状态、评分和问题摘要。" />
      )}
    </CollapsibleSection>
  );
}

function TimelineSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const events = getSortedTimeline(detail);
  const displayItems = getTimelineDisplayItems(detail);
  return (
    <section className="sprix-timeline-panel">
      <div className="sprix-section-heading">
        <SectionTitle title="Agent 执行动态" icon={<Clock3 size={16} />} />
        {events.length > 0 && <SoftTag tone="neutral">{displayItems.length} 条记录</SoftTag>}
      </div>
      {events.length > 0 ? (
        <div className="sprix-timeline-scroll">
          <div className="sprix-timeline-list">
            {displayItems.map((item, index) => {
              const event = item.event;
              const isCurrent = index === displayItems.length - 1;
              return (
                <div key={event.eventId ?? `${event.eventType}-${index}`} className="sprix-timeline-event">
                  <span className={`sprix-timeline-dot ${isCurrent ? "is-current" : ""}`} />
                  <div
                    className={`sprix-timeline-card ${isCurrent ? "is-current" : ""} ${item.narrative ? "is-narrative" : ""}`}
                  >
                    <div className="sprix-timeline-content">
                      <p className="sprix-timeline-summary">
                        <strong>{getTimelineEventTitle(event)}</strong>
                        {getTimelineEventMessage(event) ? <span>{getTimelineEventMessage(event)}</span> : null}
                      </p>
                    </div>
                    <div className="sprix-timeline-meta">
                      <span className="sprix-timeline-time">{formatDateTime(getTimelineTime(event))}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <InlineEmpty description="Agent 开始执行后，会在这里展示过程说明和脱敏后的工具操作。" />
      )}
    </section>
  );
}

function getTimelineEventTitle(event: NonNullable<MyTaskExecutionDetail["timeline"]>[number]) {
  const nodeLabel = event.currentNodeLabel || event.currentNode;
  return nodeLabel ? getCurrentNodeLabel(nodeLabel) : event.message || event.eventType || "执行事件";
}

function getTimelineEventMessage(event: NonNullable<MyTaskExecutionDetail["timeline"]>[number]) {
  const messageText = event.message?.trim();
  if (!messageText) return "";
  return messageText === getTimelineEventTitle(event) ? "" : messageText;
}

function getAcceptanceStatusTone(status: string): "teal" | "red" {
  const normalized = status.toLowerCase();
  return normalized.includes("fail") || status.includes("失败") || status.includes("未通过") ? "red" : "teal";
}

function shouldAutoRefreshExecutionDetail(detail: MyTaskExecutionDetail) {
  return (detail.status ?? "").toUpperCase() === "RUNNING" && !detail.completedAt;
}

function HistorySection({ detail, displayProgress }: { detail: MyTaskExecutionDetail; displayProgress?: number }) {
  const histories = detail.historyExecutions ?? [];
  return (
    <section className="sprix-history-panel">
      <div className="sprix-section-heading">
        <SectionTitle title="历史执行" icon={<HistoryIcon size={16} />} />
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
                <span className="sprix-history-progress">
                  {history.current && displayProgress !== undefined ? `${displayProgress}%` : history.progress || "-"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <InlineEmpty description="同一任务产生重跑记录后，会在这里展示。" />
      )}
    </section>
  );
}

function CollapsibleSection({
  title,
  icon,
  preview,
  action,
  children
}: {
  title: string;
  icon: ReactNode;
  preview: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className={`sprix-collapsible-panel ${open ? "is-open" : ""}`}>
      <div className="sprix-collapsible-head">
        <button type="button" className="sprix-collapsible-trigger" onClick={() => setOpen((value) => !value)}>
          <span className="sprix-collapsible-title">
            <span className="sprix-collapsible-icon">{icon}</span>
            <span>{title}</span>
          </span>
          {!open && preview ? <span className="sprix-collapsible-preview">{preview}</span> : null}
        </button>
        <div className="sprix-collapsible-controls">
          {action}
          <button
            type="button"
            className="sprix-collapsible-chevron"
            aria-label={open ? `收起${title}` : `展开${title}`}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown size={16} className={open ? "is-open" : ""} />
          </button>
        </div>
      </div>
      {open ? <div className="sprix-collapsible-body">{children}</div> : null}
    </section>
  );
}

function getHistoryExecutionTitle(status?: string) {
  return status ? mapExecutionStatus(status) : "执行记录";
}

function SectionTitle({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <h3 className="sprix-section-title">
      {icon ? <span className="sprix-section-title-icon">{icon}</span> : null}
      <span>{title}</span>
    </h3>
  );
}

function InlineEmpty({ title, description }: { title?: string; description: string }) {
  return (
    <div className="sprix-inline-empty">
      {title ? <b className="block text-ink">{title}</b> : null}
      <span>{description}</span>
    </div>
  );
}
