import { describe, expect, it } from "vitest";
import type { MyTask } from "../types";
import { getMyTaskActions, getMyTaskMetaItems, getQualificationSuccessAction } from "./userFlowRules";

function myTask(overrides: Partial<MyTask>): MyTask {
  return {
    id: "execution-1",
    taskId: "task-1",
    title: "任务",
    category: "数据处理",
    reward: 100,
    status: "执行中",
    agentId: "agent-1",
    agentName: "Codex",
    startedAt: "2026-06-26 12:00",
    currentNode: "执行中",
    progress: "20%",
    settlementStatus: "未入账",
    ...overrides
  };
}

describe("qualification success action", () => {
  it("returns to the source task when qualification was opened from a task", () => {
    expect(getQualificationSuccessAction("?task=task-1")).toEqual({
      label: "返回任务并接单",
      path: "/agent/task/task-1"
    });
  });

  it("falls back to the task market without a source task", () => {
    expect(getQualificationSuccessAction("")).toEqual({
      label: "去任务市场",
      path: "/agent/market"
    });
  });
});

describe("my task action rules", () => {
  it("builds my-task meta items without estimating token locally", () => {
    expect(getMyTaskMetaItems(myTask({}))).toEqual(["数据处理", "Codex", "2026-06-26 12:00", "¥100", "预计 Token：待后端字段接入"]);
  });

  it("shows a disabled terminate action for running executions until the backend endpoint exists", () => {
    expect(getMyTaskActions(myTask({ status: "执行中" }))).toMatchObject({
      terminateLabel: "终止执行（待接口）",
      terminateEnabled: false
    });
  });

  it("shows rerun for terminated executions", () => {
    expect(getMyTaskActions(myTask({ status: "已终止" })).rerun).toBe(true);
  });

  it("shows appeal and rerun for failed executions that have not appealed", () => {
    expect(getMyTaskActions(myTask({ status: "验收未通过", appealStatus: "未申诉" }))).toMatchObject({
      appealLabel: "申诉",
      appealEnabled: true,
      rerun: true,
      viewLabel: "查看任务"
    });
  });

  it("shows readonly appeal status while an appeal is being processed", () => {
    expect(getMyTaskActions(myTask({ status: "验收未通过", appealStatus: "处理中" }))).toMatchObject({
      appealLabel: "申诉处理中",
      appealEnabled: false,
      rerun: true
    });
  });

  it("uses acceptance result copy for settlement states", () => {
    expect(getMyTaskActions(myTask({ status: "已结算" })).viewLabel).toBe("查看验收结果");
  });
});
