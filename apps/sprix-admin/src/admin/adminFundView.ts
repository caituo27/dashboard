export type AdminPendingFundAction = {
  label: string;
  disabled?: boolean;
  reason?: string;
  danger?: true;
  onClick?: () => Promise<void>;
};

export function getAdminSettlementDetailAction(): AdminPendingFundAction {
  return {
    label: "查看详情（待接口）",
    disabled: true,
    reason: "后台结算详情接口待接入"
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
