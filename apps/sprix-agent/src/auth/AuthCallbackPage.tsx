import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { confirmAlipayLoginCallback, confirmWechatLoginCallback } from "../services/sprixApi";

type CallbackState =
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "phone_bind" };

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
    const code = getSearchValue(
      searchParams,
      normalizedProvider === "wechat" ? ["code"] : ["auth_code", "authCode", "app_auth_code", "appAuthCode", "code"]
    );
    return { code, state: stateValue };
  }, [normalizedProvider, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const fallbackSuccess: CallbackState = { kind: "success" };

    async function confirmCallback() {
      if (!callbackParams.code || !callbackParams.state) {
        setState(fallbackSuccess);
        return;
      }

      try {
        const nextStatus =
          normalizedProvider === "wechat"
            ? await confirmWechatLoginCallback(callbackParams.code, callbackParams.state)
            : await confirmAlipayLoginCallback(callbackParams.code, callbackParams.state);
        if (cancelled) return;
        setState(nextStatus.phoneBindRequired ? { kind: "phone_bind" } : { kind: "success" });
      } catch (error) {
        if (cancelled) return;
        setState(fallbackSuccess);
      }
    }

    void confirmCallback();

    return () => {
      cancelled = true;
    };
  }, [callbackParams.code, callbackParams.state, normalizedProvider]);

  const isLoading = state.kind === "loading";

  return (
    <main className="sprix-auth-callback-page">
      <section className="sprix-auth-callback-card">
        <div className={`sprix-auth-callback-icon ${isLoading ? "" : "is-success"}`}>
          {isLoading ? <Loader2 size={30} /> : <CheckCircle2 size={32} />}
        </div>
        <div>
          <span className="sprix-auth-callback-kicker">{providerLabel}扫码登录</span>
          <h1>{isLoading ? "正在确认授权" : "扫码授权成功"}</h1>
          <p>
            {isLoading
              ? "正在确认扫码结果，请不要关闭页面。"
              : state.kind === "phone_bind"
                ? "授权已完成，请回到电脑端继续绑定手机号。"
                : "授权已完成，请回到电脑端继续使用 Sprix AI。"}
          </p>
        </div>
      </section>
    </main>
  );
}
