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
    title: "暂无打款记录",
    description: "任务完成并通过平台验收后，平台将按规则自动打款。"
  };
}

export function getPayoutAccountText(account: Account) {
  if (account.alipayVerifiedName) return `收款人：${account.alipayVerifiedName}`;
  if (account.alipayBound) return "收款账户已绑定";
  if (account.maskedPhone) return `收款用户：${account.maskedPhone}`;
  return "收款信息待确认。";
}

export function getPayoutPageSubtitle() {
  return "查看打款记录、到账状态和预计到账时间。";
}
