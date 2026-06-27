import { describe, expect, it } from "vitest";
import { getRecommendationPendingState } from "./recommendationView";

describe("recommendation view model", () => {
  it("shows recommendation and matching as backend-pending without local scores", () => {
    expect(getRecommendationPendingState()).toEqual({
      title: "推荐/匹配能力待后端接入",
      description: "当前任务市场按后端已发布任务展示；推荐排序、匹配度、推荐理由和画像依据待后端接口返回后再展示。",
      metrics: [
        { label: "推荐排序", value: "待接口" },
        { label: "匹配度", value: "待接口" },
        { label: "推荐理由", value: "待接口" }
      ]
    });
  });
});
