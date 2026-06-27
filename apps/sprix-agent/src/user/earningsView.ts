import type { Account, Payout } from "../types";

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
    title: "暂无提现记录",
    description: "任务完成并通过平台验收后，系统会自动打款；后端返回记录后将在这里展示。"
  };
}

export function getPayoutAccountText(account: Account) {
  if (account.alipayAccountMasked) return `收款账户：${account.alipayAccountMasked}`;
  if (account.maskedPhone) return `收款用户：${account.maskedPhone}`;
  return "收款信息以后端记录为准。";
}

export function getPayoutPageSubtitle() {
  return "查看提现记录、到账状态和预计到账时间。";
}
