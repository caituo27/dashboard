import { beforeEach, describe, expect, it, vi } from "vitest";

const { accountApiMock, agentApiMock, authApiMock, earningsApiMock, httpGetMock, httpPostMock, myTaskApiMock, taskApiMock } = vi.hoisted(() => ({
  accountApiMock: {
    current: vi.fn()
  },
  agentApiMock: {
    list1: vi.fn()
  },
  authApiMock: {
    createWechatScanSession: vi.fn(),
    wechatScanSession: vi.fn(),
    mockLogin: vi.fn(),
    logout: vi.fn()
  },
  earningsApiMock: {
    withdrawable: vi.fn()
  },
  httpGetMock: vi.fn(),
  httpPostMock: vi.fn(),
  myTaskApiMock: {
    list: vi.fn()
  },
  taskApiMock: {
    market: vi.fn()
  }
}));

vi.mock("../utils/http", () => ({
  http: {
    get: httpGetMock,
    post: httpPostMock
  },
  isGlobalAuthError: (error: unknown) => Boolean(error && typeof error === "object" && (error as { globalAuth?: unknown }).globalAuth === true)
}));

vi.mock("../apis/sprix", () => ({
  AccountControllerApiFactory: vi.fn(() => accountApiMock),
  AgentControllerApiFactory: vi.fn(() => agentApiMock),
  AppealControllerApiFactory: vi.fn(() => ({})),
  AuthControllerApiFactory: vi.fn(() => authApiMock),
  EarningsControllerApiFactory: vi.fn(() => earningsApiMock),
  MyTaskControllerApiFactory: vi.fn(() => myTaskApiMock),
  TaskControllerApiFactory: vi.fn(() => taskApiMock),
  WithdrawalControllerApiFactory: vi.fn(() => ({}))
}));

import {
  authenticateConsumer,
  createWechatLoginSession,
  mapRemoteWithdrawal,
  readAgentSnapshot,
  readWechatLoginStatus,
  resolveLocalAgentClaimBaseUrlForRuntime,
  sendSmsCode
} from "./sprixApi";

describe("Sprix API WeChat login adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    httpGetMock.mockResolvedValue(null);
  });

  it("creates a QR login session from the backend scan session", async () => {
    authApiMock.createWechatScanSession.mockResolvedValue({
      sessionId: "session-1",
      qrPayload: "sprix://wechat-login?sessionId=session-1",
      expiresInSeconds: 300,
      pollIntervalSeconds: 2
    });

    await expect(createWechatLoginSession()).resolves.toEqual({
      sessionId: "session-1",
      qrPayload: "sprix://wechat-login?sessionId=session-1",
      expiresInSeconds: 300,
      pollIntervalMs: 2000
    });
  });

  it("stores the returned auth token when the scan session is confirmed", async () => {
    authApiMock.wechatScanSession.mockResolvedValue({
      sessionId: "session-1",
      status: "CONFIRMED",
      expiresInSeconds: 250,
      token: {
        token: "token-1",
        nickname: "Andy"
      }
    });

    await expect(readWechatLoginStatus("session-1")).resolves.toEqual({
      sessionId: "session-1",
      status: "CONFIRMED",
      expiresInSeconds: 250,
      authenticated: true
    });
    expect(localStorage.getItem("sprix-auth-token")).toBe("token-1");
  });

  it("rejects incomplete scan sessions before rendering an unusable QR code", async () => {
    authApiMock.createWechatScanSession.mockResolvedValue({
      sessionId: "session-1"
    });

    await expect(createWechatLoginSession()).rejects.toThrow("微信扫码登录二维码不可用");
  });

  it("sends SMS code requests to the real backend endpoint", async () => {
    httpPostMock.mockResolvedValue({
      mobile: "13800008624",
      expiresInSeconds: 300,
      resendIntervalSeconds: 60
    });

    await expect(sendSmsCode("13800008624")).resolves.toEqual({
      mobile: "13800008624",
      expiresInSeconds: 300,
      resendIntervalSeconds: 60
    });
    expect(httpPostMock).toHaveBeenCalledWith("/api/v1/auth/sms-codes", { mobile: "13800008624" });
  });

  it("logs in with the SMS login endpoint and stores the returned token", async () => {
    httpPostMock.mockResolvedValue({
      token: "sms-token-1",
      nickname: "手机用户"
    });

    await expect(authenticateConsumer("13800008624", "123456")).resolves.toBe("sms-token-1");
    expect(httpPostMock).toHaveBeenCalledWith("/api/v1/auth/sms-login", {
      mobile: "13800008624",
      code: "123456"
    });
    expect(localStorage.getItem("sprix-auth-token")).toBe("sms-token-1");
  });

  it("does not derive Agent ability dimensions from a backend score", async () => {
    localStorage.setItem("sprix-auth-token", "token-1");
    taskApiMock.market.mockResolvedValue([]);
    accountApiMock.current.mockResolvedValue({ nickname: "用户", phone: "13800008624" });
    agentApiMock.list1.mockResolvedValue([
      {
        id: "agent-1",
        name: "Codex",
        status: "CONNECTED",
        currentExecution: true,
        score: 88,
        lastEvaluatedAt: "2026-06-26T12:00:00Z",
        abilityTags: "search,automation"
      }
    ]);
    myTaskApiMock.list.mockResolvedValue([]);
    earningsApiMock.withdrawable.mockResolvedValue(0);

    const snapshot = await readAgentSnapshot();

    expect(snapshot.agents?.[0]).toMatchObject({
      id: "agent-1",
      score: 88,
      role: "当前执行 Agent"
    });
    expect(snapshot.agents?.[0].profile).toBeUndefined();
  });

  it("does not invent agent name, evaluation time, or summary when backend fields are missing", async () => {
    localStorage.setItem("sprix-auth-token", "token-1");
    taskApiMock.market.mockResolvedValue([]);
    accountApiMock.current.mockResolvedValue({ nickname: "用户", phone: "13800008624" });
    agentApiMock.list1.mockResolvedValue([
      {
        id: "agent-1",
        status: "CONNECTED",
        currentExecution: true
      }
    ]);
    myTaskApiMock.list.mockResolvedValue([]);
    earningsApiMock.withdrawable.mockResolvedValue(0);

    const snapshot = await readAgentSnapshot();

    expect(snapshot.agents?.[0]).toMatchObject({
      id: "agent-1",
      name: "",
      lastEvaluatedAt: "",
      summary: "",
      tags: []
    });
  });

  it("does not invent a nickname when the backend account omits it", async () => {
    localStorage.setItem("sprix-auth-token", "token-1");
    taskApiMock.market.mockResolvedValue([]);
    accountApiMock.current.mockResolvedValue({ phone: "13800008624" });
    agentApiMock.list1.mockResolvedValue([]);
    myTaskApiMock.list.mockResolvedValue([]);
    earningsApiMock.withdrawable.mockResolvedValue(0);

    const snapshot = await readAgentSnapshot();

    expect(snapshot.account?.nickname).toBe("");
  });

  it("keeps the logged-in snapshot usable when withdrawal account lookup fails", async () => {
    localStorage.setItem("sprix-auth-token", "token-1");
    taskApiMock.market.mockResolvedValue([]);
    accountApiMock.current.mockResolvedValue({ nickname: "用户", phone: "13800008624" });
    agentApiMock.list1.mockResolvedValue([]);
    myTaskApiMock.list.mockResolvedValue([]);
    earningsApiMock.withdrawable.mockResolvedValue(0);
    httpGetMock.mockRejectedValue(new Error("Server error"));

    const snapshot = await readAgentSnapshot();

    expect(snapshot.account).toMatchObject({
      isLoggedIn: true,
      nickname: "用户",
      alipayBound: false
    });
  });

  it("restores login state from the account endpoint when agent snapshot requests fail", async () => {
    localStorage.setItem("sprix-auth-token", "token-1");
    taskApiMock.market.mockResolvedValue([]);
    accountApiMock.current.mockResolvedValue({ nickname: "用户", phone: "13800008624" });
    agentApiMock.list1.mockRejectedValue(new Error("agents unavailable"));
    myTaskApiMock.list.mockResolvedValue([]);
    earningsApiMock.withdrawable.mockResolvedValue(0);

    const snapshot = await readAgentSnapshot();

    expect(snapshot.account).toMatchObject({
      isLoggedIn: true,
      nickname: "用户"
    });
    expect(snapshot.agents).toEqual([]);
  });

  it("does not invent a withdrawal arrival time when the backend omits it", () => {
    expect(
      mapRemoteWithdrawal({
        id: "withdrawal-1",
        amount: 100,
        alipayAccount: "user@example.com"
      })
    ).toMatchObject({
      withdrawalNo: "withdrawal-1",
      estimatedArrivalTime: "-"
    });
  });

  it("does not invent task copy when backend task fields are missing", async () => {
    taskApiMock.market.mockResolvedValue([{ id: "task-1", reward: 100 }]);

    const snapshot = await readAgentSnapshot();

    expect(snapshot.tasks?.[0]).toMatchObject({
      id: "task-1",
      title: "",
      category: "",
      sourceName: "",
      sourceType: "",
      deliverables: "",
      acceptanceCriteria: "",
      acceptanceResult: ""
    });
  });

  it("preserves backend offline reason instead of inventing a manual-offline reason", async () => {
    taskApiMock.market.mockResolvedValue([
      {
        id: "task-1",
        reward: 100,
        status: "OFFLINE",
        offlineReason: "MAINTENANCE_WINDOW"
      }
    ]);

    const snapshot = await readAgentSnapshot();

    expect(snapshot.tasks?.[0].offlineReason).toBe("MAINTENANCE_WINDOW");
  });

  it("does not invent my-task title or agent name when related records are missing", async () => {
    localStorage.setItem("sprix-auth-token", "token-1");
    taskApiMock.market.mockResolvedValue([]);
    accountApiMock.current.mockResolvedValue({ nickname: "用户", phone: "13800008624" });
    agentApiMock.list1.mockResolvedValue([]);
    myTaskApiMock.list.mockResolvedValue([
      {
        id: "execution-1",
        taskId: "missing-task",
        agentId: "missing-agent",
        status: "RUNNING"
      }
    ]);
    earningsApiMock.withdrawable.mockResolvedValue(0);

    const snapshot = await readAgentSnapshot();

    expect(snapshot.myTasks?.[0]).toMatchObject({
      title: "",
      agentName: "",
      progress: ""
    });
  });
});

describe("Local Agent claim URL adapter", () => {
  it("falls back to the real 8084 backend in production builds when the claim base env is empty", () => {
    expect(resolveLocalAgentClaimBaseUrlForRuntime("", false, "http://42.194.150.73:8081")).toBe("http://42.194.150.73:8084");
  });
});
