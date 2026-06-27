export type AdminPendingFundAction = {
  label: string;
  disabled: true;
  reason: string;
  danger?: true;
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
    label: "导出打款清单（待接口）",
    disabled: true,
    reason: "后台打款清单导出接口待接入，前端不生成正式打款文件"
  };
}

export function getAdminWithdrawalBatchActions(): AdminPendingFundAction[] {
  const reason = "后台批量提现审核接口待接入，前端不调用未确认的 bulk-approve/bulk-reject 路径";

  return [
    {
      label: "批量通过审核（待接口）",
      disabled: true,
      reason
    },
    {
      label: "批量驳回提现（待接口）",
      disabled: true,
      reason,
      danger: true
    }
  ];
}

export function getAdminPayoutBatchActions(): AdminPendingFundAction[] {
  const reason = "后台批量打款状态接口待接入，前端不调用未确认的 bulk-paid/bulk-payout-failed 路径";

  return [
    {
      label: "批量标记已打款（待接口）",
      disabled: true,
      reason
    },
    {
      label: "批量标记打款失败（待接口）",
      disabled: true,
      reason,
      danger: true
    }
  ];
}
