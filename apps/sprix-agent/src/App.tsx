import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation, useNavigate } from "react-router-dom";
import { message } from "antd";
import {
  AccountModal,
  AgreementModal,
  AppealModal,
  BindAlipayModal,
  ContactModal,
  LoginRegisterModal,
  useGlobalModalState
} from "./components/GlobalModals";
import { UserShell } from "./components/Layout";
import {
  AgentCenterPage,
  EarningsPage,
  LandingPage,
  MyTaskDetailPage,
  MyTasksPage,
  QualificationPage,
  QualificationPromptModal,
  TaskDetailPage,
  TaskMarketPage
} from "./user/UserPages";
import { LocalAgentClaimPage } from "./user/LocalAgentClaimPage";
import { useRemoteSprixBootstrap } from "./services/useRemoteSprixBootstrap";
import { useSprixStore } from "./store/sprixStore";
import { canVisitAgentCenterBeforeAdmission, getUserAdmissionState } from "./user/admission";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RemoteSprixBridge />
      <Router>
        <ConsumerAppRoutes />
      </Router>
    </QueryClientProvider>
  );
}

function RemoteSprixBridge() {
  useRemoteSprixBootstrap();
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

  const title = useMemo(() => {
    if (location.pathname.includes("/agent/center")) return "Agent 中心";
    if (location.pathname.includes("/agent/my-tasks")) return "我的任务";
    if (location.pathname.includes("/agent/earnings")) return "提现记录";
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

  useEffect(() => {
    const handleAuthRequired = () => {
      logout();
      queryClient.removeQueries({ queryKey: ["sprix-agent"] });
      setAfterLogin(undefined);
      setAfterBind(undefined);
      setQualificationTaskId(undefined);
      setQualificationOpen(false);
      setAppealExecutionId(null);
      closeAll();
      open("login");
      navigate("/", { replace: true, state: { admissionReason: "登录已过期，请重新登录" } });
    };

    window.addEventListener("sprix-auth-required", handleAuthRequired);
    return () => window.removeEventListener("sprix-auth-required", handleAuthRequired);
  }, [closeAll, logout, navigate, open]);

  const userPageProps = {
    openLogin,
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
      <Routes>
        <Route path="/" element={<LandingPage {...userPageProps} />} />
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

      <LoginRegisterModal
        open={modal.login}
        onClose={() => close("login")}
        afterLogin={() => {
          afterLogin?.();
          setAfterLogin(undefined);
        }}
      />
      <AccountModal
        open={modal.account}
        onClose={() => close("account")}
        onBindAlipay={() => {
          close("account");
          openBindAlipay();
        }}
      />
      <AgreementModal open={modal.agreements} onClose={() => close("agreements")} />
      <ContactModal open={modal.contact} onClose={() => close("contact")} />
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
  const agents = useSprixStore((state) => state.agents);
  const admission = getUserAdmissionState(account, agents);

  if (account.isLoggedIn && canVisitAgentCenterBeforeAdmission(location.pathname)) {
    return <>{children}</>;
  }

  if (!admission.allowed) {
    return <Navigate to="/" replace state={{ admissionReason: admission.reason, from: location.pathname, openLogin: !account.isLoggedIn }} />;
  }

  return <>{children}</>;
}

function UserRoutes(props: {
  openLogin: () => void;
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
      <Route path="my-tasks/:id" element={<MyTaskDetailPage />} />
      <Route path="earnings" element={<EarningsPage {...props} />} />
      <Route path="qualification" element={<QualificationPage {...props} />} />
      <Route path="*" element={<Navigate to="market" replace />} />
    </Routes>
  );
}
