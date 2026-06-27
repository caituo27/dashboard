import { describe, expect, it } from "vitest";
import type { MyTask, Task } from "../types";
import {
  getExecutionArtifactsState,
  getExecutionBackendPendingSections,
  getExecutionOverview,
  getExecutionRequirementText,
  getExecutionReviewState
} from "./executionDetailView";

function myTask(overrides: Partial<MyTask>): MyTask {
  return {
    id: "execution-1",
    taskId: "task-1",
    title: "执行任务",
    category: "数据处理",
    reward: 100,
    status: "执行中",
    agentId: "agent-1",
    agentName: "Codex",
    startedAt: "2026-06-27 00:00",
    currentNode: "生成结果",
    progress: "40%",
    settlementStatus: "未入账",
    ...overrides
  };
}

function task(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    title: "执行任务",
    category: "数据处理",
    sourceName: "Sprix",
    sourceType: "平台任务",
    description: "",
    cardSummary: "",
    deliverables: "",
    acceptanceCriteria: "",
    reward: 100,
    totalSlots: 1,
    remainingSlots: 0,
    publishedAt: "2026-06-27 00:00",
    taskStatus: "已发布",
    offlineReason: "",
    agentMatchScore: 0,
    recommendedTaskType: "",
    suggestedTeam: "",
    matchAnalysis: "",
    riskPrompt: "",
    recommendedReason: "",
    submittedFiles: [],
    resultFiles: [],
    acceptanceResult: "",
    ...overrides
  };
}

describe("execution detail view model", () => {
  it("builds the overview from the actual execution fields", () => {
    expect(getExecutionOverview(myTask({ status: "结算中", settlementStatus: "结算中" }))).toEqual([
      { label: "执行状态", value: "结算中" },
      { label: "当前节点", value: "生成结果" },
      { label: "执行进度", value: "40%" },
      { label: "结算状态", value: "结算中" },
      { label: "执行 Agent", value: "Codex" },
      { label: "任务奖励", value: "¥100" },
      { label: "预计 Token", value: "待后端字段接入" }
    ]);
  });

  it("joins only backend-provided requirement fields", () => {
    expect(
      getExecutionRequirementText(
        task({
          description: "采集公开数据",
          deliverables: "",
          acceptanceCriteria: "字段完整"
        })
      )
    ).toBe("采集公开数据\n字段完整");
  });

  it("uses an explicit empty review state when no review result has been returned", () => {
    expect(getExecutionReviewState(myTask({ rejectReason: undefined }), task({ acceptanceResult: "" }))).toEqual({
      kind: "empty",
      title: "验收结果待后端返回",
      description: "后端尚未返回验收报告、驳回原因或结算结果。"
    });
  });

  it("uses returned artifact file lists and otherwise shows a backend-pending state", () => {
    expect(getExecutionArtifactsState(task({ resultFiles: ["result.pdf"], submittedFiles: ["source.csv"] }))).toEqual({
      kind: "records",
      files: ["result.pdf", "source.csv"]
    });
    expect(getExecutionArtifactsState(task({}))).toEqual({
      kind: "empty",
      title: "交付文件待后端返回",
      description: "后端尚未返回执行日志、交付物或验收附件。"
    });
  });

  it("exposes backend-pending sections for execution history, logs, and settlement details", () => {
    expect(getExecutionBackendPendingSections()).toEqual([
      {
        title: "同任务历史执行待后端返回",
        description: "后端尚未提供同一任务下的多次执行记录，暂不展示本地模拟历史。"
      },
      {
        title: "执行日志待后端返回",
        description: "后端尚未提供节点日志、Agent 输出流或失败原因，暂不展示前端假日志。"
      },
      {
        title: "结算明细待后端返回",
        description: "后端尚未提供本次执行的结算金额、平台费和入账时间，暂不展示本地估算。"
      }
    ]);
  });
});
