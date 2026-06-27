import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Form, Input, InputNumber, Modal, QRCode, Tabs, message } from "antd";
import { useSprixStore } from "../store/sprixStore";
import { getWithdrawalAccountBindMessage, getWithdrawalRealNameMatchText } from "../user/withdrawalAccountView";
import { ActionButton, SecondaryButton, StatusTag } from "./Primitives";
import {
  applyRemoteWithdrawal,
  authenticateConsumer,
  createRemoteAlipayBindSession,
  createWechatLoginSession,
  mapWithdrawalAccountState,
  mapRemoteWithdrawal,
  readRemoteAlipayBindStatus,
  readWechatLoginStatus,
  sendSmsCode,
  submitRemoteAppeal,
  type AlipayBindSession,
  type WechatLoginSession
} from "../services/sprixApi";
import { currency } from "../utils/format";
import { getAccountEditActions, getAccountProfileRows } from "../user/accountView";
import { getWithdrawalAccountAction } from "../user/earningsView";

type ModalState = {
  login: boolean;
  account: boolean;
  agreements: boolean;
  contact: boolean;
  bindAlipay: boolean;
  withdraw: boolean;
};

const wechatQrBoxClassName = [
  "mx-auto flex h-48 w-48 items-center justify-center rounded-[22px]",
  "border border-line bg-white p-3 text-center text-sm text-ink-soft"
].join(" ");

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
  const [phoneForm] = Form.useForm<{ phone: string; code: string }>();
  const [agreed, setAgreed] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatSession, setWechatSession] = useState<WechatLoginSession>();
  const [wechatStatus, setWechatStatus] = useState("WAITING");
  const [wechatExpiresInSeconds, setWechatExpiresInSeconds] = useState(0);

  const completeLogin = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
    message.success("登录 / 注册成功");
    onClose();
    afterLogin?.();
  }, [afterLogin, onClose, queryClient]);

  const finishLogin = async (values?: { phone?: string; code?: string }) => {
    if (!agreed) {
      message.warning("请先阅读并同意用户协议和隐私协议");
      return;
    }
    if (!values?.phone || !values.code) {
      message.warning("请输入手机号和验证码");
      return;
    }
    setSubmitting(true);
    try {
      await authenticateConsumer(values.phone, values.code);
      await completeLogin();
    } catch (error) {
      message.error(error instanceof Error ? `登录失败：${error.message}` : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const startWechatLogin = async () => {
    if (!agreed) {
      message.warning("请先阅读并同意用户协议和隐私协议");
      return;
    }

    setWechatLoading(true);
    try {
      const session = await createWechatLoginSession();
      setWechatSession(session);
      setWechatStatus("PENDING");
      setWechatExpiresInSeconds(session.expiresInSeconds);
    } catch (error) {
      message.error(error instanceof Error ? `微信登录失败：${error.message}` : "微信登录失败");
    } finally {
      setWechatLoading(false);
    }
  };

  const requestSmsCode = async () => {
    try {
      const { phone } = await phoneForm.validateFields(["phone"]);
      setSmsSending(true);
      const result = await sendSmsCode(phone);
      setSmsCountdown(Math.max(result.resendIntervalSeconds ?? 60, 1));
      message.success("验证码已发送");
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(error instanceof Error ? `验证码发送失败：${error.message}` : "验证码发送失败");
    } finally {
      setSmsSending(false);
    }
  };

  useEffect(() => {
    if (open) return;
    setWechatSession(undefined);
    setWechatStatus("WAITING");
    setWechatExpiresInSeconds(0);
    setWechatLoading(false);
    setSmsSending(false);
    setSmsCountdown(0);
  }, [open]);

  useEffect(() => {
    if (!open || smsCountdown <= 0) return;
    const timeoutId = window.setTimeout(() => setSmsCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [open, smsCountdown]);

  useEffect(() => {
    if (!open || !wechatSession) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const pollWechatStatus = async () => {
      try {
        const scanStatus = await readWechatLoginStatus(wechatSession.sessionId);
        if (cancelled) return;

        setWechatStatus(scanStatus.status);
        setWechatExpiresInSeconds(scanStatus.expiresInSeconds);

        if (scanStatus.authenticated) {
          await completeLogin();
          return;
        }

        if (isWechatSessionExpired(scanStatus.status, scanStatus.expiresInSeconds)) return;
        timeoutId = window.setTimeout(pollWechatStatus, wechatSession.pollIntervalMs);
      } catch (error) {
        if (cancelled) return;
        setWechatStatus("ERROR");
        message.error(error instanceof Error ? `微信登录状态获取失败：${error.message}` : "微信登录状态获取失败");
      }
    };

    timeoutId = window.setTimeout(pollWechatStatus, wechatSession.pollIntervalMs);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [completeLogin, open, wechatSession]);

  const wechatStatusText = getWechatStatusText(wechatStatus, wechatExpiresInSeconds, Boolean(wechatSession));

  return (
    <Modal title="登录 / 注册" open={open} onCancel={onClose} footer={null} width={520}>
      <Tabs
        items={[
          {
            key: "wechat",
            label: "微信扫码登录",
            children: (
              <div className="space-y-4">
                <div className={wechatQrBoxClassName}>
                  {wechatSession ? (
                    <QRCode type="svg" value={wechatSession.qrPayload} size={168} bordered={false} />
                  ) : (
                    <span>同意协议后生成二维码</span>
                  )}
                </div>
                <p className="text-center text-sm text-ink-soft">{wechatStatusText}</p>
                {wechatSession && (
                  <p className="text-center text-xs text-ink-soft">
                    {wechatExpiresInSeconds > 0 ? `二维码剩余 ${formatRemainingSeconds(wechatExpiresInSeconds)}` : "二维码有效期以微信页面为准"}
                  </p>
                )}
                <AgreementCheck agreed={agreed} onChange={setAgreed} />
                <ActionButton block loading={wechatLoading} onClick={startWechatLogin}>
                  {wechatSession ? "刷新微信登录二维码" : "生成微信登录二维码"}
                </ActionButton>
              </div>
            )
          },
          {
            key: "phone",
            label: "手机验证码登录 / 注册",
            children: (
              <Form form={phoneForm} layout="vertical" onFinish={finishLogin} className="pt-2">
                <Form.Item label="手机号" name="phone" rules={[{ required: true, message: "请输入手机号" }]}>
                  <Input placeholder="请输入手机号" />
                </Form.Item>
                <Form.Item label="验证码" name="code" rules={[{ required: true, message: "请输入验证码" }]}>
                  <Input
                    placeholder="请输入验证码"
                    suffix={
                      <Button
                        type="link"
                        loading={smsSending}
                        disabled={smsCountdown > 0}
                        onClick={requestSmsCode}
                      >
                        {smsCountdown > 0 ? `${smsCountdown}s 后重发` : "获取验证码"}
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

function isWechatSessionExpired(status: string, expiresInSeconds: number) {
  const normalizedStatus = status.toUpperCase();
  return expiresInSeconds <= 0 || normalizedStatus === "EXPIRED" || normalizedStatus === "CANCELLED" || normalizedStatus === "FAILED";
}

function getWechatStatusText(status: string, expiresInSeconds: number, hasSession: boolean) {
  if (!hasSession) return "同意协议后生成微信登录二维码";
  if (status === "ERROR") return "扫码状态获取失败，请刷新二维码";
  if (isWechatSessionExpired(status, expiresInSeconds)) return "二维码已过期，请刷新后重试";

  const normalizedStatus = status.toUpperCase();
  if (normalizedStatus === "SCANNED") return "已扫码，请在微信中确认登录";
  if (normalizedStatus === "CONFIRMED") return "登录确认中";
  return "请使用微信扫码，确认后会自动进入平台";
}

function formatRemainingSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
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
        <section className="rounded-2xl bg-[#fff7e8] px-4 py-3">
          <h3 className="font-semibold text-ink">正式协议全文待接入</h3>
          <p>当前仅展示产品流程摘要，正式用户协议、隐私协议和自由职业者服务框架协议全文待法务/后端配置后接入。</p>
        </section>
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
        <section className="rounded-2xl bg-[#fafafa] px-4 py-3">
          <h3 className="font-semibold text-ink">客服联系信息待配置</h3>
          <p className="mt-1">客服渠道、服务时间和问题分类待运营配置或后端接口返回后展示。</p>
        </section>
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
  const profileRows = getAccountProfileRows(account);
  const editActions = getAccountEditActions();
  const withdrawalAction = getWithdrawalAccountAction(account);
  return (
    <Modal title="账户信息" open={open} onCancel={onClose} footer={<ActionButton onClick={onClose}>关闭</ActionButton>}>
      <div className="grid gap-3 text-sm">
        {profileRows.map((row) => (
          <InfoRow key={row.label} label={row.label} value={row.label === "接单资格" ? <StatusTag status={row.value} /> : row.value} />
        ))}
        <InfoRow
          label="提现账户"
          value={
            account.alipayBound ? (
              <span>{account.alipayAccountMasked} · {withdrawalAction.label}</span>
            ) : (
              <SecondaryButton size="small" onClick={onBindAlipay}>
                {withdrawalAction.label}
              </SecondaryButton>
            )
          }
        />
        <div className="mt-2 grid gap-2 rounded-2xl bg-[#fafafa] p-3">
          {editActions.map((action) => (
            <div key={action.label} className="flex flex-col gap-2 rounded-2xl border border-line bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-ink">{action.label}</div>
                <div className="mt-1 text-xs text-ink-soft">{action.reason}</div>
              </div>
              <SecondaryButton size="small" disabled={action.disabled}>
                待接口接入
              </SecondaryButton>
            </div>
          ))}
        </div>
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
  const [form] = Form.useForm<{ verifiedName: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<AlipayBindSession>();
  const [status, setStatus] = useState("WAITING");
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);

  useEffect(() => {
    if (open) return;
    form.resetFields();
    setSession(undefined);
    setStatus("WAITING");
    setExpiresInSeconds(0);
    setSubmitting(false);
  }, [form, open]);

  useEffect(() => {
    if (!open || !session) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const pollAlipayStatus = async () => {
      try {
        const bindStatus = await readRemoteAlipayBindStatus(session.sessionId);
        if (cancelled) return;

        setStatus(bindStatus.status);
        setExpiresInSeconds(bindStatus.expiresInSeconds);

        if (bindStatus.completed && bindStatus.withdrawalAccount) {
          mergeRemoteState({ account: mapWithdrawalAccountState(bindStatus.withdrawalAccount) });
          await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
          message.success(getWithdrawalAccountBindMessage(bindStatus.withdrawalAccount));
          onClose();
          afterBind?.();
          return;
        }

        if (isAlipaySessionExpired(bindStatus.status, bindStatus.expiresInSeconds)) return;
        timeoutId = window.setTimeout(pollAlipayStatus, session.pollIntervalMs);
      } catch (error) {
        if (cancelled) return;
        setStatus("ERROR");
        message.error(error instanceof Error ? `支付宝绑定状态获取失败：${error.message}` : "支付宝绑定状态获取失败");
      }
    };

    timeoutId = window.setTimeout(pollAlipayStatus, session.pollIntervalMs);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [afterBind, mergeRemoteState, onClose, open, queryClient, session]);

  const alipayStatusText = getAlipayStatusText(status, expiresInSeconds, Boolean(session));

  return (
    <Modal
      title="设置提现账户"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      style={{ top: 32 }}
      styles={{ body: { maxHeight: "calc(100vh - 128px)", overflowY: "auto" } }}
    >
      <p className="mb-5 text-sm leading-7 text-ink-soft">为确保提现资金进入本人账户，请绑定与接单实人认证主体一致的支付宝账户。</p>
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          const verifiedName = values.verifiedName || "";
          setSubmitting(true);
          try {
            const nextSession = await createRemoteAlipayBindSession(verifiedName);
            setSession(nextSession);
            setStatus("PENDING");
            setExpiresInSeconds(nextSession.expiresInSeconds);
          } catch (error) {
            message.error(error instanceof Error ? `二维码生成失败：${error.message}` : "二维码生成失败");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item label="认证姓名" name="verifiedName" rules={[{ required: true, message: "请输入实人认证姓名" }]}>
          <Input placeholder="请输入与实人认证一致的姓名" />
        </Form.Item>
        <div className="mb-4 rounded-2xl bg-[#e7f7f2] px-4 py-3 text-sm text-accent">扫码授权后，后台将校验支付宝实名主体与接单实人认证主体是否一致。</div>
        {session && (
          <div className="mb-4 space-y-3">
            <div className={wechatQrBoxClassName}>
              <QRCode type="svg" value={session.qrPayload} size={168} bordered={false} />
            </div>
            <p className="text-center text-sm text-ink-soft">{alipayStatusText}</p>
            <p className="text-center text-xs text-ink-soft">
              {expiresInSeconds > 0 ? `二维码剩余 ${formatRemainingSeconds(expiresInSeconds)}` : "二维码已过期"}
            </p>
          </div>
        )}
        <ActionButton htmlType="submit" block loading={submitting}>
          {session ? "刷新支付宝绑定二维码" : "生成支付宝绑定二维码"}
        </ActionButton>
        {session && (
          <SecondaryButton className="mt-2" block href={session.qrPayload} target="_blank">
            无法扫码时打开授权页
          </SecondaryButton>
        )}
      </Form>
    </Modal>
  );
}

function isAlipaySessionExpired(status: string, expiresInSeconds: number) {
  const normalizedStatus = status.toUpperCase();
  return expiresInSeconds <= 0 || normalizedStatus === "EXPIRED" || normalizedStatus === "CANCELLED" || normalizedStatus === "FAILED";
}

function getAlipayStatusText(status: string, expiresInSeconds: number, hasSession: boolean) {
  if (!hasSession) return "生成二维码后使用支付宝扫码授权";
  if (status === "ERROR") return "扫码状态获取失败，请刷新二维码";
  if (isAlipaySessionExpired(status, expiresInSeconds)) return "二维码已过期，请刷新后重试";
  if (status.toUpperCase() === "COMPLETED") return "绑定完成，正在同步账户状态";
  return "请使用支付宝扫码授权，完成后会自动更新账户";
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
      <p className="mb-5 text-sm leading-7 text-ink-soft">如你认为本次验收结果存在误判，可提交申诉。平台将按后端返回的申诉状态和处理时限更新进度。</p>
      <Form
        layout="vertical"
        onFinish={async (values) => {
          if (!executionId) return;
          setSubmitting(true);
          try {
            await submitRemoteAppeal(executionId, values.reason);
            await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
            message.success("申诉已提交，处理进度以后端返回状态为准");
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
