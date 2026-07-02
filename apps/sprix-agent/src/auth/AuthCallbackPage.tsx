import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { buildRemoteAlipayBindCallbackUrl, confirmAlipayLoginCallback, confirmWechatLoginCallback } from "../services/sprixApi";

type CallbackState =
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "phone_bind" }
  | { kind: "bind_success" }
  | { kind: "bind_failed" };

function getSearchValue(searchParams: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value?.trim()) return value.trim();
  }
  return "";
}

export function FaceVerificationCallbackPage() {
  return (
    <main className="sprix-auth-callback-page">
      <section className="sprix-auth-callback-card">
        <div className="sprix-auth-callback-icon is-success">
          <CheckCircle2 size={32} />
        </div>
        <div>
          <span className="sprix-auth-callback-kicker">支付宝人脸核验</span>
          <h1>核验结果已返回</h1>
          <p>请回到 Sprix 页面继续操作，系统会自动同步核验结果；如果页面未更新，请点击完成确认。</p>
        </div>
      </section>
    </main>
  );
}

export function AuthCallbackPage() {
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>({ kind: "loading" });
  const normalizedProvider = provider === "wechat" ? "wechat" : "alipay";
  const scene = searchParams.get("scene")?.trim();
  const resultStatus = searchParams.get("status")?.trim();
  const isAlipayBindScene = normalizedProvider === "alipay" && scene === "bind";

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
      if (isAlipayBindScene) {
        setState(resultStatus === "success" ? { kind: "bind_success" } : { kind: "bind_failed" });
        return;
      }

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
        if (normalizedProvider === "alipay" && isMissingAlipayLoginSession(error)) {
          window.location.replace(buildRemoteAlipayBindCallbackUrl(callbackParams.code, callbackParams.state));
          return;
        }
        setState(fallbackSuccess);
      }
    }

    void confirmCallback();

    return () => {
      cancelled = true;
    };
  }, [callbackParams.code, callbackParams.state, isAlipayBindScene, normalizedProvider, resultStatus]);

  const isLoading = state.kind === "loading";
  const isError = state.kind === "bind_failed";
  const copy = getCallbackCopy(state, isLoading, isAlipayBindScene);

  return (
    <main className="sprix-auth-callback-page">
      <section className="sprix-auth-callback-card">
        <div className={`sprix-auth-callback-icon ${isLoading ? "" : isError ? "is-error" : "is-success"}`}>
          {isLoading ? <Loader2 size={30} /> : isError ? <XCircle size={32} /> : <CheckCircle2 size={32} />}
        </div>
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </section>
    </main>
  );
}

function isMissingAlipayLoginSession(error: unknown) {
  return error instanceof Error && error.message.includes("Alipay login session not found");
}

function getCallbackCopy(state: CallbackState, isLoading: boolean, isAlipayBindScene: boolean) {
  if (isAlipayBindScene) {
    if (isLoading) {
      return {
        title: "正在确认授权",
        description: "正在确认收款支付宝绑定结果，请不要关闭页面。"
      };
    }
    if (state.kind === "bind_success") {
      return {
        title: "成功",
        description: "授权已完成，请回到 Sprix 页面继续使用。"
      };
    }
    return {
      title: "收款支付宝绑定未完成",
      description: "请回到 Sprix 页面刷新二维码后重试。"
    };
  }

  return {
    title: isLoading ? "正在确认授权" : "成功",
    description: isLoading
      ? "正在确认扫码结果，请不要关闭页面。"
      : state.kind === "phone_bind"
        ? "授权已完成，请回到电脑端继续绑定手机号。"
        : "请回到电脑端继续使用 Sprix AI。"
  };
}
