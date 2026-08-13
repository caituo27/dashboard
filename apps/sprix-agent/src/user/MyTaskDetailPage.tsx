import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, MouseEvent, ReactNode } from "react";
import { Input, Modal, Spin, message } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Download, RotateCw, UploadCloud, X } from "lucide-react";
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

const manualSubmissionMaxFileCount = 10;
const manualSubmissionMaxFileSizeBytes = 50 * 1024 * 1024;
const manualSubmissionMaxFileCountMessage = `每次最多上传 ${manualSubmissionMaxFileCount} 个交付文件`;
const executionProgressMilestones = [5, 20, 45, 70, 82, 90, 95, 100];

function parseExecutionProgress(progress?: string) {
  const value = Number.parseFloat(progress ?? "");
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.floor(value))) : undefined;
}

function getExecutionProgressCeiling(progress: number) {
  const nextMilestone = executionProgressMilestones.find((milestone) => milestone > progress);
  return nextMilestone === undefined ? 100 : nextMilestone - 1;
}

function validateManualSubmissionFile(file: File) {
  if (file.size === 0) return "文件不能为空";
  if (file.size > manualSubmissionMaxFileSizeBytes) return "单个文件不能超过 50 MiB";
  return null;
}

export function MyTaskDetailPage({ openAppeal }: MyTaskDetailPageProps) {
  const { id } = useParams();
  const rerunTask = useRerunTask();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<MyTaskExecutionDetailView>();
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  const [displayProgress, setDisplayProgress] = useState<number>();

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
  const actualProgress = parseExecutionProgress(detail?.progress);
  const isExecutionRunning = Boolean(detail && shouldAutoRefreshExecutionDetail(detail));
  const progressCeiling = actualProgress === undefined ? undefined : getExecutionProgressCeiling(actualProgress);

  useEffect(() => {
    setDisplayProgress(actualProgress);
  }, [detail?.id, actualProgress, isExecutionRunning]);

  useEffect(() => {
    if (
      !isExecutionRunning ||
      displayProgress === undefined ||
      progressCeiling === undefined ||
      displayProgress >= progressCeiling
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDisplayProgress((current) => Math.min((current ?? displayProgress) + 1, progressCeiling));
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [displayProgress, isExecutionRunning, progressCeiling]);

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
              <strong>{displayProgress === undefined ? summary.progress : `${displayProgress}%`}</strong>
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
            <ManualSubmissionsSection
              executionId={detail.id ?? id}
              detail={detail}
              onSubmitted={() => loadDetail(true)}
            />
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
          {taskAttachmentsQuery.data.map((attachment) => {
            const attachmentMeta = [attachment.mimeType || "未知类型", formatBytes(attachment.sizeBytes)].filter(Boolean).join(" · ");
            return (
              <div key={attachment.attachmentId} className="sprix-artifact-compact-row">
                <div className="min-w-0">
                  <p title={attachment.filename}>{attachment.filename}</p>
                  <span title={attachmentMeta}>{attachmentMeta}</span>
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
            );
          })}
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
      <SectionTitle title="Agent 原始交付文件" />
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
      <Surface className="p-5">
        <div className="sprix-section-heading">
          <SectionTitle title="人工补交记录" />
          {detail.canManualResubmit && (
            <ActionButton icon={<UploadCloud size={15} />} onClick={() => setOpen(true)}>
              重新上传交付产物
            </ActionButton>
          )}
        </div>
        {detail.reviewSource === "USER_MANUAL" && (
          <div className="mt-3 rounded-2xl border border-[#d8e7ff] bg-[#f4f8ff] px-4 py-3 text-sm leading-7 text-[#2457a6]">
            人工补交文件不会触发自动验收或 Agent 评估，由平台管理员人工审核。
          </div>
        )}
        {submissions.length > 0 ? (
          <div className="mt-4 space-y-3">
            {submissions.map((submission) => (
              <div key={submission.submissionId} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>第 {submission.submissionNo} 次人工补交</strong>
                    <SoftTag tone={submission.status === "REJECTED" ? "red" : submission.status === "APPROVED" ? "teal" : "neutral"}>
                      {manualSubmissionStatusLabel(submission.status)}
                    </SoftTag>
                  </div>
                  <span className="text-xs text-ink-soft">{formatDateTime(submission.submittedAt)}</span>
                </div>
                {submission.description && <p className="mt-2 text-sm leading-7 text-ink-soft">{submission.description}</p>}
                {submission.reviewReason && <p className="mt-2 text-sm leading-7 text-[#b42318]">审核说明：{submission.reviewReason}</p>}
                <div className="mt-3 space-y-2">
                  {submission.files.map((file) => (
                    <div key={file.id ?? file.fileId} className="flex items-center justify-between gap-3 rounded-xl bg-[#fafafa] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{file.filename}</p>
                        <span className="text-xs text-ink-soft">人工上传 · {formatBytes(file.sizeBytes)}</span>
                      </div>
                      <SecondaryButton icon={<Download size={14} />} onClick={() => void downloadFile(file)}>下载</SecondaryButton>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <InlineEmpty title="暂无人工补交" description="只有平台审核不通过后，才可以手工重新上传交付产物。" />
        )}
      </Surface>
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
          className="group mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line bg-[#fafafa] p-4 text-sm text-ink-soft transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 hover:bg-card hover:shadow-soft active:translate-y-0 active:scale-[0.995] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"
          onClick={handleUploadPickerClick}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-card text-ink-soft transition-colors duration-200 group-hover:border-accent/30 group-hover:text-accent">
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
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const visibleIssues = issuesExpanded ? issues : issues.slice(0, 4);
  const hiddenIssueCount = issues.length - visibleIssues.length;
  return (
    <Surface className="sprix-acceptance-panel p-6">
      <div className="sprix-section-heading">
        <SectionTitle title={(detail as MyTaskExecutionDetailView).manualSubmissions?.length ? "历史自动验收结果" : "验收结果"} />
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
