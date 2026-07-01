import type { Account, Payout } from "../types";
import { hasBoundPayoutAccount } from "./accountView";

export type PayoutRecordState =
  | {
      kind: "records";
    }
  | {
      kind: "empty";
      title: string;
      description: string;
    };

export function getPayoutRecordState(payouts: Payout[]): PayoutRecordState {
  if (payouts.length > 0) return { kind: "records" };

  return {
    kind: "empty",
    title: "暂无打款记录",
    description: "任务完成并通过平台验收后，平台将按规则自动打款。"
  };
}

export function getPayoutAccountText(account: Account) {
  if (account.alipayVerifiedName) return `收款人：${account.alipayVerifiedName}`;
  if (account.alipayAccountMasked) return `收款支付宝：${account.alipayAccountMasked}`;
  if (hasBoundPayoutAccount(account)) return "收款账户已绑定";
  if (account.maskedPhone) return `收款用户：${account.maskedPhone}`;
  return "收款信息待确认。";
}

export function getPayoutAccountActionLabel(account: Account) {
  return account.alipayBound ? "已绑定支付宝" : "绑定支付宝";
}

export function getPayoutAccountWarning(account: Account) {
  return account.alipayBound ? "" : "当前未绑定支付宝，将影响任务结算";
}

export function getPayoutPageSubtitle() {
  return "查看打款记录、到账状态和预计到账时间。";
}
