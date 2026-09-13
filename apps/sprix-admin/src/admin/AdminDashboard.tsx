import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Alert,Button,DatePicker,Skeleton} from 'antd';
import {PageHeader,Surface} from '../components/Primitives';
import type {AnalyticsRange} from '../services/dashboardAnalyticsMock';
import {useDashboardAnalytics} from './useDashboardAnalytics';
import {DashboardBusinessMetrics} from './DashboardBusinessMetrics';
import {DashboardOrders} from './DashboardOrders';
import './dashboard.css';

const MIN_DATE='2026-07-27';
const DATA_END_DATE='2026-09-06';
const CUTOFF_AT='2026-09-06 23:59:59';
const dashboardTime=(value:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value));

export function AdminDashboard(){
 const navigate=useNavigate();
 const [range,setRange]=useState<AnalyticsRange>({startDate:MIN_DATE,endDate:DATA_END_DATE});
 const [ordersOpen,setOrdersOpen]=useState(false);
 const query=useDashboardAnalytics(range);
 const startDate='days' in range?MIN_DATE:range.startDate;
 const endDate='days' in range?DATA_END_DATE:range.endDate;
 const rangeControl=<DatePicker.RangePicker className="dashboard-range-picker" aria-label="日经营数据查询日期范围" allowClear={false} value={null} placeholder={[startDate,endDate]} format="YYYY-MM-DD" disabledDate={date=>{const key=date.format('YYYY-MM-DD');return key<MIN_DATE||key>DATA_END_DATE;}} onChange={(_,values)=>{const[nextStart,nextEnd]=values;if(nextStart&&nextEnd)setRange({startDate:nextStart,endDate:nextEnd});}}/>;
 const actions=<div className="dashboard-header-actions"><Button className="dashboard-refresh-button" loading={query.isFetching} onClick={()=>void query.refetch()}>刷新数据</Button><div className="dashboard-update-line">经营数据更新至 {CUTOFF_AT}（北京时间）</div></div>;
 const pageSubtitle="平台规模、日经营数据与周度趋势";
 if(query.isPending)return <div className="dashboard-page"><PageHeader title="Sprix 核心经营看板" subtitle={pageSubtitle} actions={actions}/><Surface className="dashboard-loading" aria-live="polite"><Skeleton active paragraph={{rows:14}}/></Surface></div>;
 if(query.isError)return <div className="dashboard-page"><PageHeader title="Sprix 核心经营看板" subtitle={pageSubtitle} actions={actions}/><Alert type="error" showIcon message="数据概览加载失败" description={query.error.message} action={<Button onClick={()=>void query.refetch()}>重试</Button>}/></div>;
 const metrics=query.data.businessMetrics;
 if(!metrics)return <div className="dashboard-page"><PageHeader title="Sprix 核心经营看板" subtitle={pageSubtitle} actions={actions}/><Alert type="warning" showIcon message="经营数据缺失" description="当前响应未包含完整经营数据。"/></div>;
 const taskQuery=(category?:string,scope:'period'|'snapshot'='period')=>{
  const params=new URLSearchParams({source:'dashboard',startDate:scope==='snapshot'?MIN_DATE:metrics.periodStart,endDate:scope==='snapshot'?DATA_END_DATE:metrics.periodEnd,endAt:CUTOFF_AT,snapshotVersion:metrics.snapshotVersion});
  if(category)params.set('category',category);
  navigate(`/tasks?${params}`);
 };
 const weeklyStart=metrics.weeks[0]?.startDate??MIN_DATE,weeklyEnd=metrics.weeks[metrics.weeks.length-1]?.endDate??DATA_END_DATE;
 return <div className="dashboard-page"><PageHeader title="Sprix 核心经营看板" subtitle={pageSubtitle} actions={actions}/><DashboardBusinessMetrics data={metrics} overview={query.data.overview} snapshotAt={dashboardTime(query.data.generatedAt)} onTasks={taskQuery} onOrders={()=>setOrdersOpen(true)} rangeControl={rangeControl}/>{ordersOpen&&<DashboardOrders initialStatus="completed" startDate={weeklyStart} endDate={weeklyEnd} endAt={CUTOFF_AT} snapshotVersion={metrics.snapshotVersion} onClose={()=>setOrdersOpen(false)}/>}</div>;
}
