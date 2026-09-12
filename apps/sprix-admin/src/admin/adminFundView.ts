export type AdminPendingFundAction = {
  label: string;
  disabled?: boolean;
  reason?: string;
  danger?: true;
  onClick?: () => Promise<void>;
};

export function getAdminSettlementDetailAction(onClick?: () => Promise<void>): AdminPendingFundAction {
  return {
    label: "查看详情",
    onClick
  };
}

export function getAdminPayoutExportAction(): AdminPendingFundAction {
  return {
    label: "导出打款清单"
  };
}

export function getAdminWithdrawalBatchActions(actions: {
  approve: () => Promise<void>;
  reject: () => Promise<void>;
}): AdminPendingFundAction[] {
  return [
    {
      label: "批量通过审核",
      onClick: actions.approve
    },
    {
      label: "批量驳回提现",
      onClick: actions.reject,
      danger: true
    }
  ];
}

export function getAdminPayoutBatchActions(actions: {
  markPaid: () => Promise<void>;
  markFailed: () => Promise<void>;
}): AdminPendingFundAction[] {
  return [
    {
      label: "批量标记已打款",
      onClick: actions.markPaid
    },
    {
      label: "批量标记打款失败",
      onClick: actions.markFailed,
      danger: true
    }
  ];
}
