import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Form, Input, Modal, Progress, Segmented, Steps, message } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Bot, BrainCircuit, ClipboardList, PlugZap, UsersRound } from "lucide-react";
import type { FaceVerificationSession } from "../apis/sprix";
import type { Account, Agent, AgentEvaluation, MyTask, Task } from "../types";
import { useSprixStore } from "../store/sprixStore";
import {
  acceptRemoteTask,
  cancelRemoteTask,
  completeRemoteFaceVerification,
  type FaceVerificationIdentity,
  initializeRemoteFaceVerification,
  readCurrentRemoteAgent,
  readLatestRemoteAgentEvaluation,
  markRemoteCurrentAgent,
  readRemoteAgents,
  readRemoteAgentEvaluation,
  signRemoteFreelancerAgreement,
  smartAcceptRemoteTask,
  startRemoteAgentEvaluation
} from "../services/sprixApi";
import { ActionButton, EmptyState, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface } from "../components/Primitives";
import { AgentEvaluationProgressModal } from "../components/AgentEvaluationProgressModal";
import { compactText, currency, scoreText } from "../utils/format";
import { isGlobalAuthError } from "../utils/http";
import { getLocalAgentEmptyMessage } from "../home/localAgentInventory";
import { QrPayloadBox } from "../components/QrSession";
import { getAgentAbilityResult, getAgentAdmissionSummary, getAgentTagLabels, hasPendingAgentEvaluation } from "./agentResult";
import { getPayoutAccountText, getPayoutPageSubtitle, getPayoutRecordState } from "./earningsView";
import { getQualificationRecordRows } from "./qualificationView";
import { getRecommendationPanelState, getSmartAcceptMessage } from "./recommendationView";
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

const evaluationDimensionLabels: Record<string, string> = {
  clarity: "表达清晰",
  completeness: "覆盖完整",
  safety: "安全边界",
  maintainability: "改动边界",
  specificity: "项目理解",
  efficiency: "执行效率"
};

type UserPageProps = {
  openLogin: () => void;
  openBindAlipay: (afterBind?: () => void) => void;
  openQualificationPrompt: (taskId?: string) => void;
  openAppeal: (executionId: string) => void;
};

type FaceVerificationFormValues = FaceVerificationIdentity;

const FACE_VERIFICATION_POLL_INTERVAL_MS = 2_000;

function showRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${error.message}` : fallback);
}

const agentEvaluationStatusLabels: Record<AgentEvaluation["status"], string> = {
  running: "能力画像生成中",
  judging: "能力画像评分中",
  completed: "能力画像已生成",
  failed: "测评失败"
};

const agentEvaluationActionLabels: Record<AgentEvaluation["status"], string> = {
  running: "查看进度",
  judging: "查看进度",
  completed: "查看结果",
  failed: "重新评测"
};

function getAgentEvaluationStatusLabel(evaluation?: AgentEvaluation) {
  return evaluation ? agentEvaluationStatusLabels[evaluation.status] : "未测评";
}

function getAgentEvaluationActionLabel(agent: Agent) {
  return agent.evaluation ? agentEvaluationActionLabels[agent.evaluation.status] : "开始评测";
}

export function TaskMarketPage({ openLogin, openQualificationPrompt }: Partial<UserPageProps> = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tasks = useSprixStore((state) => state.tasks);
  const myTasks = useSprixStore((state) => state.myTasks);
  const account = useSprixStore((state) => state.account);
  const [smartAccepting, setSmartAccepting] = useState(false);
  const [smartAcceptMessage, setSmartAcceptMessage] = useState<string>();
  const currentAgent = useSprixStore((state) => state.currentAgent);
  const availableTasks = useMemo(() => tasks.filter((task) => task.taskStatus === "已发布"), [tasks]);
  const recommendationState = useMemo(
    () =>
      getRecommendationPanelState({
        tasks: availableTasks,
        currentAgent,
        isLoggedIn: account.isLoggedIn,
        smartAcceptMessage
      }),
    [account.isLoggedIn, availableTasks, currentAgent, smartAcceptMessage]
  );

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

  const handleSmartAccept = async () => {
    const bestTask = recommendationState.bestTask ?? availableTasks[0];
    if (!bestTask) {
      message.info("暂无可推荐任务");
      return;
    }
    const gate = getTaskAcceptGate(account, currentAgent, bestTask);
    if (gate.kind === "login") {
      openLogin?.();
      return;
    }
    if (gate.kind === "qualification") {
      message.warning(gate.message);
      openQualificationPrompt?.(bestTask.id);
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

    setSmartAccepting(true);
    try {
      const response = await smartAcceptRemoteTask();
      const statusMessage = getSmartAcceptMessage(response.accepted, response.message);
      setSmartAcceptMessage(response.accepted ? "已接单" : "未自动接单");
      if (response.accepted) {
        await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
        message.success(statusMessage);
        navigate("/agent/my-tasks");
        return;
      }
      message.info(statusMessage);
    } catch (error) {
      showRequestError(error, "智能接单失败", "智能接单失败：");
    } finally {
      setSmartAccepting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="任务市场"
        title="可接取任务"
        subtitle="浏览当前可接取的任务，选择适合你的 Agent 执行的工作，并持续跟踪执行进度与收益。"
      />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard title="已发布任务" value={availableTasks.length || "-"} />
        <MetricCard title="当前执行 Agent" value={currentAgent?.name ?? "-"} icon={<Bot size={19} />} />
        <MetricCard title="我的任务" value={myTasks.length || "-"} icon={<UsersRound size={19} />} />
      </div>
      <Surface className="mb-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">{recommendationState.title}</h2>
            <p className="mt-2 text-sm leading-7 text-ink-soft">{recommendationState.description}</p>
            {recommendationState.bestReason && <p className="mt-2 text-sm leading-7 text-ink-soft">{recommendationState.bestReason}</p>}
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="grid min-w-[280px] gap-2 sm:grid-cols-3">
              {recommendationState.metrics.map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#fafafa] px-4 py-3 text-sm">
                  <span className="block text-ink-soft">{item.label}</span>
                  <b className="text-ink">{item.value}</b>
                </div>
              ))}
            </div>
            <ActionButton loading={smartAccepting} icon={<PlugZap size={16} />} onClick={handleSmartAccept}>
              智能接单
            </ActionButton>
          </div>
        </div>
      </Surface>
      <div className="sprix-grid-auto">
        {availableTasks.map((task) => (
          <TaskCard key={task.id} task={task} onAccept={() => handleAccept(task)} />
        ))}
      </div>
      {availableTasks.length === 0 && <EmptyState title="暂无可接取任务" description="当前暂时没有新的任务，稍后再来查看适合 Agent 执行的工作。" />}
    </>
  );
}

function TaskCard({ task, onAccept }: { task: Task; onAccept: () => void }) {
  const estimatedToken = getEstimatedTokenField();
  return (
    <Surface className="flex min-h-[332px] flex-col p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusTag status={task.taskStatus} />
        <SoftTag tone="neutral">{task.category}</SoftTag>
        {task.agentMatchScore > 0 && <SoftTag>匹配 {task.agentMatchScore}%</SoftTag>}
      </div>
      <Link to={`/agent/task/${task.id}`} className="text-xl font-semibold leading-7 text-ink no-underline hover:text-accent">
        {task.title}
      </Link>
      <p className="mt-3 flex-1 text-sm leading-7 text-ink-soft">{compactText(task.cardSummary, 104)}</p>
      {task.recommendedReason && <p className="mt-3 rounded-2xl bg-[#fafafa] p-3 text-sm leading-6 text-ink-soft">{task.recommendedReason}</p>}
      <div className="mt-4 grid gap-2 text-sm text-ink-soft">
        <span>奖励：<b className="text-ink">{currency(task.reward)}</b></span>
        <span>剩余名额：{task.remainingSlots}/{task.totalSlots}</span>
        <span>{estimatedToken.label}：{estimatedToken.value}</span>
        <span>来源：{task.sourceName}</span>
      </div>
      <div className="mt-5 flex gap-2">
        <ActionButton onClick={onAccept}>接单</ActionButton>
        <SecondaryButton href={`/agent/task/${task.id}`}>查看详情</SecondaryButton>
      </div>
    </Surface>
  );
}

export function TaskDetailPage({ openLogin, openQualificationPrompt }: UserPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const task = useSprixStore((state) => state.tasks.find((item) => item.id === id));
  const account = useSprixStore((state) => state.account);
  const currentAgent = useSprixStore((state) => state.currentAgent);
  const executionAgentName = currentAgent?.name;
  const estimatedToken = getEstimatedTokenField();

  if (!task) return <EmptyState title="任务不存在" description="当前任务已不可访问" action={<SecondaryButton href="/agent/market">返回任务市场</SecondaryButton>} />;

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

  return (
    <>
      <div className="sprix-detail-back-row">
        <SecondaryButton href="/agent/market">返回任务列表</SecondaryButton>
      </div>
      <PageHeader
        title={task.title}
        titleClassName="sprix-task-detail-title"
        subtitle={
          <>
            {task.category} · {task.sourceName} · 奖励 <span className="sprix-number-text">{currency(task.reward)}</span>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Surface className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusTag status={task.taskStatus} />
              <SoftTag>剩余名额 {task.remainingSlots}/{task.totalSlots}</SoftTag>
              <SoftTag tone="neutral">{estimatedToken.label}：{estimatedToken.value}</SoftTag>
            </div>
            <p className="sprix-detail-prose mt-5 text-[15px]">{task.description}</p>
            <p className="sprix-detail-prose mt-3 rounded-2xl bg-[#fafafa] p-4">{estimatedToken.description}</p>
          </Surface>
          <InfoBlock title="详细任务描述" body={task.description} />
          <InfoBlock title="交付标准" body={task.deliverables} />
          <InfoBlock title="验收标准" body={task.acceptanceCriteria} />
        </div>
        <aside className="space-y-5">
          {task.agentMatchScore > 0 && (
            <Surface className="p-5">
              <h3 className="text-lg font-semibold">匹配推荐</h3>
              <div className="mt-4 space-y-3 text-sm text-ink-soft">
                <p className="flex items-center justify-between gap-3">匹配度：<b className="text-ink">{task.agentMatchScore}%</b></p>
                <p>推荐团队：<b className="text-ink">{task.suggestedTeam || "当前执行 Agent"}</b></p>
                <p>{task.recommendedReason}</p>
                {task.matchAnalysis && <p>{task.matchAnalysis}</p>}
              </div>
            </Surface>
          )}
          <Surface className="p-5">
            <h3 className="text-lg font-semibold">任务来源信息</h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">{task.sourceName}</p>
            <p className="text-sm text-ink-soft">来源类型：{task.sourceType}</p>
          </Surface>
          <Surface className="p-5">
            <h3 className="text-lg font-semibold">接单确认</h3>
            <div className="mt-4 space-y-3 text-sm text-ink-soft">
              <p>当前执行 Agent：<b className="text-ink">{executionAgentName ?? "未设置"}</b></p>
              <p>当前连接状态：{currentAgent ? "后端已连接" : "未连接"}</p>
              <p>接单后将立即进入执行中。</p>
            </div>
            <ActionButton className="mt-5 w-full" onClick={handleAccept}>
              接单
            </ActionButton>
          </Surface>
        </aside>
      </div>
    </>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <Surface className="p-6">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="sprix-detail-prose mt-3 text-[15px]">{body}</p>
    </Surface>
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
  const [evaluationAgent, setEvaluationAgent] = useState<Agent | null>(null);
  const [evaluation, setEvaluation] = useState<AgentEvaluation | undefined>();
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<AgentEvaluation | undefined>();
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string>();
  const currentWithEvaluation = currentEvaluation && current ? { ...current, evaluation: currentEvaluation, score: currentEvaluation.result.overallScore ?? current.score } : current;
  const agentsWithCurrentEvaluation =
    currentEvaluation && current
      ? agents.map((agent) =>
          agent.id === current.id ? { ...agent, evaluation: currentEvaluation, score: currentEvaluation.result.overallScore ?? agent.score } : agent
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

  const setCurrent = async (agent: Agent) => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
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
    if (setCurrentAfterCompletion) {
      autoSetCurrentAgentIdRef.current = agent.id;
    }
    setEvaluationAgent(agent);
    setEvaluation(undefined);
    setEvaluationModalOpen(true);
    setEvaluationError(undefined);
    setEvaluationLoading(true);
    try {
      let latestEvaluation: AgentEvaluation | undefined;
      try {
        latestEvaluation = await readLatestRemoteAgentEvaluation(agent.id);
      } catch (error) {
        if (!isAgentEvaluationNotFound(error)) {
          throw error;
        }
      }
      const shouldStartEvaluation = forceStart || !hasReusableEvaluation(latestEvaluation);
      const nextEvaluation = !forceStart && hasReusableEvaluation(latestEvaluation)
        ? latestEvaluation
        : await startRemoteAgentEvaluation(agent.id);
      setEvaluation(nextEvaluation);
      if (current?.id === agent.id) {
        setCurrentEvaluation(nextEvaluation);
      }
      await refreshAgents();
      await markCurrentAfterCompletedEvaluation(agent, nextEvaluation);
      if (shouldStartEvaluation && isEvaluationActive(nextEvaluation.status)) {
        message.success("评测已开始");
      }
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : "评测操作失败");
      showRequestError(error, "评测操作失败", "评测操作失败：");
    } finally {
      setEvaluationLoading(false);
    }
  };

  useEffect(() => {
    if (!evaluationAgent || !evaluation || isEvaluationTerminal(evaluation.status)) return;

    let cancelled = false;
    const poll = window.setInterval(async () => {
      try {
        const next = await readRemoteAgentEvaluation(evaluationAgent.id, evaluation.evaluationId);
        if (cancelled) return;
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
      } catch (error) {
        if (cancelled) return;
        setEvaluationError(error instanceof Error ? error.message : "评测状态获取失败");
        window.clearInterval(poll);
      }
    }, 1_500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [current?.id, evaluation, evaluationAgent, refreshAgents]);

  useEffect(() => {
    if (!account.isLoggedIn || !current?.id || current.evaluation?.result?.status === "completed") {
      setCurrentEvaluation(undefined);
      return;
    }

    let cancelled = false;
    readLatestRemoteAgentEvaluation(current.id)
      .then((latest) => {
        if (cancelled) return;
        setCurrentEvaluation(latest);
        if (!isEvaluationTerminal(latest.status)) {
          setEvaluationAgent(current);
          setEvaluation(latest);
        }
      })
      .catch(() => {
        if (!cancelled) setCurrentEvaluation(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [account.isLoggedIn, current?.id, current?.lastEvaluatedAt, current?.evaluation?.result?.status]);

  const closeEvaluation = () => {
    setEvaluationModalOpen(false);
    if (!evaluation || isEvaluationTerminal(evaluation.status)) {
      setEvaluationAgent(null);
      setEvaluation(undefined);
    }
    setEvaluationError(undefined);
    setEvaluationLoading(false);
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
          const canRestartEvaluation = agent.evaluation && isCompletedAgentEvaluation(agent.evaluation);
          return agent.role === "当前执行 Agent" ? (
            <>
              <SecondaryButton disabled>当前执行 Agent</SecondaryButton>
              <ActionButton onClick={() => openAgentEvaluation(agent)}>{getAgentEvaluationActionLabel(agent)}</ActionButton>
              {canRestartEvaluation && <SecondaryButton onClick={() => openAgentEvaluation(agent, { forceStart: true })}>重新评测</SecondaryButton>}
            </>
          ) : (
            <>
              <ActionButton onClick={() => setCurrent(agent)}>设为当前执行 Agent</ActionButton>
              <SecondaryButton onClick={() => openAgentEvaluation(agent)}>{getAgentEvaluationActionLabel(agent)}</SecondaryButton>
              {canRestartEvaluation && <SecondaryButton onClick={() => openAgentEvaluation(agent, { forceStart: true })}>重新评测</SecondaryButton>}
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
  return error instanceof Error && error.message === "Agent evaluation not found";
}

function hasReusableEvaluation(evaluation: AgentEvaluation | undefined): evaluation is AgentEvaluation {
  return Boolean(evaluation && evaluation.status !== "failed");
}

function evaluationDimensions(result: AgentEvaluation["result"]) {
  return Object.entries(evaluationDimensionLabels).map(([key, label]) => ({
    key,
    label,
    score: Number(result.dimensions[key]?.score) || 0,
    comment: result.dimensions[key]?.comment
  }));
}

function EvaluationRadar({ result }: { result: AgentEvaluation["result"] }) {
  const dimensions = evaluationDimensions(result);
  const size = 220;
  const center = size / 2;
  const radius = 76;
  const rings = [20, 40, 60, 80, 100];
  const pointFor = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
    const nextRadius = radius * (value / 100);
    return `${center + Math.cos(angle) * nextRadius},${center + Math.sin(angle) * nextRadius}`;
  };
  const polygon = dimensions.map((item, index) => pointFor(index, item.score)).join(" ");

  return (
    <svg className="sprix-evaluation-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="六维能力雷达图">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={dimensions.map((_, index) => pointFor(index, ring)).join(" ")}
          className="sprix-evaluation-radar-ring"
        />
      ))}
      {dimensions.map((item, index) => {
        const axisEnd = pointFor(index, 100);
        const [x, y] = axisEnd.split(",").map(Number);
        const labelX = center + (x - center) * 1.18;
        const labelY = center + (y - center) * 1.18;
        return (
          <g key={item.key}>
            <line x1={center} y1={center} x2={x} y2={y} className="sprix-evaluation-radar-axis" />
            <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="sprix-evaluation-radar-label">
              {item.label}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} className="sprix-evaluation-radar-area" />
      <polyline points={`${polygon} ${polygon.split(" ")[0]}`} className="sprix-evaluation-radar-line" />
      {dimensions.map((item, index) => {
        const [x, y] = pointFor(index, item.score).split(",").map(Number);
        return <circle key={item.key} cx={x} cy={y} r="3.8" className="sprix-evaluation-radar-dot" />;
      })}
    </svg>
  );
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
                    <SoftTag key={tag}>{tag}</SoftTag>
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
            <AbilityProfile agent={agent} embedded showScore={false} />
          </div>
        </>
      ) : (
        <div className="sprix-current-agent-empty rounded-[22px] border border-dashed border-line p-7 text-center">
          <Bot className="mx-auto text-ink-soft" />
          <h4 className="mt-3 text-lg font-semibold">未设置当前执行 Agent</h4>
          <p className="mt-2 text-sm text-ink-soft">在 Agent 列表中选择一个 Agent 设为当前执行 Agent 后，即可执行平台任务。</p>
        </div>
      )}
    </Surface>
  );
}

function AbilityProfile({ agent, embedded = false, showScore = true }: { agent?: Agent; embedded?: boolean; showScore?: boolean }) {
  const ability = getAgentAbilityResult(agent);
  const summary = agent ? getAgentAdmissionSummary(agent) : undefined;
  const evaluationResult = agent?.evaluation?.result?.status === "completed" ? agent.evaluation.result : undefined;
  const dimensions = evaluationResult ? evaluationDimensions(evaluationResult) : [];
  const careerRoleName = evaluationResult?.careerProfile?.roleName?.trim();
  const careerSummary = careerRoleName ? evaluationResult?.summary?.trim() : "";
  const isAbilityPending = !evaluationResult && hasPendingAgentEvaluation(agent);
  const content = (
    <>
      {careerRoleName && (
        <div className="sprix-ability-career-block">
          <div className="sprix-ability-career-panel">
            <span>职位定位：</span>
            <strong>{careerRoleName}</strong>
          </div>
          {careerSummary && <p className="sprix-ability-career-summary">{careerSummary}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">能力画像</h3>
        {agent?.evaluation && <StatusTag status={getAgentEvaluationStatusLabel(agent.evaluation)} />}
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-soft">最近评测：{summary?.lastEvaluatedAt ?? "-"}</p>
      {evaluationResult ? (
        <div className={`sprix-ability-profile mt-5 ${showScore ? "" : "is-bars-only"}`}>
          {showScore && (
            <div className="sprix-ability-score">
              <strong>{evaluationResult.overallScore ?? "-"}</strong>
              <span>综合评分</span>
              <EvaluationRadar result={evaluationResult} />
            </div>
          )}
          <div className="sprix-ability-detail">
            <div className="sprix-ability-bars">
              {dimensions.map((dimension, index) => (
                <div key={dimension.key} className="sprix-ability-dimension">
                  <div className="sprix-ability-dimension-row">
                    <span>{dimension.label}</span>
                    <div>
                      <span style={{ width: `${dimension.score}%`, transitionDelay: `${index * 60}ms` }} />
                    </div>
                    <strong>{dimension.score}</strong>
                  </div>
                  {dimension.comment && <p>{dimension.comment}</p>}
                </div>
              ))}
            </div>
            {evaluationResult.summary && !careerRoleName && <p className="sprix-ability-summary">{evaluationResult.summary}</p>}
            {evaluationResult.improvements.length > 0 && (
              <div className="sprix-ability-improvements">
                {evaluationResult.improvements.map((item) => (
                  <SoftTag key={item} tone="amber">
                    {item}
                  </SoftTag>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : isAbilityPending ? (
        <div className="sprix-ability-pending mt-5">
          <div className="sprix-ability-pending-head">
            <span>能力画像生成中</span>
          </div>
          <div className="sprix-ability-pending-bars">
            {Object.values(evaluationDimensionLabels).map((label, index) => (
              <div key={label} className="sprix-ability-pending-row">
                <span>{label}</span>
                <div>
                  <i style={{ animationDelay: `${index * 90}ms` }} />
                </div>
                <em>待生成</em>
              </div>
            ))}
          </div>
        </div>
      ) : ability.kind === "profile" ? (
        <div className="mt-5 space-y-4">
          {ability.rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-ink-soft">{row.label}</span>
                <span className="font-semibold text-ink">{row.value}</span>
              </div>
              <Progress percent={row.value} showInfo={false} strokeColor="#0f766e" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[22px] border border-dashed border-line p-7 text-center">
          <BrainCircuit className="mx-auto text-ink-soft" />
          <h4 className="mt-3 text-lg font-semibold">{ability.title}</h4>
          <p className="mt-2 text-sm text-ink-soft">{ability.description}</p>
        </div>
      )}
    </>
  );

  return embedded ? <div className="sprix-embedded-ability-profile">{content}</div> : <Surface className="p-6">{content}</Surface>;
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
        <p className="rounded-2xl bg-[#fafafa] p-4 text-sm text-ink-soft">{empty}</p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const completedEvaluation = agent.evaluation?.result?.status === "completed" ? agent.evaluation.result : undefined;
            return (
              <div key={agent.id} className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold">{agent.name}</h4>
                      <StatusTag status={agent.status} />
                      {agent.evaluation && <StatusTag status={getAgentEvaluationStatusLabel(agent.evaluation)} />}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {completedEvaluation ? `综合评分：${scoreText(completedEvaluation.overallScore)} · ` : ""}当前角色：{agent.role} · 最近评测时间：{agent.lastEvaluatedAt}
                    </p>
                    {agent.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {agent.tags.map((tag) => (
                          <SoftTag key={tag}>{tag}</SoftTag>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">{renderActions(agent)}</div>
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
        <Segmented options={["全部", "执行中", "已终止", "已完成"]} value={tab} onChange={(value) => setTab(String(value))} />
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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent shadow-[0_14px_32px_rgba(47,128,237,0.14)]">
        <ClipboardList size={30} strokeWidth={1.8} />
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
  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag status={task.status} />
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
    <div className="mt-4 rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">
      <b className="block text-ink">{title}</b>
      <span>{description}</span>
    </div>
  );
}

export function EarningsPage({ openLogin, openBindAlipay }: UserPageProps) {
  const account = useSprixStore((state) => state.account);
  const payouts = useSprixStore((state) => state.payouts);
  if (!account.isLoggedIn) {
    return <EmptyState title="登录后查看打款记录" description="登录后可查看打款记录、到账状态和预计到账时间。" action={<ActionButton onClick={openLogin}>登录 / 注册</ActionButton>} />;
  }
  const payoutState = getPayoutRecordState(payouts);
  return (
    <>
      <PageHeader title="打款记录" subtitle={getPayoutPageSubtitle()} />
      <Surface className="mb-5 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <SoftTag>自动打款</SoftTag>
            <p className="mt-3 text-sm text-ink-soft">{getPayoutAccountText(account)}</p>
          </div>
          <SecondaryButton onClick={() => openBindAlipay()}>绑定支付宝</SecondaryButton>
        </div>
        {payoutState.kind === "records" ? (
          <div className="space-y-3">
            {payouts.slice(0, 8).map((item) => (
              <div key={item.withdrawalNo} className="grid gap-2 rounded-[18px] border border-line bg-white p-4 text-sm lg:grid-cols-6">
                <b>{item.withdrawalNo}</b>
                <span>{currency(item.payoutAmount)}</span>
                <span>{item.alipayAccount}</span>
                <StatusTag status={item.withdrawStatus} />
                <span>{item.approvedAt}</span>
                <span>预计 {item.estimatedArrivalTime}</span>
              </div>
            ))}
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

  useEffect(() => {
    if (step === 1 && !account.freelancerAgreementSigned) {
      setAgreementOpen(true);
    }
  }, [account.freelancerAgreementSigned, step]);

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
    if (!faceVerificationOpen || !faceVerificationSession?.webUrl) return;

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
        const accountPatch = await completeRemoteFaceVerification();
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
  }, [applyCompletedFaceVerification, faceVerificationOpen, faceVerificationSession?.webUrl]);

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

    setSubmitting(true);
    faceVerificationConfirmingRef.current = true;
    try {
      const accountPatch = await completeRemoteFaceVerification();
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
        <Steps current={step} items={["支付宝人脸核验", "同意服务协议", "开通成功"].map((title) => ({ title }))} />
        <div className="mt-8 rounded-[22px] bg-[#fafafa] p-5">
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
                <SecondaryButton onClick={() => openBindAlipay()}>绑定收款支付宝</SecondaryButton>
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
        <p className="mt-2 text-sm leading-7 text-ink-soft">当前只展示账户接口已返回的资格状态。认证主体、认证时间、协议版本和签署时间等待后端记录接口。</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {qualificationRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3 text-sm">
              <span className="text-ink-soft">{row.label}</span>
              {row.value === "待后端返回" ? <span className="text-ink-soft">{row.value}</span> : <StatusTag status={row.value} />}
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

const placeholderAgreementSections = [
  {
    title: "一、服务身份",
    body: "用户以自由职业者身份在 Sprix 平台接取任务，并确认任务执行、交付、验收和结算行为均由本人授权的 Agent 或本人操作完成。"
  },
  {
    title: "二、任务交付与验收",
    body: "用户应根据任务说明、交付标准和验收标准完成交付。平台可依据任务要求进行自动或人工验收，并展示验收结果。"
  },
  {
    title: "三、收益结算",
    body: "任务验收通过后，平台按页面展示的任务奖励进入结算流程。提现、打款、实名一致性校验和异常处理以后续平台规则及真实接口结果为准。"
  },
  {
    title: "四、争议与申诉",
    body: "如用户对验收结果、结算状态或任务处理存在异议，可按平台提供的申诉入口提交说明，平台将根据任务记录和交付证据处理。"
  },
  {
    title: "五、占位说明",
    body: "当前展示的是协议占位摘要；签署动作已接后端接口，正式协议全文、版本号、签署记录和配置来源将在后端或法务文本完成后替换。"
  }
];

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
      title="自由职业者服务框架协议"
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      styles={{ body: { maxHeight: "calc(100dvh - 160px)", overflowY: "auto" } }}
    >
      <div className="space-y-4 text-sm leading-7 text-ink-soft">
        <section className="rounded-2xl bg-[#fff7e8] px-4 py-3">
          <h3 className="font-semibold text-ink">正式协议全文待接入</h3>
          <p>以下为占位协议内容。请阅读满 10 秒后签署；签署动作会提交后端，后续将替换为正式协议全文。</p>
        </section>
        {placeholderAgreementSections.map((section) => (
          <section key={section.title} className="rounded-2xl bg-[#fafafa] px-4 py-3">
            <h3 className="font-semibold text-ink">{section.title}</h3>
            <p className="mt-1">{section.body}</p>
          </section>
        ))}
        <ActionButton
          block
          disabled={!canSign || submitting}
          loading={submitting}
          onClick={onSign}
        >
          {getAgreementSignButtonText(secondsRemaining)}
        </ActionButton>
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
