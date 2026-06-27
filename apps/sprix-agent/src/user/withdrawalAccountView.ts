type WithdrawalAccountMatchState = {
  realNameMatched?: boolean | null;
};

type WithdrawalAccountSummaryState = {
  alipayRealNameMatched?: boolean | null;
};

export function getWithdrawalAccountBindMessage(account: WithdrawalAccountMatchState) {
  return account.realNameMatched ? "支付宝账户绑定成功，实名一致性已通过" : "支付宝账户已绑定，实名一致性待处理";
}

export function getWithdrawalRealNameMatchText(account: WithdrawalAccountSummaryState) {
  return account.alipayRealNameMatched ? "已通过" : "待确认";
}
