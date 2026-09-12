import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Alert, Button, Empty, Segmented, Skeleton } from "antd";
import { BarChart3, CalendarDays, Gauge, TrendingUp } from "lucide-react";
import { MetricCard, PageHeader, Surface } from "../components/Primitives";
import { useDashboardAnalytics } from "./useDashboardAnalytics";
import { DashboardOverview } from "./DashboardOverview";
import { DashboardAnalytics } from "./DashboardAnalytics";
import { DashboardBar, DashboardNumber } from "./DashboardMotion";
import type { AnalyticsPeriod } from "../services/dashboardAnalyticsMock";
import "./dashboard.css";

function PublicationChart({ series, days, periodRange, onSelect }: { series: { key: string; label: string; count: number }[]; days: number; periodRange: string; onSelect:(date:string)=>void }) {
  const total = series.reduce((sum, item) => sum + item.count, 0);
  const maximum = Math.max(1, ...series.map((item) => item.count));
  return <>
    <div className="dashboard-chart-summary"><strong><DashboardNumber value={total} /></strong><span>个任务</span></div>
    {total === 0 ? <div className="dashboard-chart-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该时段暂无任务发布记录" /></div> :
      <div className="dashboard-chart" role="group" aria-label={`统计周期 ${periodRange} 任务发布趋势：${series.map((item) => `${item.label} ${item.count} 个`).join("，")}`}>
        <div className="dashboard-chart-scale"><span>{maximum}</span><span>{Math.round(maximum / 2)}</span><span>0</span></div>
        <div className="dashboard-bars">{series.map((item, index) => <div className="dashboard-bar-column" key={item.key}>
          <button type="button" className="dashboard-bar-track dashboard-chart-drilldown" aria-label={`查看 ${item.key} 发布的 ${item.count} 个任务`} onClick={()=>onSelect(item.key)}><DashboardBar ratio={item.count / maximum} title={`${item.key}：${item.count} 个任务`} /></button>
          <span>{days === 7 || index % 5 === 0 || index === days - 1 ? item.label : ""}</span>
        </div>)}</div>
      </div>}
    <p className="dashboard-note">按发布日期统计，包含已下线任务，不含已删除任务。</p>
  </>;
}

const categoryColors = ["#0f766e", "#3f8f87", "#74aaa4", "#d3a64d", "#8b92a5", "#d7dcdf"];
function pieSector(start: number, end: number) {
  const point = (ratio: number) => {
    const angle = ratio * Math.PI * 2 - Math.PI / 2;
    return [100 + Math.cos(angle) * 82, 100 + Math.sin(angle) * 82];
  };
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  return `M 100 100 L ${x1} ${y1} A 82 82 0 ${end - start > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

function CategoryPie({ categories, total, onSelect }: { categories: { category: string; count: number }[]; total: number; onSelect: (category: string) => void }) {
  const topTotal = categories.reduce((sum, item) => sum + item.count, 0);
  const rows = [...categories, ...(total > topTotal ? [{ category: "其他", count: total - topTotal }] : [])];
  let offset = 0;
  const segments = rows.map((item, index) => {
    const start = offset;
    offset += item.count / Math.max(1, total);
    return { ...item, start, end: offset, color: categoryColors[index % categoryColors.length], clickable: item.category !== "其他" };
  });
  if (total === 0) return <div className="dashboard-chart-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已发布任务" /></div>;
  const select = (category: string, clickable: boolean) => clickable && onSelect(category);
  return <div className="dashboard-category-layout">
    <svg className="dashboard-category-pie" viewBox="0 0 200 200" role="img" aria-label={`已发布任务类别分布，共 ${total.toLocaleString("zh-CN")} 个任务`}>
      {segments.map(item => <path key={item.category} d={pieSector(item.start, item.end)} fill={item.color} stroke="white" strokeWidth="2" role={item.clickable ? "button" : undefined} tabIndex={item.clickable ? 0 : undefined} className={item.clickable ? "dashboard-category-sector" : undefined} onClick={()=>select(item.category,item.clickable)} onKeyDown={(event)=>{if(item.clickable && (event.key==="Enter" || event.key===" ")){event.preventDefault();onSelect(item.category);}}}><title>{item.category}：{item.count.toLocaleString("zh-CN")} 个，{(item.count / total * 100).toFixed(1)}%</title></path>)}
    </svg>
    <div className="dashboard-category-legend">{segments.map(item => <button key={item.category} type="button" disabled={!item.clickable} onClick={()=>select(item.category,item.clickable)}><i style={{background:item.color}}/><span><b>{item.category}</b><small>{item.count.toLocaleString("zh-CN")} · {(item.count / total * 100).toFixed(1)}%</small></span></button>)}</div>
  </div>;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<AnalyticsPeriod>(7);
  const query = useDashboardAnalytics(period);
  if (query.isPending) return <Surface className="dashboard-panel"><Skeleton active paragraph={{ rows: 8 }} /></Surface>;
  if (query.isError) return <Alert type="error" showIcon message="数据概览加载失败" description="请检查网络连接后重试。" action={<Button onClick={() => void query.refetch()}>重试</Button>} />;
  const data = query.data;
  const { overview, operations } = data;
  const firstDay = data.daily[0]?.date;
  const cutoffTime = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(data.generatedAt));
  const periodRange = firstDay ? `${firstDay} 00:00:00 至 ${cutoffTime}` : "—";
  const publications = operations.taskPublications.slice(-data.period).map((item) => ({ key: item.date, label: `${Number(item.date.slice(5, 7))}/${Number(item.date.slice(8, 10))}`, count: item.count }));
  const latestPublication = publications[publications.length - 1];
  const periodPublications = publications.reduce((total, item) => total + item.count, 0);
  const averagePublications = periodPublications / Math.max(1, data.period);
  const peakPublication = publications.reduce((peak, item) => item.count > peak.count ? item : peak, publications[0] ?? { key: "", label: "", count: 0 });
  const topCategories = operations.publishedTaskCategories.slice(0, 5);
  const openCategory = (category: string) => navigate(`/tasks?category=${encodeURIComponent(category)}&status=${encodeURIComponent("已发布")}`);
  return <div className="dashboard-page">
    <PageHeader title="数据概览" />
    <section className="dashboard-scope" aria-labelledby="dashboard-cumulative-title">
      <div className="dashboard-scope-heading"><div><h2 id="dashboard-cumulative-title">累计经营数据</h2><p><span>数据截止：{cutoffTime}</span><span>来源表：taskExecutions、tasks、users、agents</span></p></div></div>
      <DashboardOverview overview={overview} taskTotal={operations.taskTotal} />
      <Surface className="dashboard-panel dashboard-category-panel"><div className="dashboard-category-intro"><h2>已发布任务类别分布</h2><p>截至 {cutoffTime} 的全部已发布任务</p><small>点击类别查看对应任务</small></div><CategoryPie categories={topCategories} total={operations.publishedTasks} onSelect={openCategory}/></Surface>
    </section>
    <section className="dashboard-scope" aria-labelledby="dashboard-period-title">
      <div className="dashboard-period-heading">
        <div className="dashboard-period-title-row">
          <h2 id="dashboard-period-title">周期分析</h2>
          <Segmented aria-label="统计周期" value={period} onChange={(value) => setPeriod(value === 30 ? 30 : 7)} options={[{ label: "近 7 天", value: 7 }, { label: "近 30 天", value: 30 }]} />
        </div>
        <p><span>统计周期（北京时间）：{periodRange}</span><span>来源表：tasks、analyticsEvents</span></p>
      </div>
      <div className="dashboard-metrics">
        <MetricCard title="发布任务数" value={<DashboardNumber value={periodPublications} />} icon={<TrendingUp size={18} />} />
        <MetricCard title="日均发布量" value={<DashboardNumber value={averagePublications} />} icon={<Gauge size={18} />} />
        <MetricCard title="单日峰值" value={<DashboardNumber value={peakPublication.count} />} caption={peakPublication.key || "—"} icon={<BarChart3 size={18} />} />
        <MetricCard onClick={()=>latestPublication && navigate(`/tasks?publishedDate=${latestPublication.key}`)} title="昨日发布量" value={<DashboardNumber value={latestPublication?.count ?? 0} />} caption={latestPublication?.key ?? cutoffTime.slice(0, 10)} icon={<CalendarDays size={18} />} />
      </div>
      <Surface className="dashboard-panel"><div className="dashboard-panel-header"><div><h2>任务发布趋势</h2></div></div><PublicationChart series={publications} days={data.period} periodRange={periodRange} onSelect={date=>navigate(`/tasks?publishedDate=${date}`)} /></Surface>
      <DashboardAnalytics data={data} />
    </section>
  </div>;
}
