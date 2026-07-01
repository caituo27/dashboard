import { describe, expect, it } from "vitest";
import { createInitialSprixState } from "../store/domain";
import { getAccountEditActions, getAccountProfileRows } from "./accountView";

describe("accountView", () => {
  it("shows account rows without email and exposes real edit actions", () => {
    const account = {
      ...createInitialSprixState().account,
      nickname: "用户4204",
      maskedPhone: "173****4204",
      qualificationStatus: "已开通" as const
    };

    const rows = getAccountProfileRows(account);
    const actions = getAccountEditActions();

    expect(rows.map((row) => row.label)).toEqual(["昵称", "绑定手机号", "接单资格"]);
    expect(actions.map((action) => action.key)).toEqual(["avatar", "nickname", "phone", "cancel"]);
    expect(actions.map((action) => action.buttonLabel)).not.toContain("待接口接入");
  });
});
