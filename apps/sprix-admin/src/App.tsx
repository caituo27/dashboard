import { adminQueryClient } from "./services/adminQueryClient";
import { useMemo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AdminLoginPage, hasAdminToken } from "./admin/AdminLoginPage";
import {
  AdminAcceptanceCenter,
  AdminAcceptanceDetail,
  AdminAppealCenter,
  AdminAppealDetail,
  AdminTaskCenter,
  AdminTaskDetail,
  AdminTaskExecutionResultDetail,
  AdminTaskForm
} from "./admin/AdminPages";
import { AdminShell } from "./components/Layout";
import { AdminDashboard } from "./admin/AdminDashboard";
import {AdminBehaviorAnalytics} from './admin/AdminBehaviorAnalytics';

const queryClient = adminQueryClient;
for (const key of ["task-center", "task-detail", "acceptance-reviews", "appeals", "appeal-detail"]) {
  queryClient.setQueryDefaults(["sprix-admin", key], { staleTime: 0, refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route path="/*" element={<RequireAdminAuth><AdminRoutes /></RequireAdminAuth>} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

function RequireAdminAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!hasAdminToken()) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return children;
}

function AdminRoutes() {
  const location = useLocation();
  const title = useMemo(() => {
    if (location.pathname === "/dashboard") return "数据概览";
    if (location.pathname === "/behavior-analytics") return "行为数据分析";
    if (location.pathname.includes("/appeals")) return "申诉处理中心";
    if (location.pathname.includes("/acceptance")) return "平台验收中心";
    if (location.pathname.match(/^\/tasks\/[^/]+\/edit$/)) return "编辑任务";
    if (location.pathname.includes("/tasks/new")) return "发布新任务";
    if (location.pathname.includes("/tasks/")) return "任务详情";
    return "任务管理中心";
  }, [location.pathname]);

  return (
    <AdminShell title={title}>
      <Routes>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="behavior-analytics" element={<AdminBehaviorAnalytics />} />
        <Route path="tasks" element={<AdminTaskCenter />} />
        <Route path="tasks/new" element={<AdminTaskForm />} />
        <Route path="tasks/:id/edit" element={<AdminTaskForm />} />
        <Route path="tasks/:taskId/results/:executionId" element={<AdminTaskExecutionResultDetail />} />
        <Route path="tasks/:id" element={<AdminTaskDetail />} />
        <Route path="acceptance" element={<AdminAcceptanceCenter />} />
        <Route path="acceptance/:executionId" element={<AdminAcceptanceDetail />} />
        <Route path="appeals" element={<AdminAppealCenter />} />
        <Route path="appeals/:id" element={<AdminAppealDetail />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </AdminShell>
  );
}
