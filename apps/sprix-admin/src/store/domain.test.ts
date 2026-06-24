import { describe, expect, it } from "vitest";
import {
  acceptTask,
  createInitialSprixState,
  passAppeal,
  submitAppeal,
  submitWithdrawal
} from "./domain";

describe("Sprix domain state flow", () => {
  it("creates an execution record and decreases available task slots when a user accepts a task", () => {
    const state = createInitialSprixState();
    const next = acceptTask(state, "task-leads-cleaning");

    expect(next.myTasks[0]?.taskId).toBe("task-leads-cleaning");
    expect(next.myTasks[0]?.status).toBe("执行中");
    expect(next.tasks.find((task) => task.id === "task-leads-cleaning")?.remainingSlots).toBe(7);
    expect(next.adminExecutionRecords["task-leads-cleaning"].running).toHaveLength(2);
  });

  it("submits an appeal and mirrors it into the admin appeal center", () => {
    const state = createInitialSprixState();
    const rejectedRecord = state.myTasks.find((task) => task.status === "验收未通过");
    expect(rejectedRecord).toBeTruthy();

    const next = submitAppeal(state, rejectedRecord!.id, "验收结果遗漏了补充说明。");

    expect(next.myTasks.find((task) => task.id === rejectedRecord!.id)?.appealStatus).toBe("申诉处理中");
    expect(next.adminAppeals.some((appeal) => appeal.appealReason.includes("补充说明"))).toBe(true);
  });

  it("moves a passed appeal into settlement and creates a fund settlement record", () => {
    const state = createInitialSprixState();
    const appeal = state.adminAppeals.find((item) => item.appealStatus === "待处理");
    expect(appeal).toBeTruthy();

    const next = passAppeal(state, appeal!.appealNo);

    expect(next.adminAppeals.find((item) => item.appealNo === appeal!.appealNo)?.appealStatus).toBe("申诉通过");
    expect(next.myTasks.find((task) => task.appealNo === appeal!.appealNo)?.status).toBe("结算中");
    expect(next.settlements.some((item) => item.sourceAppealNo === appeal!.appealNo)).toBe(true);
  });

  it("submits a withdrawal request and creates an admin withdrawal review record", () => {
    const state = createInitialSprixState();
    const next = submitWithdrawal(state, 640);

    expect(next.withdrawals[0]?.withdrawStatus).toBe("提现审核中");
    expect(next.withdrawals[0]?.applyAmount).toBe(640);
    expect(next.account.withdrawableAmount).toBe(0);
    expect(next.fundFlows[0]?.flowType).toBe("提现申请处理中");
  });
});
