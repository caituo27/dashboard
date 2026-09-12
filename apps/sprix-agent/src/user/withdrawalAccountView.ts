type WithdrawalAccountMatchState = {
  realNameMatched?: boolean | null;
};

type WithdrawalAccountSummaryState = {
  alipayRealNameMatched?: boolean | null;
};

export function getWithdrawalAccountBindMessage(account: WithdrawalAccountMatchState) {
  return account.realNameMatched ? "收款支付宝绑定成功，账户已授权" : "收款支付宝已绑定，待重新授权";
}

export function getWithdrawalRealNameMatchText(account: WithdrawalAccountSummaryState) {
  return account.alipayRealNameMatched ? "已授权" : "待授权";
}
