import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Form, Input, InputNumber, Modal, Tabs, message } from "antd";
import { useSprixStore } from "../store/sprixStore";
import { ActionButton, SecondaryButton, StatusTag } from "./Primitives";
import { applyRemoteWithdrawal, authenticateConsumer, bindRemoteWithdrawalAccount, mapRemoteWithdrawal, submitRemoteAppeal } from "../services/sprixApi";
import { currency } from "../utils/format";

type ModalState = {
  login: boolean;
  account: boolean;
  agreements: boolean;
  contact: boolean;
  bindAlipay: boolean;
  withdraw: boolean;
};

export function useGlobalModalState() {
  const [modal, setModal] = useState<ModalState>({
    login: false,
    account: false,
    agreements: false,
    contact: false,
    bindAlipay: false,
    withdraw: false
  });
  const open = (key: keyof ModalState) => setModal((prev) => ({ ...prev, [key]: true }));
  const close = (key: keyof ModalState) => setModal((prev) => ({ ...prev, [key]: false }));
  return { modal, open, close };
}

export function LoginRegisterModal({
  open,
  onClose,
  afterLogin
}: {
  open: boolean;
  onClose: () => void;
  afterLogin?: () => void;
}) {
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [counting, setCounting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const finishLogin = async (values?: { phone?: string; code?: string }) => {
    if (!agreed) {
      message.warning("请先阅读并同意用户协议和隐私协议");
      return;
    }
    setSubmitting(true);
    try {
      await authenticateConsumer(values?.phone ?? "agent@sprix.ai", values?.code ?? "123456");
      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
      message.success("登录 / 注册成功");
      onClose();
      afterLogin?.();
    } catch (error) {
      message.error(error instanceof Error ? `登录失败：${error.message}` : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="登录 / 注册" open={open} onCancel={onClose} footer={null} width={520}>
      <Tabs
        items={[
          {
            key: "wechat",
            label: "微信扫码登录",
            children: (
              <div className="space-y-4">
                <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-[22px] border border-line bg-[#f7f7f5] text-center text-sm text-ink-soft">
                  微信扫码区域
                </div>
                <p className="text-center text-sm text-ink-soft">请使用微信扫码完成登录 / 注册</p>
                <p className="text-center text-xs text-ink-soft">扫码成功后将自动进入平台</p>
                <AgreementCheck agreed={agreed} onChange={setAgreed} />
                <ActionButton block loading={submitting} onClick={() => finishLogin()}>
                  使用后端登录
                </ActionButton>
              </div>
            )
          },
          {
            key: "phone",
            label: "手机验证码登录 / 注册",
            children: (
              <Form layout="vertical" onFinish={finishLogin} className="pt-2">
                <Form.Item label="手机号" name="phone" rules={[{ required: true, message: "请输入手机号" }]}>
                  <Input placeholder="请输入手机号" />
                </Form.Item>
                <Form.Item label="验证码" name="code" rules={[{ required: true, message: "请输入验证码" }]}>
                  <Input
                    placeholder="请输入验证码"
                    suffix={
                      <Button
                        type="link"
                        disabled={counting}
                        onClick={() => {
                          setCounting(true);
                          message.success("验证码已发送");
                          window.setTimeout(() => setCounting(false), 1800);
                        }}
                      >
                        {counting ? "已发送" : "获取验证码"}
                      </Button>
                    }
                  />
                </Form.Item>
                <AgreementCheck agreed={agreed} onChange={setAgreed} />
                <ActionButton block htmlType="submit" loading={submitting}>
                  登录 / 注册
                </ActionButton>
              </Form>
            )
          }
        ]}
      />
    </Modal>
  );
}

function AgreementCheck({ agreed, onChange }: { agreed: boolean; onChange: (value: boolean) => void }) {
  return (
    <Checkbox checked={agreed} onChange={(event) => onChange(event.target.checked)} className="mb-4">
      我已阅读并同意《用户协议》和《隐私协议》
    </Checkbox>
  );
}

export function AgreementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal title="相关协议" open={open} onCancel={onClose} footer={<ActionButton onClick={onClose}>我知道了</ActionButton>}>
      <div className="space-y-4 text-sm leading-7 text-ink-soft">
        <section>
          <h3 className="font-semibold text-ink">《用户协议》</h3>
          <p>用户应遵守平台任务规则，按页面提示完成接单、交付、申诉和账户管理。</p>
        </section>
        <section>
          <h3 className="font-semibold text-ink">《隐私协议》</h3>
          <p>平台仅在业务流程中处理必要账户、认证、任务和资金状态信息。</p>
        </section>
        <section>
          <h3 className="font-semibold text-ink">《自由职业者服务框架协议》</h3>
          <p>用户以自由职业者身份接取任务，确认交付、验收、结算、申诉和提现规则。</p>
        </section>
      </div>
    </Modal>
  );
}

export function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal title="联系我们" open={open} onCancel={onClose} footer={<ActionButton onClick={onClose}>我知道了</ActionButton>}>
      <div className="space-y-3 text-sm text-ink-soft">
        <p>
          <span className="font-semibold text-ink">客服电话：</span>400-800-1024
        </p>
        <p>
          <span className="font-semibold text-ink">服务时间：</span>工作日 10:00 - 19:00
        </p>
        <p>如遇接单资格、任务执行、申诉或提现相关问题，可联系客服协助处理。</p>
      </div>
    </Modal>
  );
}

export function AccountModal({
  open,
  onClose,
  onBindAlipay
}: {
  open: boolean;
  onClose: () => void;
  onBindAlipay: () => void;
}) {
  const account = useSprixStore((state) => state.account);
  return (
    <Modal title="账户信息" open={open} onCancel={onClose} footer={<ActionButton onClick={onClose}>关闭</ActionButton>}>
      <div className="grid gap-3 text-sm">
        <InfoRow label="昵称" value={account.nickname} />
        <InfoRow label="邮箱" value={account.email} />
        <InfoRow label="绑定手机号" value={account.maskedPhone} />
        <InfoRow label="接单资格" value={<StatusTag status={account.qualificationStatus} />} />
        <InfoRow
          label="提现账户"
          value={
            account.alipayBound ? (
              <span>{account.alipayAccountMasked} · 已通过</span>
            ) : (
              <SecondaryButton size="small" onClick={onBindAlipay}>
                绑定
              </SecondaryButton>
            )
          }
        />
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}

export function BindAlipayModal({
  open,
  onClose,
  afterBind
}: {
  open: boolean;
  onClose: () => void;
  afterBind?: () => void;
}) {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal title="设置提现账户" open={open} onCancel={onClose} footer={null}>
      <p className="mb-5 text-sm leading-7 text-ink-soft">为确保提现资金进入本人账户，请绑定与接单实人认证主体一致的支付宝账户。</p>
      <Form
        layout="vertical"
        onFinish={async (values) => {
          const account = values.account || "xia***@alipay.com";
          setSubmitting(true);
          try {
            const withdrawalAccount = await bindRemoteWithdrawalAccount(account);
            mergeRemoteState({
              account: {
                alipayBound: true,
                alipayAccountMasked: withdrawalAccount.alipayAccount ?? account,
                alipayRealNameMatched: Boolean(withdrawalAccount.realNameMatched),
                withdrawAccountStatus: withdrawalAccount.realNameMatched ? "可用" : "需更换"
              }
            });
            await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
            message.success("支付宝账户绑定成功，实名一致性已通过");
            onClose();
            afterBind?.();
          } catch (error) {
            message.error(error instanceof Error ? `绑定失败：${error.message}` : "绑定失败");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item label="支付宝账号" name="account" rules={[{ required: true, message: "请输入支付宝账户" }]}>
          <Input placeholder="请输入支付宝账户" />
        </Form.Item>
        <div className="mb-4 rounded-2xl bg-[#e7f7f2] px-4 py-3 text-sm text-accent">真实姓名将与接单实人认证主体一致性校验。</div>
        <ActionButton htmlType="submit" block loading={submitting}>
          授权绑定
        </ActionButton>
      </Form>
    </Modal>
  );
}

export function WithdrawRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        <InfoRow label="收款账户" value={`支付宝账户 ${account.alipayAccountMasked || "xia***@alipay.com"}`} />
        <InfoRow label="实名一致性" value="已通过" />
        <InfoRow label="预计到账时间" value="1-3 个工作日" />
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
            message.success("提现申请已提交，预计 1-3 个工作日内到账");
            onClose();
          } catch (error) {
            message.error(error instanceof Error ? `提现申请失败：${error.message}` : "提现申请失败");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item label="本次提现金额">
          <InputNumber value={amount} min={1} max={account.withdrawableAmount} onChange={setAmount} className="w-full" />
        </Form.Item>
        <p className="mb-5 text-sm leading-7 text-ink-soft">
          提交后，平台将在 1-3 个工作日内完成审核与打款处理。资金将打款至你已绑定的本人支付宝账户。
        </p>
        <div className="flex gap-2">
          <ActionButton htmlType="submit" loading={submitting}>提交提现申请</ActionButton>
          <SecondaryButton onClick={onClose}>取消</SecondaryButton>
        </div>
      </Form>
    </Modal>
  );
}

export function AppealModal({
  open,
  executionId,
  onClose
}: {
  open: boolean;
  executionId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal title="提交申诉" open={open} onCancel={onClose} footer={null}>
      <p className="mb-5 text-sm leading-7 text-ink-soft">如你认为本次验收结果存在误判，可提交申诉。平台将在 1-3 个工作日内返回处理结果。</p>
      <Form
        layout="vertical"
        onFinish={async (values) => {
          if (!executionId) return;
          setSubmitting(true);
          try {
            await submitRemoteAppeal(executionId, values.reason);
            await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
            message.success("申诉已提交，平台将在 1-3 个工作日内返回处理结果");
            onClose();
          } catch (error) {
            message.error(error instanceof Error ? `申诉提交失败：${error.message}` : "申诉提交失败");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item label="申诉理由" name="reason" rules={[{ required: true, message: "请输入申诉理由" }]}>
          <Input.TextArea rows={5} placeholder="请说明你认为验收存在误判的原因" />
        </Form.Item>
        <ActionButton htmlType="submit" loading={submitting}>提交</ActionButton>
      </Form>
    </Modal>
  );
}
