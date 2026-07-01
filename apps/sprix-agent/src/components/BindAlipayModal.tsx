import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, message } from "antd";
import {
  createRemoteAlipayBindSession,
  mapWithdrawalAccountState,
  readRemoteAlipayBindStatus,
  readRemoteWithdrawalAccountState,
  type AlipayBindSession
} from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";
import { ActionButton, SecondaryButton } from "./Primitives";
import { formatRemainingSeconds, QrPayloadBox } from "./QrSession";
import { showRequestError } from "./requestErrors";

type BindAlipayModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly afterBind?: () => void;
};

export function BindAlipayModal({ open, onClose, afterBind }: BindAlipayModalProps) {
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
              accountPatch = {};
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

  const alipayStatusText = getAlipayStatusText(status, expiresInSeconds, Boolean(session));

  return (
    <Modal
      title="绑定收款支付宝"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      style={{ top: 32 }}
      styles={{ body: { maxHeight: "calc(100dvh - 128px)", overflowY: "auto" } }}
    >
      <p className="mb-5 text-sm leading-7 text-ink-soft">请绑定收款人授权的支付宝账户。平台后续按该授权账户自动打款，收款支付宝与登录支付宝可以不同。</p>
      <Form
        form={form}
        layout="vertical"
        className="sprix-phone-login-form"
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
      >
        <Form.Item label="收款人姓名" name="verifiedName" rules={[{ required: true, message: "请输入收款人姓名" }]}>
          <Input size="large" placeholder="请输入收款人姓名" />
        </Form.Item>
        <div className="mb-4 rounded-2xl bg-[#e7f7f2] px-4 py-3 text-sm text-accent">扫码授权后，后台只保存收款支付宝账户，不会绑定或覆盖登录支付宝身份。</div>
        {session && (
          <div className="mb-4 space-y-3">
            <QrPayloadBox value={session.qrPayload} placeholder="同意协议后生成二维码" />
            <p className="text-center text-sm text-ink-soft">{alipayStatusText}</p>
            <p className="text-center text-xs text-ink-soft">
              {expiresInSeconds > 0 ? `二维码剩余 ${formatRemainingSeconds(expiresInSeconds)}` : "二维码已过期"}
            </p>
          </div>
        )}
        <ActionButton size="large" htmlType="submit" block loading={submitting} className="sprix-login-submit-button">
          {session ? "刷新支付宝绑定二维码" : "生成支付宝绑定二维码"}
        </ActionButton>
        {session && (
          <SecondaryButton size="large" className="mt-2" block href={session.qrPayload} target="_blank">
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
  if (isAlipayBindCompleted(status)) return "绑定完成，正在同步账户状态";
  return "请使用支付宝扫码授权，完成后会自动更新账户";
}

function isAlipayBindCompleted(status: string) {
  return ["COMPLETED", "SUCCESS", "SUCCEEDED", "AUTHORIZED", "BOUND"].includes(status.toUpperCase());
}
