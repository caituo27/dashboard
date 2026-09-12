import { AdminTable as Table } from "../components/AdminTable";
import { useState } from "react";
import { AnalyticsDetails, type AnalyticsSelection } from "./AnalyticsDetails";
import { Button } from "antd";
import type { DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";
import { Eye, MousePointer2, Users, TrendingUp } from "lucide-react";
import { MetricCard, SoftTag, Surface } from "../components/Primitives";

import { DashboardBar, DashboardNumber } from "./DashboardMotion";

const funnelLabels = ["访问任务市场", "查看任务详情", "发起接单", "成功接取任务", "Agent 提交交付"];
const number = (value: number) => value.toLocaleString("zh-CN");
const percent = (value: number, base: number) => base > 0 ? `${(value / base * 100).toFixed(1)}%` : "—";

export function DashboardAnalytics({ data }: { data: DashboardAnalyticsSnapshot }) {
  const [selection, setSelection] = useState<AnalyticsSelection | null>(null);
  const days = data.period;
  const totalConversion = data.funnel[0] > 0 ? data.funnel[data.funnel.length - 1] / data.funnel[0] * 100 : 0;
  const maximum = Math.max(1, ...data.visits);

  return <section className="dashboard-analytics" aria-labelledby="dashboard-analytics-title">
    <div className="dashboard-analytics-heading">
      <div><h2 id="dashboard-analytics-title">用户行为分析（抽样）</h2></div>

    </div>
    <div className="dashboard-metrics">
      <MetricCard onClick={() => setSelection({ kind: "pv" })} title="页面浏览量 PV" value={<DashboardNumber value={data.pv} />} caption="统计周期内的页面浏览次数" icon={<Eye size={18} />} />
      <MetricCard onClick={() => setSelection({ kind: "uv" })} title="独立访客 UV" value={<DashboardNumber value={data.uv} />} caption="统计周期内的去重访客数" icon={<Users size={18} />} />
      <MetricCard onClick={() => setSelection({ kind: "clicks" })} title="关键按钮点击" value={<DashboardNumber value={data.clicks} />} caption={`下方 ${data.buttons.length} 个关键按钮的点击总次数`} icon={<MousePointer2 size={18} />} />
      <MetricCard onClick={() => setSelection({ kind: "funnel" })} title="Agent 提交交付转化率" value={<DashboardNumber value={totalConversion} decimals={2} suffix="%" />} caption="Agent 提交交付人数 / 访问任务市场人数" icon={<TrendingUp size={18} />} />
    </div>
    <div className="dashboard-main-grid">
      <Surface className="dashboard-panel">
        <div className="dashboard-panel-header"><div><h3>访问趋势</h3><p>页面浏览量 PV{` · 近 ${days} 天，按日统计`}</p></div><SoftTag tone="neutral">PV</SoftTag></div>
        <div className="dashboard-chart" role="group" aria-label={`访问量：${data.visits.map((value, index) => `第 ${index + 1} 段 ${value} 次`).join("，")}`}>
          <div className="dashboard-chart-scale"><span>{number(maximum)}</span><span>{number(Math.round(maximum / 2))}</span><span>0</span></div>
          <div className="dashboard-bars">{data.visits.map((value, index) => {
            const label = index === days - 1 ? "今天" : `${days - index - 1} 天前`;
            return <div className="dashboard-bar-column" key={index}><button type="button" className="dashboard-bar-track dashboard-chart-drilldown" aria-label={`查看 ${data.daily[index].date} 的访问明细，${number(value)} 次`} onClick={() => setSelection({ kind: "pv", date: data.daily[index].date })}><DashboardBar ratio={value / maximum} title={`${label}：${number(value)} 次`} /></button><span>{days === 7 || index % 5 === 0 || index === days - 1 ? label : ""}</span></div>;
          })}</div>
        </div>
      </Surface>
      <Surface className="dashboard-panel">
        <div className="dashboard-panel-header"><div><h3>任务转化漏斗</h3></div></div>
        <div className="dashboard-funnel">{funnelLabels.map((label, index) => <button type="button" key={label} className="dashboard-funnel-step dashboard-funnel-drilldown" onClick={() => setSelection({ kind: "funnel", stage: index })}>
          <div className="dashboard-funnel-label"><span><small>{String(index + 1).padStart(2, "0")}</small>{label}</span><strong><DashboardNumber value={data.funnel[index]} /></strong></div>
          <div className="dashboard-funnel-track"><DashboardBar horizontal ratio={data.funnel[index] / Math.max(1, data.funnel[0])} /></div>
          <div className="dashboard-funnel-rate">{index === 0 ? "漏斗起点 · 去重访客" : `上一步转化率 ${percent(data.funnel[index], data.funnel[index - 1])}`}</div>
        </button>)}</div>
        <p className="dashboard-note">同一用户、同一任务路径在 24 小时内依次完成；按用户去重，限所选周期内事件。终点为Agent 提交交付，不代表验收通过。</p>
      </Surface>
    </div>
    <Surface className="dashboard-table-panel">
      <div className="dashboard-panel-header"><div><h3>关键按钮点击排行</h3></div></div>
      <Table rowKey="name" size="small" pagination={false} scroll={{ x: 620 }} dataSource={[...data.buttons].sort((a,b)=>b.clicks-a.clicks || a.name.localeCompare(b.name))} locale={{ emptyText: "该时段暂无按钮点击" }} columns={[
        { title: "按钮", dataIndex: "name" },
        { title: "所在页面", dataIndex: "page" },
        { title: "点击次数", dataIndex: "clicks", align: "right", render: (value: number) => number(value) },
        { title: "点击人数", dataIndex: "users", align: "right", render: (value: number) => number(value) },
        { title: "点击次数占比", key: "share", align: "right", render: (_, record) => percent(record.clicks, data.clicks) },
        { title: "操作", key: "detail", render: (_, record) => <Button type="link" onClick={() => setSelection({ kind: "button", button: record.name })}>查看明细</Button> }
      ]} />
    </Surface>
    <AnalyticsDetails data={data} selection={selection} onChange={setSelection} onClose={() => setSelection(null)} />
  </section>;
}
