import { useCallback, useEffect, useState } from "react";
import {
  createAlipayLoginSession,
  createWechatLoginSession,
  readAlipayLoginStatus,
  readWechatLoginStatus,
  type AlipayLoginSession,
  type WechatLoginSession
} from "../services/sprixApi";
import { showRequestError } from "../components/requestErrors";
import { isSessionExpired, type QrLoginProvider } from "./authTypes";

type QrLoginSession = AlipayLoginSession | WechatLoginSession;

type UseQrLoginSessionOptions = {
  provider: QrLoginProvider;
  active: boolean;
  onAuthenticated: () => Promise<void>;
};

export function useQrLoginSession({ provider, active, onAuthenticated }: UseQrLoginSessionOptions) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<QrLoginSession>();
  const [status, setStatus] = useState("WAITING");
  const [expiresInSeconds, setExpiresInSeconds] = useState(0);
  const [bindTicket, setBindTicket] = useState<string>();

  const start = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setSession(undefined);
    setStatus("WAITING");
    setExpiresInSeconds(0);
    setBindTicket(undefined);
    try {
      const nextSession = provider === "alipay" ? await createAlipayLoginSession() : await createWechatLoginSession();
      setSession(nextSession);
      setStatus("PENDING");
      setExpiresInSeconds(nextSession.expiresInSeconds);
    } catch (error) {
      setStatus("ERROR");
      showRequestError(error, provider === "alipay" ? "支付宝登录失败" : "微信登录失败", provider === "alipay" ? "支付宝登录失败：" : "微信登录失败：");
    } finally {
      setLoading(false);
    }
  }, [active, provider]);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      setSession(undefined);
      setStatus("WAITING");
      setExpiresInSeconds(0);
      setBindTicket(undefined);
      return;
    }
    if (!session && !loading && status !== "ERROR") {
      void start();
    }
  }, [active, loading, session, start, status]);

  useEffect(() => {
    if (!active || !session) return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const nextStatus =
          provider === "alipay" ? await readAlipayLoginStatus(session.sessionId) : await readWechatLoginStatus(session.sessionId);
        if (cancelled) return;
        setStatus(nextStatus.status);
        setExpiresInSeconds(nextStatus.expiresInSeconds);
        setBindTicket(nextStatus.bindTicket);
        if (nextStatus.authenticated) {
          await onAuthenticated();
          return;
        }
        if (nextStatus.phoneBindRequired && nextStatus.bindTicket) {
          return;
        }
        if (nextStatus.expiresInSeconds <= 0 || nextStatus.status.toUpperCase() === "EXPIRED") {
          timeoutId = window.setTimeout(() => {
            if (!cancelled) void start();
          }, 300);
          return;
        }
        if (isSessionExpired(nextStatus.status, nextStatus.expiresInSeconds)) return;
        timeoutId = window.setTimeout(poll, session.pollIntervalMs);
      } catch (error) {
        if (cancelled) return;
        setStatus("ERROR");
        showRequestError(
          error,
          provider === "alipay" ? "支付宝登录状态获取失败" : "微信登录状态获取失败",
          provider === "alipay" ? "支付宝登录状态获取失败：" : "微信登录状态获取失败："
        );
      }
    };

    timeoutId = window.setTimeout(poll, session.pollIntervalMs);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [active, onAuthenticated, provider, session, start]);

  return { loading, session, status, expiresInSeconds, bindTicket, refresh: start };
}
