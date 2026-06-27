import { describe, expect, it } from "vitest";
import type { Account } from "../types";
import { getFaceVerificationStartState, getQualificationRecordRows } from "./qualificationView";

function account(overrides: Partial<Account>): Account {
  return {
    isLoggedIn: true,
    nickname: "",
    email: "",
    maskedPhone: "138****8624",
    phone: "13800008624",
    phoneVerified: true,
    qualificationStatus: "未开通",
    realPersonVerified: false,
    freelancerAgreementSigned: false,
    alipayBound: false,
    alipayAccountMasked: "",
    alipayRealNameMatched: false,
    withdrawAccountStatus: "未绑定",
    withdrawableAmount: 0,
    ...overrides
  };
}

describe("qualification record view", () => {
  it("shows real account qualification states without inventing record fields", () => {
    expect(
      getQualificationRecordRows(
        account({
          qualificationStatus: "已开通",
          realPersonVerified: true,
          freelancerAgreementSigned: true
        })
      )
    ).toEqual([
      { label: "接单资格", value: "已开通" },
      { label: "实人认证", value: "已完成" },
      { label: "服务协议", value: "已签署" },
      { label: "认证主体", value: "待后端返回" },
      { label: "认证时间", value: "待后端返回" },
      { label: "协议版本", value: "待后端返回" },
      { label: "签署时间", value: "待后端返回" }
    ]);
  });

  it("keeps incomplete states explicit", () => {
    expect(getQualificationRecordRows(account({})).slice(0, 3)).toEqual([
      { label: "接单资格", value: "未开通" },
      { label: "实人认证", value: "未完成" },
      { label: "服务协议", value: "未签署" }
    ]);
  });
});

describe("face verification start state", () => {
  it("redirects to the backend-provided verification URL", () => {
    expect(getFaceVerificationStartState({ webUrl: "https://verify.example.com/session-1" })).toEqual({
      kind: "redirect",
      url: "https://verify.example.com/session-1",
      message: "请在打开的实人认证页面完成认证，完成后返回 Sprix 查看资格状态。"
    });
  });

  it("keeps verification pending when the backend does not return a verification URL", () => {
    expect(getFaceVerificationStartState({ certifyId: "certify-1", status: "CREATED" })).toEqual({
      kind: "pending",
      message: "实人认证页面地址待后端返回，前端不会直接标记认证成功。"
    });
  });
});
