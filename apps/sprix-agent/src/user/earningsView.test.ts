import { describe, expect, it } from "vitest";
import type { Account, Settlement, Withdrawal } from "../types";
import { getEarningsOverview, getWithdrawalAccountCard, getWithdrawalAccountAction, getWithdrawalEntryAction, getWithdrawalHistoryState, getWithdrawalProgressRefreshAction } from "./earningsView";

function account(overrides: Partial<Account>): Account {
  return {
    isLoggedIn: true,
    nickname: "",
    email: "",
    maskedPhone: "",
    phone: "",
    phoneVerified: false,
    qualificationStatus: "已开通",
    realPersonVerified: true,
    freelancerAgreementSigned: true,
    alipayBound: false,
    alipayAccountMasked: "",
    alipayRealNameMatched: false,
    withdrawAccountStatus: "未绑定",
    withdrawableAmount: 0,
    ...overrides
  };
}

describe("earnings view model", () => {
  it("builds a withdrawal account card from real account state", () => {
    expect(
      getWithdrawalAccountCard(
        account({
          alipayBound: true,
          alipayAccountMasked: "user***@alipay.com",
          withdrawAccountStatus: "可用"
        })
      )
    ).toEqual({
      status: "可用",
      accountText: "支付宝账户：user***@alipay.com",
      actionLabel: "安全验证接口待接入"
    });
  });

  it("shows an explicit unbound account state without placeholder account data", () => {
    expect(getWithdrawalAccountCard(account({}))).toEqual({
      status: "未绑定",
      accountText: "当前尚未绑定提现账户。",
      actionLabel: "绑定支付宝账户"
    });
  });

  it("allows first-time binding but blocks replacement until security verification exists", () => {
    expect(getWithdrawalAccountAction(account({}))).toEqual({
      kind: "bind",
      label: "绑定支付宝账户"
    });
    expect(getWithdrawalAccountAction(account({ alipayBound: true }))).toEqual({
      kind: "security-pending",
      label: "安全验证接口待接入",
      description: "更换支付宝账户前需要先完成手机号验证码安全验证；后端接口未接入前不开放直接更换。"
    });
  });

  it("blocks withdrawal entry until account binding and real-name match are both confirmed", () => {
    expect(getWithdrawalEntryAction(account({ withdrawableAmount: 0 }))).toEqual({
      kind: "blocked",
      message: "当前暂无可提现金额"
    });
    expect(getWithdrawalEntryAction(account({ withdrawableAmount: 100, alipayBound: false }))).toEqual({
      kind: "bind-account",
      message: "请先绑定与实人认证主体一致的支付宝账户"
    });
    expect(
      getWithdrawalEntryAction(
        account({
          withdrawableAmount: 100,
          alipayBound: true,
          alipayRealNameMatched: false
        })
      )
    ).toEqual({
      kind: "blocked",
      message: "提现账户实名一致性待确认，暂不能提交提现申请"
    });
    expect(
      getWithdrawalEntryAction(
        account({
          withdrawableAmount: 100,
          alipayBound: true,
          alipayRealNameMatched: true
        })
      )
    ).toEqual({
      kind: "open-withdraw"
    });
  });

  it("summarizes only available earnings data", () => {
    const settlements = [
      { netIncome: 100, settlementStatus: "结算中" },
      { netIncome: 80, settlementStatus: "已入账" }
    ] as Settlement[];
    const withdrawals = [{ withdrawalNo: "W-1" }] as Withdrawal[];

    expect(getEarningsOverview(account({ withdrawableAmount: 60 }), settlements, withdrawals)).toEqual({
      withdrawable: "¥60",
      settling: "¥100",
      withdrawalCount: "1"
    });
  });

  it("marks withdrawal history as waiting for a backend list when there are no returned records", () => {
    expect(getWithdrawalHistoryState([])).toEqual({
      kind: "empty",
      title: "提现记录接口待接入",
      description: "当前仅在提交提现后展示本次后端返回的申请记录；历史提现记录需要后端提供查询接口。"
    });
  });

  it("shows withdrawal progress refresh as a disabled backend-pending action", () => {
    expect(getWithdrawalProgressRefreshAction()).toEqual({
      label: "刷新打款进度（待接口）",
      disabled: true,
      description: "后端尚未提供提现审核和打款进度刷新接口，前端不伪造状态流转。"
    });
  });
});
