import { describe, expect, it } from "vitest";
import { getWithdrawalAccountBindMessage, getWithdrawalRealNameMatchText } from "./withdrawalAccountView";

describe("getWithdrawalAccountBindMessage", () => {
  it("does not claim real-name verification passed when the backend returns a mismatch", () => {
    expect(getWithdrawalAccountBindMessage({ realNameMatched: false })).toBe("支付宝账户已绑定，实名一致性待处理");
  });

  it("only reports real-name verification passed when the backend confirms the match", () => {
    expect(getWithdrawalAccountBindMessage({ realNameMatched: true })).toBe("支付宝账户绑定成功，实名一致性已通过");
  });

  it("uses the account real-name match state in withdrawal summaries", () => {
    expect(getWithdrawalRealNameMatchText({ alipayRealNameMatched: true })).toBe("已通过");
    expect(getWithdrawalRealNameMatchText({ alipayRealNameMatched: false })).toBe("待确认");
  });
});
