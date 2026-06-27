import type { Account, Settlement, Withdrawal } from "../types";
import { currency } from "../utils/format";

export type WithdrawalAccountCard = {
  status: Account["withdrawAccountStatus"];
  accountText: string;
  actionLabel: string;
};

export type WithdrawalAccountAction =
  | {
      kind: "bind";
      label: string;
    }
  | {
      kind: "security-pending";
      label: string;
      description: string;
    };

export type WithdrawalHistoryState =
  | {
      kind: "records";
    }
  | {
      kind: "empty";
      title: string;
      description: string;
    };

export type WithdrawalProgressRefreshAction = {
  label: string;
  disabled: boolean;
  description: string;
};

export type WithdrawalEntryAction =
  | {
      kind: "open-withdraw";
    }
  | {
      kind: "bind-account";
      message: string;
    }
  | {
      kind: "blocked";
      message: string;
    };

export function getWithdrawalAccountCard(account: Account): WithdrawalAccountCard {
  const action = getWithdrawalAccountAction(account);
  if (!account.alipayBound) {
    return {
      status: account.withdrawAccountStatus,
      accountText: "当前尚未绑定提现账户。",
      actionLabel: action.label
    };
  }

  return {
    status: account.withdrawAccountStatus,
    accountText: `支付宝账户：${account.alipayAccountMasked || "-"}`,
    actionLabel: action.label
  };
}

export function getWithdrawalAccountAction(account: Account): WithdrawalAccountAction {
  if (!account.alipayBound) {
    return {
      kind: "bind",
      label: "绑定支付宝账户"
    };
  }

  return {
    kind: "security-pending",
    label: "安全验证接口待接入",
    description: "更换支付宝账户前需要先完成手机号验证码安全验证；后端接口未接入前不开放直接更换。"
  };
}

export function getEarningsOverview(account: Account, settlements: Settlement[], withdrawals: Withdrawal[]) {
  const settlingAmount = settlements
    .filter((item) => item.settlementStatus === "结算中")
    .reduce((sum, item) => sum + item.netIncome, 0);

  return {
    withdrawable: currency(account.withdrawableAmount),
    settling: currency(settlingAmount),
    withdrawalCount: String(withdrawals.length)
  };
}

export function getWithdrawalEntryAction(account: Account): WithdrawalEntryAction {
  if (account.withdrawableAmount <= 0) {
    return {
      kind: "blocked",
      message: "当前暂无可提现金额"
    };
  }

  if (!account.alipayBound) {
    return {
      kind: "bind-account",
      message: "请先绑定与实人认证主体一致的支付宝账户"
    };
  }

  if (!account.alipayRealNameMatched) {
    return {
      kind: "blocked",
      message: "提现账户实名一致性待确认，暂不能提交提现申请"
    };
  }

  return {
    kind: "open-withdraw"
  };
}

export function getWithdrawalHistoryState(withdrawals: Withdrawal[]): WithdrawalHistoryState {
  if (withdrawals.length > 0) return { kind: "records" };

  return {
    kind: "empty",
    title: "提现记录接口待接入",
    description: "当前仅在提交提现后展示本次后端返回的申请记录；历史提现记录需要后端提供查询接口。"
  };
}

export function getWithdrawalProgressRefreshAction(): WithdrawalProgressRefreshAction {
  return {
    label: "刷新打款进度（待接口）",
    disabled: true,
    description: "后端尚未提供提现审核和打款进度刷新接口，前端不伪造状态流转。"
  };
}
