import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createInitialSprixState } from "../store/domain";
import { useSprixStore } from "../store/sprixStore";
import type { Agent, AgentEvaluation } from "../types";
import * as sprixApi from "../services/sprixApi";
import { HomePage } from "../home/HomePage";
import { AgentCenterPage, EarningsPage, QualificationPage } from "./UserPages";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

vi.mock("../services/sprixApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/sprixApi")>();
  return {
    ...actual,
    connectRemoteAgent: vi.fn(),
    markRemoteCurrentAgent: vi.fn(),
    readCurrentRemoteAgent: vi.fn(),
    readRemoteAgents: vi.fn(),
    readRemoteAgentEvaluation: vi.fn(),
    readLatestRemoteAgentEvaluation: vi.fn(),
    initializeRemoteFaceVerification: vi.fn(),
    startRemoteAgentEvaluation: vi.fn()
  };
});

const availableAgent: Agent = {
  id: "agent-1",
  name: "Codex Agent",
  status: "可用",
  role: "可用 Agent",
  score: null,
  lastEvaluatedAt: "未有记录",
  summary: "研发与网页生成",
  tags: []
};

const connectedAgent: Agent = {
  ...availableAgent,
  status: "已连接",
  role: "当前执行 Agent",
  score: 92,
  tags: ["软件开发", "网页生成"]
};

const completedEvaluation = {
  evaluationId: "evaluation-1",
  agentId: "agent-1",
  localAgentId: "local-agent-1",
  status: "completed" as const,
  questions: [],
  steps: [],
  transcript: [],
  result: {
    status: "completed" as const,
    mode: "",
    overallScore: 92,
    dimensions: {},
    summary: "",
    improvements: [],
    steps: [],
    transcript: [],
    error: null
  },
  startedAt: "",
  completedAt: "",
  createdAt: "",
  updatedAt: ""
};

const runningEvaluation: AgentEvaluation = {
  evaluationId: "evaluation-running-1",
  agentId: "agent-1",
  localAgentId: "local-agent-1",
  status: "running",
  questions: [],
  steps: [],
  transcript: [],
  result: {
    status: "running",
    mode: "",
    overallScore: null,
    dimensions: {},
    summary: "",
    improvements: [],
    steps: [],
    transcript: [],
    error: null
  },
  startedAt: "",
  completedAt: null,
  createdAt: "",
  updatedAt: ""
};

function setLoggedInAccountWithAlipay() {
  const initialState = createInitialSprixState();
  useSprixStore.setState({
    account: {
      ...initialState.account,
      isLoggedIn: true,
      alipayBound: true,
      alipayAccountMasked: "xia***@alipay.com"
    },
    payouts: []
  });
}

function setLoggedInAccountWithoutPayouts() {
  const initialState = createInitialSprixState();
  useSprixStore.setState({
    account: {
      ...initialState.account,
      isLoggedIn: true
    },
    payouts: []
  });
}

function setLoggedInAccountWithVerifiedPayeeName() {
  const initialState = createInitialSprixState();
  useSprixStore.setState({
    account: {
      ...initialState.account,
      isLoggedIn: true,
      alipayBound: true,
      alipayAccountMasked: "036Tyu_ALPZFDZx6vaJpzTLR5dSyeUocB8TT1mV7cub7FAa",
      alipayVerifiedName: "叶雨欣"
    },
    payouts: []
  });
}

function renderEarningsPage() {
  render(
    <EarningsPage
      openLogin={vi.fn()}
      openBindAlipay={vi.fn()}
      openQualificationPrompt={vi.fn()}
      openAppeal={vi.fn()}
    />
  );
}

function renderHomePage(initialEntry: string | { pathname: string; state?: unknown } = "/") {
  const openLogin = vi.fn();
  const onLogout = vi.fn();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              openLogin={openLogin}
              onLogout={onLogout}
            />
          }
        />
        <Route path="/agent/center" element={<div>Agent center route</div>} />
        <Route path="/agent/market" element={<div>Task market route</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { onLogout, openLogin };
}

function renderAgentCenterPage() {
  render(
    <MemoryRouter initialEntries={["/agent/center"]}>
      <AgentCenterPage
        openLogin={vi.fn()}
        openBindAlipay={vi.fn()}
        openQualificationPrompt={vi.fn()}
        openAppeal={vi.fn()}
      />
    </MemoryRouter>
  );
}

function renderQualificationPage() {
  render(
    <MemoryRouter initialEntries={["/agent/qualification"]}>
      <QualificationPage
        openLogin={vi.fn()}
        openBindAlipay={vi.fn()}
        openQualificationPrompt={vi.fn()}
        openAppeal={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe("QualificationPage", () => {
  beforeEach(() => {
    vi.mocked(sprixApi.initializeRemoteFaceVerification).mockReset();
    vi.mocked(sprixApi.initializeRemoteFaceVerification).mockResolvedValue({
      certifyId: "certify-1",
      webUrl: "https://verify.alipay.com/session",
      status: "PENDING"
    });
    useSprixStore.setState(createInitialSprixState());
  });

  it("passes real identity fields when starting face verification", async () => {
    renderQualificationPage();

    fireEvent.change(screen.getByLabelText("真实姓名"), { target: { value: " 张三 " } });
    fireEvent.change(screen.getByLabelText("身份证号"), { target: { value: "110101199001011234" } });
    fireEvent.click(screen.getByRole("button", { name: "开始支付宝人脸核验" }));

    await waitFor(() =>
      expect(sprixApi.initializeRemoteFaceVerification).toHaveBeenCalledWith({
        realName: "张三",
        idCardNo: "110101199001011234"
      })
    );
    expect(await screen.findByText("请使用支付宝进行扫码完成认证。")).toBeTruthy();
  });
});

describe("EarningsPage", () => {
  beforeEach(() => {
    useSprixStore.setState(createInitialSprixState());
  });

  it("disables the bind Alipay button when the account is already bound", () => {
    setLoggedInAccountWithAlipay();

    renderEarningsPage();

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "绑定支付宝" }).disabled).toBe(true);
  });

  it("does not expose backend implementation wording in the empty payout state", () => {
    setLoggedInAccountWithoutPayouts();

    renderEarningsPage();

    expect(screen.queryByText(/后端/)).toBeNull();
    expect(screen.getByText("暂无打款记录")).toBeTruthy();
    expect(screen.getAllByText("打款记录")).toHaveLength(1);
    expect(screen.queryByText("暂无提现记录")).toBeNull();
  });

  it("shows the verified payee name instead of the Alipay user id", () => {
    setLoggedInAccountWithVerifiedPayeeName();

    renderEarningsPage();

    expect(screen.getByText("收款人：叶雨欣")).toBeTruthy();
    expect(screen.queryByText(/036Tyu_ALPZFDZx6vaJpzTLR5dSyeUocB8TT1mV7cub7FAa/)).toBeNull();
  });
});

describe("HomePage agent module", () => {
  beforeEach(() => {
    Object.defineProperty(window, "getComputedStyle", {
      configurable: true,
      value: vi.fn(() => ({
        getPropertyValue: vi.fn(() => "")
      }))
    });
    vi.mocked(sprixApi.connectRemoteAgent).mockReset();
    vi.mocked(sprixApi.markRemoteCurrentAgent).mockReset();
    vi.mocked(sprixApi.readCurrentRemoteAgent).mockReset();
    vi.mocked(sprixApi.readRemoteAgents).mockReset();
    vi.mocked(sprixApi.readRemoteAgentEvaluation).mockReset();
    vi.mocked(sprixApi.readLatestRemoteAgentEvaluation).mockReset();
    vi.mocked(sprixApi.startRemoteAgentEvaluation).mockReset();
    vi.mocked(sprixApi.connectRemoteAgent).mockResolvedValue(connectedAgent);
    vi.mocked(sprixApi.markRemoteCurrentAgent).mockResolvedValue(connectedAgent);
    vi.mocked(sprixApi.readCurrentRemoteAgent).mockResolvedValue(undefined);
    vi.mocked(sprixApi.readRemoteAgents).mockResolvedValue({ agents: [], currentAgentId: null });
    vi.mocked(sprixApi.readLatestRemoteAgentEvaluation).mockRejectedValue(new Error("Agent evaluation not found"));
    vi.mocked(sprixApi.startRemoteAgentEvaluation).mockResolvedValue({
      evaluationId: "evaluation-1",
      agentId: "agent-1",
      localAgentId: "local-agent-1",
      status: "running",
      questions: [],
      steps: [],
      transcript: [],
      result: {
        status: "running",
        mode: "",
        overallScore: null,
        dimensions: {},
        summary: "",
        improvements: [],
        steps: [],
        transcript: [],
        error: null
      },
      startedAt: "",
      completedAt: null,
      createdAt: "",
      updatedAt: ""
    });
    useSprixStore.setState(createInitialSprixState());
  });

  it("routes logged-in users with a current agent from the homepage to Agent Center", async () => {
    const initialState = createInitialSprixState();
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      agents: [connectedAgent]
    });

    renderHomePage();

    const centerButtons = await screen.findAllByRole("button", { name: "进入 Agent 中心" });
    expect(centerButtons.length).toBeGreaterThan(0);
    fireEvent.click(centerButtons[0]);

    expect(await screen.findByText("Agent center route")).toBeTruthy();
    expect(screen.queryByText("Task market route")).toBeNull();
  });

  it("uses connect local Agent as the logged-out homepage primary action", () => {
    const { openLogin } = renderHomePage();

    expect(screen.queryByRole("link", { name: "下载客户端" })).toBeNull();
    expect(screen.getByRole("button", { name: "连接本地 Agent" })).toBeTruthy();
    expect(screen.getByText("让你的 Agent 自动帮你赚钱")).toBeTruthy();
    expect(openLogin).not.toHaveBeenCalled();
  });

  it("keeps logged-in users with a current agent on the homepage before they choose Agent Center", async () => {
    const initialState = createInitialSprixState();
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      agents: [connectedAgent]
    });

    renderHomePage();

    expect(await screen.findAllByRole("button", { name: "进入 Agent 中心" })).not.toHaveLength(0);
    expect(screen.queryByText("Agent center route")).toBeNull();
  });

  it("opens a single homepage setup flow and scans local agents before showing choices", async () => {
    const initialState = createInitialSprixState();
    let resolveAgents: (result: Awaited<ReturnType<typeof sprixApi.readRemoteAgents>>) => void = () => undefined;
    vi.mocked(sprixApi.readRemoteAgents).mockReturnValue(
      new Promise((resolve) => {
        resolveAgents = resolve;
      })
    );
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      agents: []
    });

    renderHomePage();

    expect(screen.getAllByRole("button", { name: "设置当前执行 Agent" })).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "下载客户端" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "设置当前执行 Agent" }));

    expect(screen.getByText("正在识别本地 Agent")).toBeTruthy();

    await act(async () => {
      resolveAgents({ agents: [availableAgent], currentAgentId: null });
    });

    expect(await screen.findByText("当前设备可连接 Agent")).toBeTruthy();
    expect(screen.getByText("Codex Agent")).toBeTruthy();
    expect(screen.getByRole("button", { name: "连接并测评" })).toBeTruthy();
    expect(sprixApi.readRemoteAgents).toHaveBeenCalled();
  });

  it("evaluates the selected homepage agent and shows the final score", async () => {
    const initialState = createInitialSprixState();
    let resolveEvaluation: (evaluation: typeof completedEvaluation) => void = () => undefined;
    vi.mocked(sprixApi.readRemoteAgents).mockResolvedValue({ agents: [availableAgent], currentAgentId: null });
    vi.mocked(sprixApi.startRemoteAgentEvaluation).mockReturnValue(
      new Promise((resolve) => {
        resolveEvaluation = resolve;
      })
    );
    vi.mocked(sprixApi.markRemoteCurrentAgent).mockResolvedValue({
      ...connectedAgent,
      evaluation: completedEvaluation
    });
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      agents: []
    });

    renderHomePage();

    fireEvent.click(screen.getByRole("button", { name: "设置当前执行 Agent" }));
    expect(await screen.findByText("当前设备可连接 Agent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Codex Agent/ }));
    fireEvent.click(screen.getByRole("button", { name: "连接并测评" }));

    await waitFor(() => expect(sprixApi.startRemoteAgentEvaluation).toHaveBeenCalledWith("agent-1"));
    expect(await screen.findByRole("heading", { name: "生成职业画像" })).toBeTruthy();
    expect(screen.getByLabelText("测评等待动效")).toBeTruthy();

    await act(async () => {
      resolveEvaluation(completedEvaluation);
    });

    expect(await screen.findByText("Agent 评分已生成")).toBeTruthy();
    expect(screen.getByLabelText("评分结果动效")).toBeTruthy();
    expect(screen.getByText("92")).toBeTruthy();
    expect(sprixApi.markRemoteCurrentAgent).toHaveBeenCalledWith("agent-1");
  });

  it("shows admission prompts without opening login automatically", () => {
    const { openLogin } = renderHomePage({
      pathname: "/",
      state: {
        admissionReason: "登录已过期，请重新登录",
        openLogin: true
      }
    });

    expect(screen.getByText("让你的 Agent 自动帮你赚钱")).toBeTruthy();
    expect(openLogin).not.toHaveBeenCalled();
  });

  it("shows a logout entry for logged-in users on the homepage", () => {
    const initialState = createInitialSprixState();
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true,
        nickname: "Xiaoxiao"
      },
      agents: [connectedAgent]
    });
    const { onLogout } = renderHomePage();

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("does not treat a non-current connected agent as admission-ready", () => {
    const initialState = createInitialSprixState();
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      agents: [
        {
          ...connectedAgent,
          role: "可用 Agent"
        }
      ]
    });

    renderHomePage();

    expect(screen.getAllByRole("button", { name: "设置当前执行 Agent" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "进入任务市场" })).toBeNull();
  });

  it("opens an existing running evaluation instead of starting a new one from Agent Center", async () => {
    const initialState = createInitialSprixState();
    const staleFailedAgent: Agent = {
      ...connectedAgent,
      evaluation: {
        ...runningEvaluation,
        status: "failed",
        result: {
          ...runningEvaluation.result,
          status: "failed",
          error: "old failed evaluation"
        }
      }
    };
    vi.mocked(sprixApi.readLatestRemoteAgentEvaluation).mockResolvedValue(runningEvaluation);
    vi.mocked(sprixApi.readRemoteAgents).mockResolvedValue({ agents: [{ ...connectedAgent, evaluation: runningEvaluation }], currentAgentId: "agent-1" });
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      currentAgent: staleFailedAgent,
      agents: [staleFailedAgent]
    });

    renderAgentCenterPage();

    fireEvent.click(screen.getByRole("button", { name: "重新评测" }));

    await waitFor(() => expect(sprixApi.readLatestRemoteAgentEvaluation).toHaveBeenCalledWith("agent-1"));
    expect(sprixApi.startRemoteAgentEvaluation).not.toHaveBeenCalled();
    expect(await screen.findByText("生成 Agent 能力画像")).toBeTruthy();
    expect(screen.getByText("处理中，关闭弹框不会取消后端任务")).toBeTruthy();
  });

  it("shows view progress in the Agent list when the current agent has a running latest evaluation", async () => {
    const initialState = createInitialSprixState();
    vi.mocked(sprixApi.readLatestRemoteAgentEvaluation).mockResolvedValue(runningEvaluation);
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      currentAgent: connectedAgent,
      agents: [connectedAgent]
    });

    renderAgentCenterPage();

    expect((await screen.findAllByText("能力画像生成中")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: "查看进度" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "重新评测" })).toBeNull();
  });

  it("starts a new evaluation only when latest evaluation is not found", async () => {
    const initialState = createInitialSprixState();
    vi.mocked(sprixApi.startRemoteAgentEvaluation).mockResolvedValue(runningEvaluation);
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      currentAgent: connectedAgent,
      agents: [connectedAgent]
    });

    renderAgentCenterPage();

    fireEvent.click(screen.getByRole("button", { name: "开始评测" }));

    await waitFor(() => expect(sprixApi.readLatestRemoteAgentEvaluation).toHaveBeenCalledWith("agent-1"));
    await waitFor(() => expect(sprixApi.startRemoteAgentEvaluation).toHaveBeenCalledWith("agent-1"));
    expect(await screen.findByText("生成 Agent 能力画像")).toBeTruthy();
  });

  it("marks the first successfully evaluated agent as current from Agent Center", async () => {
    const initialState = createInitialSprixState();
    vi.mocked(sprixApi.startRemoteAgentEvaluation).mockResolvedValue(completedEvaluation);
    vi.mocked(sprixApi.readRemoteAgents).mockResolvedValue({ agents: [connectedAgent], currentAgentId: "agent-1" });
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      agents: [availableAgent]
    });

    renderAgentCenterPage();

    fireEvent.click(screen.getByRole("button", { name: "测评并设为当前执行 Agent" }));

    await waitFor(() => expect(sprixApi.startRemoteAgentEvaluation).toHaveBeenCalledWith("agent-1"));
    await waitFor(() => expect(sprixApi.markRemoteCurrentAgent).toHaveBeenCalledWith("agent-1"));
  });
});
