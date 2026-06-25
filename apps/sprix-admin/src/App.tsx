import { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { AdminAppealCenter, AdminAppealDetail, AdminFundCenter, AdminTaskCenter, AdminTaskDetail, AdminTaskForm } from "./admin/AdminPages";
import { AdminShell } from "./components/Layout";
import { useRemoteSprixBootstrap } from "./services/useRemoteSprixBootstrap";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RemoteSprixBridge />
      <Router>
        <Routes>
          <Route path="/*" element={<AdminRoutes />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

function RemoteSprixBridge() {
  useRemoteSprixBootstrap();
  return null;
}

function AdminRoutes() {
  const location = useLocation();
  const title = useMemo(() => {
    if (location.pathname.includes("/appeals")) return "申诉处理中心";
    if (location.pathname.includes("/funds")) return "资金管理中心";
    if (location.pathname.includes("/tasks/new")) return "发布新任务";
    if (location.pathname.includes("/tasks/")) return "任务详情";
    return "任务管理中心";
  }, [location.pathname]);

  return (
    <AdminShell title={title}>
      <Routes>
        <Route index element={<Navigate to="tasks" replace />} />
        <Route path="tasks" element={<AdminTaskCenter />} />
        <Route path="tasks/new" element={<AdminTaskForm />} />
        <Route path="tasks/:id" element={<AdminTaskDetail />} />
        <Route path="appeals" element={<AdminAppealCenter />} />
        <Route path="appeals/:id" element={<AdminAppealDetail />} />
        <Route path="funds/*" element={<AdminFundCenter />} />
        <Route path="*" element={<Navigate to="tasks" replace />} />
      </Routes>
    </AdminShell>
  );
}
