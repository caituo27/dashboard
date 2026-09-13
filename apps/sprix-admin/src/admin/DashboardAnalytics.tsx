import { AdminTable as Table } from "../components/AdminTable";
import { Surface } from "../components/Primitives";
import { dashboardPeriodEnd, dashboardPeriodRange, type DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";
import { AnalyticsDetails, type AnalyticsSelection } from "./AnalyticsDetails";
import { ListOrdered, TrendingUp } from "lucide-react";

const number=(value:number,decimals=0)=>value.toLocaleString("zh-CN",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
const compactNumber=(value:number)=>value>=10_000?`${Math.round(value/1000)}k`:value>=1000?`${(value/1000).toFixed(1)}k`:number(value);

export function DashboardAnalytics({data,selection,onSelectionChange}:{data:DashboardAnalyticsSnapshot;selection:AnalyticsSelection|null;onSelectionChange:(selection:AnalyticsSelection|null)=>void}){
  const pv=data.daily.map(day=>day.pv);const uv=data.daily.map(day=>day.uv);const width=760,height=158;const plot={left:52,right:682,top:14,bottom:124};
  const uvMaximum=Math.ceil(Math.max(1,...uv)/1000)*1000;const pvMaximum=Math.ceil(Math.max(1,...pv)/1000)*1000;
  const x=(index:number)=>plot.left+index*(plot.right-plot.left)/Math.max(1,data.daily.length-1);
  const yUv=(value:number)=>plot.top+(1-value/uvMaximum)*(plot.bottom-plot.top);const yPv=(value:number)=>plot.top+(1-value/pvMaximum)*(plot.bottom-plot.top);
  const points=(values:number[],scale:(value:number)=>number)=>values.map((value,index)=>`${x(index)},${scale(value)}`).join(" ");const tickRatios=[1,0.5,0];const last=data.daily[data.daily.length-1];
  const periodRange=dashboardPeriodRange(data);
  const shortPeriod=`${data.periodStart.slice(5)} 至 ${data.periodEnd.slice(5)}`;
  const withRange = (value: Omit<AnalyticsSelection,"startDate"|"endDate"|"endAt">): AnalyticsSelection => ({...value,startDate:data.periodStart,endDate:data.periodEnd,endAt:dashboardPeriodEnd(data)});
  const openDailyDetail=(kind:"uv"|"pv",date:string)=>onSelectionChange(withRange({kind,date}));
  return <>
    <Surface className="dashboard-traffic-panel"><div className="dashboard-section-header dashboard-section-header-row"><div><h2><TrendingUp/>用户访问与行为</h2><p>{periodRange} · 按所选区间统计</p></div><div className="dashboard-chart-legend" aria-label="趋势图图例"><span><i className="is-uv"/>UV（独立访客）</span><span><i className="is-pv"/>PV（页面浏览量）</span></div></div>
      <div className="dashboard-traffic-metrics">
        <button type="button" className="dashboard-traffic-metric" onClick={()=>onSelectionChange(withRange({kind:"uv"}))}><span>UV</span><strong>{number(data.uv)}</strong><em>独立访客</em><small>{shortPeriod}</small></button>
        <button type="button" className="dashboard-traffic-metric" onClick={()=>onSelectionChange(withRange({kind:"pv"}))}><span>PV</span><strong>{number(data.pv)}</strong><em>页面浏览量</em><small>{shortPeriod}</small></button>
        <div className="dashboard-traffic-metric"><span>人均浏览页数</span><strong>{data.uv?number(data.pv/data.uv,2):"—"}</strong><em>PV ÷ UV</em><small>{shortPeriod}</small></div>
      </div>
      <div className="dashboard-traffic-chart"><div className="dashboard-chart-caption"><strong>每日访问趋势</strong><span>左轴 UV · 右轴 PV</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日 UV 与 PV 趋势，左轴表示 UV，右轴表示 PV">{tickRatios.map(ratio=>{const tickY=plot.top+(1-ratio)*(plot.bottom-plot.top);return <g key={ratio}><line x1={plot.left} y1={tickY} x2={plot.right} y2={tickY} className="dashboard-line-grid"/><text x={plot.left-8} y={tickY+3} textAnchor="end" className="dashboard-axis-label is-uv">{compactNumber(Math.round(uvMaximum*ratio))}</text><text x={width-4} y={tickY+3} textAnchor="end" className="dashboard-axis-label is-pv">{compactNumber(Math.round(pvMaximum*ratio))}</text></g>;})}<polyline points={points(uv,yUv)} className="dashboard-uv-line"/><polyline points={points(pv,yPv)} className="dashboard-pv-line"/>{data.daily.map((day,index)=>{const showDate=data.daily.length<=7||index%5===0||index===data.daily.length-1;return <g key={day.date} className="dashboard-traffic-point"><circle cx={x(index)} cy={yUv(day.uv)} r="3" className="is-uv" role="button" tabIndex={0} onClick={()=>openDailyDetail("uv",day.date)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openDailyDetail("uv",day.date);}}}><title>{day.date} UV：{number(day.uv)}</title></circle><circle cx={x(index)} cy={yPv(day.pv)} r="3" className="is-pv" role="button" tabIndex={0} onClick={()=>openDailyDetail("pv",day.date)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openDailyDetail("pv",day.date);}}}><title>{day.date} PV：{number(day.pv)}</title></circle>{showDate&&<text x={x(index)} y={height-7} textAnchor="middle" className="dashboard-axis-label">{day.date.slice(5).replace("-","/")}</text>}</g>;})}{last&&<><text x={plot.right+9} y={yUv(last.uv)+3} className="dashboard-line-value is-uv">{number(last.uv)}</text><text x={plot.right+9} y={yPv(last.pv)+3} className="dashboard-line-value is-pv">{number(last.pv)}</text></>}</svg></div>
    </Surface>
    <Surface className="dashboard-behavior-panel"><div className="dashboard-section-header"><div><h2><ListOrdered/>关键行为排行</h2><p>{periodRange} · 转化率为行为用户数占区间 UV 的比例</p></div></div><Table rowKey="eventName" size="small" pagination={false} dataSource={data.behaviors} onRow={record=>({onClick:()=>onSelectionChange(withRange({kind:"behavior",behavior:record.name,eventName:record.eventName})),onKeyDown:event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelectionChange(withRange({kind:"behavior",behavior:record.name,eventName:record.eventName}));}},tabIndex:0,className:"dashboard-behavior-row"})} columns={[{title:"行为",dataIndex:"name"},{title:"用户数",dataIndex:"users",align:"right",render:(value:number)=>number(value)},{title:"发生次数",dataIndex:"count",align:"right",render:(value:number)=>number(value)},{title:"用户转化率",dataIndex:"conversion",align:"right",render:(value?:number)=>value==null?"—":`${value.toFixed(1)}%`},{title:"操作",key:"action",width:90,render:()=> <span className="dashboard-table-link">查看明细</span>}]}/></Surface>
    <AnalyticsDetails data={data} selection={selection} onChange={value=>onSelectionChange(value)} onClose={()=>onSelectionChange(null)}/>
  </>;
}
