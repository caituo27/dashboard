import { AdminTable as Table } from "../components/AdminTable";
import { AnalyticsEvents } from "./AnalyticsEvents";
import { Drawer, Select, Tabs } from "antd";
import type { AnalyticsDay, DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";

export type AnalyticsSelection = { kind: "pv" | "uv" | "behavior"; startDate: string; endDate: string; date?: string; behavior?: string; eventName?: string };
const number = (value: number) => value.toLocaleString("zh-CN");

export function AnalyticsDetails({ data, selection, onChange, onClose }: { data: DashboardAnalyticsSnapshot; selection: AnalyticsSelection | null; onChange: (value: AnalyticsSelection) => void; onClose: () => void }) {
  const titles = { pv: "页面访问明细", uv: "独立访客明细", behavior: `${selection?.behavior ?? "关键行为"} · 行为明细` };
  const scopedDays = selection ? data.daily.filter((day) => day.date >= selection.startDate && day.date <= selection.endDate) : [];
  const selectedDate = scopedDays.some((day) => day.date === selection?.date) ? selection?.date : undefined;
  const rows = scopedDays.filter((day) => !selectedDate || day.date === selectedDate).slice().reverse();
  const periodRange = selectedDate ? `${selectedDate} 00:00:00 至 ${selectedDate} 23:59:59` : selection ? `${selection.startDate} 00:00:00 至 ${selection.endDate} 23:59:59` : "";
  return <Drawer title={selection ? titles[selection.kind] : "分析明细"} open={selection !== null} onClose={onClose} width={1100}>
    {selection && <>
      <div className="dashboard-details-toolbar"><span>来源表：analyticsEvents · 统计周期（北京时间）：{periodRange}</span><Select aria-label="明细日期" value={selectedDate ?? "all"} style={{ minWidth: 160 }} onChange={(date) => onChange({ ...selection, date: date === "all" ? undefined : date })} options={[{ value: "all", label: "全部日期" }, ...scopedDays.map((day) => ({ value: day.date, label: day.date }))]} /></div>
      <Tabs destroyOnHidden items={[{key:"summary",label:"每日汇总",children:<>
      <Table<AnalyticsDay> rowKey="date" size="small" dataSource={rows} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 520 }} columns={[
        { title: "日期", dataIndex: "date" },
        { title: "页面浏览 PV", dataIndex: "pv", render: number },
        { title: "独立访客 UV", dataIndex: "uv", render: number },
        { title: "按钮点击次数", dataIndex: "clicks", render: number }
      ]} />
      </>},{key:"events",label:"事件明细",children:<AnalyticsEvents key={`${selection.startDate}:${selection.endDate}:${selectedDate}:${selection.kind}:${selection.eventName}`} period={scopedDays.length || data.period} startDate={selection.startDate} endDate={selection.endDate} selection={{...selection,date:selectedDate}}/>}]} />
    </>}
  </Drawer>;
}
