import { describe, expect, it } from "vitest";
import { getAdminPayoutBatchActions, getAdminPayoutExportAction, getAdminSettlementDetailAction, getAdminWithdrawalBatchActions } from "./adminFundView";

describe("admin fund detail actions", () => {
  it("marks settlement detail as backend-pending", () => {
    expect(getAdminSettlementDetailAction()).toEqual({
      label: "查看详情（待接口）",
      disabled: true,
      reason: "后台结算详情接口待接入"
    });
  });

  it("marks payout export as backend-pending", () => {
    expect(getAdminPayoutExportAction()).toEqual({
      label: "导出打款清单（待接口）",
      disabled: true,
      reason: "后台打款清单导出接口待接入，前端不生成正式打款文件"
    });
  });

  it("marks withdrawal review batch actions as backend-pending", () => {
    expect(getAdminWithdrawalBatchActions()).toEqual([
      {
        label: "批量通过审核（待接口）",
        disabled: true,
        reason: "后台批量提现审核接口待接入，前端不调用未确认的 bulk-approve/bulk-reject 路径"
      },
      {
        label: "批量驳回提现（待接口）",
        disabled: true,
        reason: "后台批量提现审核接口待接入，前端不调用未确认的 bulk-approve/bulk-reject 路径",
        danger: true
      }
    ]);
  });

  it("marks payout batch actions as backend-pending", () => {
    expect(getAdminPayoutBatchActions()).toEqual([
      {
        label: "批量标记已打款（待接口）",
        disabled: true,
        reason: "后台批量打款状态接口待接入，前端不调用未确认的 bulk-paid/bulk-payout-failed 路径"
      },
      {
        label: "批量标记打款失败（待接口）",
        disabled: true,
        reason: "后台批量打款状态接口待接入，前端不调用未确认的 bulk-paid/bulk-payout-failed 路径",
        danger: true
      }
    ]);
  });
});
