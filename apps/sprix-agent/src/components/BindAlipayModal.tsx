import { useEffect, useState } from "react";
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
import { ActionButton, SecondaryButton } from "./Primitives";
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
  const title = showBindForm ? "绑定收款支付宝" : "收款支付宝";

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={showBindForm ? 520 : 440}
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
  const accountStatus = account.withdrawAccountStatus || "已绑定";
  const accountAvailable = accountStatus === "可用";

  return (
    <div className="pt-1">
      <p className="text-sm leading-6 text-ink-soft">
        平台将按此账户发放任务报酬。
      </p>
      <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
        <div className="flex min-h-12 items-center gap-4 py-3">
          <dt className="w-20 shrink-0 text-ink-soft">支付宝账户</dt>
          <dd
            className="min-w-0 flex-1 truncate text-right font-medium tabular-nums text-ink"
            title={account.alipayAccountMasked || undefined}
          >
            {formatBoundAlipayText(account.alipayAccountMasked)}
          </dd>
        </div>
        <div className="flex min-h-12 items-center gap-4 py-3">
          <dt className="w-20 shrink-0 text-ink-soft">收款人</dt>
          <dd className="min-w-0 flex-1 truncate text-right font-medium text-ink">
            {account.alipayVerifiedName || "-"}
          </dd>
        </div>
        <div className="flex min-h-12 items-center gap-4 py-3">
          <dt className="w-20 shrink-0 text-ink-soft">实名状态</dt>
          <dd className="flex-1 text-right font-medium text-ink">
            {account.alipayRealNameMatched ? "已确认" : "待确认"}
          </dd>
        </div>
        <div className="flex min-h-12 items-center gap-4 py-3">
          <dt className="w-20 shrink-0 text-ink-soft">账户状态</dt>
          <dd className="flex flex-1 items-center justify-end gap-2 font-medium text-ink">
            <span
              className={`h-1.5 w-1.5 rounded-full ${accountAvailable ? "bg-accent" : "bg-ink-soft"}`}
              aria-hidden="true"
            />
            {accountStatus}
          </dd>
        </div>
      </dl>
      <div className="mt-5 flex justify-end">
        <ActionButton onClick={onClose}>关闭</ActionButton>
      </div>
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
        绑定后，平台将向该支付宝账户自动打款。
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
          {session ? "刷新绑定二维码" : "生成绑定二维码"}
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
