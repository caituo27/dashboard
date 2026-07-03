import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AgentEvaluationProgressModal } from "./AgentEvaluationProgressModal";
import type { Agent, AgentEvaluation } from "../types";

const agent: Agent = {
  id: "agent-1",
  name: "Codex Agent",
  status: "可用",
  role: "可用 Agent",
  score: null,
  lastEvaluatedAt: "-",
  summary: "",
  tags: []
};

const runningEvaluation: AgentEvaluation = {
  evaluationId: "evaluation-1",
  agentId: "agent-1",
  localAgentId: "codex",
  status: "running",
  questions: [],
  steps: [],
  transcript: [],
  result: {
    status: "running",
    mode: "runtime_probe",
    overallScore: null,
    dimensions: {},
    careerProfile: null,
    abilityTags: [],
    summary: "",
    improvements: [],
    steps: [],
    transcript: [],
    error: null
  },
  startedAt: "",
  completedAt: null,
  lastEvaluatedAt: null,
  createdAt: "",
  updatedAt: ""
};

const failedEvaluation: AgentEvaluation = {
  ...runningEvaluation,
  status: "failed",
  result: {
    ...runningEvaluation.result,
    status: "failed",
    error: "Agent CLI unavailable"
  }
};

describe("AgentEvaluationProgressModal", () => {
  beforeAll(() => {
    const getComputedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => getComputedStyle(element));
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
  });

  it("shows a compact step track while the evaluation is running", () => {
    render(<AgentEvaluationProgressModal open agent={agent} evaluation={runningEvaluation} loading={false} onClose={vi.fn()} />);

    expect(screen.getByText("正在分析安全边界")).toBeTruthy();
    expect(screen.getByText("1/6")).toBeTruthy();

    const steps = screen.getAllByTestId("evaluation-step");
    expect(steps).toHaveLength(6);
    expect(within(steps[0]).getByText("评测中")).toBeTruthy();
    expect(within(steps[1]).getByText("准备中")).toBeTruthy();
    expect(within(steps[2]).getByText("准备中")).toBeTruthy();
  });

  it("shows a recovery-focused failure state when the evaluation fails", () => {
    render(<AgentEvaluationProgressModal open agent={agent} evaluation={failedEvaluation} loading={false} onClose={vi.fn()} />);

    expect(screen.getByText("生成 Agent 能力画像")).toBeTruthy();
    expect(screen.getByText("评测未完成")).toBeTruthy();
    expect(screen.getByText("本次评测暂未完成")).toBeTruthy();
    expect(screen.getByText("可能与网络连接、Agent CLI 登录状态、账号额度或本机连接状态有关。请检查后稍后重试。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "稍后再试" })).toBeTruthy();
    expect(screen.queryByTestId("evaluation-step")).toBeNull();
  });
});
