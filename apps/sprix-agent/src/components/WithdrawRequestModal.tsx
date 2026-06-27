import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, InputNumber, Modal, message } from "antd";
import { applyRemoteWithdrawal, mapRemoteWithdrawal } from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";
import { getWithdrawalRealNameMatchText } from "../user/withdrawalAccountView";
import { currency } from "../utils/format";
import { ActionButton, SecondaryButton } from "./Primitives";
import { showRequestError } from "./requestErrors";

type WithdrawRequestModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
};

export function WithdrawRequestModal({ open, onClose }: WithdrawRequestModalProps) {
  const account = useSprixStore((state) => state.account);
  const withdrawals = useSprixStore((state) => state.withdrawals);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number | null>(account.withdrawableAmount);
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal title="提交提现申请" open={open} onCancel={onClose} footer={null}>
      <div className="mb-5 space-y-3 rounded-[22px] bg-[#fafafa] p-4 text-sm">
        <InfoRow label="可提现金额" value={currency(account.withdrawableAmount)} />
        <InfoRow label="收款账户" value={account.alipayAccountMasked ? `支付宝账户 ${account.alipayAccountMasked}` : "未绑定"} />
        <InfoRow label="实名一致性" value={getWithdrawalRealNameMatchText(account)} />
        <InfoRow label="预计到账时间" value="提交后以后端返回为准" />
      </div>
      <Form
        layout="vertical"
        onFinish={async () => {
          const value = Number(amount ?? 0);
          if (value <= 0) {
            message.warning("提现金额必须大于 0");
            return;
          }
          if (value > account.withdrawableAmount) {
            message.warning("提现金额不得大于可提现金额");
            return;
          }
          setSubmitting(true);
          try {
            const withdrawal = await applyRemoteWithdrawal(value);
            mergeRemoteState({
              withdrawals: [mapRemoteWithdrawal(withdrawal), ...withdrawals],
              account: { withdrawableAmount: Math.max(0, account.withdrawableAmount - value) }
            });
            await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
            message.success("提现申请已提交，预计到账时间以后端返回为准");
            onClose();
          } catch (error) {
            showRequestError(error, "提现申请失败", "提现申请失败：");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item label="本次提现金额">
          <InputNumber value={amount} min={1} max={account.withdrawableAmount} onChange={setAmount} className="w-full" />
        </Form.Item>
        <p className="mb-5 text-sm leading-7 text-ink-soft">
          提交后，平台会按后端返回的审核与打款进度更新状态。资金将打款至你已绑定的本人支付宝账户。
        </p>
        <div className="flex gap-2">
          <ActionButton htmlType="submit" loading={submitting}>提交提现申请</ActionButton>
          <SecondaryButton onClick={onClose}>取消</SecondaryButton>
        </div>
      </Form>
    </Modal>
  );
}

function InfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
