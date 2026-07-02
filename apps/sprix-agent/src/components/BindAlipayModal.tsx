import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, message, type FormInstance } from "antd";
import {
  createRemoteAlipayBindSession,
  mapWithdrawalAccountState,
  readRemoteAlipayBindStatus,
  readRemoteWithdrawalAccountState,
  type AlipayBindSession
} from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";
import type { Account } from "../types";
import { ActionButton, SecondaryButton, StatusTag } from "./Primitives";
import { formatRemainingSeconds, QrPayloadBox } from "./QrSession";
import { showRequestError } from "./requestErrors";
import { hasBoundPayoutAccount } from "../user/accountView";

const maxBoundAlipayTextLength = 15;

type BindAlipayModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly afterBind?: () => void;
};

export function BindAlipayModal({ open, onClose, afterBind }: BindAlipayModalProps) {
  const account = useSprixStore((state) => state.account);
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
        if (bindStatus.completed) {
          let accountPatch = bindStatus.withdrawalAccount ? mapWithdrawalAccountState(bindStatus.withdrawalAccount) : {};
          if (!bindStatus.withdrawalAccount) {
            try {
              accountPatch = await readRemoteWithdrawalAccountState();
            } catch {
              accountPatch = { alipayBound: true, withdrawAccountStatus: "可用" };
            }
          }
          if (cancelled) return;
          mergeRemoteState({ account: accountPatch });
          await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
          message.success("收款支付宝绑定成功");
          onClose();
          afterBind?.();
          return;
        }
        if (isAlipaySessionExpired(bindStatus.status, bindStatus.expiresInSeconds)) return;
        timeoutId = window.setTimeout(pollAlipayStatus, session.pollIntervalMs);
      } catch (error) {
        if (cancelled) return;
        setStatus("ERROR");
        showRequestError(error, "支付宝绑定状态获取失败", "支付宝绑定状态获取失败：");
      }
    };

    timeoutId = window.setTimeout(pollAlipayStatus, session.pollIntervalMs);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [afterBind, mergeRemoteState, onClose, open, queryClient, session]);

  const payoutAccountBound = hasBoundPayoutAccount(account);
  const showBindForm = !payoutAccountBound;
  const alipayStatusText = getAlipayStatusText(status, expiresInSeconds, Boolean(session));
  const title = showBindForm ? "绑定收款支付宝" : "收款支付宝绑定信息";

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      style={{ top: 32 }}
      styles={{ body: { maxHeight: "calc(100dvh - 128px)", overflowY: "auto" } }}
    >
      {showBindForm ? (
        <BindAlipayForm
          form={form}
          session={session}
          submitting={submitting}
          expiresInSeconds={expiresInSeconds}
          alipayStatusText={alipayStatusText}
          onFinish={async (values) => {
            const verifiedName = values.verifiedName || "";
            setSubmitting(true);
            try {
              const nextSession = await createRemoteAlipayBindSession(verifiedName);
              setSession(nextSession);
              setStatus("PENDING");
              setExpiresInSeconds(nextSession.expiresInSeconds);
            } catch (error) {
              showRequestError(error, "二维码生成失败", "二维码生成失败：");
            } finally {
              setSubmitting(false);
            }
          }}
        />
      ) : (
        <BoundAlipayInfo account={account} onClose={onClose} />
      )}
    </Modal>
  );
}

function BoundAlipayInfo({
  account,
  onClose
}: {
  account: Account;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-7 text-ink-soft">
        当前账号已绑定收款支付宝。平台后续按该授权账户自动打款，收款支付宝与登录支付宝可以不同。
      </p>
      <div className="grid gap-3 rounded-2xl bg-[#fafafa] p-4 text-sm">
        <BoundAlipayInfoRow label="绑定状态" value={<StatusTag status="已绑定支付宝" />} />
        <BoundAlipayInfoRow
          label="支付宝账户"
          value={formatBoundAlipayText(account.alipayAccountMasked)}
          title={account.alipayAccountMasked || undefined}
        />
        <BoundAlipayInfoRow label="收款人" value={account.alipayVerifiedName || "-"} />
        <BoundAlipayInfoRow
          label="实名一致性"
          value={account.alipayRealNameMatched ? "已确认" : "待确认"}
        />
        <BoundAlipayInfoRow label="账户状态" value={<StatusTag status={account.withdrawAccountStatus} />} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton onClick={onClose}>我知道了</ActionButton>
      </div>
    </div>
  );
}

function BoundAlipayInfoRow({
  label,
  value,
  title
}: {
  label: string;
  value: ReactNode;
  title?: string;
}) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
      <span className="text-ink-soft">{label}</span>
      <span
        className="min-w-0 max-w-full justify-self-end truncate text-right font-medium text-ink"
        title={title}
      >
        {value}
      </span>
    </div>
  );
}

function formatBoundAlipayText(value?: string) {
  if (!value) return "-";
  return Array.from(value).slice(0, maxBoundAlipayTextLength).join("");
}

function BindAlipayForm({
  form,
  session,
  submitting,
  expiresInSeconds,
  alipayStatusText,
  onFinish
}: {
  form: FormInstance<{ verifiedName: string }>;
  session: AlipayBindSession | undefined;
  submitting: boolean;
  expiresInSeconds: number;
  alipayStatusText: string;
  onFinish: (values: { verifiedName: string }) => Promise<void>;
}) {
  return (
    <>
      <p className="mb-5 text-sm leading-7 text-ink-soft">
        请绑定收款人授权的支付宝账户。平台后续按该授权账户自动打款，收款支付宝与登录支付宝可以不同。
      </p>
      <Form
        form={form}
        layout="vertical"
        className="sprix-phone-login-form"
        onFinish={onFinish}
      >
        <Form.Item
          label="收款人姓名"
          name="verifiedName"
          rules={[{ required: true, message: "请输入收款人姓名" }]}
        >
          <Input size="large" placeholder="请输入收款人姓名" />
        </Form.Item>
        <div className="mb-4 rounded-2xl bg-[#e7f7f2] px-4 py-3 text-sm text-accent">
          扫码授权后，后台只保存收款支付宝账户，不会绑定或覆盖登录支付宝身份。
        </div>
        {session && (
          <div className="mb-4 space-y-3">
            <QrPayloadBox value={session.qrPayload} placeholder="同意协议后生成二维码" />
            <p className="text-center text-sm text-ink-soft">{alipayStatusText}</p>
            <p className="text-center text-xs text-ink-soft">
              {expiresInSeconds > 0 ? `二维码剩余 ${formatRemainingSeconds(expiresInSeconds)}` : "二维码已过期"}
            </p>
          </div>
        )}
        <ActionButton
          size="large"
          htmlType="submit"
          block
          loading={submitting}
          className="sprix-login-submit-button"
        >
          {session ? "刷新支付宝绑定二维码" : "生成支付宝绑定二维码"}
        </ActionButton>
        {session && (
          <SecondaryButton
            size="large"
            className="mt-2"
            block
            href={session.qrPayload}
            target="_blank"
          >
            无法扫码时打开授权页
          </SecondaryButton>
        )}
      </Form>
    </>
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
  if (isAlipayBindCompleted(status)) return "绑定完成，正在同步账户状态";
  return "请使用支付宝扫码授权，完成后会自动更新账户";
}

function isAlipayBindCompleted(status: string) {
  return ["COMPLETED", "SUCCESS", "SUCCEEDED", "AUTHORIZED", "BOUND"].includes(status.toUpperCase());
}
