import {DashboardFinance,financeLabels,type FinanceMetric} from "./DashboardFinance";
import { AdminTable as Table } from "../components/AdminTable";
import { DashboardOrders } from "./DashboardOrders";
import type { ExecutionFilter } from "../services/dashboardRecords";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Alert, Button, Modal, Empty, Segmented, Skeleton } from "antd";
import { CheckCircle2, CircleDollarSign, ClipboardList, RefreshCw, Workflow } from "lucide-react";
import { MetricCard, PageHeader, StatusTag, Surface } from "../components/Primitives";
import { currency } from "../utils/format";
import { useDashboardAnalytics } from "./useDashboardAnalytics";
import { DashboardOverview } from "./DashboardOverview";
import { DashboardAnalytics } from "./DashboardAnalytics";
import { DashboardBar, DashboardNumber } from "./DashboardMotion";
import type { AnalyticsPeriod } from "../services/dashboardAnalyticsMock";
import "./dashboard.css";

function PublicationChart({ series, days, onSelect }: { series: { key: string; label: string; count: number }[]; days: number; onSelect:(date:string)=>void }) {
  const total = series.reduce((sum, item) => sum + item.count, 0);
  const maximum = Math.max(1, ...series.map((item) => item.count));
  return <>
    <div className="dashboard-chart-summary"><strong><DashboardNumber value={total} /></strong><span>个任务 · 近 {days} 天发布</span></div>
    {total === 0 ? <div className="dashboard-chart-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该时段暂无任务发布记录" /></div> :
      <div className="dashboard-chart" role="group" aria-label={`近 ${days} 天任务发布趋势：${series.map((item) => `${item.label} ${item.count} 个`).join("，")}`}>
        <div className="dashboard-chart-scale"><span>{maximum}</span><span>{Math.round(maximum / 2)}</span><span>0</span></div>
        <div className="dashboard-bars">{series.map((item, index) => <div className="dashboard-bar-column" key={item.key}>
          <button type="button" className="dashboard-bar-track dashboard-chart-drilldown" aria-label={`查看 ${item.key} 发布的 ${item.count} 个任务`} onClick={()=>onSelect(item.key)}><DashboardBar ratio={item.count / maximum} title={`${item.key}：${item.count} 个任务`} /></button>
          <span>{days === 7 || index % 5 === 0 || index === days - 1 ? item.label : ""}</span>
        </div>)}</div>
      </div>}
    <p className="dashboard-note">按发布日期统计，包含已下线任务，不含已删除任务。</p>
  </>;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [financeMetric,setFinanceMetric] = useState<FinanceMetric | null>(null);
  const [orders,setOrders] = useState<ExecutionFilter | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>(7);
  const query = useDashboardAnalytics(period);
  if (query.isPending) return <Surface className="dashboard-panel"><Skeleton active paragraph={{ rows: 8 }} /></Surface>;
  if (query.isError) return <Alert type="error" showIcon message="数据概览加载失败" description="请检查网络连接后重试。" action={<Button onClick={() => void query.refetch()}>重试</Button>} />;
  const data = query.data;
  const { overview, operations, finance } = data;
  const states = [
    { key: "running", label: "执行中", value: operations.executions.running, color: "#0f766e" },
    { key: "reviewing", label: "待验收", value: operations.executions.reviewing, color: "#d5a347" },
    { key: "completed", label: "已完成", value: operations.executions.completed, color: "#8bbcb4" },
    { key: "terminated", label: "已终止", value: operations.executions.terminated, color: "#cbd1d6" },
    ...(operations.executions.other ? [{ key: "other", label: "其他状态", value: operations.executions.other, color: "#8b92a5" }] : [])
  ];
  const openState = (key:string) => {
    if(key === 'other') Modal.info({title:'其他状态订单',content:'接口汇总包含尚未分类的执行状态，当前详情接口未提供对应记录。可到任务管理中心查看关联任务。'});
    else setOrders(key as ExecutionFilter);
  };
  let progress = 0;
  const segments = states.map(state=>{const offset=progress;progress+=state.value/Math.max(1,overview.orders)*100;return {...state,offset,length:progress-offset};});
  const publications = operations.taskPublications.slice(-data.period).map((item) => ({ key: item.date, label: `${Number(item.date.slice(5, 7))}/${Number(item.date.slice(8, 10))}`, count: item.count }));
  return <div className="dashboard-page">
    <PageHeader title="数据概览" actions={<div className="dashboard-analytics-controls"><Segmented aria-label="趋势与行为分析时间范围" value={period} onChange={(value) => setPeriod(value === 30 ? 30 : 7)} options={[{ label: "近 7 天", value: 7 }, { label: "近 30 天", value: 30 }]} /><Button icon={<RefreshCw size={14} />} loading={query.isFetching} onClick={() => void query.refetch()}>刷新数据</Button></div>} />
    <DashboardOverview overview={overview} generatedAt={data.generatedAt} onOrders={()=>setOrders("all")} />
    <div className="dashboard-context"><span>运营总览 / 累计数据</span><span>趋势与行为分析：近 {data.period} 天 · 含今天</span></div>
    <div className="dashboard-metrics">
      <MetricCard onClick={()=>navigate("/tasks")} title="任务总数" value={<DashboardNumber value={operations.taskTotal} />} icon={<ClipboardList size={18} />} />
      <MetricCard onClick={()=>setOrders("running")} title="执行中订单" value={<DashboardNumber value={operations.executions.running} />} icon={<Workflow size={18} />} />
      <MetricCard onClick={()=>setOrders("completed")} title="已完成订单" value={<DashboardNumber value={operations.executions.completed} />} icon={<CheckCircle2 size={18} />} />
      <MetricCard onClick={()=>navigate("/funds")} title="累计已提现" value={<DashboardNumber value={finance.paidAmount} prefix="¥" decimals={2} />} icon={<CircleDollarSign size={18} />} />
    </div>
    <div className="dashboard-main-grid">
      <Surface className="dashboard-panel"><div className="dashboard-panel-header"><div><h2>任务发布趋势</h2><p>近 {data.period} 天任务供给 · 今天统计至更新时间</p></div></div><PublicationChart series={publications} days={data.period} onSelect={date=>navigate(`/tasks?publishedDate=${date}`)} /></Surface>
      <Surface className="dashboard-panel">
        <div className="dashboard-panel-header"><div><h2>订单状态分布</h2></div></div>
        {overview.orders > 0 ? <><div className="dashboard-interactive-ring">
          <svg viewBox="0 0 200 200" aria-label="订单状态分布，点击扇区查看订单">
            {segments.map(state=><circle key={state.key} cx="100" cy="100" r="82" pathLength="100" fill="none" stroke={state.color} strokeWidth="22" strokeDasharray={`${state.length} ${100-state.length}`} strokeDashoffset={-state.offset} transform="rotate(-90 100 100)" role="button" tabIndex={0} aria-label={`查看${state.label}订单 ${state.value.toLocaleString()} 条`} onClick={()=>openState(state.key)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openState(state.key);}}}><title>{`${state.label}：${state.value.toLocaleString()} 条，点击查看`}</title></circle>)}
          </svg>
          <button className="dashboard-ring-center" onClick={()=>setOrders('all')} aria-label="查看全部订单"><strong><DashboardNumber value={overview.orders}/></strong><span>累计订单 · 查看全部</span></button>
        </div><div className="dashboard-legend">{states.map(state=><button className="dashboard-legend-action" key={state.key} onClick={()=>openState(state.key)}><span><i style={{background:state.color}}/>{state.label}</span><strong>{state.value.toLocaleString()}<small>{(state.value/overview.orders*100).toFixed(1)}%</small> →</strong></button>)}</div></> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无订单" />}

      </Surface>
    </div>
    <div className="dashboard-main-grid">
      <Surface className="dashboard-table-panel">
        <div className="dashboard-panel-header"><div><h2>最新发布任务</h2></div></div>
        <Table rowKey="id" size="small" dataSource={data.latestTasks} pagination={false} scroll={{ x: 640 }} columns={[
          { title: "任务名称", dataIndex: "title", ellipsis: true, render: (title: string, row) => <Link to={`/tasks/${encodeURIComponent(row.id)}`}>{title}</Link> },
          { title: "状态", dataIndex: "taskStatus", width: 100, render: (value: string) => <StatusTag status={value} /> },
          { title: "单订单奖励", dataIndex: "reward", width: 115, render: (value: number) => currency(value) },
          { title: "发布时间", dataIndex: "publishedAt", width: 155, render: (value: string) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) }
        ]} />
      </Surface>
      <Surface className="dashboard-panel">
        <div className="dashboard-panel-header"><div><h2>待处理概览</h2></div></div>
        <div className="dashboard-queue">{[
          { to:"/acceptance", label: "待平台验收", caption: "平台验收中心待处理记录", value: operations.pendingAcceptance ?? operations.executions.reviewing },
          { to:"/appeals", label: "累计申诉", caption: "包含已处理与待处理记录", value: operations.appeals }
        ].map((item) => <Link to={item.to} className="dashboard-queue-row" key={item.label}><div><strong>{item.label}</strong><span>{item.caption}</span></div><b><DashboardNumber value={item.value} /> →</b></Link>)}</div>
      </Surface>
    </div>
    <Surface className="dashboard-panel">
      <div className="dashboard-panel-header"><div><h2>结算与提现</h2></div></div>
      <div className="dashboard-finance">{(Object.keys(financeLabels) as FinanceMetric[]).map(metric => <button type="button" className="text-left" onClick={()=>setFinanceMetric(metric)} key={metric}><span>{financeLabels[metric]}</span><strong>{currency(finance[metric])}</strong><small>查看记录 →</small></button>)}</div>
    </Surface>
    {financeMetric && <DashboardFinance key={financeMetric} metric={financeMetric} amount={finance[financeMetric]} onClose={()=>setFinanceMetric(null)}/>}
    <DashboardAnalytics data={data} />
    {orders && <DashboardOrders key={orders} initialStatus={orders} onClose={()=>setOrders(null)}/> }
  </div>;
}
