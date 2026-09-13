import { describe, expect, it } from "vitest";
import { filterAvailableAppealDetails } from "./pagedAdminData";
import type { AdminAppeal } from "../types";

const appeal = (backendId: string): AdminAppeal => ({
  backendId,
  appealNo: backendId,
  taskTitle: "测试任务",
  taskCategory: "数据标注",
  userName: "测试用户",
  userPhone: "13800000000",
  agentName: "Codex Agent",
  issueSummary: "测试问题",
  appealReason: "申请复核",
  appealStatus: "待处理",
  priority: "普通",
  submittedAt: "2026-09-13 10:00:00",
  handler: "待分配",
  processLogs: []
});

describe("filterAvailableAppealDetails", () => {
  it("removes missing appeal details without breaking list filtering", () => {
    const first = appeal("appeal-1");
    const second = appeal("appeal-2");
    expect(filterAvailableAppealDetails([
      first,
      null,
      second
    ])).toEqual([first, second]);
  });
});
