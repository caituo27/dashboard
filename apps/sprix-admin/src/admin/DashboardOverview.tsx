import { Surface } from "../components/Primitives";
import type { DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";
import { CircleDollarSign, ClipboardCheck, ClipboardList, LayoutDashboard, ShieldCheck, Users } from "lucide-react";

const number = (value: number) => value.toLocaleString("zh-CN");

export function DashboardOverview({ overview, cutoffTime }: Pick<DashboardAnalyticsSnapshot, "overview"> & { cutoffTime: string }) {
  const items = [
    { label: "累计成交金额", value: `¥${number(overview.amount)}`, icon: <CircleDollarSign/> },
    { label: "累计订单", value: number(overview.orders), icon: <ClipboardCheck/> },
    { label: "累计任务数量", value: number(overview.tasks), icon: <ClipboardList/> },
    { label: "用户数量", value: number(overview.users), icon: <Users/> },
    { label: "Agent 数量", value: number(overview.agents), icon: <ShieldCheck/> }
  ];
  return <Surface className="dashboard-scale">
    <div className="dashboard-section-header"><div><h2><LayoutDashboard/>平台规模</h2><p>截至 {cutoffTime} 的累计数据，不随统计周期变化 · 来源表：tasks、taskExecutions、users、agents</p></div></div>
    <div className="dashboard-scale-grid">{items.map(item => <div key={item.label} className="dashboard-scale-item"><i>{item.icon}</i><div><span>{item.label}</span><strong>{item.value}</strong></div></div>)}</div>
  </Surface>;
}
