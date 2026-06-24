import type { LucideIcon } from "lucide-react";
import { Bot, CircleDollarSign, ClipboardList, LayoutDashboard } from "lucide-react";

export type SiteRoute = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
};

export const userRoutes: SiteRoute[] = [
  { key: "market", label: "任务市场", path: "/agent/market", icon: LayoutDashboard },
  { key: "myTasks", label: "我的任务", path: "/agent/my-tasks", icon: ClipboardList },
  { key: "earnings", label: "报酬结算", path: "/agent/earnings", icon: CircleDollarSign },
  { key: "agents", label: "Agent 中心", path: "/agent/center", icon: Bot }
];
