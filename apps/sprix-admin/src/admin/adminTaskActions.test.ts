import { describe, expect, it } from "vitest";
import { getAdminTaskWriteAction } from "./adminTaskActions";

describe("admin task write actions", () => {
  it("marks task publish as backend-pending until the Swagger write endpoint exists", () => {
    expect(getAdminTaskWriteAction("publish")).toEqual({
      label: "发布任务（待接口）",
      disabled: true,
      reason: "后台任务发布接口待正式接入，当前 Swagger 仅提供任务查询接口"
    });
  });

  it("marks task mutation actions as backend-pending", () => {
    expect(["edit", "offline", "republish", "delete"].map((action) => getAdminTaskWriteAction(action))).toEqual([
      {
        label: "保存修改（待接口）",
        disabled: true,
        reason: "后台任务编辑接口待正式接入，前端不调用未确认写入路径"
      },
      {
        label: "下线（待接口）",
        disabled: true,
        reason: "后台任务下线接口待正式接入，前端不调用未确认写入路径"
      },
      {
        label: "重新发布（待接口）",
        disabled: true,
        reason: "后台任务重新发布接口待正式接入，前端不调用未确认写入路径"
      },
      {
        label: "删除（待接口）",
        disabled: true,
        reason: "后台任务删除接口待正式接入，前端不调用未确认写入路径",
        danger: true
      }
    ]);
  });
});
