import { describe, expect, it } from "vitest";
import type { Account } from "../types";
import { getAccountEditActions, getAccountProfileRows } from "./accountView";

function account(overrides: Partial<Account>): Account {
  return {
    isLoggedIn: true,
    nickname: "用户",
    email: "user@example.com",
    maskedPhone: "138****8624",
    phone: "13800008624",
    phoneVerified: true,
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

describe("account view model", () => {
  it("builds account profile rows from real account fields", () => {
    expect(getAccountProfileRows(account({ nickname: "", email: "" }))).toEqual([
      { label: "昵称", value: "-" },
      { label: "邮箱", value: "-" },
      { label: "绑定手机号", value: "138****8624" },
      { label: "接单资格", value: "已开通" }
    ]);
  });

  it("marks edit actions as pending backend interfaces", () => {
    expect(getAccountEditActions()).toEqual([
      { label: "修改头像", disabled: true, reason: "头像上传与资料更新接口待接入" },
      { label: "修改昵称", disabled: true, reason: "账户资料编辑接口待接入" },
      { label: "修改手机号", disabled: true, reason: "手机号更换与验证码接口待接入" },
      { label: "注销账户", disabled: true, reason: "账户注销接口待接入" }
    ]);
  });
});
