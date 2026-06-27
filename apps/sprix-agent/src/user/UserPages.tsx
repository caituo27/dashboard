import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, Progress, Segmented, Steps, message } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Bot, BrainCircuit, Download, PlugZap, Sparkles, UsersRound } from "lucide-react";
import type { Agent, MyTask, Task } from "../types";
import { useSprixStore } from "../store/sprixStore";
import {
  acceptRemoteTask,
  initializeRemoteFaceVerification,
  markRemoteCurrentAgent,
  rerunRemoteTask,
  signRemoteFreelancerAgreement
} from "../services/sprixApi";
import { ActionButton, EmptyState, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface, primitiveIcons } from "../components/Primitives";
import { compactText, currency, scoreText } from "../utils/format";
import { isGlobalAuthError } from "../utils/http";
import { getCurrentExecutionAgent, getUserAdmissionState } from "./admission";
import { getAgentAbilityResult, getAgentAdmissionSummary, getAgentProfileEditAction, getAgentTagLabels, getCurrentAgentScoreMetric } from "./agentResult";
import { getEarningsOverview, getWithdrawalAccountAction, getWithdrawalAccountCard, getWithdrawalEntryAction, getWithdrawalHistoryState, getWithdrawalProgressRefreshAction } from "./earningsView";
import { getExecutionArtifactsState, getExecutionBackendPendingSections, getExecutionOverview, getExecutionRequirementText, getExecutionReviewState } from "./executionDetailView";
import { getFaceVerificationStartState, getQualificationRecordRows } from "./qualificationView";
import { getRecommendationPendingState } from "./recommendationView";
import { getSmartAcceptPendingActions, getSmartAcceptUnavailableRows } from "./smartAcceptView";
import { getEstimatedTokenField } from "./tokenEstimateView";
import { getMyTaskActions, getMyTaskMetaItems, getQualificationSuccessAction } from "./userFlowRules";

const CLIENT_DOWNLOAD_URL = "https://cnb.cool/yztx_qxun/LocalCLIAgentRelease/-/git/raw/main/LocalCLIAgent.pkg";

type UserPageProps = {
  openLogin: () => void;
  openBindAlipay: (afterBind?: () => void) => void;
  openWithdraw: () => void;
  openQualificationPrompt: (taskId?: string) => void;
  openAppeal: (executionId: string) => void;
};

function showRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${error.message}` : fallback);
}

export function LandingPage({ openLogin }: UserPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const tasks = useSprixStore((state) => state.tasks);
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const admission = getUserAdmissionState(account, agents);
  const admissionState = location.state as { admissionReason?: string; openLogin?: boolean } | null;
  const admissionReason = admissionState?.admissionReason;
  const shouldOpenLogin = Boolean(admissionState?.openLogin);
  const handledAdmissionLoginKey = useRef<string>();
  const autoEnteredAgentCenterRef = useRef(false);

  useEffect(() => {
    if (admissionReason) message.warning(admissionReason);
  }, [admissionReason]);

  useEffect(() => {
    if (!shouldOpenLogin || account.isLoggedIn || handledAdmissionLoginKey.current === location.key) return;
    handledAdmissionLoginKey.current = location.key;
    openLogin();
  }, [account.isLoggedIn, location.key, openLogin, shouldOpenLogin]);

  useEffect(() => {
    if (!admission.allowed || autoEnteredAgentCenterRef.current) return;
    autoEnteredAgentCenterRef.current = true;
    navigate("/agent/center");
  }, [admission.allowed, navigate]);

  const currentAgent = admission.allowed ? admission.currentAgent : undefined;
  const publishedTaskCount = tasks.filter((task) => task.taskStatus === "已发布").length;

  const enterAgentCenter = () => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    navigate("/agent/center");
  };

  return (
    <main className="sprix-landing">
      <section className="sprix-landing-inner">
        <div className="sprix-page-hero">
          <div className="sprix-hero-kicker">Sprix AI</div>
          <h1 className="sprix-title sprix-hero-title">让你的 Agent 自动帮你赚钱</h1>
          <p className="sprix-hero-subtitle">
            登录后选择当前执行 Agent，再进入任务市场接取真实后端发布的任务。
          </p>
          <div className="sprix-hero-actions">
            <ActionButton icon={<PlugZap size={16} />} onClick={admission.allowed ? () => navigate("/agent/center") : enterAgentCenter}>
              {account.isLoggedIn ? "进入 Agent 中心" : "登录 / 注册"}
            </ActionButton>
            {!account.isLoggedIn && <SecondaryButton onClick={openLogin}>登录 / 注册</SecondaryButton>}
            {account.isLoggedIn && !admission.allowed && (
              <SecondaryButton href={CLIENT_DOWNLOAD_URL} target="_blank" rel="noreferrer" icon={<Download size={16} />}>
                下载客户端
              </SecondaryButton>
            )}
          </div>
        </div>
        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <MetricCard title="已发布任务" value={publishedTaskCount || "-"} icon={<UsersRound size={19} />} />
          <MetricCard title="Agent 数量" value={agents.length || "-"} icon={<Bot size={19} />} />
          <MetricCard title="当前执行评分" value={getCurrentAgentScoreMetric(currentAgent)} icon={primitiveIcons.check} />
        </div>
        <Surface className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <SoftTag tone={admission.allowed ? "teal" : account.isLoggedIn ? "amber" : "neutral"}>
                {admission.allowed ? "准入完成" : account.isLoggedIn ? "等待设置当前 Agent" : "等待登录"}
              </SoftTag>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                {currentAgent ? `当前执行 Agent：${currentAgent.name}` : "先设置当前执行 Agent，再进入正式功能区"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-soft">
                LocalCLIAgent 首次打开 `/local-agent/claim` 后，前端会为当前登录用户生成 enrollmentToken，并跳转到 8084 后端完成绑定。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {admission.allowed ? (
                <ActionButton onClick={() => navigate("/agent/center")}>进入 Agent 中心</ActionButton>
              ) : (
                <ActionButton onClick={enterAgentCenter}>{account.isLoggedIn ? "进入 Agent 中心" : "登录 / 注册"}</ActionButton>
              )}
            </div>
          </div>
        </Surface>
      </section>
    </main>
  );
}

export function TaskMarketPage(_props: Partial<UserPageProps> = {}) {
  const navigate = useNavigate();
  const tasks = useSprixStore((state) => state.tasks);
  const myTasks = useSprixStore((state) => state.myTasks);
  const agents = useSprixStore((state) => state.agents);
  const currentAgent = getCurrentExecutionAgent(agents);
  const [smartAcceptOpen, setSmartAcceptOpen] = useState(false);
  const availableTasks = useMemo(() => tasks.filter((task) => task.taskStatus === "已发布"), [tasks]);
  const recommendationState = getRecommendationPendingState();

  const handleAccept = (task: Task) => {
    if (!currentAgent) {
      message.warning("请先设置当前执行 Agent");
      navigate("/agent/center");
      return;
    }
    navigate(`/agent/task/${task.id}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="任务市场"
        title="可接取任务"
        subtitle="这里展示真实后端已发布的任务。推荐排序、匹配度和预计 Token 字段接入后，会在对应位置展示。"
        actions={
          <ActionButton icon={<Sparkles size={16} />} onClick={() => setSmartAcceptOpen(true)}>
            智能接单
          </ActionButton>
        }
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
          </div>
          <div className="grid min-w-[280px] gap-2 sm:grid-cols-3">
            {recommendationState.metrics.map((item) => (
              <div key={item.label} className="rounded-2xl bg-[#fafafa] px-4 py-3 text-sm">
                <span className="block text-ink-soft">{item.label}</span>
                <b className="text-ink">{item.value}</b>
              </div>
            ))}
          </div>
        </div>
      </Surface>
      <div className="sprix-grid-auto">
        {availableTasks.map((task) => (
          <TaskCard key={task.id} task={task} onAccept={() => handleAccept(task)} />
        ))}
      </div>
      {availableTasks.length === 0 && <EmptyState title="暂无可接取任务" description="当前后端没有已发布任务，稍后再来查看新的 Agent 任务。" />}
      <SmartAcceptUnavailableModal open={smartAcceptOpen} currentAgent={currentAgent} onClose={() => setSmartAcceptOpen(false)} />
    </>
  );
}

function TaskCard({ task, onAccept }: { task: Task; onAccept: () => void }) {
  const estimatedToken = getEstimatedTokenField();
  return (
    <Surface className="flex min-h-[286px] flex-col p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusTag status={task.taskStatus} />
        <SoftTag tone="neutral">{task.category}</SoftTag>
      </div>
      <Link to={`/agent/task/${task.id}`} className="text-xl font-semibold leading-7 text-ink no-underline hover:text-accent">
        {task.title}
      </Link>
      <p className="mt-3 flex-1 text-sm leading-7 text-ink-soft">{compactText(task.cardSummary, 104)}</p>
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

function SmartAcceptUnavailableModal({ open, currentAgent, onClose }: { open: boolean; currentAgent?: Agent; onClose: () => void }) {
  const rows = getSmartAcceptUnavailableRows(currentAgent);
  const actions = getSmartAcceptPendingActions();
  const icons = [<Bot key="agent" size={18} />, <Sparkles key="threshold" size={18} />, <PlugZap key="status" size={18} />];
  return (
    <Modal title="智能接单" open={open} onCancel={onClose} footer={null} width={640}>
      <div className="sprix-auto-accept-flow">
        {rows.map((row, index) => (
          <div key={row.label}>
            {icons[index]}
            <span>{row.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-[18px] bg-[#fafafa] p-5">
        <p className="text-sm leading-7 text-ink-soft">
          智能接单需要后端提供开关状态、阈值配置、命中任务和自动接单结果。接口接入前，前端不写入本地开关状态，也不会自动接取任务。
        </p>
      </div>
      <div className="mt-4 grid gap-2">
        {actions.map((action) => (
          <div key={action.label} className="flex flex-col gap-2 rounded-2xl border border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-ink-soft">{action.reason}</span>
            <SecondaryButton size="small" disabled={action.disabled}>
              {action.label}
            </SecondaryButton>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <ActionButton onClick={onClose}>关闭</ActionButton>
      </div>
    </Modal>
  );
}

export function TaskDetailPage({ openLogin }: UserPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const task = useSprixStore((state) => state.tasks.find((item) => item.id === id));
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const currentAgent = getCurrentExecutionAgent(agents);
  const executionAgentName = currentAgent?.name;
  const estimatedToken = getEstimatedTokenField();

  if (!task) return <EmptyState title="任务不存在" description="当前任务已不可访问" action={<SecondaryButton href="/agent/market">返回任务市场</SecondaryButton>} />;

  const handleAccept = () => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    if (!executionAgentName) {
      message.warning("请先设置当前执行 Agent");
      navigate("/agent/center");
      return;
    }
    if (task.taskStatus !== "已发布" || task.remainingSlots <= 0) {
      message.warning("当前任务暂不可接单");
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
          message.success("接单成功，任务已进入执行中");
          navigate("/agent/my-tasks");
        } catch (error) {
          showRequestError(error, "接单失败", "接单失败：");
        }
      }
    });
  };

  return (
    <>
      <PageHeader title={task.title} subtitle={`${task.category} · ${task.sourceName} · 奖励 ${currency(task.reward)}`} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Surface className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusTag status={task.taskStatus} />
              <SoftTag>剩余名额 {task.remainingSlots}/{task.totalSlots}</SoftTag>
              <SoftTag tone="neutral">{estimatedToken.label}：{estimatedToken.value}</SoftTag>
            </div>
            <p className="mt-5 text-[15px] leading-8 text-ink-soft">{task.description}</p>
            <p className="mt-3 rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">{estimatedToken.description}</p>
          </Surface>
          <InfoBlock title="详细任务描述" body={task.description} />
          <InfoBlock title="交付标准" body={task.deliverables} />
          <InfoBlock title="验收标准" body={task.acceptanceCriteria} />
        </div>
        <aside className="space-y-5">
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
      <p className="mt-3 text-[15px] leading-8 text-ink-soft">{body}</p>
    </Surface>
  );
}

export function AgentCenterPage({ openLogin }: UserPageProps) {
  const queryClient = useQueryClient();
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const current = getCurrentExecutionAgent(agents);

  const setCurrent = async (agentId: string) => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    try {
      await markRemoteCurrentAgent(agentId);
      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
      message.success("已设置当前执行 Agent");
    } catch (error) {
      showRequestError(error, "设置失败", "设置失败：");
    }
  };

  const refreshAgentEvaluation = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
      message.success("已刷新 Agent 评测结果");
    } catch (error) {
      showRequestError(error, "评测刷新失败", "评测刷新失败：");
    }
  };

  return (
    <>
      <PageHeader
        title="Agent 中心"
        subtitle="选择一个 Agent 作为当前执行 Agent，并查看能力画像。"
        actions={
          <ActionButton
            href={CLIENT_DOWNLOAD_URL}
            icon={<Download size={16} />}
            target="_blank"
            rel="noreferrer"
          >
            下载客户端
          </ActionButton>
        }
      />
      <div className="mb-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <CurrentAgentCard agent={current} />
        <AbilityProfile agent={current} />
      </div>
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard title="Agent 数量" value={agents.length} icon={<PlugZap size={19} />} />
        <MetricCard title="可设置 Agent" value={agents.filter((agent) => agent.role !== "当前执行 Agent").length} icon={primitiveIcons.plug} />
        <MetricCard title="当前执行能力评分" value={getCurrentAgentScoreMetric(current)} icon={primitiveIcons.check} />
      </div>
      <AgentList
        title="Agent 列表"
        agents={agents}
        empty="暂无 Agent"
        renderActions={(agent) =>
          agent.role === "当前执行 Agent" ? (
            <>
              <SecondaryButton disabled>当前执行 Agent</SecondaryButton>
              <ActionButton onClick={refreshAgentEvaluation}>评测</ActionButton>
            </>
          ) : (
            <>
              <ActionButton onClick={() => setCurrent(agent.id)}>设为当前执行 Agent</ActionButton>
              <SecondaryButton onClick={refreshAgentEvaluation}>评测</SecondaryButton>
            </>
          )
        }
      />
    </>
  );
}

function CurrentAgentCard({ agent }: { agent?: Agent }) {
  const summary = agent ? getAgentAdmissionSummary(agent) : undefined;
  const tagLabels = summary ? getAgentTagLabels(summary.tags) : [];
  return (
    <Surface className="min-h-[272px] p-6">
      <h3 className="text-lg font-semibold">当前执行 Agent</h3>
      {summary ? (
        <div className="mt-5 flex gap-4">
          <AgentAvatar name={summary.title} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-2xl font-semibold">{summary.title}</h4>
              <StatusTag status={summary.status} />
            </div>
            <p className="mt-2 text-sm text-ink-soft">{summary.summary}</p>
            <div className="mt-4 grid gap-2 text-sm text-ink-soft md:grid-cols-2">
              <span>综合评分：<b className="text-ink">{summary.score}</b></span>
              <span>当前角色：{summary.role}</span>
              <span className="md:col-span-2">最近评测时间：{summary.lastEvaluatedAt}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tagLabels.map((tag) => (
                <SoftTag key={tag}>{tag}</SoftTag>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-[22px] border border-dashed border-line p-7 text-center">
          <Bot className="mx-auto text-ink-soft" />
          <h4 className="mt-3 text-lg font-semibold">未设置当前执行 Agent</h4>
          <p className="mt-2 text-sm text-ink-soft">在 Agent 列表中选择一个 Agent 设为当前执行 Agent 后，即可执行平台任务。</p>
        </div>
      )}
    </Surface>
  );
}

function AbilityProfile({ agent }: { agent?: Agent }) {
  const ability = getAgentAbilityResult(agent);
  const editAction = getAgentProfileEditAction();
  return (
    <Surface className="min-h-[272px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">能力画像</h3>
        <SecondaryButton disabled={editAction.disabled}>{editAction.label}</SecondaryButton>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{editAction.description}</p>
      {ability.kind === "profile" ? (
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
        <p className="rounded-2xl bg-[#fafafa] p-4 text-sm text-ink-soft">{empty}</p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.id} className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-4">
                <AgentAvatar name={agent.name} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold">{agent.name}</h4>
                    <StatusTag status={agent.status} />
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    综合评分：{scoreText(agent.score)} · 当前角色：{agent.role} · 最近评测时间：{agent.lastEvaluatedAt}
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
          ))}
        </div>
      )}
    </Surface>
  );
}

function AgentAvatar({ name }: { name: string }) {
  return <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-pill text-lg font-semibold text-white">{name.slice(0, 1)}</div>;
}

export function MyTasksPage({ openLogin, openAppeal }: UserPageProps) {
  const queryClient = useQueryClient();
  const account = useSprixStore((state) => state.account);
  const myTasks = useSprixStore((state) => state.myTasks);
  const [tab, setTab] = useState("全部");
  const visible = myTasks.filter((task) => {
    if (tab === "全部") return true;
    if (tab === "已完成") return ["验收未通过", "结算中", "已结算"].includes(task.status);
    return task.status === tab;
  });

  const rerunTask = (executionId: string) => {
    Modal.confirm({
      title: "确认重新执行",
      content: "重新执行会基于当前执行 Agent 创建新的执行记录，原执行记录会保留。",
      okText: "确认重新执行",
      cancelText: "取消",
      onOk: async () => {
        try {
          await rerunRemoteTask(executionId);
          await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
          message.success("已重新生成执行记录");
        } catch (error) {
          showRequestError(error, "重新执行失败", "重新执行失败：");
        }
      }
    });
  };

  if (!account.isLoggedIn) {
    return <EmptyState title="登录后查看我的任务" description="登录后可查看执行记录、验收结果、申诉状态和重新执行入口。" action={<ActionButton onClick={openLogin}>登录 / 注册</ActionButton>} />;
  }

  return (
    <>
      <PageHeader title="我的任务" subtitle="查看任务执行、验收、申诉和结算状态。" />
      <Surface className="p-5">
        <Segmented options={["全部", "执行中", "已终止", "已完成"]} value={tab} onChange={(value) => setTab(String(value))} />
        <div className="mt-5 space-y-3">
          {visible.map((task) => (
            <MyTaskRow key={task.id} task={task} onAppeal={openAppeal} onRerun={rerunTask} />
          ))}
        </div>
      </Surface>
    </>
  );
}

function MyTaskRow({ task, onAppeal, onRerun }: { task: MyTask; onAppeal: (executionId: string) => void; onRerun: (executionId: string) => void }) {
  const actions = getMyTaskActions(task);
  const metaItems = getMyTaskMetaItems(task);
  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag status={task.status} />
          {task.appealStatus && <StatusTag status={task.appealStatus} />}
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
        {actions.terminateLabel && <SecondaryButton disabled={!actions.terminateEnabled}>{actions.terminateLabel}</SecondaryButton>}
        {actions.rerun && <SecondaryButton onClick={() => onRerun(task.id)}>重新执行</SecondaryButton>}
        <SecondaryButton href={`/agent/my-tasks/${task.id}`}>{actions.viewLabel}</SecondaryButton>
      </div>
    </div>
  );
}

export function MyTaskDetailPage() {
  const { id } = useParams();
  const task = useSprixStore((state) => state.myTasks.find((item) => item.id === id));
  const base = useSprixStore((state) => state.tasks.find((item) => item.id === task?.taskId));
  if (!task || !base) return <EmptyState title="执行记录不存在" description="该任务记录暂不可访问" action={<SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>} />;
  const overview = getExecutionOverview(task);
  const requirementText = getExecutionRequirementText(base);
  const review = getExecutionReviewState(task, base);
  const artifacts = getExecutionArtifactsState(base);
  const pendingSections = getExecutionBackendPendingSections();
  return (
    <>
      <PageHeader title={task.title} subtitle={`${task.status} · ${task.agentName} · ${currency(task.reward)}`} actions={<SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        {overview.map((item) => (
          <MetricCard key={item.label} title={item.label} value={item.value} />
        ))}
      </div>
      <Surface className="mb-5 p-6">
        <div className="flex flex-wrap gap-2">
          <StatusTag status={task.status} />
          <SoftTag>{task.currentNode}</SoftTag>
          <SoftTag>{task.progress}</SoftTag>
        </div>
        <Steps
          className="mt-6"
          current={task.status === "执行中" ? 2 : 5}
          items={["已接单", "解析任务", "生成结果", "质量检查", "平台验收", "报酬入账"].map((title) => ({ title }))}
        />
      </Surface>
      <div className="grid gap-5 xl:grid-cols-3">
        <Surface className="p-6">
          <h3 className="text-lg font-semibold text-ink">交付与验收</h3>
          {review.kind === "content" ? (
            <p className="mt-3 whitespace-pre-line text-[15px] leading-8 text-ink-soft">{review.body}</p>
          ) : (
            <InlineEmpty title={review.title} description={review.description} />
          )}
        </Surface>
        <Surface className="p-6">
          <h3 className="text-lg font-semibold text-ink">任务要求</h3>
          {requirementText ? (
            <p className="mt-3 whitespace-pre-line text-[15px] leading-8 text-ink-soft">{requirementText}</p>
          ) : (
            <InlineEmpty title="任务要求待后端返回" description="后端尚未返回任务描述、交付标准或验收标准。" />
          )}
        </Surface>
        <Surface className="p-6">
          <h3 className="text-lg font-semibold text-ink">执行文件</h3>
          {artifacts.kind === "records" ? (
            <div className="mt-4 space-y-2">
              {artifacts.files.map((file) => (
                <div key={file} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
                  {file}
                </div>
              ))}
            </div>
          ) : (
            <InlineEmpty title={artifacts.title} description={artifacts.description} />
          )}
        </Surface>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {pendingSections.map((section) => (
          <Surface key={section.title} className="p-6">
            <InlineEmpty title={section.title} description={section.description} />
          </Surface>
        ))}
      </div>
    </>
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

export function EarningsPage({ openLogin, openBindAlipay, openWithdraw }: UserPageProps) {
  const account = useSprixStore((state) => state.account);
  const withdrawals = useSprixStore((state) => state.withdrawals);
  const settlements = useSprixStore((state) => state.settlements);
  if (!account.isLoggedIn) {
    return <EmptyState title="登录后查看报酬结算" description="登录后可查看结算记录、可提现金额与提现申请状态。" action={<ActionButton onClick={openLogin}>登录 / 注册</ActionButton>} />;
  }
  const handleWithdraw = () => {
    const action = getWithdrawalEntryAction(account);
    if (action.kind === "blocked") {
      message.warning(action.message);
      return;
    }
    if (action.kind === "bind-account") {
      message.warning(action.message);
      openBindAlipay(openWithdraw);
      return;
    }
    openWithdraw();
  };
  const overview = getEarningsOverview(account, settlements, withdrawals);
  const withdrawalAccount = getWithdrawalAccountCard(account);
  const withdrawalHistory = getWithdrawalHistoryState(withdrawals);
  const progressRefresh = getWithdrawalProgressRefreshAction();
  return (
    <>
      <PageHeader title="报酬结算" subtitle="查看结算记录、可提现金额、提现申请和预计到账时间。" actions={<ActionButton onClick={handleWithdraw}>提现</ActionButton>} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard title="可提现金额" value={overview.withdrawable} />
        <MetricCard title="结算中" value={overview.settling} caption="结算明细接口接入后同步刷新" />
        <MetricCard title="提现申请" value={overview.withdrawalCount} caption="历史记录接口待接入" />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Surface className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusTag status={withdrawalAccount.status} />
            {account.alipayBound && <SoftTag>实名一致性：{account.alipayRealNameMatched ? "已通过" : "待确认"}</SoftTag>}
          </div>
          <h3 className="text-lg font-semibold">提现账户</h3>
          <p className="mt-3 text-sm text-ink-soft">{withdrawalAccount.accountText}</p>
          <ActionButton className="mt-5" onClick={() => openBindAlipay()}>
            {withdrawalAccount.actionLabel}
          </ActionButton>
        </Surface>
        <Surface className="p-5">
          <h3 className="text-lg font-semibold">结算明细</h3>
          {settlements.length > 0 ? (
            <div className="mt-4 space-y-3">
              {settlements.slice(0, 5).map((item) => (
                <div key={item.settlementNo} className="grid gap-2 rounded-[18px] border border-line bg-white p-4 text-sm lg:grid-cols-5">
                  <b>{item.settlementNo}</b>
                  <span>{item.taskTitle}</span>
                  <span>{currency(item.netIncome)}</span>
                  <StatusTag status={item.settlementStatus} />
                  <span>{item.createdAt}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">
              C 端结算明细查询接口待接入，当前仅展示可提现金额和本次提现申请返回记录。
            </p>
          )}
        </Surface>
      </div>
      <Surface className="mb-5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">提现申请记录</h3>
          <SecondaryButton disabled={progressRefresh.disabled}>{progressRefresh.label}</SecondaryButton>
        </div>
        <p className="mb-4 rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">{progressRefresh.description}</p>
        {withdrawalHistory.kind === "records" ? (
          <div className="space-y-3">
            {withdrawals.slice(0, 5).map((item) => (
              <div key={item.withdrawalNo} className="grid gap-2 rounded-[18px] border border-line bg-white p-4 text-sm lg:grid-cols-6">
                <b>{item.withdrawalNo}</b>
                <span>{currency(item.applyAmount)}</span>
                <span>{item.alipayAccount}</span>
                <StatusTag status={item.withdrawStatus} />
                <span>{item.appliedAt}</span>
                <span>预计 {item.estimatedArrivalTime}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">{withdrawalHistory.description}</p>
        )}
      </Surface>
    </>
  );
}

export function QualificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const account = useSprixStore((state) => state.account);
  const [checked, setChecked] = useState(false);
  const [signed, setSigned] = useState(false);
  const [step, setStep] = useState(account.qualificationStatus === "已开通" ? 2 : 0);
  const [submitting, setSubmitting] = useState(false);
  const successAction = getQualificationSuccessAction(location.search);
  const qualificationRows = getQualificationRecordRows(account);

  return (
    <>
      <PageHeader title="开通接单资格" subtitle="完成实人认证和服务协议签署后，即可接取平台任务。提现前需另行绑定本人支付宝账户。" />
      <Surface className="mb-5 p-6">
        <Steps current={step} items={["实人认证", "签署服务协议", "开通成功"].map((title) => ({ title }))} />
        <div className="mt-8 rounded-[22px] bg-[#fafafa] p-5">
          {step === 0 && (
            <>
              <h3 className="text-lg font-semibold">实人认证</h3>
              <p className="mt-2 text-sm leading-7 text-ink-soft">用于确认接单服务主体，保障任务执行、收益归属和争议处理准确性。</p>
              <Button className="mt-4" onClick={() => setChecked((value) => !value)}>
                {checked ? "已同意认证信息处理确认" : "同意认证信息处理确认"}
              </Button>
              <ActionButton
                className="ml-2 mt-4"
                disabled={!checked || submitting}
                loading={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const verificationSession = await initializeRemoteFaceVerification();
                    const startState = getFaceVerificationStartState(verificationSession);

                    if (startState.kind === "redirect") {
                      message.info(startState.message);
                      window.location.assign(startState.url);
                      return;
                    }

                    message.warning(startState.message);
                  } catch (error) {
                    showRequestError(error, "实人认证初始化失败", "实人认证初始化失败：");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                开始实人认证
              </ActionButton>
            </>
          )}
          {step === 1 && (
            <>
              <h3 className="text-lg font-semibold">签署《自由职业者服务框架协议》</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
                <li>用户以自由职业者身份接取平台任务</li>
                <li>用户确认任务交付、验收、结算、申诉等平台规则</li>
                <li>用户确认提现账户需与实人认证主体一致</li>
              </ul>
              <Button className="mt-4" onClick={() => setSigned((value) => !value)}>
                {signed ? "已确认签署" : "确认阅读并同意协议"}
              </Button>
              <ActionButton
                className="ml-2 mt-4"
                disabled={!signed || submitting}
                loading={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const accountPatch = await signRemoteFreelancerAgreement();
                    mergeRemoteState({ account: accountPatch });
                    await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
                    setStep(2);
                    message.success("接单资格已开通");
                  } catch (error) {
                    showRequestError(error, "协议签署失败", "协议签署失败：");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                确认签署
              </ActionButton>
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="text-lg font-semibold">接单资格已开通</h3>
              <p className="mt-2 text-sm leading-7 text-ink-soft">你已完成实人认证和服务协议签署，可以接取平台任务。提现前需绑定与认证主体一致的本人支付宝账户。</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ActionButton onClick={() => navigate(successAction.path)}>{successAction.label}</ActionButton>
                {successAction.path !== "/agent/market" && <SecondaryButton href="/agent/market">去任务市场</SecondaryButton>}
                <SecondaryButton href="/agent/withdraw-account">提前设置提现账户</SecondaryButton>
              </div>
            </>
          )}
        </div>
      </Surface>
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

export function WithdrawAccountPage({ openBindAlipay }: UserPageProps) {
  const account = useSprixStore((state) => state.account);
  const withdrawalAccount = getWithdrawalAccountCard(account);
  const withdrawalAction = getWithdrawalAccountAction(account);
  return (
    <>
      <PageHeader title="绑定收款方式" subtitle="绑定与接单实人认证主体一致的支付宝账户。" />
      <Surface className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusTag status={withdrawalAccount.status} />
          {account.alipayBound && <SoftTag>实名一致性：{account.alipayRealNameMatched ? "已通过" : "待确认"}</SoftTag>}
        </div>
        <p className="text-sm text-ink-soft">{withdrawalAccount.accountText}</p>
        {withdrawalAction.kind === "security-pending" && (
          <p className="mt-4 rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">{withdrawalAction.description}</p>
        )}
        <ActionButton className="mt-5" disabled={withdrawalAction.kind !== "bind"} onClick={() => withdrawalAction.kind === "bind" && openBindAlipay()}>
          {withdrawalAction.label}
        </ActionButton>
      </Surface>
    </>
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
      <p className="text-sm leading-7 text-ink-soft">首次接单前，需要完成实人认证并签署《自由职业者服务框架协议》。</p>
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
