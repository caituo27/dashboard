import { useState } from "react";
import { Segmented } from "antd";
import { Surface } from "../components/Primitives";
import { BarChart3 } from "lucide-react";
import type { DashboardAnalyticsSnapshot, DashboardTrendMetric, DashboardTrendPoint } from "../services/dashboardAnalyticsMock";

const options: { label: string; value: DashboardTrendMetric; money?: boolean; decimals?: number }[] = [
  {label:"验收 GMV",value:"acceptedGmv",money:true},
  {label:"发布任务",value:"publishedTasks"},
  {label:"接单任务",value:"acceptedTasks"},
  {label:"完成任务",value:"completedTasks"},
  {label:"单均价值",value:"averageTaskValue",money:true,decimals:1}
];
const format = (value:number, money?:boolean, decimals=0) => `${money?"¥":""}${value.toLocaleString("zh-CN",{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}`;
const dateLabel = (point:DashboardTrendPoint) => point.startDate===point.endDate?point.startDate.slice(5).replace("-","/"):`${point.startDate.slice(5).replace("-","/")} - ${point.endDate.slice(5).replace("-","/")}`;

export function DashboardBusinessTrend({ data, onSelect }: { data: DashboardAnalyticsSnapshot; onSelect: (metric: DashboardTrendMetric, point: DashboardTrendPoint) => void }) {
  const [metric,setMetric] = useState<DashboardTrendMetric>("acceptedGmv");
  const selected = options.find(item=>item.value===metric) ?? options[0];
  const points = data.businessTrends[metric];
  const maximum = Math.max(1,...points.map(point=>point.value));
  const granularity=data.period<=14?"按日":"按周";
  return <Surface className="dashboard-trend-panel">
    <div className="dashboard-section-header dashboard-section-header-row dashboard-trend-header"><div><h2><BarChart3/>经营趋势</h2><p>{data.periodStart} 00:00:00 至 {data.periodEnd} 23:59:59 · {granularity} · 来源表：tasks、taskExecutions</p></div></div>
    <div className="dashboard-chart-toolbar"><strong>{selected.label}趋势</strong><Segmented className="dashboard-trend-switch" size="small" value={metric} onChange={value=>setMetric(value as DashboardTrendMetric)} options={options.map(item=>({label:item.label,value:item.value}))}/></div>
    <div className="dashboard-business-bars" role="group" aria-label={`${selected.label}${data.periodStart}至${data.periodEnd}趋势`}>{points.map(point=>{
      const change = point.previous ? (point.value-point.previous)/point.previous*100 : null;
      return <button type="button" key={`${metric}:${point.startDate}`} className="dashboard-business-bar dashboard-action" onClick={()=>onSelect(metric,point)} aria-label={`${point.startDate}至${point.endDate}，${format(point.value,selected.money,selected.decimals)}`} title={`${point.startDate} 至 ${point.endDate}：${format(point.value,selected.money,selected.decimals)}${change===null?"":`，环比 ${change.toFixed(1)}%`}`}>
        <span className="dashboard-business-bar-value"><strong>{format(point.value,selected.money,selected.decimals)}</strong>{change!==null&&<em className={change>=0?"is-positive":"is-negative"}>{change>=0?"↑":"↓"} {Math.abs(change).toFixed(1)}%</em>}</span><i style={{height:`${Math.max(14,point.value/maximum*100)}%`}}/><small>{dateLabel(point)}</small>
      </button>;
    })}</div>
  </Surface>;
}
