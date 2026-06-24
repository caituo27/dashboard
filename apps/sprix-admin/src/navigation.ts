import type { LucideIcon } from "lucide-react";
import { CircleDollarSign, ClipboardList, ShieldCheck } from "lucide-react";

export type SiteRoute = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
};

export const adminRoutes: SiteRoute[] = [
  { key: "tasks", label: "任务管理中心", path: "/tasks", icon: ClipboardList },
  { key: "appeals", label: "申诉处理中心", path: "/appeals", icon: ShieldCheck },
  { key: "funds", label: "资金管理中心", path: "/funds", icon: CircleDollarSign }
];
