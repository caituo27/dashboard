import { useMemo, useState } from "react";
import { Button, Modal, Progress, Segmented, Steps, message } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bot, BrainCircuit, ChartNoAxesColumnIncreasing, CircleDollarSign, Download, PlugZap, Radar, Sparkles, UsersRound } from "lucide-react";
import type { Agent, Task } from "../types";
import { useSprixStore } from "../store/sprixStore";
import {
  acceptRemoteTask,
  completeRemoteRealPersonVerification,
  connectRemoteAgent,
  disconnectRemoteAgent,
  initializeRemoteFaceVerification,
  markRemoteCurrentAgent,
  rerunRemoteTask,
  signRemoteFreelancerAgreement
} from "../services/sprixApi";
import { ActionButton, EmptyState, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface, primitiveIcons } from "../components/Primitives";
import { compactText, currency, scoreText } from "../utils/format";
import {
  buildLocalAgentAssessment,
  buildRecommendedTasks,
  getDemoAutoAcceptResult,
  localAgentOptions,
  readLocalAgentAssessment,
  saveLocalAgentAssessment,
  type LocalAgentAssessment,
  type LocalAgentId,
  type LocalAgentOption,
  type RecommendedTask
} from "./cSideExperience";

const CLIENT_DOWNLOAD_URL = "https://cnb.cool/yztx_qxun/LocalCLIAgentRelease/-/git/raw/main/LocalCLIAgent.pkg";

type UserPageProps = {
  openLogin: () => void;
  openBindAlipay: (afterBind?: () => void) => void;
  openWithdraw: () => void;
  openQualificationPrompt: (taskId?: string) => void;
  openAppeal: (executionId: string) => void;
};

export function TaskMarketPage({ openLogin, openQualificationPrompt }: UserPageProps) {
  const navigate = useNavigate();
  const tasks = useSprixStore((state) => state.tasks);
  const myTasks = useSprixStore((state) => state.myTasks);
  const account = useSprixStore((state) => state.account);
  const [connectOpen, setConnectOpen] = useState(false);
  const [autoAcceptOpen, setAutoAcceptOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<LocalAgentId>("codex");
  const [assessment, setAssessment] = useState<LocalAgentAssessment | null>(() => readLocalAgentAssessment());
  const [assessing, setAssessing] = useState(false);
  const recommendedTasks = useMemo(() => buildRecommendedTasks(tasks), [tasks]);
  const activeAssessment = account.isLoggedIn ? assessment : null;

  const handleAccept = (task: Task) => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    if (!activeAssessment) {
      message.warning("请先连接本地 Agent 并完成评测");
      setConnectOpen(true);
      return;
    }
    if (account.qualificationStatus !== "已开通") {
      openQualificationPrompt(task.id);
      return;
    }
    navigate(`/agent/task/${task.id}`);
  };

  const handleOpenConnect = () => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    setConnectOpen(true);
  };

  const handleAssessAgent = (agentId: LocalAgentId) => {
    setSelectedAgentId(agentId);
    setAssessing(true);
    window.setTimeout(() => {
      const nextAssessment = buildLocalAgentAssessment(agentId);
      setAssessment(nextAssessment);
      saveLocalAgentAssessment(nextAssessment);
      setAssessing(false);
      setConnectOpen(false);
      message.success("本地 Agent 已连接，画像评测完成");
    }, 720);
  };

  const handleOpenAutoAccept = () => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    if (!activeAssessment) {
      message.info("先连接本地 Agent 后再查看自动接单演示");
      setConnectOpen(true);
      return;
    }
    setAutoAcceptOpen(true);
  };

  return (
    <>
      <PageHeader
        eyebrow="Sprix C 端首页"
        title="连接本地 Agent，让它先替你看任务"
        subtitle="登录后连接当前电脑里的 AI Agent，平台用一个画像问题完成快速评测，再把更适合你的任务排到前面。"
        actions={
          <>
            <ActionButton icon={<PlugZap size={16} />} onClick={handleOpenConnect}>
              {activeAssessment ? `已连接 ${activeAssessment.agentName}` : account.isLoggedIn ? "连接本地 Agent" : "登录后连接 Agent"}
            </ActionButton>
            <SecondaryButton icon={<Sparkles size={16} />} onClick={handleOpenAutoAccept}>
              自动接单演示
            </SecondaryButton>
          </>
        }
      />
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="推荐任务" value={recommendedTasks.length} icon={<ChartNoAxesColumnIncreasing size={19} />} />
        <MetricCard title="本地 Agent" value={localAgentOptions.length} icon={<Bot size={19} />} />
        <MetricCard title="画像评分" value={activeAssessment ? `${activeAssessment.score}/100` : "-"} icon={<BrainCircuit size={19} />} />
        <MetricCard title="我的任务" value={myTasks.length} icon={<UsersRound size={19} />} />
      </div>
      <div className="sprix-home-workbench mb-5">
        <Surface className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <SoftTag>已检测到</SoftTag>
              <h2 className="mt-3 text-2xl font-semibold text-ink">本机可连接 Agent</h2>
            </div>
            <SecondaryButton icon={<Radar size={16} />} onClick={handleOpenConnect}>
              重新检测
            </SecondaryButton>
          </div>
          <div className="space-y-3">
            {localAgentOptions.map((agent) => (
              <LocalAgentCard
                key={agent.id}
                agent={agent}
                selected={selectedAgentId === agent.id}
                connected={activeAssessment?.agentId === agent.id}
                onConnect={() => {
                  setSelectedAgentId(agent.id);
                  handleOpenConnect();
                }}
              />
            ))}
          </div>
        </Surface>
        <Surface className="sprix-assessment-panel p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <SoftTag tone={activeAssessment ? "teal" : "amber"}>{activeAssessment ? "评测完成" : "等待评测"}</SoftTag>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Agent 对你的职业画像</h2>
            </div>
            <div className="sprix-score-orb">{activeAssessment?.score ?? "--"}</div>
          </div>
          {activeAssessment ? (
            <>
              <p className="text-sm font-semibold text-ink-soft">评测问题：{activeAssessment.question}</p>
              <h3 className="mt-3 text-3xl font-semibold text-ink">{activeAssessment.profileTitle}</h3>
              <p className="mt-3 text-sm leading-7 text-ink-soft">{activeAssessment.profileSummary}</p>
              <div className="mt-5 space-y-4">
                {activeAssessment.dimensions.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-ink-soft">{item.label}</span>
                      <span className="font-semibold text-ink">{item.value}</span>
                    </div>
                    <Progress percent={item.value} showInfo={false} strokeColor="#111111" />
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-[18px] bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">{activeAssessment.recommendedDirection}</p>
            </>
          ) : (
            <div className="sprix-empty-assessment">
              <BrainCircuit size={32} />
              <h3>连接后生成 76 分画像</h3>
              <p>本版先用一个问题快速跑通演示链路，后续可替换成真实 Agent 评测。</p>
              <ActionButton icon={<PlugZap size={16} />} onClick={handleOpenConnect}>
                连接并评测
              </ActionButton>
            </div>
          )}
        </Surface>
      </div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SoftTag>为你推荐</SoftTag>
          <h2 className="mt-3 text-3xl font-semibold text-ink">按画像匹配度排序的任务</h2>
          <p className="mt-2 text-sm leading-7 text-ink-soft">每个任务先展示 Token 预测，人工接单保留；自动接单当前仅展示扫描动画和结果。</p>
        </div>
        <ActionButton icon={<Sparkles size={16} />} onClick={handleOpenAutoAccept}>
          自动接单演示
        </ActionButton>
      </div>
      <div className="sprix-grid-auto">
        {recommendedTasks.map((task) => (
          <TaskCard key={task.id} task={task} onAccept={() => handleAccept(task)} />
        ))}
      </div>
      {recommendedTasks.length === 0 && <EmptyState title="暂无可推荐任务" description="当前还没有已发布任务，稍后再来查看新的 Agent 任务。" />}
      <LocalAgentConnectModal
        open={connectOpen}
        selectedAgentId={selectedAgentId}
        assessment={activeAssessment}
        assessing={assessing}
        onClose={() => setConnectOpen(false)}
        onSelect={setSelectedAgentId}
        onAssess={handleAssessAgent}
      />
      <AutoAcceptDemoModal open={autoAcceptOpen} tasks={recommendedTasks} onClose={() => setAutoAcceptOpen(false)} />
    </>
  );
}

function LocalAgentCard({
  agent,
  selected,
  connected,
  onConnect
}: {
  agent: LocalAgentOption;
  selected: boolean;
  connected: boolean;
  onConnect: () => void;
}) {
  return (
    <div className={`sprix-agent-option ${selected ? "is-selected" : ""}`}>
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-pill text-sm font-semibold text-white">{agent.name.slice(0, 1)}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">{agent.name}</h3>
            <SoftTag tone={connected ? "teal" : "neutral"}>{connected ? "已连接" : agent.status}</SoftTag>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-soft">{agent.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {agent.tags.map((tag) => (
              <SoftTag key={tag} tone="neutral">{tag}</SoftTag>
            ))}
          </div>
        </div>
      </div>
      <SecondaryButton onClick={onConnect}>{connected ? "查看" : "连接"}</SecondaryButton>
    </div>
  );
}

function TaskCard({ task, onAccept }: { task: RecommendedTask; onAccept: () => void }) {
  return (
    <Surface className="flex min-h-[326px] flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <SoftTag>{task.rankLabel}</SoftTag>
          <SoftTag tone="neutral">{task.category}</SoftTag>
        </div>
        <span className="text-xs font-semibold text-accent">适配度 {task.agentMatchScore}%</span>
      </div>
      <Link to={`/agent/task/${task.id}`} className="text-xl font-semibold leading-7 text-ink no-underline hover:text-accent">
        {task.title}
      </Link>
      <p className="mt-3 flex-1 text-sm leading-7 text-ink-soft">{compactText(task.cardSummary, 86)}</p>
      <div className="mt-4 grid gap-2 text-sm text-ink-soft">
        <span className="sprix-token-badge">Token 预测：{task.tokenEstimate}</span>
        <span>奖励：<b className="text-ink">{currency(task.reward)}</b></span>
        <span>剩余名额：{task.remainingSlots}/{task.totalSlots}</span>
        <span>来源：{task.sourceName}</span>
        <span>推荐理由：{task.recommendedReason}</span>
      </div>
      <div className="mt-5 flex gap-2">
        <ActionButton onClick={onAccept}>接单</ActionButton>
        <SecondaryButton href={`/agent/task/${task.id}`}>查看详情</SecondaryButton>
      </div>
    </Surface>
  );
}

function LocalAgentConnectModal({
  open,
  selectedAgentId,
  assessment,
  assessing,
  onClose,
  onSelect,
  onAssess
}: {
  open: boolean;
  selectedAgentId: LocalAgentId;
  assessment: LocalAgentAssessment | null;
  assessing: boolean;
  onClose: () => void;
  onSelect: (agentId: LocalAgentId) => void;
  onAssess: (agentId: LocalAgentId) => void;
}) {
  const current = localAgentOptions.find((agent) => agent.id === selectedAgentId) ?? localAgentOptions[0];
  const step = assessing ? 1 : assessment?.agentId === selectedAgentId ? 2 : 0;

  return (
    <Modal title="连接本地 Agent" open={open} onCancel={onClose} footer={null} width={760}>
      <Steps className="mb-6" current={step} items={["检测本机 Agent", "运行画像评测", "推荐任务"].map((title) => ({ title }))} />
      <div className="grid gap-3 md:grid-cols-3">
        {localAgentOptions.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className={`sprix-agent-pick ${selectedAgentId === agent.id ? "is-selected" : ""}`}
            onClick={() => onSelect(agent.id)}
          >
            <span>{agent.name}</span>
            <small>{agent.vendor}</small>
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-[18px] bg-[#fafafa] p-4">
        <p className="text-sm font-semibold text-ink">评测问题</p>
        <p className="mt-2 text-lg text-ink">我在你眼里的职业画像是什么？</p>
        <p className="mt-3 text-sm leading-7 text-ink-soft">
          将使用 {current.name} 生成一次演示画像，再根据画像把任务按匹配度排序。当前版本不提供下载入口。
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <ActionButton loading={assessing} icon={<PlugZap size={16} />} onClick={() => onAssess(selectedAgentId)}>
          {assessing ? `正在连接 ${current.name}` : `连接并评测 ${current.name}`}
        </ActionButton>
        <SecondaryButton onClick={onClose}>稍后再说</SecondaryButton>
      </div>
    </Modal>
  );
}

function AutoAcceptDemoModal({ open, tasks, onClose }: { open: boolean; tasks: RecommendedTask[]; onClose: () => void }) {
  const result = getDemoAutoAcceptResult(tasks);

  return (
    <Modal title="自动接单演示" open={open} onCancel={onClose} footer={null} width={640}>
      <div className="sprix-auto-accept-flow">
        <div>
          <Sparkles size={18} />
          <span>扫描推荐任务</span>
        </div>
        <div>
          <Radar size={18} />
          <span>匹配率阈值 {result.threshold}%</span>
        </div>
        <div>
          <CircleDollarSign size={18} />
          <span>本版不实际接单</span>
        </div>
      </div>
      <div className="mt-5 rounded-[18px] bg-[#fafafa] p-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-ink-soft">超过阈值任务</span>
          <b className="text-ink">{result.eligibleCount} 个</b>
        </div>
        <Progress percent={Math.min(100, result.eligibleCount * 25)} showInfo={false} strokeColor="#111111" />
        <p className="mt-4 text-sm leading-7 text-ink-soft">{result.message}</p>
      </div>
      <div className="mt-5 flex justify-end">
        <ActionButton onClick={onClose}>知道了</ActionButton>
      </div>
    </Modal>
  );
}

export function TaskDetailPage({ openLogin, openQualificationPrompt }: UserPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const task = useSprixStore((state) => state.tasks.find((item) => item.id === id));
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const currentAgent = agents.find((agent) => agent.role === "当前执行 Agent" && agent.status === "已连接");
  const storedLocalAssessment = useMemo(() => readLocalAgentAssessment(), []);
  const localAssessment = account.isLoggedIn ? storedLocalAssessment : null;
  const executionAgentName = currentAgent?.name ?? localAssessment?.agentName;

  if (!task) return <EmptyState title="任务不存在" description="当前任务已不可访问" action={<SecondaryButton href="/agent/market">返回任务市场</SecondaryButton>} />;

  const handleAccept = () => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    if (!executionAgentName) {
      message.warning("请先连接本地 Agent");
      navigate("/agent/market");
      return;
    }
    if (account.qualificationStatus !== "已开通") {
      openQualificationPrompt(task.id);
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
          message.error(error instanceof Error ? `接单失败：${error.message}` : "接单失败");
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
              <SoftTag>适配度 {task.agentMatchScore}%</SoftTag>
            </div>
            <p className="mt-5 text-[15px] leading-8 text-ink-soft">{task.description}</p>
          </Surface>
          <InfoBlock title="详细任务描述" body={task.description} />
          <InfoBlock title="交付标准" body={task.deliverables} />
          <InfoBlock title="验收标准" body={task.acceptanceCriteria} />
          <InfoBlock title="Agent 匹配分析" body={task.matchAnalysis} />
        </div>
        <aside className="space-y-5">
          <Surface className="p-5">
            <h3 className="text-lg font-semibold">任务来源信息</h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">{task.sourceName}</p>
            <p className="text-sm text-ink-soft">来源类型：{task.sourceType}</p>
          </Surface>
          <Surface className="p-5">
            <h3 className="text-lg font-semibold">推荐执行团队</h3>
            <p className="mt-3 text-sm leading-7 text-ink-soft">{task.suggestedTeam}</p>
          </Surface>
          <Surface className="p-5">
            <h3 className="text-lg font-semibold">接单确认</h3>
            <div className="mt-4 space-y-3 text-sm text-ink-soft">
              <p>当前执行 Agent：<b className="text-ink">{executionAgentName ?? "未设置"}</b></p>
              <p>当前连接状态：{currentAgent ? "后端已连接" : localAssessment ? "本地已连接" : "未连接"}</p>
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
  const connected = agents.filter((agent) => agent.status === "已连接");
  const available = agents.filter((agent) => agent.status !== "已连接");
  const current = agents.find((agent) => agent.role === "当前执行 Agent" && agent.status === "已连接");

  const connect = async (agent: Agent) => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    try {
      await connectRemoteAgent(agent.id);
      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
      message.success(agent.status === "已断开" ? "重新连接成功" : "连接并评测完成");
    } catch (error) {
      message.error(error instanceof Error ? `连接失败：${error.message}` : "连接失败");
    }
  };

  const setCurrent = async (agentId: string) => {
    try {
      await markRemoteCurrentAgent(agentId);
      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
      message.success("已设置当前执行 Agent");
    } catch (error) {
      message.error(error instanceof Error ? `设置失败：${error.message}` : "设置失败");
    }
  };

  const disconnect = async (agentId: string) => {
    try {
      await disconnectRemoteAgent(agentId);
      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
      message.success("已断开连接");
    } catch (error) {
      message.error(error instanceof Error ? `断开失败：${error.message}` : "断开失败");
    }
  };

  return (
    <>
      <PageHeader
        title="Agent 中心"
        subtitle="连接当前设备可用 Agent，设置当前执行 Agent，并查看能力画像。"
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
        <MetricCard title="已连接 Agent" value={connected.length} icon={<PlugZap size={19} />} />
        <MetricCard title="当前设备可连接 Agent" value={available.length} icon={primitiveIcons.plug} />
        <MetricCard title="当前执行能力评分" value={current ? `${current.score}/100` : "-"} icon={primitiveIcons.check} />
      </div>
      <AgentList
        title="已连接 Agent"
        agents={connected}
        empty="暂无已连接 Agent"
        renderActions={(agent) =>
          agent.role === "当前执行 Agent" ? (
            <SecondaryButton onClick={() => disconnect(agent.id)}>断开连接</SecondaryButton>
          ) : (
            <>
              <ActionButton onClick={() => setCurrent(agent.id)}>设为当前执行 Agent</ActionButton>
              <SecondaryButton onClick={() => disconnect(agent.id)}>断开连接</SecondaryButton>
            </>
          )
        }
      />
      <AgentList
        title="当前设备可连接 Agent"
        agents={available}
        empty="暂无可连接 Agent"
        renderActions={(agent) => <ActionButton onClick={() => connect(agent)}>{agent.status === "已断开" ? "重新连接" : "连接并评测"}</ActionButton>}
      />
    </>
  );
}

function CurrentAgentCard({ agent }: { agent?: Agent }) {
  return (
    <Surface className="min-h-[272px] p-6">
      <h3 className="text-lg font-semibold">当前执行 Agent</h3>
      {agent ? (
        <div className="mt-5 flex gap-4">
          <AgentAvatar name={agent.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-2xl font-semibold">{agent.name}</h4>
              <StatusTag status={agent.status} />
            </div>
            <p className="mt-2 text-sm text-ink-soft">{agent.summary}</p>
            <div className="mt-4 grid gap-2 text-sm text-ink-soft md:grid-cols-2">
              <span>综合评分：<b className="text-ink">{scoreText(agent.score)}</b></span>
              <span>当前角色：{agent.role}</span>
              <span className="md:col-span-2">最近评测时间：{agent.lastEvaluatedAt}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {agent.tags.map((tag) => (
                <SoftTag key={tag}>{tag}</SoftTag>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-[22px] border border-dashed border-line p-7 text-center">
          <Bot className="mx-auto text-ink-soft" />
          <h4 className="mt-3 text-lg font-semibold">未设置 / 待连接</h4>
          <p className="mt-2 text-sm text-ink-soft">连接当前设备可用 Agent 后，即可执行平台任务。</p>
        </div>
      )}
    </Surface>
  );
}

function AbilityProfile({ agent }: { agent?: Agent }) {
  const profile = agent?.profile;
  const rows = profile
    ? [
        ["需求理解", profile.requirement],
        ["执行稳定性", profile.stability],
        ["交付完整度", profile.delivery],
        ["质量自检", profile.quality]
      ]
    : [
        ["需求理解", null],
        ["执行稳定性", null],
        ["交付完整度", null],
        ["质量自检", null],
        ["流程执行", null],
        ["异常识别", null]
      ];
  return (
    <Surface className="min-h-[272px] p-6">
      <h3 className="text-lg font-semibold">能力画像</h3>
      <div className="mt-5 space-y-4">
        {rows.map(([label, value]) => (
          <div key={String(label)}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-ink-soft">{label}</span>
              <span className="font-semibold text-ink">{value ?? "-"}</span>
            </div>
            {typeof value === "number" ? <Progress percent={value} showInfo={false} strokeColor="#0f766e" /> : <div className="h-2 rounded-full bg-[#f2f2f0]" />}
          </div>
        ))}
      </div>
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
            <div key={task.id} className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusTag status={task.status} />
                  {task.appealStatus && <StatusTag status={task.appealStatus} />}
                </div>
                <Link to={`/agent/my-tasks/${task.id}`} className="mt-2 block text-lg font-semibold text-ink no-underline hover:text-accent">
                  {task.title}
                </Link>
                <p className="mt-1 text-sm text-ink-soft">
                  {task.category} · {task.agentName} · {task.startedAt} · {currency(task.reward)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {task.status === "验收未通过" && (
                  <>
                    <ActionButton disabled={task.appealStatus === "申诉不通过" || task.appealStatus === "申诉处理中"} onClick={() => openAppeal(task.id)}>
                      {task.appealStatus === "申诉不通过" ? "申诉不通过" : "申诉"}
                    </ActionButton>
                    <SecondaryButton
                      onClick={async () => {
                        try {
                          await rerunRemoteTask(task.id);
                          await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
                          message.success("已重新生成执行记录");
                        } catch (error) {
                          message.error(error instanceof Error ? `重新执行失败：${error.message}` : "重新执行失败");
                        }
                      }}
                    >
                      重新执行
                    </SecondaryButton>
                  </>
                )}
                <SecondaryButton href={`/agent/my-tasks/${task.id}`}>查看任务</SecondaryButton>
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </>
  );
}

export function MyTaskDetailPage() {
  const { id } = useParams();
  const task = useSprixStore((state) => state.myTasks.find((item) => item.id === id));
  const base = useSprixStore((state) => state.tasks.find((item) => item.id === task?.taskId));
  if (!task || !base) return <EmptyState title="执行记录不存在" description="该任务记录暂不可访问" action={<SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>} />;
  return (
    <>
      <PageHeader title={task.title} subtitle={`${task.status} · ${task.agentName} · ${currency(task.reward)}`} actions={<SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>} />
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
      <div className="grid gap-5 xl:grid-cols-2">
        <InfoBlock title="交付与验收" body={task.rejectReason ?? base.acceptanceResult} />
        <InfoBlock title="任务要求" body={`${base.recommendedTaskType}。${base.description} ${base.deliverables} ${base.acceptanceCriteria}`} />
      </div>
    </>
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
    if (account.withdrawableAmount <= 0) {
      message.warning("当前暂无可提现金额");
      return;
    }
    if (!account.alipayBound) {
      openBindAlipay(openWithdraw);
      return;
    }
    openWithdraw();
  };
  return (
    <>
      <PageHeader title="报酬结算" subtitle="查看结算记录、可提现金额、提现申请和预计到账时间。" actions={<ActionButton onClick={handleWithdraw}>提现</ActionButton>} />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard title="可提现金额" value={currency(account.withdrawableAmount)} />
        <MetricCard title="结算中" value={currency(settlements.filter((item) => item.settlementStatus === "结算中").reduce((sum, item) => sum + item.netIncome, 0))} />
        <MetricCard title="提现申请" value={withdrawals.length} />
      </div>
      <Surface className="mb-5 p-5">
        <h3 className="mb-4 text-lg font-semibold">提现申请记录</h3>
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
      </Surface>
    </>
  );
}

export function QualificationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const account = useSprixStore((state) => state.account);
  const [checked, setChecked] = useState(false);
  const [signed, setSigned] = useState(false);
  const [step, setStep] = useState(account.qualificationStatus === "已开通" ? 2 : 0);
  const [submitting, setSubmitting] = useState(false);

  return (
    <>
      <PageHeader title="开通接单资格" subtitle="完成实人认证和服务协议签署后，即可接取平台任务。提现前需另行绑定本人支付宝账户。" />
      <Surface className="p-6">
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
                    await initializeRemoteFaceVerification();
                    const accountPatch = await completeRemoteRealPersonVerification();
                    mergeRemoteState({ account: accountPatch });
                    await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
                    message.success("实人认证成功");
                    setStep(1);
                  } catch (error) {
                    message.error(error instanceof Error ? `实人认证失败：${error.message}` : "实人认证失败");
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
                    message.error(error instanceof Error ? `协议签署失败：${error.message}` : "协议签署失败");
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
                <ActionButton onClick={() => navigate("/agent/market")}>去任务市场</ActionButton>
                <SecondaryButton href="/agent/withdraw-account">提前设置提现账户</SecondaryButton>
              </div>
            </>
          )}
        </div>
      </Surface>
    </>
  );
}

export function WithdrawAccountPage({ openBindAlipay }: UserPageProps) {
  const account = useSprixStore((state) => state.account);
  return (
    <>
      <PageHeader title="绑定收款方式" subtitle="绑定与接单实人认证主体一致的支付宝账户。" />
      <Surface className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusTag status={account.withdrawAccountStatus} />
          {account.alipayBound && <SoftTag>实名一致性：已通过</SoftTag>}
        </div>
        <p className="text-sm text-ink-soft">{account.alipayBound ? `支付宝账户：${account.alipayAccountMasked}` : "当前尚未绑定提现账户。"}</p>
        <ActionButton className="mt-5" onClick={() => openBindAlipay()}>
          {account.alipayBound ? "更换支付宝账户" : "绑定支付宝账户"}
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
