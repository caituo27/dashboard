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

function VisitsLineChart({ values, dates, onSelect }: { values: number[]; dates: string[]; onSelect: (date: string) => void }) {
  const width = 760;
  const height = 230;
  const left = 52;
  const right = 18;
  const top = 18;
  const bottom = 34;
  const rawMaximum = Math.max(1, ...values);
  const rawMinimum = Math.min(...values);
  const spread = Math.max(100, rawMaximum - rawMinimum);
  const minimum = Math.max(0, Math.floor((rawMinimum - spread * 0.25) / 50) * 50);
  const maximum = Math.ceil((rawMaximum + spread * 0.25) / 50) * 50;
  const x = (index: number) => left + index * ((width - left - right) / Math.max(1, values.length - 1));
  const y = (value: number) => top + (1 - (value - minimum) / Math.max(1, maximum - minimum)) * (height - top - bottom);
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area = values.length ? `${left},${height - bottom} ${points} ${x(values.length - 1)},${height - bottom}` : "";
  const labelEvery = values.length <= 7 ? 1 : 5;

  return <div className="dashboard-line-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`页面浏览量趋势：${values.map((value, index) => `${dates[index]} ${value} 次`).join("，")}`}>
      {[0, 0.5, 1].map((ratio) => {
        const lineY = top + ratio * (height - top - bottom);
        const label = Math.round(maximum - (maximum - minimum) * ratio);
        return <g key={ratio}><line x1={left} y1={lineY} x2={width - right} y2={lineY} className="dashboard-line-grid"/><text x={left - 10} y={lineY + 4} textAnchor="end" className="dashboard-line-label">{number(label)}</text></g>;
      })}
      {area && <polygon points={area} className="dashboard-line-area"/>}
      {points && <polyline points={points} className="dashboard-line-path"/>}
      {values.map((value, index) => {
        const date = dates[index];
        const showLabel = index % labelEvery === 0 || index === values.length - 1;
        return <g key={date} role="button" tabIndex={0} className="dashboard-line-point" aria-label={`查看 ${date} 的访问明细，${number(value)} 次`} onClick={() => onSelect(date)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(date); } }}>
          <circle cx={x(index)} cy={y(value)} r="4"/>
          <title>{date}：{number(value)} 次</title>
          {showLabel && <text x={x(index)} y={height - 10} textAnchor="middle" className="dashboard-line-label">{date.slice(5).replace("-", "/")}</text>}
        </g>;
      })}
    </svg>
  </div>;
}

export function DashboardAnalytics({ data }: { data: DashboardAnalyticsSnapshot }) {
  const [selection, setSelection] = useState<AnalyticsSelection | null>(null);
  const days = data.period;
  const firstDay = data.daily[0]?.date;
  const cutoffTime = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(data.generatedAt));
  const periodRange = firstDay ? `${firstDay} 00:00:00 至 ${cutoffTime}` : "—";
  const totalConversion = data.funnel[0] > 0 ? data.funnel[data.funnel.length - 1] / data.funnel[0] * 100 : 0;

  return <section className="dashboard-analytics" aria-labelledby="dashboard-analytics-title">
    <div className="dashboard-analytics-heading"><div><h2 id="dashboard-analytics-title">用户行为分析</h2><p>抽样数据 · 统计周期（北京时间）：{periodRange}</p></div></div>
    <div className="dashboard-metrics">
      <MetricCard onClick={() => setSelection({ kind: "pv" })} title="页面浏览量 PV" value={<DashboardNumber value={data.pv} />} caption="该周期的页面浏览次数" icon={<Eye size={18} />} />
      <MetricCard onClick={() => setSelection({ kind: "uv" })} title="独立访客 UV" value={<DashboardNumber value={data.uv} />} caption="该周期的去重访客数" icon={<Users size={18} />} />
      <MetricCard onClick={() => setSelection({ kind: "clicks" })} title="关键按钮点击" value={<DashboardNumber value={data.clicks} />} caption={`下方 ${data.buttons.length} 个关键按钮的点击总次数`} icon={<MousePointer2 size={18} />} />
      <MetricCard onClick={() => setSelection({ kind: "funnel" })} title="Agent 提交交付转化率" value={<DashboardNumber value={totalConversion} decimals={2} suffix="%" />} caption="Agent 提交交付人数 / 访问任务市场人数" icon={<TrendingUp size={18} />} />
    </div>
    <div className="dashboard-main-grid">
      <Surface className="dashboard-panel">
        <div className="dashboard-panel-header"><div><h3>访问趋势</h3><p>页面浏览量 PV · {days} 个完整自然日</p></div><SoftTag tone="neutral">PV</SoftTag></div>
        <VisitsLineChart values={data.visits} dates={data.daily.map((item) => item.date)} onSelect={(date) => setSelection({ kind: "pv", date })}/>
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
