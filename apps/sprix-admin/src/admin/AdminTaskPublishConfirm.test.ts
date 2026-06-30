import { describe, expect, it, vi } from "vitest";
import { getPublishTaskConfirmOptions } from "./AdminPages";

describe("publish task confirmation", () => {
  it("uses the required confirmation copy before publishing a new task", () => {
    const onConfirm = vi.fn();
    const options = getPublishTaskConfirmOptions(onConfirm);

    expect(options).toEqual(expect.objectContaining({
      content: "确认发布后，该任务将在任务市场展示，用户可查看任务详情并接单。",
      okText: "确认发布",
      cancelText: "取消"
    }));

    options.onOk();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
