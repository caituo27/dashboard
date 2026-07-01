import type { Account } from "../types";

export type AccountProfileRow = {
  label: string;
  value: string;
};

export type AccountEditAction = {
  key: "avatar" | "nickname" | "phone" | "cancel";
  label: string;
  description: string;
  buttonLabel: string;
  danger?: boolean;
};

export function getAccountProfileRows(account: Account): AccountProfileRow[] {
  return [
    { label: "昵称", value: account.nickname || "-" },
    { label: "绑定手机号", value: account.maskedPhone || "-" },
    { label: "接单资格", value: account.qualificationStatus }
  ];
}

export function hasBoundPayoutAccount(account: Account) {
  return account.alipayBound || account.withdrawAccountStatus !== "未绑定" || Boolean(account.alipayAccountMasked || account.alipayVerifiedName);
}

export function getAccountEditActions(): AccountEditAction[] {
  return [
    { key: "avatar", label: "修改头像", description: "上传头像图片并同步到当前账户", buttonLabel: "修改" },
    { key: "nickname", label: "修改昵称", description: "更新账户昵称并刷新页面账户信息", buttonLabel: "修改" },
    { key: "phone", label: "修改手机号", description: "通过图形验证码和短信验证码更换绑定手机号", buttonLabel: "更换" },
    { key: "cancel", label: "注销账户", description: "注销后将退出登录并清除当前账号登录身份", buttonLabel: "注销", danger: true }
  ];
}
