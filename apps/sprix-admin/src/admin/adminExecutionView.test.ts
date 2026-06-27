import { describe, expect, it } from "vitest";
import { getAdminExecutionRecordActions } from "./adminExecutionView";

describe("admin execution record actions", () => {
  it("marks running execution detail as backend-pending", () => {
    expect(getAdminExecutionRecordActions("running")).toEqual([
      {
        label: "查看执行详情（待接口）",
        disabled: true,
        reason: "后台 execution 详情接口待接入"
      }
    ]);
  });

  it("marks completed execution result, review, appeal, and settlement links as backend-pending", () => {
    expect(getAdminExecutionRecordActions("completed", { appealStatus: "申诉通过", settlementStatus: "结算中" })).toEqual([
      { label: "查看结果（待接口）", disabled: true, reason: "后台执行结果文件接口待接入" },
      { label: "查看验收详情（待接口）", disabled: true, reason: "后台验收报告详情接口待接入" },
      { label: "查看申诉（待接口）", disabled: true, reason: "执行记录到申诉详情的关联字段待后端返回" },
      { label: "查看结算（待接口）", disabled: true, reason: "后台 execution 结算详情接口待接入" }
    ]);
  });
});
