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

import { readAgentSnapshot } from "./sprixApi";

function mockLoggedInSnapshotDefaults() {
  localStorage.setItem("sprix-auth-token", "token-1");
  apiMocks.platform.overview.mockResolvedValue({ agentCount: 1, taskCount: 1 });
  apiMocks.account.current1.mockResolvedValue({
    nickname: "用户5160",
    phone: "13812345678",
    phoneVerified: true,
    qualificationStatus: "ACTIVE",
    realPersonVerified: false,
    freelancerAgreementSigned: false,
    withdrawableAmount: 0
  });
  apiMocks.account.currentWithdrawalAccount.mockResolvedValue(undefined);
  apiMocks.earnings.withdrawable.mockResolvedValue(0);
}

describe("readAgentSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
      content: [
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
});
