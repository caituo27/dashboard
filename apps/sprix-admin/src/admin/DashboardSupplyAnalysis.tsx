import { useState } from "react";
import { Segmented, Empty } from "antd";
import { Surface } from "../components/Primitives";
import type { DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";
import { ClipboardList } from "lucide-react";

const number=(value:number)=>value.toLocaleString("zh-CN");
export function DashboardSupplyAnalysis({data,cutoffTime,onCategory,onDate}:{data:DashboardAnalyticsSnapshot;cutoffTime:string;onCategory:(category:string)=>void;onDate:(date:string)=>void}){
  const [view,setView]=useState<"categories"|"trend">("categories");
  const categories=data.operations.publishedTaskCategories;const total=categories.reduce((sum,item)=>sum+item.count,0);const publications=data.operations.taskPublications;const max=Math.max(1,...publications.map(item=>item.count));
  const periodRange=`${data.periodStart} 00:00:00 至 ${data.periodEnd} 23:59:59`;
  const context=view==="categories"?`截至 ${cutoffTime} 的已发布任务 · 来源表：tasks`:`${periodRange} · 任务发布数量 · 来源表：tasks`;
  return <Surface className="dashboard-supply-panel"><div className="dashboard-section-header dashboard-section-header-row"><div><h2><ClipboardList/>任务供给分析</h2><p>{context}</p></div><Segmented size="small" value={view} onChange={value=>setView(value as typeof view)} options={[{label:"任务类别分布",value:"categories"},{label:"任务发布趋势",value:"trend"}]}/></div>
    {view==="categories"?<div className="dashboard-category-bars">{categories.map(item=>{const ratio=item.count/Math.max(1,total)*100;return <button type="button" key={item.category} className="dashboard-category-row dashboard-action" disabled={item.category==="其他"} onClick={()=>onCategory(item.category)}><span>{item.category}</span><i><b style={{width:`${ratio}%`}}/></i><strong>{ratio.toFixed(1)}%</strong><small>{number(item.count)}</small></button>;})}</div>:publications.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${periodRange} 暂无任务发布记录`}/>:<div className="dashboard-publication-bars">{publications.map((item,index)=><button type="button" key={item.date} className="dashboard-publication-column dashboard-action" onClick={()=>onDate(item.date)} title={`${item.date}：发布 ${number(item.count)} 个任务`}><span>{number(item.count)}</span><i style={{height:`${Math.max(8,item.count/max*100)}%`}}/><small>{publications.length<=7||index%5===0||index===publications.length-1?item.date.slice(5).replace("-","/"):""}</small></button>)}</div>}
  </Surface>;
}
