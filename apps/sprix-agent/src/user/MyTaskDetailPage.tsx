import { useCallback, useEffect, useMemo, useState } from "react";
import { Collapse, Spin, message } from "antd";
import type { CollapseProps } from "antd";
import { Link, useParams } from "react-router-dom";
import { Download, RotateCw } from "lucide-react";
import type { ArtifactSnapshot, MyTaskExecutionDetail } from "../apis/sprix";
import { ActionButton, EmptyState, SecondaryButton, SoftTag, StatusTag, Surface } from "../components/Primitives";
import { getMyTaskArtifactDownloadHref, readRemoteMyTaskDetail } from "../services/sprixApi";
import { isGlobalAuthError } from "../utils/http";
import {
  formatBytes,
  formatDateTime,
  getAcceptanceIssues,
  getArtifactTitle,
  getCurrentNodeLabel,
  getExecutionSummary,
  getOutputFailureMessage,
  getSortedTimeline,
  getTaskRequirementRows,
  getTimelineTime,
  getTokenUsage,
  isExecutionTerminal,
  mapExecutionStatus
} from "./executionDetailView";
import { getMyTaskActions } from "./userFlowRules";
import { useRerunTask } from "./useRerunTask";

type MyTaskDetailPageProps = {
  openAppeal: (executionId: string) => void;
};

export function MyTaskDetailPage({ openAppeal }: MyTaskDetailPageProps) {
  const { id } = useParams();
  const rerunTask = useRerunTask();
  const [detail, setDetail] = useState<MyTaskExecutionDetail>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDetail = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (silent) {
        setRefreshing(true);
      } else {
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
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    setDetail(undefined);
    void loadDetail(false);
  }, [loadDetail]);

  useEffect(() => {
    if (!detail || isExecutionTerminal(detail.status)) return;
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
      <div className="sprix-detail-toolbar">
        <SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>
      </div>

      <Surface className="sprix-execution-hero p-6">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusTag status={summary.status} />
            <StatusTag status={summary.appealStatus} />
            <SoftTag tone="neutral">{summary.currentNode}</SoftTag>
            {refreshing && <SoftTag tone="neutral">刷新中</SoftTag>}
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
        <div className="sprix-execution-hero-progress">
          <span>执行进度</span>
          <strong>{summary.progress}</strong>
        </div>
      </Surface>

      <Surface className="sprix-execution-progress-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">执行概况</h2>
            <p className="mt-1 text-sm text-ink-soft">详情数据来自当前执行记录接口，未结束时会自动刷新。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions?.appealLabel && (
              <ActionButton disabled={!actions.appealEnabled} onClick={() => actions.appealEnabled && openAppeal(detail.id ?? id)}>
                {actions.appealLabel}
              </ActionButton>
            )}
            {actions?.rerun && (
              <SecondaryButton icon={<RotateCw size={15} />} onClick={() => rerunTask(detail.id ?? id)}>
                重新执行
              </SecondaryButton>
            )}
          </div>
        </div>
      </Surface>

      <div className="sprix-execution-content-grid">
        <TaskRequirementSection detail={detail} />
        <OutputSection detail={detail} />
        <ArtifactsSection executionId={detail.id ?? id} artifacts={detail.artifacts ?? []} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AcceptanceSection detail={detail} />
        <TimelineSection detail={detail} />
      </div>

      <HistorySection detail={detail} />
    </div>
  );
}

function TaskRequirementSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const rows = getTaskRequirementRows(detail);
  return (
    <Surface className="p-6">
      <SectionTitle title="任务要求" />
      {rows.length > 0 ? (
        <div className="mt-4 space-y-4">
          {rows.map((row) => (
            <div key={row.label}>
              <p className="text-xs font-semibold text-ink-soft">{row.label}</p>
              <p className="mt-1 whitespace-pre-line text-[15px] leading-7 text-ink">{row.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <InlineEmpty title="暂无任务要求" description="详情接口暂未返回任务描述、交付要求或验收标准。" />
      )}
    </Surface>
  );
}

function OutputSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const output = detail.output;
  const failureMessage = getOutputFailureMessage(detail);
  const logs: NonNullable<CollapseProps["items"]> = [];
  if (output?.stdout?.trim()) {
    logs.push({
      key: "stdout",
      label: "stdout",
      children: <pre className="sprix-execution-log">{output.stdout}</pre>
    });
  }
  if (output?.stderr?.trim()) {
    logs.push({
      key: "stderr",
      label: "stderr",
      children: <pre className="sprix-execution-log">{output.stderr}</pre>
    });
  }

  return (
    <Surface className="p-6">
      <SectionTitle title="Agent 输出" />
      {output ? (
        <div className="mt-4 space-y-4">
          {failureMessage && <div className="rounded-2xl border border-[#ffd9d9] bg-[#fff4f4] px-4 py-3 text-sm text-[#b42318]">{failureMessage}</div>}
          <div>
            <p className="text-xs font-semibold text-ink-soft">最终消息</p>
            <p className="mt-1 whitespace-pre-line text-[15px] leading-7 text-ink">{output.finalMessage || "暂无最终消息"}</p>
          </div>
          <div className="grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
            <InfoPill label="退出码" value={String(output.exitCode ?? "-")} />
            <InfoPill label="Token 用量" value={getTokenUsage(detail)} />
            <InfoPill label="接收时间" value={formatDateTime(output.receivedAt)} />
            <InfoPill label="日志截断" value={output.stdoutTruncated || output.stderrTruncated ? "是" : "否"} />
          </div>
          {logs.length > 0 && <Collapse ghost items={logs} />}
        </div>
      ) : (
        <InlineEmpty title="暂无 Agent 输出" description="任务执行日志和最终消息还未回传。" />
      )}
    </Surface>
  );
}

function ArtifactsSection({ executionId, artifacts }: { executionId: string; artifacts: ArtifactSnapshot[] }) {
  return (
    <Surface className="p-6">
      <SectionTitle title="交付文件" />
      {artifacts.length > 0 ? (
        <div className="mt-4 space-y-3">
          {artifacts.map((artifact) => {
            const fileId = artifact.fileId ?? artifact.artifactId ?? "";
            const href = fileId ? getMyTaskArtifactDownloadHref(executionId, fileId, artifact.downloadUrl) : undefined;
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
                  {href && (
                    <SecondaryButton href={href} target="_blank" rel="noreferrer" icon={<Download size={15} />}>
                      下载
                    </SecondaryButton>
                  )}
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

function AcceptanceSection({ detail }: { detail: MyTaskExecutionDetail }) {
  const acceptance = detail.acceptance;
  const issues = getAcceptanceIssues(acceptance);
  return (
    <Surface className="p-6">
      <SectionTitle title="验收结果" />
      {acceptance ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoPill label="状态" value={acceptance.status || "-"} />
            <InfoPill label="评分" value={acceptance.score == null ? "-" : `${acceptance.score}`} />
            <InfoPill label="业务状态" value={acceptance.mappedBusinessStatus || "-"} />
          </div>
          {acceptance.summary && <p className="whitespace-pre-line text-[15px] leading-7 text-ink">{acceptance.summary}</p>}
          {issues.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {issues.map((issue) => (
                <SoftTag key={issue} tone="amber">
                  {issue}
                </SoftTag>
              ))}
            </div>
          )}
          {acceptance.acceptancePayload && (
            <Collapse
              ghost
              items={[
                {
                  key: "payload",
                  label: "验收详情",
                  children: <pre className="sprix-execution-log">{acceptance.acceptancePayload}</pre>
                }
              ]}
            />
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
    <Surface className="p-6">
      <SectionTitle title="执行时间线" />
      {events.length > 0 ? (
        <div className="mt-4 space-y-3">
          {events.map((event, index) => (
            <div key={event.eventId ?? `${event.eventType}-${index}`} className="rounded-2xl border border-line bg-white px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <SoftTag tone="neutral">{formatDateTime(getTimelineTime(event))}</SoftTag>
                {event.progress && <SoftTag>{event.progress}</SoftTag>}
              </div>
              <p className="mt-2 font-semibold text-ink">{event.currentNodeLabel || getCurrentNodeLabel(event.currentNode) || event.message || event.eventType}</p>
              {event.message && <p className="mt-1 text-sm leading-7 text-ink-soft">{event.message}</p>}
              {event.payload && (
                <Collapse
                  className="mt-2"
                  ghost
                  items={[
                    {
                      key: "payload",
                      label: "事件详情",
                      children: <pre className="sprix-execution-log">{event.payload}</pre>
                    }
                  ]}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <InlineEmpty title="暂无时间线" description="执行节点进度回传后，会按时间展示在这里。" />
      )}
    </Surface>
  );
}

function HistorySection({ detail }: { detail: MyTaskExecutionDetail }) {
  const histories = detail.historyExecutions ?? [];
  return (
    <Surface className="p-6">
      <SectionTitle title="历史执行" />
      {histories.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {histories.map((history) => (
            <Link
              key={history.id}
              to={`/agent/my-tasks/${history.id}`}
              className={`rounded-2xl border px-4 py-3 no-underline ${history.current ? "border-[#8dd5c8] bg-[#e7f7f2] text-ink" : "border-line bg-white text-ink"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusTag status={mapExecutionStatus(history.status)} />
                {history.current && <SoftTag>当前执行</SoftTag>}
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                {history.progress || "-"} · {getCurrentNodeLabel(history.currentNode)} · {formatDateTime(history.startedAt ?? history.createdAt)}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <InlineEmpty title="暂无历史执行" description="同一任务产生重跑记录后，会在这里展示。" />
      )}
    </Surface>
  );
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
