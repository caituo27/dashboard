import { describe, expect, it } from "vitest";
import { getAdminEstimatedTokenField } from "./tokenEstimateView";

describe("admin estimated token field", () => {
  it("keeps estimated token read-only until the backend task field exists", () => {
    expect(getAdminEstimatedTokenField()).toEqual({
      label: "预计 Token",
      value: "待后端字段接入",
      helper: "后端任务模型尚未提供预计 Token 字段，发布/编辑时不提交本地估算值。"
    });
  });
});
