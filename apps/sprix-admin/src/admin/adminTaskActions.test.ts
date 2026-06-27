import { describe, expect, it } from "vitest";
import { getAdminTaskWriteAction } from "./adminTaskActions";

describe("admin task write actions", () => {
  it("enables task publish after the Swagger write endpoint is available", () => {
    expect(getAdminTaskWriteAction("publish")).toEqual({
      kind: "publish",
      label: "发布任务"
    });
  });

  it("enables task mutation actions from the backend dev Swagger", () => {
    expect(["edit", "offline", "republish", "delete"].map((action) => getAdminTaskWriteAction(action))).toEqual([
      {
        kind: "edit",
        label: "保存修改"
      },
      {
        kind: "offline",
        label: "下线"
      },
      {
        kind: "republish",
        label: "重新发布"
      },
      {
        kind: "delete",
        label: "删除",
        danger: true
      }
    ]);
  });
});
