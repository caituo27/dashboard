import { AdminTable as Table } from "../components/AdminTable";
import { AnalyticsEvents } from "./AnalyticsEvents";
import { Drawer, Select, Tabs } from "antd";
import type { AnalyticsDay, DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";

export type AnalyticsSelection = { kind: "pv" | "uv" | "clicks" | "funnel" | "button"; date?: string; button?: string; stage?: number };
const stageLabels = ["访问任务市场", "查看任务详情", "发起接单", "成功接取任务", "Agent 提交交付"];
const number = (value: number) => value.toLocaleString("zh-CN");

export function AnalyticsDetails({ data, selection, onChange, onClose }: { data: DashboardAnalyticsSnapshot; selection: AnalyticsSelection | null; onChange: (value: AnalyticsSelection) => void; onClose: () => void }) {
  const titles = { pv: "页面访问明细", uv: "独立访客明细", clicks: "按钮点击明细", funnel: "任务转化明细", button: `${selection?.button ?? "按钮"} · 点击明细` };
  const selectedDate = data.daily.some((day) => day.date === selection?.date) ? selection?.date : undefined;
  const rows = data.daily.filter((day) => !selectedDate || day.date === selectedDate).slice().reverse();
  const stage = selection?.stage ?? 4;
  const buttonRows = rows.map((day) => ({ ...day, selectedButton: day.buttons.find((button) => button.name === selection?.button) }));
  return <Drawer title={selection ? titles[selection.kind] : "分析明细"} open={selection !== null} onClose={onClose} width={1100}>
    {selection && <>
      <div className="dashboard-details-toolbar"><span>近 {data.period} 天 · 按日统计</span><Select aria-label="明细日期" value={selectedDate ?? "all"} style={{ minWidth: 160 }} onChange={(date) => onChange({ ...selection, date: date === "all" ? undefined : date })} options={[{ value: "all", label: "全部日期" }, ...data.daily.map((day) => ({ value: day.date, label: day.date }))]} /></div>
      <p className="dashboard-note">更新于 {new Date(data.generatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} · 今天统计至更新时间</p>
      <Tabs destroyOnHidden items={[{key:"summary",label:"每日汇总",children:<>
      {selection.kind === "funnel" ? <Table<AnalyticsDay> rowKey="date" size="small" dataSource={rows} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 980 }} columns={[
        { title: "日期", dataIndex: "date", width: 115 },
        ...stageLabels.map((label, index) => ({ title: index === stage ? `${label}（所选）` : label, key: label, render: (_: unknown, day: AnalyticsDay) => number(day.funnel[index]) })),
        { title: "交付转化率", key: "conversion", render: (_, day) => day.funnel[0] ? `${(day.funnel[4] / day.funnel[0] * 100).toFixed(2)}%` : "—" }
      ]} /> : selection.kind === "button" ? <Table rowKey="date" size="small" dataSource={buttonRows} pagination={{ pageSize: 10, hideOnSinglePage: true }} columns={[
        { title: "日期", dataIndex: "date" },
        { title: "点击次数", key: "clicks", render: (_, day) => number(day.selectedButton?.clicks ?? 0) },
        { title: "点击人数", key: "users", render: (_, day) => number(day.selectedButton?.users ?? 0) }
      ]} /> : <Table<AnalyticsDay> rowKey="date" size="small" dataSource={rows} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 520 }} columns={[
        { title: "日期", dataIndex: "date" },
        { title: "页面浏览 PV", dataIndex: "pv", render: number },
        { title: "独立访客 UV", dataIndex: "uv", render: number },
        { title: "按钮点击次数", dataIndex: "clicks", render: number }
      ]} />}
      {selection.kind === "clicks" && <div className="dashboard-details-buttons">{data.buttons.map((button) => <button key={button.name} type="button" onClick={() => onChange({ kind: "button", button: button.name, date: selection.date })}>{button.name} →</button>)}</div>}
      </>},{key:"events",label:"事件明细",children:<AnalyticsEvents key={`${data.period}:${selectedDate}:${selection.kind}:${selection.button}`} period={data.period} selection={{...selection,date:selectedDate}}/>}]} />
    </>}
  </Drawer>;
}
