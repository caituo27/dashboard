import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, DatePicker, Segmented, Skeleton } from "antd";
import { PageHeader, Surface } from "../components/Primitives";
import type { AnalyticsPeriod, AnalyticsRange, DashboardTrendMetric, DashboardTrendPoint } from "../services/dashboardAnalyticsMock";
import { useDashboardAnalytics } from "./useDashboardAnalytics";
import { DashboardOverview } from "./DashboardOverview";
import { DashboardBusinessResults } from "./DashboardBusinessResults";
import { DashboardTaskOperations } from "./DashboardTaskOperations";
import { DashboardBusinessTrend } from "./DashboardBusinessTrend";
import { DashboardAgentEcosystem } from "./DashboardAgentEcosystem";
import { DashboardSupplyAnalysis } from "./DashboardSupplyAnalysis";
import { DashboardAnalytics } from "./DashboardAnalytics";
import type { AnalyticsSelection } from "./AnalyticsDetails";
import { DashboardOrders } from "./DashboardOrders";
import type { ExecutionFilter, OrderRange } from "../services/dashboardRecords";
import "./dashboard.css";

function dashboardTime(value:string){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(value));}

export function AdminDashboard(){
  const navigate=useNavigate();
  const [range,setRange]=useState<AnalyticsRange>({days:7});
  const [orderDrilldown,setOrderDrilldown]=useState<({status:ExecutionFilter}&OrderRange)|null>(null);
  const [analyticsSelection,setAnalyticsSelection]=useState<AnalyticsSelection|null>(null);
  const query=useDashboardAnalytics(range);
  if(query.isPending)return <Surface className="dashboard-loading"><Skeleton active paragraph={{rows:14}}/></Surface>;
  if(query.isError)return <Alert type="error" showIcon message="数据概览加载失败" description="请检查网络连接后重试。" action={<Button onClick={()=>void query.refetch()}>重试</Button>}/>;
  const data=query.data;
  const cutoffTime=dashboardTime(data.generatedAt);
  const periodRange=`${data.periodStart} 00:00:00 至 ${data.periodEnd} 23:59:59`;
  const latestAllowed=cutoffTime.slice(0,10);
  const earliestAllowed=new Date(Date.parse(`${latestAllowed}T00:00:00+08:00`)-29*86_400_000+8*3_600_000).toISOString().slice(0,10);
  const taskRange=`startDate=${data.periodStart}&endDate=${data.periodEnd}`;
  const openOrders=(status:ExecutionFilter,startDate=data.periodStart,endDate=data.periodEnd)=>setOrderDrilldown({status,startDate,endDate});
  const openAccepted=()=>openOrders("completed");
  const openLifecycle=(node:"published"|"accepted"|"completed"|"passed")=>{
    if(node==="published"){navigate(`/tasks?status=${encodeURIComponent("已发布")}&${taskRange}`);return;}
    openOrders(node==="accepted"?"all":"completed");
  };
  const openTrend=(metric:DashboardTrendMetric,point:DashboardTrendPoint)=>{
    if(metric==="acceptedGmv"||metric==="completedTasks"){openOrders("completed",point.startDate,point.endDate);return;}
    navigate(`/tasks?trendMetric=${metric}&startDate=${point.startDate}&endDate=${point.endDate}`);
  };
  const headerActions=<div className="dashboard-header-actions"><span>数据更新至 {cutoffTime}（北京时间）</span><div className="dashboard-range-controls"><Segmented aria-label="快捷统计周期" value={"days" in range?range.days:undefined} onChange={value=>setRange({days:Number(value) as AnalyticsPeriod})} options={[{label:"近 7 天",value:7},{label:"近 30 天",value:30},{label:"最近 4 个完整自然周",value:28}]}/><DatePicker.RangePicker className="dashboard-range-picker" aria-label="自定义统计周期" allowClear={false} value={null} placeholder={[`${data.periodStart} 00:00:00`,`${data.periodEnd} 23:59:59`]} format="YYYY-MM-DD" disabledDate={date=>{const key=date.format("YYYY-MM-DD");return key<earliestAllowed||key>latestAllowed;}} onChange={(_,values)=>{const[startDate,endDate]=values;if(startDate&&endDate)setRange({startDate,endDate});}}/></div></div>;
  return <div className="dashboard-page">
    <PageHeader title="Dashboard" subtitle="平台运营数据总览" actions={headerActions}/>
    <DashboardOverview overview={data.overview} cutoffTime={cutoffTime}/>
    <DashboardBusinessResults data={data} periodRange={periodRange} cutoffTime={cutoffTime} onAccepted={openAccepted} onTasks={()=>navigate(`/tasks?${taskRange}`)} onOperations={()=>document.querySelector(".dashboard-task-flow")?.scrollIntoView({behavior:"smooth",block:"start"})} onAgent={()=>document.querySelector(".dashboard-agent-panel")?.scrollIntoView({behavior:"smooth",block:"start"})} onTraffic={()=>setAnalyticsSelection({kind:"pv",startDate:data.periodStart,endDate:data.periodEnd})}/>
    <DashboardTaskOperations data={data} onNode={openLifecycle}/>
    <div className="dashboard-analysis-grid"><DashboardBusinessTrend data={data} onSelect={openTrend}/><DashboardAgentEcosystem data={data}/></div>
    <div className="dashboard-lower-grid">
      <DashboardSupplyAnalysis data={data} cutoffTime={cutoffTime} onCategory={category=>navigate(`/tasks?category=${encodeURIComponent(category)}`)} onDate={date=>navigate(`/tasks?publishedDate=${date}`)}/>
      <DashboardAnalytics data={data} selection={analyticsSelection} onSelectionChange={setAnalyticsSelection}/>
    </div>
    {orderDrilldown&&<DashboardOrders key={`${orderDrilldown.status}:${orderDrilldown.startDate}:${orderDrilldown.endDate}`} initialStatus={orderDrilldown.status} startDate={orderDrilldown.startDate} endDate={orderDrilldown.endDate} onClose={()=>setOrderDrilldown(null)}/>}
  </div>;
}
