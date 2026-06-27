import type { Account } from "../types";

export type AccountProfileRow = {
  label: string;
  value: string;
};

export type AccountEditAction = {
  label: string;
  disabled: true;
  reason: string;
};

export function getAccountProfileRows(account: Account): AccountProfileRow[] {
  return [
    { label: "昵称", value: account.nickname || "-" },
    { label: "邮箱", value: account.email || "-" },
    { label: "绑定手机号", value: account.maskedPhone || "-" },
    { label: "接单资格", value: account.qualificationStatus }
  ];
}

export function getAccountEditActions(): AccountEditAction[] {
  return [
    { label: "修改头像", disabled: true, reason: "头像上传与资料更新接口待接入" },
    { label: "修改昵称", disabled: true, reason: "账户资料编辑接口待接入" },
    { label: "修改手机号", disabled: true, reason: "手机号更换与验证码接口待接入" },
    { label: "注销账户", disabled: true, reason: "账户注销接口待接入" }
  ];
}
