import type { LucideIcon } from "lucide-react";
import { ClipboardCheck, ClipboardList, LayoutDashboard, ShieldCheck } from "lucide-react";

export type SiteRoute = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
};

export const adminRoutes: SiteRoute[] = [
  { key: "dashboard", label: "数据概览", path: "/dashboard", icon: LayoutDashboard },
  { key: "tasks", label: "任务管理中心", path: "/tasks", icon: ClipboardList },
  { key: "acceptance", label: "平台验收中心", path: "/acceptance", icon: ClipboardCheck },
  { key: "appeals", label: "申诉处理中心", path: "/appeals", icon: ShieldCheck }
];
