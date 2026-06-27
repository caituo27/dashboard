import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Tabs, message } from "antd";
import {
  authenticateConsumer,
  createAlipayLoginSession,
  createWechatLoginSession,
  readAlipayLoginStatus,
  readWechatLoginStatus,
  sendSmsCode,
  type AlipayLoginSession,
  type WechatLoginSession
} from "../services/sprixApi";
import { ActionButton, SecondaryButton } from "./Primitives";
import { QrPayloadBox } from "./QrSession";
import { AgreementCheck, getAlipayStatusText, getWechatStatusText, isSessionExpired, SessionExpiryText } from "./LoginRegisterModalParts";
import { showRequestError } from "./requestErrors";

type LoginRegisterModalProps = { readonly open: boolean; readonly onClose: () => void; readonly afterLogin?: () => void };

export function LoginRegisterModal({ open, onClose, afterLogin }: LoginRegisterModalProps) {
  const queryClient = useQueryClient();
  const [phoneForm] = Form.useForm<{ phone: string; code: string }>();
  const [agreed, setAgreed] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [alipayLoading, setAlipayLoading] = useState(false);
  const [alipaySession, setAlipaySession] = useState<AlipayLoginSession>();
  const [alipayStatus, setAlipayStatus] = useState("WAITING");
  const [alipayExpiresInSeconds, setAlipayExpiresInSeconds] = useState(0);
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
      showRequestError(error, "登录失败", "登录失败：");
    } finally {
      setSubmitting(false);
    }
  };

  const startAlipayLogin = async () => {
    if (!agreed) {
      message.warning("请先阅读并同意用户协议和隐私协议");
      return;
    }

    setAlipayLoading(true);
    try {
      const session = await createAlipayLoginSession();
      setAlipaySession(session);
      setAlipayStatus("PENDING");
      setAlipayExpiresInSeconds(session.expiresInSeconds);
    } catch (error) {
      showRequestError(error, "支付宝登录失败", "支付宝登录失败：");
    } finally {
      setAlipayLoading(false);
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
      showRequestError(error, "微信登录失败", "微信登录失败：");
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
      showRequestError(error, "验证码发送失败", "验证码发送失败：");
    } finally {
      setSmsSending(false);
    }
  };

  useEffect(() => {
    if (open) return;
    setAlipaySession(undefined);
    setAlipayStatus("WAITING");
    setAlipayExpiresInSeconds(0);
    setAlipayLoading(false);
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
    if (!open || !alipaySession) return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const pollAlipayStatus = async () => {
      try {
        const loginStatus = await readAlipayLoginStatus(alipaySession.sessionId);
        if (cancelled) return;
        setAlipayStatus(loginStatus.status);
        setAlipayExpiresInSeconds(loginStatus.expiresInSeconds);
        if (loginStatus.authenticated) {
          await completeLogin();
          return;
        }
        if (isSessionExpired(loginStatus.status, loginStatus.expiresInSeconds)) return;
        timeoutId = window.setTimeout(pollAlipayStatus, alipaySession.pollIntervalMs);
      } catch (error) {
        if (cancelled) return;
        setAlipayStatus("ERROR");
        showRequestError(error, "支付宝登录状态获取失败", "支付宝登录状态获取失败：");
      }
    };

    timeoutId = window.setTimeout(pollAlipayStatus, alipaySession.pollIntervalMs);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [alipaySession, completeLogin, open]);

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
        if (isSessionExpired(scanStatus.status, scanStatus.expiresInSeconds)) return;
        timeoutId = window.setTimeout(pollWechatStatus, wechatSession.pollIntervalMs);
      } catch (error) {
        if (cancelled) return;
        setWechatStatus("ERROR");
        showRequestError(error, "微信登录状态获取失败", "微信登录状态获取失败：");
      }
    };

    timeoutId = window.setTimeout(pollWechatStatus, wechatSession.pollIntervalMs);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [completeLogin, open, wechatSession]);

  const alipayStatusText = getAlipayStatusText(alipayStatus, alipayExpiresInSeconds, Boolean(alipaySession));
  const wechatStatusText = getWechatStatusText(wechatStatus, wechatExpiresInSeconds, Boolean(wechatSession));

  return (
    <Modal title="登录 / 注册" open={open} onCancel={onClose} footer={null} width={520}>
      <Tabs
        tabBarGutter={16}
        items={[
          {
            key: "alipay",
            label: "支付宝扫码登录",
            children: (
              <div className="space-y-4">
                <QrPayloadBox value={alipaySession?.qrPayload} placeholder="同意协议后生成二维码" />
                <p className="text-center text-sm text-ink-soft">{alipayStatusText}</p>
                {alipaySession && <SessionExpiryText expiresInSeconds={alipayExpiresInSeconds} fallback="二维码已过期" />}
                <AgreementCheck agreed={agreed} onChange={setAgreed} />
                <ActionButton block loading={alipayLoading} onClick={startAlipayLogin}>
                  {alipaySession ? "刷新支付宝登录二维码" : "生成支付宝登录二维码"}
                </ActionButton>
                {alipaySession && (
                  <SecondaryButton block href={alipaySession.qrPayload} target="_blank">
                    无法扫码时打开授权页
                  </SecondaryButton>
                )}
              </div>
            )
          },
          {
            key: "wechat",
            label: "微信扫码登录",
            children: (
              <div className="space-y-4">
                <QrPayloadBox value={wechatSession?.qrPayload} placeholder="同意协议后生成二维码" />
                <p className="text-center text-sm text-ink-soft">{wechatStatusText}</p>
                {wechatSession && <SessionExpiryText expiresInSeconds={wechatExpiresInSeconds} fallback="二维码有效期以微信页面为准" />}
                <AgreementCheck agreed={agreed} onChange={setAgreed} />
                <ActionButton block loading={wechatLoading} onClick={startWechatLogin}>
                  {wechatSession ? "刷新微信登录二维码" : "生成微信登录二维码"}
                </ActionButton>
              </div>
            )
          },
          {
            key: "phone",
            label: "手机号验证码",
            children: (
              <Form form={phoneForm} layout="vertical" onFinish={finishLogin} className="pt-2">
                <Form.Item label="手机号" name="phone" rules={[{ required: true, message: "请输入手机号" }]}>
                  <Input placeholder="请输入手机号" />
                </Form.Item>
                <Form.Item label="验证码" name="code" rules={[{ required: true, message: "请输入验证码" }]}>
                  <Input
                    placeholder="请输入验证码"
                    suffix={
                      <Button type="link" loading={smsSending} disabled={smsCountdown > 0} onClick={requestSmsCode}>
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
