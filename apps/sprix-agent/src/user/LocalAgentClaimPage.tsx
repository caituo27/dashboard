import { useEffect, useRef, useState } from "react";
import { Button, Result, Spin, message } from "antd";
import { useSearchParams } from "react-router-dom";
import { LoginRegisterModal } from "../components/GlobalModals";
import { buildLocalAgentClaimUrl, createLocalAgentEnrollment, hasStoredAuthToken } from "../services/sprixApi";

type ClaimStatus = "checking" | "login-required" | "enrolling" | "redirecting" | "invalid" | "failed";

export function LocalAgentClaimPage() {
  const [searchParams] = useSearchParams();
  const claimToken = searchParams.get("claimToken") ?? "";
  const enrollmentToken = searchParams.get("enrollmentToken") ?? "";
  const [status, setStatus] = useState<ClaimStatus>("checking");
  const [loginOpen, setLoginOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const enrollmentStartedRef = useRef(false);

  const redirectToBackendClaim = (nextEnrollmentToken: string) => {
    const claimUrl = buildLocalAgentClaimUrl(claimToken, nextEnrollmentToken);
    const targetUrl = new URL(claimUrl, window.location.origin);
    const currentUrl = new URL(window.location.href);

    if (targetUrl.origin === currentUrl.origin && targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
      setErrorMessage("后端连接地址未生效，请检查 Local Agent claim 路由是否已转发到后端。");
      setStatus("failed");
      return;
    }

    setStatus("redirecting");
    window.location.replace(targetUrl.toString());
  };

  const startEnrollment = async () => {
    if (enrollmentStartedRef.current) return;
    enrollmentStartedRef.current = true;
    setStatus("enrolling");

    try {
      const enrollment = await createLocalAgentEnrollment(claimToken);
      redirectToBackendClaim(enrollment.enrollmentToken);
    } catch (error) {
      enrollmentStartedRef.current = false;
      const messageText = error instanceof Error ? error.message : "本机 Agent 连接失败";
      setErrorMessage(messageText);
      setStatus("failed");
      message.error(messageText);
    }
  };

  useEffect(() => {
    if (!claimToken) {
      setStatus("invalid");
      return;
    }

    if (enrollmentToken) {
      redirectToBackendClaim(enrollmentToken);
      return;
    }

    if (!hasStoredAuthToken()) {
      setStatus("login-required");
      setLoginOpen(true);
      return;
    }

    void startEnrollment();
  }, [claimToken, enrollmentToken]);

  const retry = () => {
    setErrorMessage("");
    if (!hasStoredAuthToken()) {
      setStatus("login-required");
      setLoginOpen(true);
      return;
    }
    void startEnrollment();
  };

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="sprix-card w-full max-w-[520px] px-6 py-8 text-center">
        {status === "invalid" && <Result status="warning" title="连接链接无效" subTitle="请重新从 LocalCLIAgent 打开连接。" />}

        {status === "login-required" && (
          <Result
            status="info"
            title="正在连接本机 Agent"
            subTitle="请先登录 Sprix，登录完成后会继续连接。"
            extra={
              <Button type="primary" shape="round" onClick={() => setLoginOpen(true)}>
                登录 Sprix
              </Button>
            }
          />
        )}

        {(status === "checking" || status === "enrolling" || status === "redirecting") && (
          <div className="py-12">
            <Spin size="large" />
            <h1 className="mt-6 text-xl font-semibold text-ink">
              {status === "redirecting" ? "正在完成连接" : "正在连接本机 Agent"}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">请不要关闭当前页面。</p>
          </div>
        )}

        {status === "failed" && (
          <Result
            status="error"
            title="连接失败"
            subTitle={errorMessage || "请稍后重试。"}
            extra={
              <Button type="primary" shape="round" onClick={retry}>
                重试
              </Button>
            }
          />
        )}
      </section>

      <LoginRegisterModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        afterLogin={() => {
          setLoginOpen(false);
          void startEnrollment();
        }}
      />
    </main>
  );
}
