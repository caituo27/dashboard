import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  account: {
    current1: vi.fn(),
    currentWithdrawalAccount: vi.fn()
  },
  agent: {
    current: vi.fn(),
    list1: vi.fn()
  },
  earnings: {
    withdrawable: vi.fn()
  },
  myTask: {
    list: vi.fn()
  },
  platform: {
    overview: vi.fn()
  },
  task: {
    market: vi.fn(),
    recommendations: vi.fn()
  }
}));

const httpMocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn()
}));

vi.mock("../apis/sprix", () => ({
  AccountControllerApiFactory: () => apiMocks.account,
  AgentControllerApiFactory: () => apiMocks.agent,
  AppealControllerApiFactory: () => ({}),
  AuthControllerApiFactory: () => ({}),
  EarningsControllerApiFactory: () => apiMocks.earnings,
  MyTaskControllerApiFactory: () => apiMocks.myTask,
  PlatformControllerApiFactory: () => apiMocks.platform,
  TaskControllerApiFactory: () => apiMocks.task
}));

vi.mock("../utils/http", () => ({
  http: httpMocks,
  isGlobalAuthError: () => false
}));

import { readAgentSnapshot, readRemoteAgents } from "./sprixApi";

function createTestStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

function mockLoggedInSnapshotDefaults() {
  localStorage.setItem("sprix-auth-token", "token-1");
  apiMocks.platform.overview.mockResolvedValue({ agentCount: 1, taskCount: 1 });
  apiMocks.account.current1.mockResolvedValue({
    nickname: "用户5160",
    email: "legacy@example.com",
    avatarUrl: "https://cdn.sprix.ai/avatar.png",
    phone: "13812345678",
    phoneVerified: true,
    qualificationStatus: "ACTIVE",
    realPersonVerified: false,
    freelancerAgreementSigned: false,
    withdrawableAmount: 0
  });
  apiMocks.account.currentWithdrawalAccount.mockResolvedValue(undefined);
  apiMocks.earnings.withdrawable.mockResolvedValue(0);
  httpMocks.get.mockResolvedValue([]);
}

describe("readAgentSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createTestStorage());
    mockLoggedInSnapshotDefaults();
  });

  it("reads array data from paged content payloads after login", async () => {
    apiMocks.task.market.mockResolvedValue({
      content: [
        {
          id: "task-1",
          title: "整理线索表",
          category: "data operations",
          sourceName: "Sprix AI Platform",
          sourceType: "PLATFORM",
          description: "清洗并归档线索数据",
          reward: 20,
          totalSlots: 2,
          remainingSlots: 1,
          status: "PUBLISHED"
        }
      ]
    });
    apiMocks.task.recommendations.mockResolvedValue({ content: [] });
    apiMocks.agent.list1.mockResolvedValue({
      currentAgentId: "agent-1",
      agents: [
        {
          id: "agent-1",
          name: "Codex Agent",
          status: "ONLINE",
          currentExecution: true,
          abilityTags: "software-development"
        }
      ]
    });
    apiMocks.agent.current.mockResolvedValue({
      id: "agent-1",
      name: "Codex Agent",
      status: "ONLINE",
      currentExecution: true,
      abilityTags: "software-development"
    });
    apiMocks.myTask.list.mockResolvedValue({ content: [] });

    const snapshot = await readAgentSnapshot();

    expect(snapshot.tasks?.map((task) => task.id)).toEqual(["task-1"]);
    expect(snapshot.agents?.map((agent) => agent.id)).toEqual(["agent-1"]);
    expect(snapshot.currentAgent?.id).toBe("agent-1");
    expect(snapshot.myTasks).toEqual([]);
    expect(snapshot.account?.avatarUrl).toBe("https://cdn.sprix.ai/avatar.png");
    expect("email" in (snapshot.account ?? {})).toBe(false);
  });

  it("uses the current Agent endpoint instead of inferring current execution from the agent list", async () => {
    apiMocks.task.market.mockResolvedValue([]);
    apiMocks.task.recommendations.mockResolvedValue([]);
    apiMocks.agent.list1.mockResolvedValue([
      {
        id: "agent-1",
        name: "Codex Agent",
        status: "ONLINE",
        currentExecution: true,
        abilityTags: "software-development"
      }
    ]);
    apiMocks.agent.current.mockRejectedValue(new Error("current agent not found"));
    apiMocks.myTask.list.mockResolvedValue([]);

    const snapshot = await readAgentSnapshot();

    expect(apiMocks.agent.current).toHaveBeenCalled();
    expect(snapshot.agents?.map((agent) => agent.id)).toEqual(["agent-1"]);
    expect(snapshot.currentAgent).toBeUndefined();
  });

  it("reads agents from the backend aggregate payload", async () => {
    apiMocks.agent.list1.mockResolvedValue({
      currentAgentId: "agent-1",
      agents: [
        {
          id: "agent-1",
          name: "Codex Agent",
          status: "AVAILABLE",
          currentExecution: true,
          score: 84,
          abilityTags: "software-development,web-generation,code-repair"
        },
        {
          id: "agent-2",
          name: "Claude Code Agent",
          status: "AVAILABLE",
          currentExecution: false,
          score: 80,
          abilityTags: "software-development,code-repair,task-execution"
        }
      ],
      localAgent: {
        bound: true,
        connectionStatus: "ONLINE"
      }
    });

    const result = await readRemoteAgents();

    expect(result.agents.map((agent) => agent.name)).toEqual(["Codex Agent", "Claude Code Agent"]);
    expect(result.agents[0]).toMatchObject({
      role: "当前执行 Agent",
      score: 84,
      tags: ["软件开发", "网页生成", "代码修复"]
    });
  });

  it("uses the agent list last evaluated time field", async () => {
    apiMocks.agent.list1.mockResolvedValue([
      {
        id: "agent-1",
        name: "Codex Agent",
        status: "AVAILABLE",
        lastEvaluatedAt: "2026-06-28T01:00:00.000Z",
        evaluation: {
          evaluationId: "evaluation-1",
          status: "COMPLETED",
          completedAt: "2026-06-29T01:00:00.000Z",
          lastEvaluatedAt: "2026-06-30T01:00:00.000Z"
        }
      }
    ]);

    const result = await readRemoteAgents();

    expect(result.agents[0]?.lastEvaluatedAt).toBe("2026-06-28 09:00");
  });

  it("normalizes malformed evaluation list fields to empty arrays", async () => {
    apiMocks.task.market.mockResolvedValue([]);
    apiMocks.task.recommendations.mockResolvedValue([]);
    apiMocks.agent.list1.mockResolvedValue([
      {
        id: "agent-1",
        name: "Codex Agent",
        status: "ONLINE",
        abilityTags: "software-development",
        evaluation: {
          evaluationId: "evaluation-1",
          status: "COMPLETED",
          questions: "not-an-array",
          steps: { content: [] },
          transcript: "not-an-array",
          result: {
            status: "COMPLETED",
            improvements: "not-an-array",
            steps: "not-an-array",
            transcript: { content: [] }
          }
        }
      }
    ]);
    apiMocks.agent.current.mockResolvedValue(undefined);
    apiMocks.myTask.list.mockResolvedValue([]);

    const snapshot = await readAgentSnapshot();

    expect(snapshot.agents?.[0]?.evaluation?.questions).toEqual([]);
    expect(snapshot.agents?.[0]?.evaluation?.steps).toEqual([]);
    expect(snapshot.agents?.[0]?.evaluation?.transcript).toEqual([]);
    expect(snapshot.agents?.[0]?.evaluation?.result.improvements).toEqual([]);
    expect(snapshot.agents?.[0]?.evaluation?.result.steps).toEqual([]);
    expect(snapshot.agents?.[0]?.evaluation?.result.transcript).toEqual([]);
  });

  it("loads payout records from current user earnings withdrawals", async () => {
    apiMocks.task.market.mockResolvedValue([]);
    apiMocks.task.recommendations.mockResolvedValue([]);
    apiMocks.agent.list1.mockResolvedValue([]);
    apiMocks.agent.current.mockResolvedValue(undefined);
    apiMocks.myTask.list.mockResolvedValue([]);
    httpMocks.get.mockResolvedValue([
      {
        id: "withdrawal-1",
        withdrawalNo: "WD20260701001",
        userId: "00000000-0000-0000-0000-000000000101",
        amount: 88.5,
        alipayAccount: "payee@example.com",
        realNameMatchStatus: "PASSED",
        estimatedArrivalTime: "T+1",
        status: "PAID",
        reviewer: "平台",
        appliedAt: "2026-07-01T10:00:00.000+08:00",
        reviewedAt: "2026-07-01T10:05:00.000+08:00"
      }
    ]);

    const snapshot = await readAgentSnapshot();

    expect(httpMocks.get).toHaveBeenCalledWith("/api/v1/earnings/withdrawals");
    expect(snapshot.payouts).toEqual([
      {
        backendId: "withdrawal-1",
        withdrawalNo: "WD20260701001",
        userName: "用户-0101",
        userPhone: "",
        alipayAccount: "payee@example.com",
        payoutAmount: 88.5,
        estimatedArrivalTime: "T+1",
        approvedAt: "2026-07-01 10:05",
        withdrawStatus: "已提现"
      }
    ]);
  });
});
