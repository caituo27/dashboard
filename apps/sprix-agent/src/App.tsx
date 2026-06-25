import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { message } from "antd";
import {
  AccountModal,
  AgreementModal,
  AppealModal,
  BindAlipayModal,
  ContactModal,
  LoginRegisterModal,
  WithdrawRequestModal,
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
  TaskMarketPage,
  WithdrawAccountPage
} from "./user/UserPages";
import { useRemoteSprixBootstrap } from "./services/useRemoteSprixBootstrap";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RemoteSprixBridge />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/agent/market" replace />} />
          <Route path="/agent/*" element={<UserRoutes />} />
          <Route path="*" element={<Navigate to="/agent/market" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

function RemoteSprixBridge() {
  useRemoteSprixBootstrap();
  return null;
}

function UserRoutes() {
  const location = useLocation();
  const { modal, open, close } = useGlobalModalState();
  const [afterLogin, setAfterLogin] = useState<(() => void) | undefined>();
  const [afterBind, setAfterBind] = useState<(() => void) | undefined>();
  const [qualificationTaskId, setQualificationTaskId] = useState<string | undefined>();
  const [appealExecutionId, setAppealExecutionId] = useState<string | null>(null);
  const [qualificationOpen, setQualificationOpen] = useState(false);

  const title = useMemo(() => {
    if (location.pathname.includes("/agent/center")) return "Agent 中心";
    if (location.pathname.includes("/agent/my-tasks")) return "我的任务";
    if (location.pathname.includes("/agent/earnings")) return "报酬结算";
    if (location.pathname.includes("/agent/qualification")) return "接单资格";
    if (location.pathname.includes("/agent/withdraw-account")) return "绑定收款方式";
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

  const userPageProps = {
    openLogin,
    openBindAlipay,
    openWithdraw: () => open("withdraw"),
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
    <UserShell
      title={title}
      onOpenLogin={() => openLogin()}
      onOpenAccount={() => open("account")}
      onOpenAgreements={() => open("agreements")}
      onOpenContact={() => open("contact")}
    >
      <Routes>
        <Route index element={<Navigate to="market" replace />} />
        <Route path="market" element={<TaskMarketPage {...userPageProps} />} />
        <Route path="task/:id" element={<TaskDetailPage {...userPageProps} />} />
        <Route path="center" element={<AgentCenterPage {...userPageProps} />} />
        <Route path="my-tasks" element={<MyTasksPage {...userPageProps} />} />
        <Route path="my-tasks/:id" element={<MyTaskDetailPage />} />
        <Route path="earnings" element={<EarningsPage {...userPageProps} />} />
        <Route path="qualification" element={<QualificationPage />} />
        <Route path="withdraw-account" element={<WithdrawAccountPage {...userPageProps} />} />
        <Route path="*" element={<Navigate to="market" replace />} />
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
      <WithdrawRequestModal open={modal.withdraw} onClose={() => close("withdraw")} />
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
    </UserShell>
  );
}
