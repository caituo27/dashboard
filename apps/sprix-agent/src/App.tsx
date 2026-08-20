import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation, useNavigate } from "react-router-dom";
import { message } from "antd";
import {
  AccountModal,
  AgreementModal,
  AppealModal,
  AboutModal,
  AuthModal,
  BindAlipayModal,
  ContactModal,
  useGlobalModalState
} from "./components/GlobalModals";
import { UserShell } from "./components/Layout";
import {
  AgentCenterPage,
  EarningsPage,
  MyTaskDetailPage,
  MyTasksPage,
  QualificationPage,
  QualificationPromptModal,
  TaskDetailPage,
  TaskMarketPage
} from "./user/UserPages";
import { LocalAgentClaimPage } from "./user/LocalAgentClaimPage";
import { HomePage } from "./home/HomePage";
import { AuthCallbackPage } from "./auth/AuthCallbackPage";
import { useRemoteSprixBootstrap } from "./services/useRemoteSprixBootstrap";
import { logoutConsumer, markRemoteCurrentAgent, readAgentSnapshot, readRemoteAgentEvaluation } from "./services/sprixApi";
import { useSprixStore } from "./store/sprixStore";
import { canVisitAgentDuringEvaluation, getUserAdmissionState } from "./user/admission";
import { isGlobalAuthError } from "./utils/http";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ConsumerAppRoutes />
      </Router>
    </QueryClientProvider>
  );
}

function RemoteSprixBridge({ bootstrapEnabled, pollEvaluation }: { bootstrapEnabled: boolean; pollEvaluation: boolean }) {
  useRemoteSprixBootstrap(bootstrapEnabled);

  const evaluationFlow = useSprixStore((state) => state.evaluationFlow);
  const setEvaluationFlow = useSprixStore((state) => state.setEvaluationFlow);
  const clearEvaluationFlow = useSprixStore((state) => state.clearEvaluationFlow);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const queryClient = useQueryClient();
  const evaluationPollInFlightRef = useRef(false);

  useEffect(() => {
    if (!pollEvaluation || !evaluationFlow) return;

    let cancelled = false;
    const syncEvaluationFlow = async () => {
      if (evaluationPollInFlightRef.current) return;
      evaluationPollInFlightRef.current = true;
      try {
        const evaluation = await readRemoteAgentEvaluation(evaluationFlow.agentId, evaluationFlow.evaluationId);
        if (cancelled) return;
        if (evaluation.status === "running" || evaluation.status === "judging") {
          setEvaluationFlow({
            agentId: evaluationFlow.agentId,
            evaluationId: evaluationFlow.evaluationId,
            status: evaluation.status,
            wasCurrentAgent: evaluationFlow.wasCurrentAgent
          });
        } else {
          const remoteState = await readAgentSnapshot();
          if (cancelled) return;
          const { activeEvaluationFlow: _activeEvaluationFlow, ...snapshotAfterEvaluation } = remoteState;
          let stateAfterEvaluation = snapshotAfterEvaluation;
          if (evaluation.status === "completed" && evaluationFlow.wasCurrentAgent === true && stateAfterEvaluation.currentAgent?.id !== evaluationFlow.agentId) {
            const restoredCurrentAgent = await markRemoteCurrentAgent(evaluationFlow.agentId);
            if (cancelled) return;
            if (restoredCurrentAgent) {
              stateAfterEvaluation = {
                ...stateAfterEvaluation,
                currentAgentId: restoredCurrentAgent.id,
                currentAgent: restoredCurrentAgent
              };
            }
          }
          mergeRemoteState(stateAfterEvaluation);
          queryClient.setQueryData(["sprix-agent", "snapshot"], stateAfterEvaluation);
          queryClient.setQueryData(["sprix-agent", "home-bootstrap"], stateAfterEvaluation);
          clearEvaluationFlow();
        }
      } catch {
        // Keep the active flow on transient errors so navigation is not interrupted.
      } finally {
        evaluationPollInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(syncEvaluationFlow, 1_500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clearEvaluationFlow, evaluationFlow, mergeRemoteState, pollEvaluation, queryClient, setEvaluationFlow]);

  return null;
}

function ConsumerAppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { modal, open, close, closeAll } = useGlobalModalState();
  const logout = useSprixStore((state) => state.logout);
  const [afterLogin, setAfterLogin] = useState<(() => void) | undefined>();
  const [afterBind, setAfterBind] = useState<(() => void) | undefined>();
  const [qualificationTaskId, setQualificationTaskId] = useState<string | undefined>();
  const [appealExecutionId, setAppealExecutionId] = useState<string | null>(null);
  const [qualificationOpen, setQualificationOpen] = useState(false);
  const normalizedPathname = location.pathname.replace(/\/+$/, "") || "/";

  const title = useMemo(() => {
    if (location.pathname.includes("/agent/center")) return "Agent 中心";
    if (location.pathname.includes("/agent/my-tasks")) return "我的任务";
    if (location.pathname.includes("/agent/earnings")) return "打款记录";
    if (location.pathname.includes("/agent/qualification")) return "接单资格";
    if (location.pathname.includes("/agent/task/")) return "任务详情";
    return "任务市场";
  }, [location.pathname]);

  const openLogin = (callback?: () => void) => {
    setAfterLogin(() => callback);
    open("login");
  };

  const openBindAlipay = (callback?: () => void) => {
    setAfterBind(() => callback);
    open("bindAlipay");
  };

  const handleLogout = async () => {
    try {
      await logoutConsumer();
    } catch (error) {
      if (isGlobalAuthError(error)) return;
    } finally {
      logout();
      queryClient.removeQueries({ queryKey: ["sprix-agent"] });
      closeAll();
      navigate("/");
      message.success("已退出登录");
    }
  };

  useEffect(() => {
    const handleAuthRequired = (event: Event) => {
      localStorage.removeItem("sprix-auth-token");
      logout();
      queryClient.removeQueries({ queryKey: ["sprix-agent"] });
      setAfterLogin(undefined);
      setAfterBind(undefined);
      setQualificationTaskId(undefined);
      setQualificationOpen(false);
      setAppealExecutionId(null);
      closeAll();
      const message =
        event instanceof CustomEvent && typeof event.detail?.message === "string" && event.detail.message.trim()
          ? event.detail.message
          : "登录已过期，请重新登录";
      navigate("/", { replace: true, state: { admissionReason: message } });
    };

    window.addEventListener("sprix-auth-required", handleAuthRequired);
    return () => window.removeEventListener("sprix-auth-required", handleAuthRequired);
  }, [closeAll, logout, navigate]);

  const userPageProps = {
    openLogin,
    openAccount: () => open("account"),
    openBindAlipay,
    openQualificationPrompt: (taskId?: string) => {
      setQualificationTaskId(taskId);
      setQualificationOpen(true);
    },
    openAppeal: (executionId: string) => {
      setAppealExecutionId(executionId);
      open("appeal" as never);
    }
  };

  return (
    <>
      <RemoteSprixBridge
        bootstrapEnabled={location.pathname.startsWith("/agent")}
        // Home and Agent Center own their modal/progress UI and poll locally;
        // the bridge takes over only after navigation to another module.
        pollEvaluation={normalizedPathname !== "/" && normalizedPathname !== "/agent/center"}
      />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              openLogin={openLogin}
              openContact={() => open("contact")}
              openAbout={() => open("about")}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="/auth/callback/alipay/face" element={<AuthCallbackPage />} />
        <Route path="/auth/callback/:provider" element={<AuthCallbackPage />} />
        <Route path="/local-agent/claim" element={<LocalAgentClaimPage />} />
        <Route
          path="/agent/*"
          element={
            <AdmissionGate>
              <UserShell
                title={title}
                onOpenLogin={() => openLogin()}
                onOpenAccount={() => open("account")}
                onOpenAgreements={() => open("agreements")}
                onOpenContact={() => open("contact")}
              >
                <UserRoutes {...userPageProps} />
              </UserShell>
            </AdmissionGate>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AuthModal
        open={modal.login}
        onClose={() => close("login")}
        onLoginSuccess={() => {
          afterLogin?.();
          setAfterLogin(undefined);
        }}
      />
      <AccountModal
        open={modal.account}
        onClose={() => close("account")}
        onOpenQualification={() => {
          setQualificationTaskId(undefined);
          setQualificationOpen(true);
        }}
        onBindAlipay={() => {
          close("account");
          openBindAlipay();
        }}
      />
      <AgreementModal open={modal.agreements} onClose={() => close("agreements")} />
      <ContactModal open={modal.contact} onClose={() => close("contact")} />
      <AboutModal open={modal.about} onClose={() => close("about")} />
      <BindAlipayModal
        open={modal.bindAlipay}
        onClose={() => close("bindAlipay")}
        afterBind={() => {
          afterBind?.();
          setAfterBind(undefined);
        }}
      />
      <AppealModal
        open={Boolean((modal as Record<string, boolean>).appeal)}
        executionId={appealExecutionId}
        onClose={() => {
          setAppealExecutionId(null);
          message.destroy();
          close("appeal" as never);
        }}
      />
      <QualificationPromptModal
        open={qualificationOpen}
        taskId={qualificationTaskId}
        onClose={() => {
          setQualificationTaskId(undefined);
          setQualificationOpen(false);
        }}
      />
    </>
  );
}

function AdmissionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const account = useSprixStore((state) => state.account);
  const currentAgent = useSprixStore((state) => state.currentAgent);
  const evaluationFlow = useSprixStore((state) => state.evaluationFlow);
  const remoteSnapshotReady = useSprixStore((state) => state.remoteSnapshotReady);

  const admission = getUserAdmissionState(account, currentAgent);

  if (account.isLoggedIn && !remoteSnapshotReady) {
    return <>{children}</>;
  }

  if (account.isLoggedIn && evaluationFlow?.wasCurrentAgent === true && canVisitAgentDuringEvaluation(location.pathname)) {
    return <>{children}</>;
  }

  if (!admission.allowed) {
    return <Navigate to="/" replace state={{ admissionReason: admission.reason, from: location.pathname }} />;
  }

  return <>{children}</>;
}

function UserRoutes(props: {
  openLogin: () => void;
  openAccount: () => void;
  openBindAlipay: (afterBind?: () => void) => void;
  openQualificationPrompt: (taskId?: string) => void;
  openAppeal: (executionId: string) => void;
}) {
  return (
    <Routes>
      <Route index element={<Navigate to="market" replace />} />
      <Route path="market" element={<TaskMarketPage {...props} />} />
      <Route path="task/:id" element={<TaskDetailPage {...props} />} />
      <Route path="center" element={<AgentCenterPage {...props} />} />
      <Route path="my-tasks" element={<MyTasksPage {...props} />} />
      <Route path="my-tasks/:id" element={<MyTaskDetailPage {...props} />} />
      <Route path="earnings" element={<EarningsPage {...props} />} />
      <Route path="qualification" element={<QualificationPage {...props} />} />
      <Route path="*" element={<Navigate to="market" replace />} />
    </Routes>
  );
}
