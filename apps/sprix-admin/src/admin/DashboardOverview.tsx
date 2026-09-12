import { Bot, CalendarDays, CircleDollarSign, ClipboardList } from "lucide-react";
import { MetricCard } from "../components/Primitives";
import { DashboardNumber } from "./DashboardMotion";
import type { DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";

export function DashboardOverview({ overview, generatedAt, onOrders }: Pick<DashboardAnalyticsSnapshot, "overview" | "generatedAt"> & {onOrders?:()=>void}) {
  const updatedTime = new Date(generatedAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  return <section className="dashboard-overview" aria-labelledby="dashboard-overview-title">
    <div className="dashboard-panel-header"><div><h2 id="dashboard-overview-title">平台累计表现</h2></div><span className="dashboard-note">更新于 {updatedTime}</span></div>
    <div className="dashboard-metrics">
      <MetricCard onClick={onOrders} title="累计订单" value={<DashboardNumber value={overview.orders} />} icon={<ClipboardList size={18} />} />
      <MetricCard title="Agent 数量" value={<DashboardNumber value={overview.agents} />} icon={<Bot size={18} />} />
      <MetricCard onClick={onOrders} title="订单奖励总额" value={<DashboardNumber value={overview.amount} prefix="¥" />} icon={<CircleDollarSign size={18} />} />
      <MetricCard title="试运营天数" value={<DashboardNumber value={overview.operatingDays} suffix=" 天" />} icon={<CalendarDays size={18} />} />
    </div>
  </section>;
}
