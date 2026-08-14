import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Form, Input, Modal, Steps, Tabs, message } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  ListChecks,
  Paperclip,
  PlugZap,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import type { FaceVerificationSession } from "../apis/sprix";
import type { Account, Agent, AgentEvaluation, MyTask, Task } from "../types";
import { useSprixStore } from "../store/sprixStore";
import {
  acceptRemoteTask,
  cancelRemoteTask,
  completeRemoteFaceVerification,
  downloadRemoteTaskAttachment,
  type FaceVerificationIdentity,
  type TaskAttachment,
  initializeRemoteFaceVerification,
  readCurrentRemoteAgent,
  readLatestRemoteAgentEvaluation,
  markRemoteCurrentAgent,
  readRemoteAgents,
  readRemoteAgentEvaluation,
  readRemoteTaskAttachmentBlob,
  readRemoteTaskAttachments,
  readRemoteWithdrawalAccountState,
  requestRemoteAgentLogin,
  signRemoteFreelancerAgreement,
  startRemoteAgentEvaluation,
  waitForRemoteAgentAuthentication
} from "../services/sprixApi";
import { ActionButton, EmptyState, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface } from "../components/Primitives";
import { AgentEvaluationProgressModal, clearAgentEvaluationProgressCache } from "../components/AgentEvaluationProgressModal";
import { AgreementContent } from "../components/AgreementContent";
import { compactText, currency, scoreText } from "../utils/format";
import { isApiRequestError, isGlobalAuthError } from "../utils/http";
import { freelancerAgreementDocument } from "../content/agreementDocuments";
import { getLocalAgentEmptyMessage } from "../home/localAgentInventory";
import { QrPayloadBox } from "../components/QrSession";
import { AgentAbilityProfile, EvaluationRadar } from "./AgentAbilityProfile";
import { getAgentAdmissionSummary, getAgentEvaluationStatusLabel, getAgentTagLabels } from "./agentResult";
import {
  getPayoutAccountActionLabel,
  getPayoutAccountText,
  getPayoutAccountWarning,
  getPayoutPageSubtitle,
  getPayoutRecordState
} from "./earningsView";
import { hasBoundPayoutAccount } from "./accountView";
import { getQualificationRecordRows } from "./qualificationView";
import { parseExecutionProgress, useExecutionDisplayProgress } from "./useExecutionDisplayProgress";
import { getEstimatedTokenField } from "./tokenEstimateView";
import {
  getAgreementSignButtonText,
  getMyTaskActions,
  getMyTaskMetaItems,
  getQualificationSuccessAction,
  getTaskAcceptGate,
  shouldShowAppealStatus
} from "./userFlowRules";
import { useRerunTask } from "./useRerunTask";
export { MyTaskDetailPage } from "./MyTaskDetailPage";

type UserPageProps = {
  openLogin: () => void;
  openAccount: () => void;
  openBindAlipay: (afterBind?: () => void) => void;
  openQualificationPrompt: (taskId?: string) => void;
  openAppeal: (executionId: string) => void;
};

function currentAgentDisplayName(name?: string) {
  return name?.replace(/\s+Agent$/i, "") || "-";
}

type FaceVerificationFormValues = FaceVerificationIdentity;

const FACE_VERIFICATION_POLL_INTERVAL_MS = 2_000;
const TASK_MARKET_SCROLL_TOP_KEY = "sprix-task-market-scroll-top";
const TASK_MARKET_VISIBLE_COUNT_KEY = "sprix-task-market-visible-count";
const TASK_MARKET_PAGE_KEY = "sprix-task-market-page";
const TASK_MARKET_BATCH_SIZE = 24;
const SMART_ACCEPT_VISIBLE = true;
const AGENT_EVALUATION_POLL_INTERVAL_MS = 1_500;

const BUTTON_ICON_PATHS = {
  alipay: "/button-icons/alipay.png",
  currentAgent: "/button-icons/agent-current.png",
  switchAgent: "/button-icons/agent-switch.png",
  evaluation: "/button-icons/evaluation.png"
} as const;

function ButtonIcon({ src }: { src: string }) {
  return <img className="sprix-button-icon" src={src} alt="" aria-hidden="true" />;
}

function formatTaskAttachmentSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KiB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function showRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${error.message}` : fallback);
}

function getTaskMarketScrollContainer() {
  const container = document.querySelector<HTMLElement>(".sprix-main");
  if (!container) return null;

  const overflowY = window.getComputedStyle(container).overflowY;
  const canScroll = container.scrollHeight > container.clientHeight;
  return canScroll && overflowY !== "visible" && overflowY !== "clip" ? container : null;
}

function scrollTaskMarketTo(scrollTop: number) {
  const scrollContainer = getTaskMarketScrollContainer();
  if (scrollContainer) {
    scrollContainer.scrollTo({ top: scrollTop, behavior: "auto" });
    return;
  }

  window.scrollTo({ top: scrollTop, behavior: "auto" });
}

function saveTaskMarketScrollTop() {
  const scrollTop = getTaskMarketScrollContainer()?.scrollTop ?? window.scrollY;
  sessionStorage.setItem(TASK_MARKET_SCROLL_TOP_KEY, String(Math.max(0, Math.round(scrollTop))));
}

function saveTaskMarketReturnState(visibleCount: number) {
  saveTaskMarketScrollTop();
  sessionStorage.setItem(TASK_MARKET_VISIBLE_COUNT_KEY, String(Math.max(TASK_MARKET_BATCH_SIZE, visibleCount)));
}

function readSavedTaskMarketScrollTop() {
  const value = Number(sessionStorage.getItem(TASK_MARKET_SCROLL_TOP_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readSavedTaskMarketVisibleCount() {
  if (readSavedTaskMarketScrollTop() === null) return TASK_MARKET_BATCH_SIZE;

  const savedCount = Number(sessionStorage.getItem(TASK_MARKET_VISIBLE_COUNT_KEY));
  if (Number.isInteger(savedCount) && savedCount >= TASK_MARKET_BATCH_SIZE) return savedCount;

  const value = Number(sessionStorage.getItem(TASK_MARKET_PAGE_KEY));
  return Number.isInteger(value) && value > 0 ? value * TASK_MARKET_BATCH_SIZE : TASK_MARKET_BATCH_SIZE;
}

function clearTaskMarketReturnState() {
  sessionStorage.removeItem(TASK_MARKET_SCROLL_TOP_KEY);
  sessionStorage.removeItem(TASK_MARKET_VISIBLE_COUNT_KEY);
  sessionStorage.removeItem(TASK_MARKET_PAGE_KEY);
}

const agentEvaluationActionLabels: Record<AgentEvaluation["status"], string> = {
  not_started: "开始评测",
  running: "查看进度",
  judging: "查看进度",
  completed: "评测完成",
  failed: "重新评测"
};

function getAgentEvaluationActionLabel(agent: Agent) {
  const resultStatus = agent.evaluation?.result?.status;
  const status = resultStatus === "completed" || resultStatus === "failed" ? resultStatus : agent.evaluation?.status;
  return status ? agentEvaluationActionLabels[status] : "开始评测";
}

export function TaskMarketPage({ openLogin, openQualificationPrompt }: Partial<UserPageProps> = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tasks = useSprixStore((state) => state.tasks);
  const myTasks = useSprixStore((state) => state.myTasks);
  const account = useSprixStore((state) => state.account);
  const currentAgent = useSprixStore((state) => state.currentAgent);
  const smartAcceptEnabled = useSprixStore((state) => state.smartAcceptEnabled);
  const setSmartAcceptEnabled = useSprixStore((state) => state.setSmartAcceptEnabled);
  const [smartAcceptModalOpen, setSmartAcceptModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(readSavedTaskMarketVisibleCount);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const availableTasks = useMemo(() => tasks.filter((task) => task.taskStatus === "已发布"), [tasks]);
  const effectiveVisibleCount = Math.min(visibleCount, availableTasks.length || TASK_MARKET_BATCH_SIZE);
  const visibleTasks = useMemo(() => availableTasks.slice(0, effectiveVisibleCount), [availableTasks, effectiveVisibleCount]);
  const hasMoreTasks = effectiveVisibleCount < availableTasks.length;

  useEffect(() => {
    if (availableTasks.length === 0) return;
    setVisibleCount((count) => Math.min(count, Math.max(availableTasks.length, TASK_MARKET_BATCH_SIZE)));
  }, [availableTasks.length]);

  useEffect(() => {
    const scrollTop = readSavedTaskMarketScrollTop();
    if (scrollTop === null || visibleTasks.length === 0) return;

    let timeout = 0;
    const frame = window.requestAnimationFrame(() => {
      scrollTaskMarketTo(scrollTop);
      timeout = window.setTimeout(() => {
        scrollTaskMarketTo(scrollTop);
        clearTaskMarketReturnState();
      }, 80);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [visibleTasks.length]);

  const loadMoreTasks = useCallback(() => {
    setVisibleCount((count) => Math.min(count + TASK_MARKET_BATCH_SIZE, availableTasks.length));
  }, [availableTasks.length]);

  const saveTaskMarketReturnPosition = useCallback(() => {
    saveTaskMarketReturnState(effectiveVisibleCount);
  }, [effectiveVisibleCount]);

  useEffect(() => {
    if (!hasMoreTasks) return;
    const marker = loadMoreRef.current;
    if (!marker) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreTasks();
        }
      },
      {
        root: getTaskMarketScrollContainer(),
        rootMargin: "360px 0px"
      }
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [hasMoreTasks, loadMoreTasks]);

  const handleAccept = (task: Task) => {
    const gate = getTaskAcceptGate(account, currentAgent, task);
    if (gate.kind === "login") {
      openLogin?.();
      return;
    }
    if (gate.kind === "qualification") {
      message.warning(gate.message);
      if (openQualificationPrompt) {
        openQualificationPrompt(task.id);
      } else {
        navigate(gate.path);
      }
      return;
    }
    if (gate.kind === "current-agent") {
      message.warning(gate.message);
      navigate(gate.path);
      return;
    }
    if (gate.kind === "task-unavailable") {
      message.warning(gate.message);
      return;
    }

    Modal.confirm({
      title: "确认接单",
      content:
        "确认接单后，平台将使用当前执行 Agent 立即执行该任务。执行期间请保持 Agent 连接，若连接断开或切换 Agent，本次执行将终止并需要重新执行。",
      okText: "确认接单",
      cancelText: "取消",
      onOk: async () => {
        try {
          await acceptRemoteTask(task.id);
          await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
          message.success("接单成功，已回到任务市场");
          navigate("/agent/market", { replace: true });
        } catch (error) {
          showRequestError(error, "接单失败", "接单失败：");
        }
      }
    });
  };

  const openSmartAcceptModal = () => {
    if (!account.isLoggedIn) {
      openLogin?.();
      return;
    }
    if (!currentAgent) {
      message.warning("请先设置当前执行 Agent");
      navigate("/agent/center");
      return;
    }

    setSmartAcceptModalOpen(true);
  };

  const enableSmartAccept = () => {
    setSmartAcceptEnabled(true);
    setSmartAcceptModalOpen(false);
    message.success("智能接单已开启");
  };

  const disableSmartAccept = () => {
    setSmartAcceptEnabled(false);
    setSmartAcceptModalOpen(false);
    message.success("智能接单已关闭");
  };

  return (
    <>
      <PageHeader
        title="可接取任务"
        subtitle="浏览当前可接取的任务，选择适合你的 Agent 执行的工作，并持续跟踪执行进度与收益。"
        actions={SMART_ACCEPT_VISIBLE ? (
          <ActionButton icon={<PlugZap size={16} />} onClick={openSmartAcceptModal}>
            {smartAcceptEnabled ? "智能接单已开启" : "智能接单"}
          </ActionButton>
        ) : undefined}
      />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard title="已发布任务" value="3W+" icon={<img className="size-[92px] object-contain" src="/task-metric-published.svg" alt="" aria-hidden="true" />} />
        <MetricCard title="当前执行 Agent" value={currentAgentDisplayName(currentAgent?.name)} icon={<img className="size-[92px] object-contain" src="/task-metric-agent.svg" alt="" aria-hidden="true" />} />
        <MetricCard
          title="我的任务"
          value={myTasks.length || "-"}
          icon={<img className="size-[92px] object-contain" src="/task-metric-tasks.svg" alt="" aria-hidden="true" />}
        />
      </div>
      <div className="sprix-grid-auto">
        {visibleTasks.map((task) => (
          <TaskCard key={task.id} task={task} onAccept={() => handleAccept(task)} onOpenDetail={saveTaskMarketReturnPosition} />
        ))}
      </div>
      {hasMoreTasks && (
        <button ref={loadMoreRef} type="button" className="sprix-task-market-load-more" onClick={loadMoreTasks}>
          继续下滑加载更多
        </button>
      )}
      {availableTasks.length === 0 && <EmptyState title="暂无可接取任务" description="当前暂时没有新的任务，稍后再来查看适合 Agent 执行的工作。" />}
      <SmartAcceptModal
        agent={currentAgent}
        enabled={smartAcceptEnabled}
        open={smartAcceptModalOpen}
        onCancel={() => setSmartAcceptModalOpen(false)}
        onDisable={disableSmartAccept}
        onEnable={enableSmartAccept}
      />
    </>
  );
}

function SmartAcceptModal({
  agent,
  enabled,
  open,
  onCancel,
  onDisable,
  onEnable
}: {
  agent?: Agent;
  enabled: boolean;
  open: boolean;
  onCancel: () => void;
  onDisable: () => void;
  onEnable: () => void;
}) {
  const agentName = agent?.name ?? "当前 Agent";
  const agentScore = agent?.score ?? 94;

  return (
    <Modal
      title={enabled ? "智能接单已开启" : "开启智能接单"}
      open={open}
      onCancel={onCancel}
      width={620}
      className="sprix-smart-accept-modal"
      footer={
        enabled ? (
          <div className="sprix-modal-actions">
            <SecondaryButton onClick={onDisable}>关闭智能接单</SecondaryButton>
            <ActionButton onClick={onCancel}>我知道了</ActionButton>
          </div>
        ) : (
          <div className="sprix-modal-actions">
            <SecondaryButton onClick={onCancel}>取消</SecondaryButton>
            <ActionButton onClick={onEnable}>开启智能接单</ActionButton>
          </div>
        )
      }
    >
      <div className="sprix-smart-accept-agent">
        <div className="sprix-smart-accept-agent-icon">
          <Bot size={24} />
        </div>
        <div className="sprix-smart-accept-agent-copy">
          <div className="sprix-smart-accept-agent-title">
            <strong>{agentName}</strong>
            <span>{enabled ? "智能接单中" : "已连接"}</span>
          </div>
          <p>{enabled ? "系统会持续按当前执行 Agent 的能力画像匹配任务。" : "开启后将使用当前执行 Agent 自动判断可接取任务。"}</p>
        </div>
      </div>
      <div className="sprix-smart-accept-metrics">
        <div>
          <span>Agent 综合评分</span>
          <strong>{agentScore}</strong>
        </div>
        <div>
          <span>自动接单阈值</span>
          <strong>92%</strong>
        </div>
        <div>
          <span>当前状态</span>
          <strong>{enabled ? "已开启" : "待开启"}</strong>
        </div>
      </div>
      <div className="sprix-smart-accept-copy">
        <ShieldCheck size={18} />
        <div>
          <strong>{enabled ? "已开启智能接单" : "开启后自动接取高匹配任务"}</strong>
          <p>
            {enabled
              ? "系统将持续根据任务与当前执行 Agent 的匹配度判断是否接单。"
              : "当平台任务与当前执行 Agent 的匹配度达到 92% 及以上时，系统将自动为你接取该任务。"}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function TaskCard({ task, onAccept, onOpenDetail }: { task: Task; onAccept: () => void; onOpenDetail: () => void }) {
  const estimatedToken = getEstimatedTokenField(task.estimatedTokens);
  return (
    <Surface className="flex min-h-[332px] flex-col p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SoftTag tone="neutral" bordered={false} className="sprix-task-market-category-tag m-0 px-2.5 py-0.5">
          {task.category}
        </SoftTag>
        {task.agentMatchScore > 0 && (
          <SoftTag className="sprix-task-market-match-tag m-0 rounded-full px-2.5 py-0.5">
            匹配 {task.agentMatchScore}%
          </SoftTag>
        )}
      </div>
      <Link to={`/agent/task/${task.id}`} className="text-xl font-semibold leading-7 text-ink no-underline hover:text-accent" onClick={onOpenDetail}>
        {task.title}
      </Link>
      <p className="mt-3 flex-1 text-sm leading-7 text-ink-soft">{compactText(task.cardSummary, 104)}</p>
      {task.recommendedReason && <p className="mt-3 rounded-lg bg-[#fafafa] p-3 text-sm leading-6 text-ink-soft">{task.recommendedReason}</p>}
      <div className="mt-4 grid gap-2 text-sm text-ink-soft">
        <span>奖励：<b className="text-ink">{currency(task.reward)}</b></span>
        <span>剩余名额：{task.remainingSlots}/{task.totalSlots}</span>
        <span>{estimatedToken.label}：{estimatedToken.value}</span>
        <span>来源：{task.sourceName}</span>
      </div>
      <div className="mt-5 flex gap-2">
        <ActionButton onClick={onAccept}>接单</ActionButton>
        <Link to={`/agent/task/${task.id}`} className="no-underline" onClick={onOpenDetail}>
          <SecondaryButton>查看详情</SecondaryButton>
        </Link>
      </div>
    </Surface>
  );
}

export function TaskDetailPage({ openLogin, openQualificationPrompt }: UserPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const task = useSprixStore((state) => state.tasks.find((item) => item.id === id));
  const account = useSprixStore((state) => state.account);
  const currentAgent = useSprixStore((state) => state.currentAgent);
  const estimatedToken = getEstimatedTokenField(task?.estimatedTokens);
  const taskAttachmentsQuery = useQuery({
    queryKey: ["sprix-agent", "task-attachments", id],
    queryFn: () => readRemoteTaskAttachments(id as string),
    enabled: Boolean(id),
    retry: 1
  });

  const returnToTaskMarket = () => {
    navigate("/agent/market");
  };

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      scrollTaskMarketTo(0);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [id]);

  if (!task) {
    return (
      <EmptyState
        title="任务不存在"
        description="当前任务已不可访问"
        action={<SecondaryButton onClick={returnToTaskMarket}>返回任务市场</SecondaryButton>}
      />
    );
  }

  const handleAccept = () => {
    const gate = getTaskAcceptGate(account, currentAgent, task);
    if (gate.kind === "login") {
      openLogin();
      return;
    }
    if (gate.kind === "qualification") {
      message.warning(gate.message);
      openQualificationPrompt(task.id);
      return;
    }
    if (gate.kind === "current-agent") {
      message.warning(gate.message);
      navigate(gate.path);
      return;
    }
    if (gate.kind === "task-unavailable") {
      message.warning(gate.message);
      return;
    }

    Modal.confirm({
      title: "确认接单",
      content: "确认接单后，平台将使用当前执行 Agent 立即执行该任务。执行期间请保持 Agent 连接，若连接断开或切换 Agent，本次执行将终止并需要重新执行。",
      okText: "确认接单",
      cancelText: "取消",
      onOk: async () => {
        try {
          await acceptRemoteTask(task.id);
          await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
          message.success("接单成功，已回到任务市场");
          navigate("/agent/market", { replace: true });
        } catch (error) {
          showRequestError(error, "接单失败", "接单失败：");
        }
      }
    });
  };

  const handleBackToTaskList = () => {
    if (location.key === "default") {
      navigate("/agent/market");
      return;
    }
    navigate(-1);
  };

  const requireAttachmentLogin = () => {
    if (account.isLoggedIn) return true;
    message.info("登录后可查看或下载任务附件原文件");
    openLogin();
    return false;
  };

  const downloadAttachment = async (attachment: TaskAttachment) => {
    if (!requireAttachmentLogin()) return;
    try {
      await downloadRemoteTaskAttachment(attachment);
    } catch (error) {
      showRequestError(error, "任务附件下载失败");
    }
  };

  const previewAttachment = async (attachment: TaskAttachment) => {
    if (!requireAttachmentLogin()) return;
    try {
      const blob = await readRemoteTaskAttachmentBlob(attachment);
      const url = URL.createObjectURL(blob);
      Modal.info({
        title: attachment.filename,
        width: 920,
        icon: null,
        okText: "关闭",
        content: <img className="mt-4 max-h-[70vh] w-full object-contain" src={url} alt={attachment.filename} />,
        afterClose: () => URL.revokeObjectURL(url)
      });
    } catch (error) {
      showRequestError(error, "任务附件预览失败");
    }
  };

  return (
    <div className="sprix-task-detail-page">
      <div className="sprix-task-detail-shell">
        <div className="sprix-detail-back-row">
          <SecondaryButton onClick={handleBackToTaskList} icon={<ChevronLeft size={16} />}>
            返回任务列表
          </SecondaryButton>
        </div>

        <header className="sprix-task-detail-hero">
          <h1 className="sprix-task-detail-title">{task.title}</h1>
          <div className="sprix-task-detail-meta">
            <span>{task.category}</span>
            <span>奖励 <b>{currency(task.reward)}</b></span>
            <span className="is-success">剩余名额 {task.remainingSlots}/{task.totalSlots}</span>
            <span>{estimatedToken.label}: {estimatedToken.value}</span>
          </div>
        </header>

        <div className="sprix-task-detail-layout">
          <main className="sprix-task-detail-main">
            <InfoBlock icon={<FileText size={18} />} title="详细任务描述" body={task.description} />
            <InfoBlock icon={<ListChecks size={18} />} title="交付标准" body={task.deliverables} />
            <InfoBlock icon={<CheckCircle2 size={18} />} title="验收标准" body={task.acceptanceCriteria} />
            <Surface className="sprix-task-info-card">
              <h3>
                <span><Paperclip size={18} /></span>
                任务附件
              </h3>
              {taskAttachmentsQuery.isLoading ? (
                <p className="sprix-detail-prose">附件加载中</p>
              ) : taskAttachmentsQuery.isError ? (
                <p className="sprix-detail-prose text-red-600">任务附件加载失败</p>
              ) : taskAttachmentsQuery.data?.length ? (
                <div className="mt-3 grid gap-2">
                  {taskAttachmentsQuery.data.map((attachment) => {
                    const previewable = attachment.mimeType.startsWith("image/");
                    return (
                      <div key={attachment.attachmentId} className="flex flex-col gap-3 rounded-xl border border-line bg-[#fafafa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink" title={attachment.filename}>{attachment.filename}</div>
                          <div className="mt-1 text-xs text-ink-soft">{attachment.mimeType || "未知类型"} · {formatTaskAttachmentSize(attachment.sizeBytes)}</div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {previewable && <SecondaryButton onClick={() => void previewAttachment(attachment)}>预览</SecondaryButton>}
                          <SecondaryButton icon={<Download size={15} />} onClick={() => void downloadAttachment(attachment)}>下载</SecondaryButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="sprix-detail-prose">暂无任务附件</p>
              )}
            </Surface>
          </main>

          <aside className="sprix-task-detail-aside">
            <Surface className="sprix-task-side-card">
              <h3>匹配信息</h3>
              <div className="sprix-task-side-score">
                <span>系统评估匹配度</span>
                <b>{task.agentMatchScore > 0 ? `${task.agentMatchScore}%` : "-"}</b>
              </div>
              <div className="sprix-task-side-divider" />
              <h3 className="is-muted">来源信息</h3>
              <InfoRow label="来源平台" value={task.sourceName} />
              <InfoRow label="任务类型" value={task.category} />
            </Surface>

            <Surface className="sprix-task-side-card">
              <h3>执行与接单</h3>
              <div className="sprix-task-agent-row is-current-agent">
                <span>当前 Agent</span>
                <b>{currentAgent?.name ?? "未设置"}</b>
              </div>
              <div className="sprix-task-agent-row">
                <span>连接状态</span>
                <b className={currentAgent ? "is-online" : "is-offline"}>
                  <span />
                  {currentAgent ? "后端已连接" : "未连接"}
                </b>
              </div>
              <ActionButton className="sprix-task-accept-button" onClick={handleAccept}>
                确认接单
              </ActionButton>
              <p className="sprix-task-accept-note">接单后将立即进入执行队列</p>
            </Surface>
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Surface className="sprix-task-info-card">
      <h3>
        <span>{icon}</span>
        {title}
      </h3>
      <p className="sprix-detail-prose">{body}</p>
    </Surface>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="sprix-task-info-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function getInitialQualificationStep(account: Account) {
  if (account.qualificationStatus === "已开通" && account.realPersonVerified && account.freelancerAgreementSigned) {
    return 2;
  }

  if (account.realPersonVerified) {
    return 1;
  }

  return 0;
}

export function AgentCenterPage({ openLogin }: UserPageProps) {
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const localAgent = useSprixStore((state) => state.localAgent);
  const currentAgent = useSprixStore((state) => state.currentAgent);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const current = currentAgent;
  const autoSetCurrentAgentIdRef = useRef<string>();
  const evaluationSessionsRef = useRef(new Map<string, AgentEvaluation>());
  const evaluationRequestIdRef = useRef(0);
  const evaluationAccountScopeRef = useRef<string>();
  const [evaluationAgent, setEvaluationAgent] = useState<Agent | null>(null);
  const [evaluation, setEvaluation] = useState<AgentEvaluation | undefined>();
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<AgentEvaluation | undefined>();
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string>();
  const [settingCurrentAgentId, setSettingCurrentAgentId] = useState<string>();
  const evaluationAccountScope = account.isLoggedIn ? account.phone || account.maskedPhone || account.nickname || "logged-in" : "logged-out";
  const currentWithEvaluation = currentEvaluation && current ? { ...current, evaluation: currentEvaluation, score: currentEvaluation.result.overallScore ?? null } : current;
  const agentsWithCurrentEvaluation =
    currentEvaluation && current
      ? agents.map((agent) =>
          agent.id === current.id ? { ...agent, evaluation: currentEvaluation, score: currentEvaluation.result.overallScore ?? null } : agent
        )
      : agents;

  const refreshAgents = useCallback(async (preferredCurrentAgent?: Agent) => {
    const [remoteAgents, refreshedCurrentAgent] = await Promise.all([
      readRemoteAgents(),
      readCurrentRemoteAgent().catch(() => undefined)
    ]);
    const currentAgentFromList = remoteAgents.currentAgentId ? remoteAgents.agents.find((agent) => agent.id === remoteAgents.currentAgentId) : undefined;
    mergeRemoteState({
      agents: remoteAgents.agents,
      localAgent: remoteAgents.localAgent,
      currentAgentId: remoteAgents.currentAgentId,
      currentAgent: refreshedCurrentAgent ?? preferredCurrentAgent ?? currentAgentFromList
    });
  }, [mergeRemoteState]);

  const promptClaudeLogin = useCallback((agent: Agent, onAuthenticated: (authenticatedAgent: Agent) => Promise<void>) => {
    Modal.confirm({
      title: "登录 Claude Code",
      content: "已检测到 Claude Code 尚未登录。点击“立即登录”后，本机会打开终端和 Claude 授权页面；完成后将自动继续当前操作。",
      okText: "立即登录",
      cancelText: "取消",
      onOk: async () => {
        try {
          await requestRemoteAgentLogin(agent.id);
          message.info("请在本机终端和浏览器中完成 Claude Code 登录");
          const authenticatedAgent = await waitForRemoteAgentAuthentication(agent.id);
          await refreshAgents(authenticatedAgent);
          message.success("Claude Code 登录成功");
          await onAuthenticated(authenticatedAgent);
        } catch (error) {
          showRequestError(error, "Claude Code 登录失败", "Claude Code 登录失败：");
          throw error;
        }
      }
    });
  }, [refreshAgents]);

  const setCurrent = async (agent: Agent) => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    if (agent.authStatus === "login_required") {
      promptClaudeLogin(agent, setCurrent);
      return;
    }
    if (settingCurrentAgentId) return;

    setSettingCurrentAgentId(agent.id);
    try {
      const latestEvaluation = await readLatestRemoteAgentEvaluation(agent.id);
      if (!isCompletedAgentEvaluation(latestEvaluation)) {
        message.warning("请先完成该 Agent 测评后再设为当前执行 Agent");
        return;
      }
      const updatedCurrentAgent = await markRemoteCurrentAgent(agent.id);
      const preferredCurrentAgent = updatedCurrentAgent ?? { ...agent, role: "当前执行 Agent" as const };
      setCurrentEvaluation(undefined);
      mergeRemoteState({ currentAgent: preferredCurrentAgent });
      await refreshAgents(preferredCurrentAgent);
      message.success("已设置当前执行 Agent");
    } catch (error) {
      if (error instanceof Error && error.message === "Agent evaluation not found") {
        message.warning("请先完成该 Agent 测评后再设为当前执行 Agent");
        return;
      }
      showRequestError(error, "设置失败", "设置失败：");
    } finally {
      setSettingCurrentAgentId(undefined);
    }
  };

  const markCurrentAfterCompletedEvaluation = async (agent: Agent, nextEvaluation: AgentEvaluation) => {
    if (autoSetCurrentAgentIdRef.current !== agent.id || !isCompletedAgentEvaluation(nextEvaluation)) return;
    try {
      const updatedCurrentAgent = await markRemoteCurrentAgent(agent.id);
      const preferredCurrentAgent = updatedCurrentAgent ?? { ...agent, role: "当前执行 Agent" as const };
      mergeRemoteState({ currentAgent: preferredCurrentAgent });
      autoSetCurrentAgentIdRef.current = undefined;
      await refreshAgents(preferredCurrentAgent);
      message.success("测评完成，已设置当前执行 Agent");
    } catch (error) {
      showRequestError(error, "设置当前执行 Agent 失败", "设置当前执行 Agent 失败：");
    }
  };

  const openAgentEvaluation = async (
    agent: Agent,
    { setCurrentAfterCompletion = false, forceStart = false }: { setCurrentAfterCompletion?: boolean; forceStart?: boolean } = {}
  ) => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    if (agent.authStatus === "login_required") {
      promptClaudeLogin(agent, (authenticatedAgent) => openAgentEvaluation(authenticatedAgent, { setCurrentAfterCompletion, forceStart }));
      return;
    }
    if (setCurrentAfterCompletion) {
      autoSetCurrentAgentIdRef.current = agent.id;
    }
    const shouldRestoreEvaluation =
      evaluationAgent?.id === agent.id && (evaluationLoading || Boolean(evaluation && isEvaluationActive(evaluation.status)));
    if (shouldRestoreEvaluation) {
      setEvaluationModalOpen(true);
      setEvaluationError(undefined);
      return;
    }
    const requestId = ++evaluationRequestIdRef.current;
    const isCurrentRequest = () => evaluationRequestIdRef.current === requestId;
    setEvaluationAgent(agent);
    setEvaluation(undefined);
    setEvaluationModalOpen(true);
    setEvaluationError(undefined);
    setEvaluationLoading(true);
    try {
      let shouldStartEvaluation = false;
      let nextEvaluation: AgentEvaluation | undefined;

      const rememberedEvaluation = !forceStart ? evaluationSessionsRef.current.get(agent.id) : undefined;
      const listedRunningEvaluation = !forceStart && agent.evaluation && isEvaluationActive(agent.evaluation.status) ? agent.evaluation : undefined;
      const runningEvaluation = rememberedEvaluation ?? listedRunningEvaluation;

      if (runningEvaluation && isEvaluationActive(runningEvaluation.status)) {
        try {
          const latestEvaluation = runningEvaluation.evaluationId
            ? await readRemoteAgentEvaluation(agent.id, runningEvaluation.evaluationId)
            : runningEvaluation;
          if (!isCurrentRequest()) return;
          if (isEvaluationActive(latestEvaluation.status) || isEvaluationTerminal(latestEvaluation.status)) {
            nextEvaluation = latestEvaluation;
          }
        } catch (error) {
          if (isGlobalAuthError(error)) throw error;
          // Keep the last known session. The polling effect will retry instead of starting a new evaluation.
          nextEvaluation = runningEvaluation;
        }
      }

      if (!nextEvaluation) {
        shouldStartEvaluation = true;
        nextEvaluation = await startRemoteAgentEvaluation(agent.id);
      }
      if (!isCurrentRequest()) return;
      if (isEvaluationActive(nextEvaluation.status)) {
        evaluationSessionsRef.current.set(agent.id, nextEvaluation);
      } else {
        evaluationSessionsRef.current.delete(agent.id);
      }
      setEvaluation(nextEvaluation);
      if (current?.id === agent.id) {
        setCurrentEvaluation(nextEvaluation);
      }
      await refreshAgents();
      if (!isCurrentRequest()) return;
      await markCurrentAfterCompletedEvaluation(agent, nextEvaluation);
      if (shouldStartEvaluation && isEvaluationActive(nextEvaluation.status)) {
        message.success("评测已开始");
      }
    } catch (error) {
      if (!isCurrentRequest()) return;
      setEvaluationError(error instanceof Error ? error.message : "评测操作失败");
      showRequestError(error, "评测操作失败", "评测操作失败：");
    } finally {
      if (isCurrentRequest()) setEvaluationLoading(false);
    }
  };

  useEffect(() => {
    if (!evaluationAgent || !evaluation || isEvaluationTerminal(evaluation.status)) return;

    let cancelled = false;
    const poll = window.setInterval(async () => {
      try {
        const next = await readRemoteAgentEvaluation(evaluationAgent.id, evaluation.evaluationId);
        if (cancelled) return;
        if (isEvaluationTerminal(next.status)) {
          evaluationSessionsRef.current.delete(evaluationAgent.id);
        } else {
          evaluationSessionsRef.current.set(evaluationAgent.id, next);
        }
        setEvaluation(next);
        if (current?.id === evaluationAgent.id) {
          setCurrentEvaluation(next);
        }
        if (isEvaluationTerminal(next.status)) {
          window.clearInterval(poll);
          if (next.status === "failed") {
            autoSetCurrentAgentIdRef.current = undefined;
          }
          if (next.status === "completed") {
            await markCurrentAfterCompletedEvaluation(evaluationAgent, next);
          }
          void refreshAgents();
        }
      } catch {
        if (cancelled) return;
        window.clearInterval(poll);
      }
    }, AGENT_EVALUATION_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [current?.id, evaluation, evaluationAgent, refreshAgents]);

  useEffect(() => {
    if (evaluationAccountScopeRef.current === evaluationAccountScope) return;

    evaluationAccountScopeRef.current = evaluationAccountScope;
    evaluationRequestIdRef.current += 1;
    evaluationSessionsRef.current.clear();
    clearAgentEvaluationProgressCache();
    autoSetCurrentAgentIdRef.current = undefined;
    setEvaluationModalOpen(false);
    setEvaluationAgent(null);
    setEvaluation(undefined);
    setCurrentEvaluation(undefined);
    setEvaluationLoading(false);
    setEvaluationError(undefined);
  }, [evaluationAccountScope]);

  useEffect(() => {
    if (!account.isLoggedIn || !current?.id || current.evaluation?.result?.status === "completed") {
      setCurrentEvaluation(undefined);
      return;
    }

    let cancelled = false;
    const requestId = evaluationRequestIdRef.current;
    readLatestRemoteAgentEvaluation(current.id)
      .then((latest) => {
        if (cancelled || requestId !== evaluationRequestIdRef.current) return;
        setCurrentEvaluation(latest);
        if (!isEvaluationTerminal(latest.status)) {
          setEvaluationAgent(current);
          setEvaluation(latest);
        }
      })
      .catch(() => {
        if (!cancelled && requestId === evaluationRequestIdRef.current) setCurrentEvaluation(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [account.isLoggedIn, current?.id, current?.evaluation?.lastEvaluatedAt, current?.evaluation?.result?.status, evaluationAccountScope]);

  const closeEvaluation = () => {
    evaluationRequestIdRef.current += 1;
    setEvaluationModalOpen(false);
    const shouldKeepEvaluationContext = evaluationLoading || Boolean(evaluation && isEvaluationActive(evaluation.status));
    setEvaluationLoading(false);
    if (!shouldKeepEvaluationContext) {
      setEvaluationAgent(null);
      setEvaluation(undefined);
    }
    setEvaluationError(undefined);
  };

  return (
    <>
      <PageHeader
        title="Agent 中心"
      />
      <div className="mb-5">
        <CurrentAgentCard agent={currentWithEvaluation} />
      </div>
      <AgentList
        title="Agent 列表"
        agents={agentsWithCurrentEvaluation}
        empty={getLocalAgentEmptyMessage(localAgent)}
        renderActions={(agent) => {
          const canRestartEvaluation =
            agent.evaluation && (isCompletedAgentEvaluation(agent.evaluation) || agent.evaluation.status === "failed" || agent.evaluation.result?.status === "failed");
          const showEvaluationAction = !canRestartEvaluation;
          const isSettingCurrent = settingCurrentAgentId === agent.id;
          return agent.role === "当前执行 Agent" ? (
            <>
              {agent.authStatus === "login_required" && (
                <SecondaryButton onClick={() => promptClaudeLogin(agent, async () => undefined)}>登录</SecondaryButton>
              )}
              <SecondaryButton
                disabled
                icon={<ButtonIcon src={BUTTON_ICON_PATHS.currentAgent} />}
              >
                当前执行 Agent
              </SecondaryButton>
              {showEvaluationAction && <SecondaryButton onClick={() => openAgentEvaluation(agent)}>{getAgentEvaluationActionLabel(agent)}</SecondaryButton>}
              {canRestartEvaluation && (
                <SecondaryButton
                  icon={<ButtonIcon src={BUTTON_ICON_PATHS.evaluation} />}
                  onClick={() => openAgentEvaluation(agent, { forceStart: true })}
                >
                  重新评测
                </SecondaryButton>
              )}
            </>
          ) : (
            <>
              {agent.authStatus === "login_required" && (
                <SecondaryButton onClick={() => promptClaudeLogin(agent, async () => undefined)}>登录</SecondaryButton>
              )}
              <ActionButton
                disabled={Boolean(settingCurrentAgentId)}
                icon={<ButtonIcon src={BUTTON_ICON_PATHS.switchAgent} />}
                loading={isSettingCurrent}
                onClick={() => setCurrent(agent)}
              >
                {isSettingCurrent ? "设置中" : "设为当前执行 Agent"}
              </ActionButton>
              {showEvaluationAction && <SecondaryButton onClick={() => openAgentEvaluation(agent)}>{getAgentEvaluationActionLabel(agent)}</SecondaryButton>}
              {canRestartEvaluation && (
                <SecondaryButton
                  icon={<ButtonIcon src={BUTTON_ICON_PATHS.evaluation} />}
                  onClick={() => openAgentEvaluation(agent, { forceStart: true })}
                >
                  重新评测
                </SecondaryButton>
              )}
            </>
          );
        }}
      />
      <AgentEvaluationProgressModal open={evaluationModalOpen} agent={evaluationAgent} evaluation={evaluation} loading={evaluationLoading} error={evaluationError} onClose={closeEvaluation} />
    </>
  );
}

function isEvaluationTerminal(status: AgentEvaluation["status"]) {
  return status === "completed" || status === "failed";
}

function isEvaluationActive(status: AgentEvaluation["status"]) {
  return status === "running" || status === "judging";
}

function isCompletedAgentEvaluation(evaluation: AgentEvaluation) {
  return evaluation.status === "completed" || evaluation.result?.status === "completed";
}

function isAgentEvaluationNotFound(error: unknown) {
  if (isApiRequestError(error) && error.code === "NOT_FOUND") return true;
  return error instanceof Error && ["Agent evaluation not found", "Agent 测评记录不存在"].includes(error.message);
}

function CurrentAgentCard({ agent }: { agent?: Agent }) {
  const summary = agent ? getAgentAdmissionSummary(agent) : undefined;
  const tagLabels = summary ? getAgentTagLabels(summary.tags) : [];
  const evaluationResult = agent?.evaluation?.result?.status === "completed" ? agent.evaluation.result : undefined;
  return (
    <Surface className="sprix-current-agent-card sprix-agent-profile-card p-6">
      {summary ? (
        <>
          <div className="sprix-agent-identity-panel">
            <div className="sprix-current-agent-body">
              <div className="min-w-0 flex-1">
                <span className="sprix-agent-current-label">当前执行 Agent</span>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-2xl font-semibold">{summary.title}</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tagLabels.map((tag) => (
                    <span key={tag} className="sprix-agent-ability-result-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                {evaluationResult && (
                  <div className="sprix-agent-score-panel">
                    <strong>{evaluationResult.overallScore ?? "-"}</strong>
                    <span>综合评分</span>
                    <EvaluationRadar result={evaluationResult} />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="sprix-agent-ability-section">
            <AgentAbilityProfile agent={agent} embedded showScore={false} resultPresentation />
          </div>
        </>
      ) : (
        <div className="sprix-current-agent-empty rounded-2xl border border-dashed border-line p-7 text-center">
          <Bot className="mx-auto text-ink-soft" />
          <h4 className="mt-3 text-lg font-semibold">未设置当前执行 Agent</h4>
          <p className="mt-2 text-sm text-ink-soft">在 Agent 列表中选择一个 Agent 设为当前执行 Agent 后，即可执行平台任务。</p>
        </div>
      )}
    </Surface>
  );
}

function AgentList({
  title,
  agents,
  empty,
  renderActions
}: {
  title: string;
  agents: Agent[];
  empty: string;
  renderActions: (agent: Agent) => React.ReactNode;
}) {
  return (
    <Surface className="mb-5 p-6">
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      {agents.length === 0 ? (
        <p className="rounded-lg bg-[#fafafa] p-4 text-sm text-ink-soft">{empty}</p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const completedEvaluation = agent.evaluation?.result?.status === "completed" ? agent.evaluation.result : undefined;
            const lastEvaluatedAt = agent.evaluation?.lastEvaluatedAt;
            return (
              <div key={agent.id} className="flex flex-col gap-4 rounded-xl border border-line bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div>
                    <div className="sprix-agent-list-title-row">
                      <h4 className="text-lg font-semibold">{agent.name}</h4>
                      {agent.authStatus === "login_required" && <SoftTag>Claude Code 未登录</SoftTag>}
                      {agent.evaluation && (
                        completedEvaluation ? (
                          <SoftTag tone="neutral" bordered={false}>
                            {getAgentEvaluationStatusLabel(agent.evaluation)}
                          </SoftTag>
                        ) : (
                          <StatusTag status={getAgentEvaluationStatusLabel(agent.evaluation)} />
                        )
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {completedEvaluation ? `综合评分：${scoreText(completedEvaluation.overallScore)} · ` : ""}最近评测时间：{lastEvaluatedAt || "-"}
                    </p>
                    {agent.tags.length > 0 && (
                      <div className="sprix-agent-list-tags mt-3 flex flex-wrap gap-2">
                        {agent.tags.map((tag) => (
                          <SoftTag key={tag} tone="neutral" bordered={false}>
                            {tag}
                          </SoftTag>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="sprix-agent-list-actions flex flex-nowrap gap-2">{renderActions(agent)}</div>
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}

export function MyTasksPage({ openLogin, openAppeal }: UserPageProps) {
  const account = useSprixStore((state) => state.account);
  const myTasks = useSprixStore((state) => state.myTasks);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("全部");
  const [cancelingTaskId, setCancelingTaskId] = useState<string>();
  const rerunTask = useRerunTask();
  const cancelTask = (executionId: string) => {
    Modal.confirm({
      title: "确认终止任务",
      content: "终止后本次执行会进入已终止状态，后续可在任务记录中重新执行。",
      okText: "确认终止",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        setCancelingTaskId(executionId);
        try {
          await cancelRemoteTask(executionId);
          await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
          message.success("任务已终止");
        } catch (error) {
          showRequestError(error, "任务终止失败", "任务终止失败：");
        } finally {
          setCancelingTaskId(undefined);
        }
      }
    });
  };
  const visible = myTasks.filter((task) => {
    if (tab === "全部") return true;
    if (tab === "已完成") return ["验收未通过", "结算中", "已结算"].includes(task.status);
    return task.status === tab;
  });

  if (!account.isLoggedIn) {
    return <EmptyState title="登录后查看我的任务" description="登录后可查看执行记录、验收结果、申诉状态和重新执行入口。" action={<ActionButton onClick={openLogin}>登录 / 注册</ActionButton>} />;
  }

  return (
    <>
      <PageHeader title="我的任务" subtitle="查看任务执行、验收、申诉和结算状态。" />
      <Surface className="p-5">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={["全部", "执行中", "已终止", "已完成"].map((label) => ({ key: label, label }))}
        />
        {visible.length > 0 ? (
          <div className="mt-5 space-y-3">
            {visible.map((task) => (
              <MyTaskRow
                key={task.id}
                task={task}
                canceling={cancelingTaskId === task.id}
                onAppeal={openAppeal}
                onCancel={cancelTask}
                onRerun={rerunTask}
              />
            ))}
          </div>
        ) : (
          <MyTasksEmptyState tab={tab} hasAnyTask={myTasks.length > 0} />
        )}
      </Surface>
    </>
  );
}

function MyTasksEmptyState({ tab, hasAnyTask }: { tab: string; hasAnyTask: boolean }) {
  const isFilteredEmpty = hasAnyTask && tab !== "全部";
  return (
    <div className="mt-5 flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-line bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-6 py-12 text-center">
      <div className="flex size-[92px] items-center justify-center">
        <img className="size-full object-contain" src="/task-metric-tasks-filled.svg" alt="" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-ink">{isFilteredEmpty ? "当前筛选暂无任务" : "暂无任务记录"}</h3>
      <p className="mt-2 max-w-[420px] text-sm leading-7 text-ink-soft">
        {isFilteredEmpty ? "该状态下暂时没有任务记录，可切换到全部查看其它执行进度。" : "接取任务后，执行进度、验收结果、申诉和结算状态会在这里集中展示。"}
      </p>
      {!isFilteredEmpty && (
        <div className="mt-6">
          <SecondaryButton href="/agent/market">去任务市场</SecondaryButton>
        </div>
      )}
    </div>
  );
}

function MyTaskRow({
  task,
  canceling,
  onAppeal,
  onCancel,
  onRerun
}: {
  task: MyTask;
  canceling: boolean;
  onAppeal: (executionId: string) => void;
  onCancel: (executionId: string) => void;
  onRerun: (executionId: string) => void;
}) {
  const actions = getMyTaskActions(task);
  const metaItems = getMyTaskMetaItems(task);
  const showPrimaryStatus = !(task.status === "验收未通过" && shouldShowAppealStatus(task.appealStatus));
  useExecutionDisplayProgress({
    executionId: task.id,
    actualProgress: parseExecutionProgress(task.progress),
    isRunning: task.status === "执行中" || task.status === "待平台审核"
  });
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {showPrimaryStatus && <StatusTag status={task.status} />}
          {shouldShowAppealStatus(task.appealStatus) && <StatusTag status={task.appealStatus} />}
        </div>
        <Link to={`/agent/my-tasks/${task.id}`} className="mt-2 block text-lg font-semibold text-ink no-underline hover:text-accent">
          {task.title}
        </Link>
        <p className="mt-1 text-sm text-ink-soft">
          {metaItems.join(" · ")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.appealLabel && (
          <ActionButton disabled={!actions.appealEnabled} onClick={() => actions.appealEnabled && onAppeal(task.id)}>
            {actions.appealLabel}
          </ActionButton>
        )}
        {actions.terminateLabel && (
          <SecondaryButton danger disabled={!actions.terminateEnabled || canceling} loading={canceling} onClick={() => actions.terminateEnabled && onCancel(task.id)}>
            {actions.terminateLabel}
          </SecondaryButton>
        )}
        {actions.rerun && <SecondaryButton onClick={() => onRerun(task.id)}>重新执行</SecondaryButton>}
        <SecondaryButton href={`/agent/my-tasks/${task.id}`}>{actions.viewLabel}</SecondaryButton>
      </div>
    </div>
  );
}

function InlineEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-4 rounded-lg bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">
      <b className="block text-ink">{title}</b>
      <span>{description}</span>
    </div>
  );
}

export function EarningsPage({ openLogin, openBindAlipay }: UserPageProps) {
  const account = useSprixStore((state) => state.account);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const payouts = useSprixStore((state) => state.payouts);

  useEffect(() => {
    if (!account.isLoggedIn) return;
    let cancelled = false;

    readRemoteWithdrawalAccountState()
      .then((accountPatch) => {
        if (!cancelled) mergeRemoteState({ account: accountPatch });
      })
      .catch(() => {
        // The earnings page can still show payout records when the payout account endpoint is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [account.isLoggedIn, mergeRemoteState]);

  if (!account.isLoggedIn) {
    return (
      <EmptyState
        title="登录后查看打款记录"
        description="登录后可查看打款记录、到账状态和预计到账时间。"
        action={<ActionButton onClick={openLogin}>登录 / 注册</ActionButton>}
      />
    );
  }
  const payoutState = getPayoutRecordState(payouts);
  const accountWarning = getPayoutAccountWarning(account);
  return (
    <>
      <PageHeader title="打款记录" subtitle={getPayoutPageSubtitle()} />
      <Surface className="mb-5 p-6">
        <div className="sprix-payout-summary">
          <div className="sprix-payout-summary-copy">
            <SoftTag tone="neutral" bordered={false}>自动打款</SoftTag>
            <p>{getPayoutAccountText(account)}</p>
            {accountWarning && (
              <p className="sprix-payout-warning">{accountWarning}</p>
            )}
          </div>
          <SecondaryButton
            icon={<ButtonIcon src={BUTTON_ICON_PATHS.alipay} />}
            onClick={() => openBindAlipay()}
          >
            {getPayoutAccountActionLabel(account)}
          </SecondaryButton>
        </div>
        {payoutState.kind === "records" ? (
          <div className="sprix-payout-table-wrap">
            <table className="sprix-payout-table">
              <thead>
                <tr>
                  <th>打款单号</th>
                  <th>打款金额</th>
                  <th>支付宝账户</th>
                  <th>打款状态</th>
                  <th>处理时间</th>
                  <th>预计到账</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((item) => (
                  <tr key={item.withdrawalNo}>
                    <td>
                      <span className="sprix-payout-table-no" title={item.withdrawalNo}>{item.withdrawalNo}</span>
                    </td>
                    <td className="sprix-payout-table-amount">{currency(item.payoutAmount)}</td>
                    <td>
                      <span className="sprix-payout-table-text" title={item.alipayAccount}>{item.alipayAccount}</span>
                    </td>
                    <td><StatusTag status={item.withdrawStatus} /></td>
                    <td>{item.approvedAt || "-"}</td>
                    <td>{item.estimatedArrivalTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <InlineEmpty title={payoutState.title} description={payoutState.description} />
        )}
      </Surface>
    </>
  );
}

export function QualificationPage({ openBindAlipay }: UserPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const account = useSprixStore((state) => state.account);
  const [step, setStep] = useState(getInitialQualificationStep(account));
  const [submitting, setSubmitting] = useState(false);
  const [faceVerificationSession, setFaceVerificationSession] = useState<FaceVerificationSession>();
  const [faceVerificationOpen, setFaceVerificationOpen] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreementSecondsRemaining, setAgreementSecondsRemaining] = useState(10);
  const faceVerificationConfirmingRef = useRef(false);
  const faceVerificationCompletedRef = useRef(false);
  const successAction = getQualificationSuccessAction(location.search);
  const qualificationRows = getQualificationRecordRows(account);
  const payoutAccountActionLabel = hasBoundPayoutAccount(account) ? "查看绑定信息" : "绑定收款支付宝";

  useEffect(() => {
    if (step === 1 && !account.freelancerAgreementSigned) {
      setAgreementOpen(true);
    }
  }, [account.freelancerAgreementSigned, step]);

  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;

    readRemoteWithdrawalAccountState()
      .then((accountPatch) => {
        if (!cancelled) mergeRemoteState({ account: accountPatch });
      })
      .catch(() => {
        // The qualification page can still be used when the payout account endpoint is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [mergeRemoteState, step]);

  useEffect(() => {
    if (!agreementOpen) return;

    setAgreementSecondsRemaining(10);
    const intervalId = window.setInterval(() => {
      setAgreementSecondsRemaining((seconds) => Math.max(seconds - 1, 0));
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [agreementOpen]);

  const applyCompletedFaceVerification = useCallback(
    (accountPatch: Partial<Account>) => {
      if (!accountPatch.realPersonVerified || faceVerificationCompletedRef.current) return false;

      faceVerificationCompletedRef.current = true;
      mergeRemoteState({ account: accountPatch });
      setFaceVerificationOpen(false);
      setStep(1);
      message.success("支付宝人脸核验已完成");
      return true;
    },
    [mergeRemoteState]
  );

  useEffect(() => {
    const certifyId = faceVerificationSession?.certifyId;
    if (!faceVerificationOpen || !faceVerificationSession?.webUrl || !certifyId) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const pollFaceVerification = async () => {
      if (faceVerificationConfirmingRef.current) {
        if (!cancelled) {
          timeoutId = window.setTimeout(pollFaceVerification, FACE_VERIFICATION_POLL_INTERVAL_MS);
        }
        return;
      }

      faceVerificationConfirmingRef.current = true;
      try {
        const accountPatch = await completeRemoteFaceVerification(certifyId);
        if (!cancelled && applyCompletedFaceVerification(accountPatch)) return;
      } catch (error) {
        if (isGlobalAuthError(error)) return;
      } finally {
        faceVerificationConfirmingRef.current = false;
      }

      if (!cancelled && !faceVerificationCompletedRef.current) {
        timeoutId = window.setTimeout(pollFaceVerification, FACE_VERIFICATION_POLL_INTERVAL_MS);
      }
    };

    timeoutId = window.setTimeout(pollFaceVerification, FACE_VERIFICATION_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    applyCompletedFaceVerification,
    faceVerificationOpen,
    faceVerificationSession?.certifyId,
    faceVerificationSession?.webUrl
  ]);

  const openFaceVerification = async (values: FaceVerificationFormValues) => {
    setSubmitting(true);
    try {
      const verificationSession = await initializeRemoteFaceVerification({
        realName: values.realName.trim(),
        idCardNo: values.idCardNo.trim()
      });
      faceVerificationCompletedRef.current = false;
      setFaceVerificationSession(verificationSession);
      setFaceVerificationOpen(true);
    } catch (error) {
      if (!(error instanceof Error) && !isGlobalAuthError(error)) {
        showRequestError(error, "实人认证初始化失败", "实人认证初始化失败：");
        return;
      }
      showRequestError(error, "实人认证初始化失败", "实人认证初始化失败：");
    } finally {
      setSubmitting(false);
    }
  };

  const completeFaceVerification = async () => {
    if (faceVerificationConfirmingRef.current) return;
    const certifyId = faceVerificationSession?.certifyId;
    if (!certifyId) {
      message.info("支付宝认证结果还未同步，请完成扫码后稍等");
      return;
    }

    setSubmitting(true);
    faceVerificationConfirmingRef.current = true;
    try {
      const accountPatch = await completeRemoteFaceVerification(certifyId);
      if (!applyCompletedFaceVerification(accountPatch)) {
        message.info("支付宝认证结果还未同步，请完成扫码后稍等");
      }
    } catch (error) {
      if (!(error instanceof Error) && !isGlobalAuthError(error)) {
        showRequestError(error, "支付宝人脸核验确认失败", "支付宝人脸核验确认失败：");
        return;
      }
      showRequestError(error, "支付宝人脸核验确认失败", "支付宝人脸核验确认失败：");
    } finally {
      faceVerificationConfirmingRef.current = false;
      setSubmitting(false);
    }
  };

  const signAgreement = async () => {
    setSubmitting(true);
    try {
      const accountPatch = await signRemoteFreelancerAgreement();
      mergeRemoteState({ account: accountPatch });
      setAgreementOpen(false);
      setStep(2);
      message.success("接单资格已开通");
    } catch (error) {
      if (!(error instanceof Error) && !isGlobalAuthError(error)) {
        showRequestError(error, "协议签署失败", "协议签署失败：");
        return;
      }
      showRequestError(error, "协议签署失败", "协议签署失败：");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="开通接单资格"
        subtitle="首次接单前需完成支付宝人脸核验，并同意《自由职业者服务框架协议》。"
      />
      <Surface className="mb-5 p-6">
        <Steps className="sprix-qualification-steps" current={step} items={["支付宝人脸核验", "同意服务协议", "开通成功"].map((title) => ({ title }))} />
        <div className="mt-8 rounded-2xl bg-[#fafafa] p-5">
          {step === 0 && (
            <>
              <h3 className="text-lg font-semibold">支付宝人脸核验</h3>
              <p className="mt-2 text-sm leading-7 text-ink-soft">
                用于确认接单服务主体，保障任务执行、收益归属和争议处理准确性。请使用支付宝扫码完成核验，完成后返回本页确认结果。
              </p>
              <Form
                layout="vertical"
                className="mt-5 max-w-xl"
                onFinish={openFaceVerification}
              >
                <Form.Item label="真实姓名" name="realName" rules={[{ required: true, whitespace: true, message: "请输入真实姓名" }]}>
                  <Input autoComplete="name" placeholder="请输入身份证姓名" />
                </Form.Item>
                <Form.Item label="身份证号" name="idCardNo" rules={[{ required: true, whitespace: true, message: "请输入身份证号" }]}>
                  <Input autoComplete="off" placeholder="请输入本人身份证号" />
                </Form.Item>
                <ActionButton
                  htmlType="submit"
                  disabled={submitting}
                  loading={submitting}
                >
                  开始支付宝人脸核验
                </ActionButton>
              </Form>
            </>
          )}
          {step === 1 && (
            <>
              <h3 className="text-lg font-semibold">签署《自由职业者服务框架协议》</h3>
              <ActionButton
                className="mt-4"
                onClick={() => setAgreementOpen(true)}
              >
                阅读并签署协议
              </ActionButton>
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="text-lg font-semibold">接单资格已开通</h3>
              <p className="mt-2 text-sm leading-7 text-ink-soft">
                你已完成支付宝人脸核验和服务协议签署，可以接取平台任务。可提前绑定与认证主体一致的本人支付宝账户用于自动打款。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ActionButton onClick={() => navigate(successAction.path)}>{successAction.label}</ActionButton>
                {successAction.path !== "/agent/market" && <SecondaryButton href="/agent/market">去任务市场</SecondaryButton>}
                <SecondaryButton onClick={() => openBindAlipay()}>{payoutAccountActionLabel}</SecondaryButton>
              </div>
            </>
          )}
        </div>
      </Surface>
      <FaceVerificationModal
        open={faceVerificationOpen}
        session={faceVerificationSession}
        submitting={submitting}
        onClose={() => setFaceVerificationOpen(false)}
        onComplete={completeFaceVerification}
      />
      <FreelancerAgreementModal
        open={agreementOpen}
        secondsRemaining={agreementSecondsRemaining}
        submitting={submitting}
        onClose={() => setAgreementOpen(false)}
        onSign={signAgreement}
      />
      <Surface className="p-6">
        <h3 className="text-lg font-semibold text-ink">接单资格记录</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {qualificationRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-xl bg-[#fafafa] px-4 py-3 text-sm">
              <span className="text-ink-soft">{row.label}</span>
              {row.variant === "text" || row.value === "待后端返回" ? <span className="text-ink-soft">{row.value}</span> : <StatusTag status={row.value} />}
            </div>
          ))}
        </div>
      </Surface>
    </>
  );
}

function FaceVerificationModal({
  open,
  session,
  submitting,
  onClose,
  onComplete
}: {
  open: boolean;
  session?: FaceVerificationSession;
  submitting: boolean;
  onClose: () => void;
  onComplete: () => void | Promise<void>;
}) {
  const qrValue = session?.webUrl;

  return (
    <Modal
      title="实名认证"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <div className="grid justify-items-center gap-5 pb-2 pt-4">
        <p className="m-0 text-center text-sm leading-6 text-ink-soft">请使用支付宝进行扫码完成认证。</p>
        <QrPayloadBox value={qrValue} placeholder="支付宝认证二维码生成中" />
        <ActionButton block disabled={!qrValue || submitting} loading={submitting} onClick={onComplete}>
          完成
        </ActionButton>
      </div>
    </Modal>
  );
}

function FreelancerAgreementModal({
  open,
  secondsRemaining,
  submitting,
  onClose,
  onSign
}: {
  open: boolean;
  secondsRemaining: number;
  submitting: boolean;
  onClose: () => void;
  onSign: () => void;
}) {
  const canSign = secondsRemaining <= 0;

  return (
    <Modal
      title="Sprix AI 自由职业者服务框架协议"
      open={open}
      onCancel={onClose}
      footer={
        <ActionButton
          block
          disabled={!canSign || submitting}
          loading={submitting}
          onClick={onSign}
        >
          {getAgreementSignButtonText(secondsRemaining)}
        </ActionButton>
      }
      width={640}
      className="sprix-agreement-modal sprix-freelancer-agreement-modal"
    >
      <div className="sprix-freelancer-agreement-scroll">
        <AgreementContent compact hideFirstHeading markdown={freelancerAgreementDocument.markdown} />
      </div>
    </Modal>
  );
}

export function QualificationPromptModal({
  taskId,
  open,
  onClose
}: {
  taskId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Modal title="开通接单资格" open={open} onCancel={onClose} footer={null}>
      <p className="text-sm leading-7 text-ink-soft">
        首次接单前，需要先完成支付宝人脸核验，再同意《自由职业者服务框架协议》。
      </p>
      <div className="mt-5 flex gap-2">
        <ActionButton
          onClick={() => {
            onClose();
            navigate(`/agent/qualification${taskId ? `?task=${taskId}` : ""}`);
          }}
        >
          开始开通
        </ActionButton>
        <SecondaryButton onClick={onClose}>暂不接单</SecondaryButton>
      </div>
    </Modal>
  );
}
