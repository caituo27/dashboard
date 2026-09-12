import { Surface } from "../components/Primitives";
import type { DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";
import { Users } from "lucide-react";

const number = (value:number,decimals=0)=>value.toLocaleString("zh-CN",{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
const compactNumber = (value:number)=>value>=1000?`${(value/1000).toFixed(value>=10_000?0:1)}k`:number(value);

export function DashboardAgentEcosystem({ data }: { data: DashboardAnalyticsSnapshot }) {
  const ecosystem=data.agentEcosystem;const width=620,height=150;const plot={left:44,right:548,top:18,bottom:124};
  const periodRange=`${data.periodStart} 00:00:00 至 ${data.periodEnd} 23:59:59`;
  const active=ecosystem.daily.map(item=>item.activeAgents);const accepting=ecosystem.daily.map(item=>item.acceptingAgents);
  const rawMinimum=Math.min(...active,...accepting);const rawMaximum=Math.max(...active,...accepting);const range=Math.max(1,rawMaximum-rawMinimum);const minimum=Math.max(0,Math.floor((rawMinimum-range*.18)/100)*100);const maximum=Math.ceil((rawMaximum+range*.18)/100)*100;
  const x=(index:number)=>plot.left+index*(plot.right-plot.left)/Math.max(1,ecosystem.daily.length-1);const y=(value:number)=>plot.top+(1-(value-minimum)/Math.max(1,maximum-minimum))*(plot.bottom-plot.top);
  const activePoints=active.map((value,index)=>`${x(index)},${y(value)}`).join(" ");const acceptingPoints=accepting.map((value,index)=>`${x(index)},${y(value)}`).join(" ");
  const ticks=[maximum,Math.round((maximum+minimum)/2),minimum];const last=ecosystem.daily[ecosystem.daily.length-1];
  return <Surface className="dashboard-agent-panel"><div className="dashboard-section-header dashboard-section-header-row"><div><h2><Users/>Agent 生态</h2><p>{periodRange} · Agent 参与情况 · 来源表：agents、taskExecutions</p></div><div className="dashboard-chart-legend"><span><i className="is-active"/>活跃 Agent{last&&<strong>{number(last.activeAgents)}</strong>}</span><span><i className="is-accepting"/>接单 Agent{last&&<strong>{number(last.acceptingAgents)}</strong>}</span></div></div>
    <div className="dashboard-dual-line"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="活跃 Agent 与接单 Agent 趋势">{ticks.map((tick,index)=>{const tickY=plot.top+index*(plot.bottom-plot.top)/2;return <g key={tick}><line x1={plot.left} y1={tickY} x2={plot.right} y2={tickY} className="dashboard-line-grid"/><text x={plot.left-8} y={tickY+3} textAnchor="end" className="dashboard-axis-label">{compactNumber(tick)}</text></g>;})}<polyline points={activePoints} className="dashboard-agent-active-line"/><polyline points={acceptingPoints} className="dashboard-agent-accepting-line"/>{ecosystem.daily.map((item,index)=><g key={item.date}><circle cx={x(index)} cy={y(item.activeAgents)} r="3" className="dashboard-agent-active-point"><title>{item.date} 活跃 Agent：{number(item.activeAgents)}</title></circle><circle cx={x(index)} cy={y(item.acceptingAgents)} r="3" className="dashboard-agent-accepting-point"><title>{item.date} 接单 Agent：{number(item.acceptingAgents)}</title></circle>{(ecosystem.daily.length<=7||index%5===0||index===ecosystem.daily.length-1)&&<text x={x(index)} y={height-5} textAnchor="middle" className="dashboard-axis-label">{item.date.slice(5).replace("-","/")}</text>}</g>)}{last&&<><text x={plot.right+10} y={y(last.activeAgents)+3} className="dashboard-line-value is-active">{number(last.activeAgents)}</text><text x={plot.right+10} y={y(last.acceptingAgents)+3} className="dashboard-line-value is-accepting">{number(last.acceptingAgents)}</text></>}</svg></div>
  </Surface>;
}
