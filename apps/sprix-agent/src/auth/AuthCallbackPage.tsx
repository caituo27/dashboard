import { useEffect, useMemo, useState } from "react";
import { Button } from "antd";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { confirmAlipayLoginCallback, confirmWechatLoginCallback, type ThirdPartyLoginCallbackStatus } from "../services/sprixApi";

type CallbackState =
  | { kind: "loading" }
  | { kind: "success"; status: ThirdPartyLoginCallbackStatus }
  | { kind: "phone_bind"; status: ThirdPartyLoginCallbackStatus }
  | { kind: "error"; message: string };

function getProviderCopy(provider?: string) {
  return provider === "wechat" ? "微信" : "支付宝";
}

function getSearchValue(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value?.trim()) return value.trim();
  }
  return "";
}

export function AuthCallbackPage() {
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>({ kind: "loading" });
  const normalizedProvider = provider === "wechat" ? "wechat" : "alipay";
  const providerLabel = getProviderCopy(normalizedProvider);

  const callbackParams = useMemo(() => {
    const stateValue = getSearchValue(searchParams, ["state", "sessionId", "session_id"]);
    const code = getSearchValue(searchParams, normalizedProvider === "wechat" ? ["code"] : ["auth_code", "authCode", "code"]);
    const error = getSearchValue(searchParams, ["error", "error_description", "message"]);
    return { code, state: stateValue, error };
  }, [normalizedProvider, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function confirmCallback() {
      if (callbackParams.error) {
        setState({ kind: "error", message: callbackParams.error });
        return;
      }

      if (!callbackParams.code || !callbackParams.state) {
        setState({ kind: "error", message: "回调参数不完整，请回到电脑端重新扫码。" });
        return;
      }

      try {
        const nextStatus =
          normalizedProvider === "wechat"
            ? await confirmWechatLoginCallback(callbackParams.code, callbackParams.state)
            : await confirmAlipayLoginCallback(callbackParams.code, callbackParams.state);
        if (cancelled) return;
        setState(nextStatus.phoneBindRequired ? { kind: "phone_bind", status: nextStatus } : { kind: "success", status: nextStatus });
      } catch (error) {
        if (cancelled) return;
        setState({ kind: "error", message: error instanceof Error ? error.message : "扫码回调处理失败，请重新扫码。" });
      }
    }

    void confirmCallback();

    return () => {
      cancelled = true;
    };
  }, [callbackParams.code, callbackParams.error, callbackParams.state, normalizedProvider]);

  const isLoading = state.kind === "loading";
  const isSuccess = state.kind === "success" || state.kind === "phone_bind";

  return (
    <main className="sprix-auth-callback-page">
      <section className="sprix-auth-callback-card">
        <div className={`sprix-auth-callback-icon ${isSuccess ? "is-success" : state.kind === "error" ? "is-error" : ""}`}>
          {isLoading ? <Loader2 size={30} /> : isSuccess ? <CheckCircle2 size={32} /> : <CircleAlert size={32} />}
        </div>
        <div>
          <span className="sprix-auth-callback-kicker">{providerLabel}扫码登录</span>
          <h1>{isLoading ? "正在确认授权" : isSuccess ? "扫码授权成功" : "扫码授权失败"}</h1>
          <p>
            {isLoading
              ? "正在确认扫码结果，请不要关闭页面。"
              : state.kind === "phone_bind"
                ? "授权已完成，请回到电脑端继续绑定手机号。"
                : state.kind === "success"
                  ? "授权已完成，请回到电脑端继续使用 Sprix AI。"
                  : state.message}
          </p>
        </div>
        <Button type="primary" shape="round" size="large" onClick={() => window.close()}>
          关闭页面
        </Button>
      </section>
    </main>
  );
}
