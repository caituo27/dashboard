import { Bot, CircleDollarSign, ClipboardList, Files, Users } from "lucide-react";
import { MetricCard } from "../components/Primitives";
import { DashboardNumber } from "./DashboardMotion";
import type { DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";

export function DashboardOverview({ overview, taskTotal, onOrders }: Pick<DashboardAnalyticsSnapshot, "overview"> & {taskTotal:number;onOrders?:()=>void}) {
  return <div className="dashboard-overview">
    <div className="dashboard-metrics">
      <MetricCard onClick={onOrders} title="累计订单" value={<DashboardNumber value={overview.orders} />} icon={<ClipboardList size={18} />} />
      <MetricCard title="累计任务" value={<DashboardNumber value={taskTotal} />} icon={<Files size={18} />} />
      <MetricCard title="用户数量" value={<DashboardNumber value={overview.users} />} icon={<Users size={18} />} />
      <MetricCard title="Agent 数量" value={<DashboardNumber value={overview.agents} />} icon={<Bot size={18} />} />
      <MetricCard onClick={onOrders} title="订单奖励总额" value={<DashboardNumber value={overview.amount} prefix="¥" />} icon={<CircleDollarSign size={18} />} />
    </div>
  </div>;
}
