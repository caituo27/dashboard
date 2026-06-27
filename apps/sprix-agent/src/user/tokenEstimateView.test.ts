import { describe, expect, it } from "vitest";
import { getEstimatedTokenField } from "./tokenEstimateView";

describe("estimated token field", () => {
  it("marks estimated token as waiting for backend without inventing a value", () => {
    expect(getEstimatedTokenField()).toEqual({
      label: "预计 Token",
      value: "待后端字段接入",
      description: "后端尚未返回预计 Token 字段，前端不做本地估算。"
    });
  });
});
