import {useState,type ReactNode} from 'react';
import {Table} from 'antd';
import {ChartNoAxesCombined,Layers3,ShieldCheck} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {Surface} from '../components/Primitives';
import type {BusinessMetrics,BusinessWeek,DashboardAnalyticsSnapshot} from '../services/dashboardAnalyticsMock';

const integer=(value:number)=>value.toLocaleString('zh-CN');
const money=(value:number)=>`¥${value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const shortMoney=(value:number)=>value>=10000?`¥${(value/10000).toFixed(value>=100000?1:2)}万`:money(value);
const percent=(value:number|null)=>value==null?'—':`${(value*100).toFixed(value*100%1===0?0:2)}%`;
const chart={width:760,height:300,left:62,right:48,top:24,bottom:48};
const plotWidth=chart.width-chart.left-chart.right;
const plotHeight=chart.height-chart.top-chart.bottom;
const y=(value:number,maximum:number)=>chart.top+plotHeight-(value/Math.max(maximum,1))*plotHeight;
const xAt=(index:number,count:number)=>chart.left+(index+.5)*plotWidth/Math.max(count,1);
const typeColors=['#087f70','#20b8a5','#3d8bfd','#76b8eb','#eab44c','#9aa7b5'];
export const AGENT_STRUCTURE_COLORS=['#3498f5','#ff8a3d','#57c978','#e979b5','#9272e6','#35b7b3'];
export const TASK_STRUCTURE_COLORS={primary:'#3498f5',secondary:'#86b7e7'};
type IconType=LucideIcon;

type ChartTooltipGroup={label:string;value?:string;color?:string;rows?:Array<{label:string;value:string}>};

function tooltipSide(index:number,count:number){
 const position=count<=1?.5:index/(count-1);
 return position<.42?'is-right':position>.58?'is-left':'';
}

function ChartDetailTooltip({index,count,scopeLabel,scopeValue,groups,footer}:{index:number;count:number;scopeLabel:string;scopeValue:string;groups:ChartTooltipGroup[];footer?:{label:string;value:string}}){
 return <div className={`executive-settlement-tooltip executive-chart-detail-tooltip ${tooltipSide(index,count)}`} role="status">
  <header><span>{scopeLabel}</span><strong>{scopeValue}</strong></header>
  <div className={`executive-settlement-tooltip-groups${groups.length===1?' is-single':''}`}>{groups.map((group,groupIndex)=><section key={`${group.label}-${groupIndex}`}><div>{group.color&&<span className="executive-tooltip-swatch" style={{background:group.color}}/>}<span className="executive-tooltip-group-label">{group.label}</span>{group.value&&<strong>{group.value}</strong>}</div>{group.rows?.map(row=><p key={row.label}><span>{row.label}</span><b>{row.value}</b></p>)}</section>)}</div>
  {footer&&<footer><span>{footer.label}</span><strong>{footer.value}</strong></footer>}
 </div>;
}

function ChartNodeHits({count,onActiveIndexChange,labels,left=chart.left,top=chart.top,width=plotWidth,height=plotHeight}:{count:number;onActiveIndexChange:(index:number|null)=>void;labels:string[];left?:number;top?:number;width?:number;height?:number}){
 const band=width/Math.max(count,1);
 return <g className="executive-chart-node-hits">{Array.from({length:count},(_,index)=><rect key={index} x={left+index*band} y={top} width={band} height={height} tabIndex={0} aria-label={labels[index]} onMouseEnter={()=>onActiveIndexChange(index)} onFocus={()=>onActiveIndexChange(index)} onBlur={()=>onActiveIndexChange(null)}/>)}</g>;
}

export function buildDailyAgentTypeComposition(weeks:BusinessWeek[]){
 return weeks.flatMap(week=>week.dailyNewAgents.map((day,dayIndex)=>{
  const segments=week.agentTypes.map(item=>({type:item.type,count:item.daily[dayIndex]??0}));
  const total=segments.reduce((sum,item)=>sum+item.count,0);
  return {date:day.date,total,segments:segments.map(item=>({...item,share:total>0?item.count/total:0}))};
 }));
}

export function buildTaskTypeComposition(weeks:BusinessWeek[]){
 const totals=new Map<string,number>();
 for(const week of weeks)for(const item of week.taskTypes)totals.set(item.type,(totals.get(item.type)??0)+item.tasks);
 const total=[...totals.values()].reduce((sum,value)=>sum+value,0);
 return [...totals].map(([type,count])=>({type,count,share:total>0?count/total:0})).sort((a,b)=>b.count-a.count||a.type.localeCompare(b.type,'zh-CN'));
}

export function buildQualityWeekSummary(week:BusinessWeek){
 return week.taskTypes.map(item=>({type:item.type,rate:item.passRate}));
}

export function selectDashboardWeekScopes(weeks:BusinessWeek[],_periodStart:string,_periodEnd:string){
 const dailyWeeks=weeks.filter(week=>week.dailyNewAgents.length>0||week.dailyDelivery.length>0);
 const weeklyWeeks=weeks,latestCompleteWeek=weeklyWeeks[weeklyWeeks.length-1];
 return {dailyWeeks,weeklyWeeks,latestCompleteWeek};
}

function PeriodMetric({label,value,note,onClick}:{label:string;value:string;note:string;onClick?:()=>void}){
 const content=<><small>{label}</small><strong>{value}</strong><p>{note}</p></>;
 return onClick?<button type="button" className="executive-period-metric executive-period-metric-button" onClick={onClick}>{content}</button>:<div className="executive-period-metric">{content}</div>;
}

function Section({title,description,icon:Icon,scope,children}:{title:string;description?:string;icon:IconType;scope?:string;children:ReactNode}){
 return <Surface className="executive-section"><header className="executive-section-header"><span><Icon size={17}/></span><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{scope&&<em>{scope}</em>}</header>{children}</Surface>;
}

function Grid({leftLabel,rightLabel}:{leftLabel:string;rightLabel?:string}){
 return <g className="executive-chart-grid">{[0,1,2,3,4].map(index=>{const gridY=chart.top+index*plotHeight/4;return <line key={index} x1={chart.left} x2={chart.width-chart.right} y1={gridY} y2={gridY}/>;})}<text x={chart.left} y={14}>{leftLabel}</text>{rightLabel&&<text x={chart.width-chart.right} y={14} textAnchor="end">{rightLabel}</text>}</g>;
}

function AxisTicks({leftMaximum,rightMinimum=0,rightMaximum,leftFormat=(value)=>integer(Math.round(value)),rightFormat=(value)=>integer(Math.round(value))}:{leftMaximum:number;rightMinimum?:number;rightMaximum?:number;leftFormat?:(value:number)=>string;rightFormat?:(value:number)=>string}){
 return <g className="executive-axis-ticks">{[0,1,2,3,4].map(index=>{const ratio=1-index/4,tickY=chart.top+index*plotHeight/4;return <g key={index}><text x={chart.left-8} y={tickY+4} textAnchor="end">{leftFormat(leftMaximum*ratio)}</text>{rightMaximum!=null&&<text x={chart.width-chart.right+8} y={tickY+4}>{rightFormat(rightMinimum+(rightMaximum-rightMinimum)*ratio)}</text>}</g>;})}</g>;
}

function DailyAgentChart({weeks}:{weeks:BusinessWeek[]}){
 const [activeIndex,setActiveIndex]=useState<number|null>(null);
 const days=weeks.flatMap(week=>week.dailyNewAgents),maximum=Math.max(1,...days.map(day=>day.total));
 const band=plotWidth/Math.max(days.length,1),barWidth=Math.max(3,band-3),active=activeIndex==null?null:days[activeIndex];
 return <div className="executive-chart" onMouseLeave={()=>setActiveIndex(null)}><div className="executive-chart-legend"><span><i className="is-teal"/>每日新增 Agent</span></div><div className="executive-chart-plot"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="每日新增 Agent"><Grid leftLabel="新增 Agent 数"/><AxisTicks leftMaximum={maximum}/>{days.map((day,index)=><rect key={day.date} className="is-teal-bar" x={chart.left+index*band+(band-barWidth)/2} y={y(day.total,maximum)} width={barWidth} height={chart.top+plotHeight-y(day.total,maximum)} rx="1"/>)}{activeIndex!=null&&<line className="executive-settlement-guide" x1={xAt(activeIndex,days.length)} x2={xAt(activeIndex,days.length)} y1={chart.top} y2={chart.top+plotHeight}/>}<ChartNodeHits count={days.length} onActiveIndexChange={setActiveIndex} labels={days.map(day=>`${day.date}，新增 Agent ${integer(day.total)}`)}/>{days.map((day,index)=>(index%Math.max(1,Math.ceil(days.length/7))===0||index===days.length-1)?<text className="executive-axis-label" key={day.date} x={xAt(index,days.length)} y={chart.height-14} textAnchor="middle">{day.date.slice(5).replace('-','/')}</text>:null)}</svg>{active&&activeIndex!=null&&<ChartDetailTooltip index={activeIndex} count={days.length} scopeLabel="日期" scopeValue={active.date} groups={[{label:'新增 Agent',value:integer(active.total),color:'#14a58f'}]}/>}</div></div>;
}

function WeeklyGmvChart({weeks}:{weeks:BusinessWeek[]}){
 const [activeIndex,setActiveIndex]=useState<number|null>(null);
 const gmv=weeks.map(week=>week.acceptedGmv),agents=weeks.map(week=>week.effectiveAgents),gmvMax=Math.max(1,...gmv),agentMax=Math.max(1,...agents);
 const gmvPoints=gmv.map((value,index)=>`${xAt(index,gmv.length)},${y(value,gmvMax)}`).join(' '),agentPoints=agents.map((value,index)=>`${xAt(index,agents.length)},${y(value,agentMax)}`).join(' ');
 const active=activeIndex==null?null:weeks[activeIndex];
 return <div className="executive-chart" onMouseLeave={()=>setActiveIndex(null)}><div className="executive-chart-legend"><span><i className="is-deep-teal is-line is-line-dot"/>周验收 GMV</span><span><i className="is-blue is-line is-line-dot"/>同周有效 Agent</span></div><div className="executive-chart-plot"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="周验收 GMV 与同周有效 Agent 双折线图"><Grid leftLabel="GMV（万元）" rightLabel="有效 Agent 数"/><AxisTicks leftMaximum={gmvMax} rightMaximum={agentMax} leftFormat={value=>(value/10000).toFixed(0)}/><polyline className="executive-chart-line is-deep-teal" points={gmvPoints}/><polyline className="executive-chart-line is-blue" points={agentPoints}/>{activeIndex!=null&&<line className="executive-settlement-guide" x1={xAt(activeIndex,weeks.length)} x2={xAt(activeIndex,weeks.length)} y1={chart.top} y2={chart.top+plotHeight}/>} {weeks.flatMap((week,index)=>[<circle key={`${week.label}-gmv`} className="executive-chart-dot is-deep-teal" cx={xAt(index,weeks.length)} cy={y(week.acceptedGmv,gmvMax)} r="4"/>,<circle key={`${week.label}-agent`} className="executive-chart-dot is-blue" cx={xAt(index,weeks.length)} cy={y(week.effectiveAgents,agentMax)} r="4"/>])}<ChartNodeHits count={weeks.length} onActiveIndexChange={setActiveIndex} labels={weeks.map(week=>`${week.label}，周验收 GMV ${money(week.acceptedGmv)}，有效 Agent ${integer(week.effectiveAgents)}`)}/>{weeks.map((week,index)=><text className="executive-axis-label" key={week.label} x={xAt(index,weeks.length)} y={chart.height-14} textAnchor="middle">{week.label}</text>)}</svg>{active&&activeIndex!=null&&<ChartDetailTooltip index={activeIndex} count={weeks.length} scopeLabel="统计周" scopeValue={active.label} groups={[{label:'周验收 GMV',value:money(active.acceptedGmv),color:'#087f70'},{label:'有效 Agent',value:integer(active.effectiveAgents),color:'#4b8ce8'}]}/>}</div></div>;
}

function WeeklyHeterogeneityChart({weeks}:{weeks:BusinessWeek[]}){
 const [activeIndex,setActiveIndex]=useState<number|null>(null);
 const rates=weeks.map(week=>week.heterogeneousRate*100),maximum=Math.max(40,...rates),band=plotWidth/Math.max(weeks.length,1),barWidth=Math.min(46,band*.38);
 const active=activeIndex==null?null:weeks[activeIndex];
 return <div className="executive-chart" onMouseLeave={()=>setActiveIndex(null)}><div className="executive-chart-legend"><span><i className="is-mint"/>异构 Agent 比例</span></div><div className="executive-chart-plot"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="周度异构 Agent 比例柱状图"><Grid leftLabel="异构比例"/><AxisTicks leftMaximum={maximum} leftFormat={value=>`${Math.round(value)}%`}/>{weeks.map((week,index)=><rect key={week.label} className="executive-heterogeneity-bar" x={xAt(index,weeks.length)-barWidth/2} y={y(week.heterogeneousRate*100,maximum)} width={barWidth} height={chart.top+plotHeight-y(week.heterogeneousRate*100,maximum)} rx="2"/>)}{activeIndex!=null&&<line className="executive-settlement-guide" x1={xAt(activeIndex,weeks.length)} x2={xAt(activeIndex,weeks.length)} y1={chart.top} y2={chart.top+plotHeight}/>}<ChartNodeHits count={weeks.length} onActiveIndexChange={setActiveIndex} labels={weeks.map(week=>`${week.label}，异构 Agent 比例 ${percent(week.heterogeneousRate)}`)}/>{weeks.map((week,index)=><text className="executive-axis-label" key={week.label} x={xAt(index,weeks.length)} y={chart.height-14} textAnchor="middle">{week.label}</text>)}</svg>{active&&activeIndex!=null&&<ChartDetailTooltip index={activeIndex} count={weeks.length} scopeLabel="统计周" scopeValue={active.label} groups={[{label:'异构 Agent 比例',value:percent(active.heterogeneousRate),color:'#28bda8'}]}/>}</div></div>;
}

function DailyDeliveryChart({weeks}:{weeks:BusinessWeek[]}){
 const [activeIndex,setActiveIndex]=useState<number|null>(null);
 const days=weeks.flatMap(week=>week.dailyDelivery),maximum=Math.max(1,...days.flatMap(day=>[day.tasks,day.effectiveAgents])),band=plotWidth/Math.max(days.length,1),barWidth=Math.max(3,band*.52),labelStep=Math.max(1,Math.ceil(Math.max(days.length-1,1)/6)),points=days.map((day,index)=>`${xAt(index,days.length)},${y(day.effectiveAgents,maximum)}`).join(' ');
 const active=activeIndex==null?null:days[activeIndex];
 return <div className="executive-chart executive-delivery-output-chart" onMouseLeave={()=>setActiveIndex(null)}><div className="executive-chart-legend"><span><i className="is-deep-teal"/>每日交付任务数</span><span><i className="is-blue is-line is-line-dot"/>当日有效 Agent 数</span></div><div className="executive-chart-plot"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="每日交付任务数与日有效 Agent 数"><Grid leftLabel="数量"/><AxisTicks leftMaximum={maximum}/>{days.map((day,index)=><rect key={day.date} className="is-deep-teal-bar" data-tasks={day.tasks} x={chart.left+index*band+(band-barWidth)/2} y={y(day.tasks,maximum)} width={barWidth} height={chart.top+plotHeight-y(day.tasks,maximum)} rx="1"/>)}<polyline className="executive-chart-line is-blue" points={points}/>{activeIndex!=null&&<line className="executive-settlement-guide" x1={xAt(activeIndex,days.length)} x2={xAt(activeIndex,days.length)} y1={chart.top} y2={chart.top+plotHeight}/>} {days.map((day,index)=><circle key={day.date} className="executive-chart-dot is-blue executive-output-dot" data-effective-agents={day.effectiveAgents} cx={xAt(index,days.length)} cy={y(day.effectiveAgents,maximum)} r="2.8"/>)}<ChartNodeHits count={days.length} onActiveIndexChange={setActiveIndex} labels={days.map(day=>`${day.date}，交付任务 ${integer(day.tasks)}，有效 Agent ${integer(day.effectiveAgents)}`)}/>{days.map((day,index)=>(index%labelStep===0||index===days.length-1)?<text className="executive-axis-label" key={day.date} x={xAt(index,days.length)} y={chart.height-14} textAnchor="middle">{day.date.slice(5).replace('-','/')}</text>:null)}</svg>{active&&activeIndex!=null&&<ChartDetailTooltip index={activeIndex} count={days.length} scopeLabel="日期" scopeValue={active.date} groups={[{label:'当日交付任务数',value:integer(active.tasks),color:'#087f70'},{label:'当日有效 Agent 数',value:integer(active.effectiveAgents),color:'#4b8ce8'}]}/>}</div></div>;
}

function ChartEmpty({children}:{children:ReactNode}){
 return <div className="executive-chart-empty">{children}</div>;
}

function TypeModuleHeader({title,note,totalLabel,total}:{title:string;note?:string;totalLabel:string;total:number}){
 return <div className="executive-type-module-header"><div><h3>{title}</h3>{note&&<p>{note}</p>}</div><div><small>{totalLabel}</small><strong>{integer(total)}</strong></div></div>;
}

function agentTypeLabel(type:string){return type==='3D工程师'?'3D 工程师':type;}

function shareAreaPath(lower:number[],upper:number[],left:number,top:number,plotWidth:number,plotHeight:number){
 const yAt=(share:number)=>top+(1-share)*plotHeight;
 if(upper.length===1)return `M ${left} ${yAt(upper[0])} L ${left+plotWidth} ${yAt(upper[0])} L ${left+plotWidth} ${yAt(lower[0])} L ${left} ${yAt(lower[0])} Z`;
 const xAtIndex=(index:number)=>left+index*plotWidth/Math.max(upper.length-1,1);
 const upperEdge=upper.map((share,index)=>`${index===0?'M':'L'} ${xAtIndex(index)} ${yAt(share)}`).join(' ');
 const lowerEdge=lower.map((share,index)=>({share,index})).reverse().map(({share,index})=>`L ${xAtIndex(index)} ${yAt(share)}`).join(' ');
 return `${upperEdge} ${lowerEdge} Z`;
}

function AgentTypeDistribution({weeks,total}:{weeks:BusinessWeek[];total:number}){
 const [activeIndex,setActiveIndex]=useState<number|null>(null);
 const types=weeks[0]?.agentTypes.map(item=>item.type)??[],days=buildDailyAgentTypeComposition(weeks),width=760,height=300,left=44,right=16,top=18,bottom=46,plotW=width-left-right,plotH=height-top-bottom,labelStep=Math.max(1,Math.ceil(days.length/7));
 const areas=types.map((type,typeIndex)=>{
  const lower=days.map(day=>day.segments.slice(0,typeIndex).reduce((sum,item)=>sum+item.share,0));
  const upper=days.map((day,dayIndex)=>lower[dayIndex]+(day.segments[typeIndex]?.share??0));
  return {type,path:shareAreaPath(lower,upper,left,top,plotW,plotH)};
 });
 const active=activeIndex==null?null:days[activeIndex];
 return <div className="executive-distribution" onMouseLeave={()=>setActiveIndex(null)}><TypeModuleHeader title="每日新增 Agent 类型构成" note="100% 堆叠面积展示每日构成变化；悬浮查看当天明细" totalLabel="累计新增 Agent" total={total}/><div className="executive-type-legend">{types.map((type,index)=><span key={type}><i style={{background:AGENT_STRUCTURE_COLORS[index]}}/>{agentTypeLabel(type)}</span>)}</div><div className="executive-chart-plot"><svg className="executive-daily-share-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每日新增 Agent 类型占比趋势">{[0,.5,1].map(rate=><g key={rate}><line x1={left} x2={width-right} y1={top+(1-rate)*plotH} y2={top+(1-rate)*plotH}/><text x={left-7} y={top+(1-rate)*plotH+4} textAnchor="end">{rate*100}%</text></g>)}<g className="executive-daily-share-areas">{areas.map((area,index)=><path key={area.type} d={area.path} fill={AGENT_STRUCTURE_COLORS[index]}/>)}</g>{activeIndex!=null&&<line className="executive-settlement-guide" x1={days.length===1?left+plotW/2:left+activeIndex*plotW/Math.max(days.length-1,1)} x2={days.length===1?left+plotW/2:left+activeIndex*plotW/Math.max(days.length-1,1)} y1={top} y2={top+plotH}/>} {days.map((day,index)=>{const x=days.length===1?left+plotW/2:left+index*plotW/(days.length-1);return <g key={day.date}>{(index%labelStep===0||index===days.length-1)&&<text x={x} y={height-16} textAnchor="middle">{day.date.slice(5).replace('-','/')}</text>}</g>;})}<ChartNodeHits count={days.length} onActiveIndexChange={setActiveIndex} labels={days.map(day=>`${day.date}，新增 Agent ${integer(day.total)}`)} left={left} top={top} width={plotW} height={plotH}/></svg>{active&&activeIndex!=null&&<ChartDetailTooltip index={activeIndex} count={days.length} scopeLabel="日期" scopeValue={active.date} groups={[{label:'新增 Agent',value:integer(active.total),color:'#3498f5',rows:active.segments.map((item,index)=>({label:agentTypeLabel(item.type),value:`${integer(item.count)}（${(item.share*100).toFixed(1)}%）`}))}]}/>}</div></div>;
}

function TaskTypeRanking({weeks,total,onTasks}:{weeks:BusinessWeek[];total:number;onTasks:(category?:string)=>void}){
 const [activeType,setActiveType]=useState<string|null>(null);
 const rows=buildTaskTypeComposition(weeks),maximum=Math.max(1,...rows.map(item=>item.count));
 const activeIndex=rows.findIndex(item=>item.type===activeType),active=activeIndex<0?null:rows[activeIndex];
 return <div className="executive-task-structure" onMouseLeave={()=>setActiveType(null)}><TypeModuleHeader title="交付任务类型构成" note="所选日期内累计交付，按数量降序" totalLabel="累计交付任务" total={total}/><div className="executive-horizontal-bars executive-chart-plot">{rows.map(item=><button type="button" key={item.type} onMouseEnter={()=>setActiveType(item.type)} onFocus={()=>setActiveType(item.type)} onBlur={()=>setActiveType(null)} onClick={()=>onTasks(item.type)}><span>{item.type}</span><i><b style={{width:`${item.count/maximum*100}%`,background:item.type==='数据标注'?TASK_STRUCTURE_COLORS.primary:TASK_STRUCTURE_COLORS.secondary}}/></i><strong>{integer(item.count)}</strong><em>{(item.share*100).toFixed(1)}%</em></button>)}{active&&<ChartDetailTooltip index={activeIndex} count={rows.length} scopeLabel="任务分类" scopeValue={active.type} groups={[{label:'交付任务数',value:integer(active.count),color:active.type==='数据标注'?TASK_STRUCTURE_COLORS.primary:TASK_STRUCTURE_COLORS.secondary},{label:'占全部交付任务',value:`${(active.share*100).toFixed(1)}%`} ]}/>}</div></div>;
}

function QualityChart({weeks}:{weeks:BusinessWeek[]}){
 const types=weeks[0]?.taskTypes.map(item=>item.type)??[],[hidden,setHidden]=useState<Set<string>>(()=>new Set()),[activeIndex,setActiveIndex]=useState<number|null>(null);
 const width=600,height=262,left=42,right=16,top=18,bottom=42,plotW=width-left-right,plotH=height-top-bottom;
 const toggle=(type:string)=>setHidden(current=>{const next=new Set(current);if(next.has(type))next.delete(type);else next.add(type);return next;});
 const visibleTypes=types.filter(type=>!hidden.has(type));
 const active=activeIndex==null?null:weeks[activeIndex];
 const band=plotW/Math.max(weeks.length,1);
 return <div className="executive-quality-chart" onMouseLeave={()=>setActiveIndex(null)}><div className="executive-quality-legend">{types.map((type,index)=><button type="button" key={type} className={hidden.has(type)?'is-hidden':''} aria-pressed={!hidden.has(type)} onClick={()=>toggle(type)}><i style={{background:typeColors[index]}}/>{type}</button>)}</div><div className="executive-chart-plot"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="各类型周质检通过率折线图">{[0,.25,.5,.75,1].map(rate=><g key={rate}><line x1={left} x2={width-right} y1={top+plotH-rate*plotH} y2={top+plotH-rate*plotH}/><text x={left-7} y={top+plotH-rate*plotH+4} textAnchor="end">{rate*100}%</text></g>)}{types.map((type,typeIndex)=>{if(hidden.has(type))return null;const points=weeks.map((week,index)=>({rate:week.taskTypes.find(item=>item.type===type)?.passRate,index})).filter((item):item is {rate:number;index:number}=>item.rate!=null),point=(rate:number,index:number)=>`${left+(index+.5)*plotW/weeks.length},${top+plotH-rate*plotH}`;return <g key={type}><polyline style={{stroke:typeColors[typeIndex]}} points={points.map(item=>point(item.rate,item.index)).join(' ')}/>{points.map(item=>{const [cx,cy]=point(item.rate,item.index).split(',');return <circle key={item.index} style={{fill:typeColors[typeIndex]}} cx={cx} cy={cy} r="3.5"/>;})}</g>;})}{activeIndex!=null&&<line className="executive-settlement-guide" x1={left+(activeIndex+.5)*plotW/weeks.length} x2={left+(activeIndex+.5)*plotW/weeks.length} y1={top} y2={top+plotH}/>}<ChartNodeHits count={weeks.length} onActiveIndexChange={setActiveIndex} labels={weeks.map(week=>`${week.label}，各类型质检通过率`)} left={left} top={top} width={plotW} height={plotH}/>{weeks.map((week,index)=><text className="executive-axis-label" key={week.label} x={left+(index+.5)*plotW/weeks.length} y={height-12} textAnchor="middle">{week.label}</text>)}</svg>{active&&activeIndex!=null&&<ChartDetailTooltip index={activeIndex} count={weeks.length} scopeLabel="统计周" scopeValue={active.label} groups={[{label:'各类型质检通过率',rows:visibleTypes.map(type=>({label:type,value:percent(active.taskTypes.find(item=>item.type===type)?.passRate??null)}))}]}/>}</div></div>;
}

type SettlementWeek={
 label:string;
 pureAgent:number;
 hybrid:number;
 total:number;
 categories:Array<{type:string;pureAgent:number;hybrid:number}>;
};

export function buildSettlementTrend(weeks:BusinessWeek[]):SettlementWeek[]{
 return weeks.map(week=>{
  const categories=week.taskTypes.map(item=>({type:item.type,pureAgent:item.pureAgentPending,hybrid:item.hybridPending}));
  const pureAgent=categories.reduce((sum,item)=>sum+item.pureAgent,0);
  const hybrid=categories.reduce((sum,item)=>sum+item.hybrid,0);
  return {label:week.label,pureAgent,hybrid,total:pureAgent+hybrid,categories};
 });
}

function SettlementTrendChart({weeks}:{weeks:BusinessWeek[]}){
 const [activeIndex,setActiveIndex]=useState<number|null>(null);
 const series=buildSettlementTrend(weeks);
 const maximum=Math.max(1,...series.flatMap(item=>[item.pureAgent,item.hybrid]));
 const active=activeIndex==null?null:series[activeIndex];
 const pureAgentPoints=series.map((item,index)=>`${xAt(index,series.length)},${y(item.pureAgent,maximum)}`).join(' '),hybridPoints=series.map((item,index)=>`${xAt(index,series.length)},${y(item.hybrid,maximum)}`).join(' '),band=plotWidth/Math.max(series.length,1);
 const tooltipSide=activeIndex==null?'':activeIndex<series.length/2?'is-right':'is-left';

 return <div className="executive-settlement-chart" onMouseLeave={()=>setActiveIndex(null)}>
  <div className="executive-chart-legend"><span><i className="is-deep-teal is-line is-line-dot"/>纯 Agent 待结算费用</span><span><i className="is-blue is-line is-line-dot"/>人 + Agent 待结算费用</span></div>
  <div className="executive-settlement-plot">
   <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="近六周待结算费用双折线图">
    <Grid leftLabel="待结算费用（元）"/>
    <AxisTicks leftMaximum={maximum} leftFormat={value=>integer(Math.round(value))}/>
    <polyline className="executive-chart-line is-deep-teal" points={pureAgentPoints}/>
    <polyline className="executive-chart-line is-blue" points={hybridPoints}/>
    {series.flatMap((item,index)=>[<circle key={`${item.label}-pure`} className="executive-chart-dot is-deep-teal" cx={xAt(index,series.length)} cy={y(item.pureAgent,maximum)} r="4"/>,<circle key={`${item.label}-hybrid`} className="executive-chart-dot is-blue" cx={xAt(index,series.length)} cy={y(item.hybrid,maximum)} r="4"/>])}
    {activeIndex!=null&&<line className="executive-settlement-guide" x1={xAt(activeIndex,series.length)} x2={xAt(activeIndex,series.length)} y1={chart.top} y2={chart.top+plotHeight}/>}
    <g className="executive-settlement-hits">{series.map((item,index)=><rect key={item.label} x={chart.left+index*band} y={chart.top} width={band} height={plotHeight} tabIndex={0} aria-label={`${item.label}，待结算费用总计${money(item.total)}`} onMouseEnter={()=>setActiveIndex(index)} onFocus={()=>setActiveIndex(index)} onBlur={()=>setActiveIndex(null)}/>)}</g>
    {series.map((item,index)=><text className="executive-axis-label" key={item.label} x={xAt(index,series.length)} y={chart.height-14} textAnchor="middle">{item.label}</text>)}
   </svg>
   {active&&<div className={`executive-settlement-tooltip ${tooltipSide}`} role="status">
    <header><span>周期</span><strong>{active.label}</strong></header>
    <div className="executive-settlement-tooltip-groups">
     <section><div><span className="is-teal-dot"/>纯 Agent 待结算合计<strong>{money(active.pureAgent)}</strong></div>{active.categories.map(item=><p key={item.type}><span>{item.type}</span><b>{money(item.pureAgent)}</b></p>)}</section>
     <section><div><span className="is-blue-dot"/>人 + Agent 待结算合计<strong>{money(active.hybrid)}</strong></div>{active.categories.map(item=><p key={item.type}><span>{item.type}</span><b>{money(item.hybrid)}</b></p>)}</section>
    </div>
    <footer><span>当周待结算费用总计</span><strong>{money(active.total)}</strong></footer>
   </div>}
  </div>
 </div>;
}

type TaskNavigator=(category?:string,scope?:'period'|'snapshot')=>void;

function PlatformSnapshot({overview,snapshotAt}:{overview:DashboardAnalyticsSnapshot['overview'];snapshotAt:string}){
 const items=[
  {label:'累计成交金额',value:`¥${integer(overview.amount)}`},
  {label:'累计订单',value:integer(overview.orders)},
  {label:'累计任务数量',value:integer(overview.tasks)},
  {label:'Agent 数量',value:integer(overview.agents)}
 ];
 return <Surface className="executive-snapshot-section"><header className="executive-snapshot-header"><div><span><Layers3 size={17}/></span><div><h2>平台累计规模</h2><p>整体累计数据，不随下方日期范围变化</p></div></div><em>截至 {snapshotAt.slice(0,10)}</em></header><div className="executive-snapshot-strip">{items.map(item=><div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div></Surface>;
}

export function DashboardBusinessMetrics({data,overview,snapshotAt,onTasks,onOrders,rangeControl}:{data:BusinessMetrics;overview:DashboardAnalyticsSnapshot['overview'];snapshotAt:string;onTasks:TaskNavigator;onOrders:()=>void;rangeControl:ReactNode}){
 const weeks=data.weeks,{dailyWeeks,weeklyWeeks,latestCompleteWeek:latest}=selectDashboardWeekScopes(weeks,data.periodStart,data.periodEnd);
 const latestScope=latest?`${latest.startDate}–${latest.endDate}`:'暂无完整周';
 const weeklyAcceptedGmv=weeklyWeeks.reduce((sum,week)=>sum+week.acceptedGmv,0);
 const weeklyDeliveredTasks=weeklyWeeks.reduce((sum,week)=>sum+week.deliveredTasks,0);
 const settlementTrend=buildSettlementTrend(weeklyWeeks);
 const sixWeekSettlementTotal=settlementTrend.reduce((sum,week)=>sum+week.total,0);
 const taskTypes=weeklyWeeks[0]?.taskTypes.map(item=>item.type)??[],amountRows=[...taskTypes.map(type=>({type})),{type:'合计'}];
 const amountColumns=[{title:'类型',dataIndex:'type',fixed:'left' as const,width:105},...weeklyWeeks.map(week=>({title:week.label,key:week.label,align:'right' as const,width:118,render:(_:unknown,row:{type:string})=>row.type==='合计'?money(week.acceptedGmv):shortMoney(week.taskTypes.find(item=>item.type===row.type)?.amount??0)}))];
 return <div className="executive-dashboard"><PlatformSnapshot overview={overview} snapshotAt={snapshotAt}/>
 <Surface className="executive-period-section executive-daily-section"><header className="executive-period-header"><div className="executive-period-heading"><span><ChartNoAxesCombined size={18}/></span><div><h2>按日经营数据</h2><p>新增、交付与类型构成按所选日期统计</p></div></div><div className="executive-period-range">{rangeControl}</div></header><div className="executive-period-grid executive-daily-metrics"><PeriodMetric label="新增 Agent" value={integer(data.summary.newAgents)} note="所选日期累计"/><PeriodMetric label="Agent 交付任务数" value={integer(data.summary.deliveredTasks)} note="所选日期累计" onClick={()=>onTasks(undefined,'period')}/></div><div className="executive-two-column executive-daily-charts"><div className="executive-module"><div className="executive-title-row"><h3>每日新增 Agent</h3></div>{dailyWeeks.length?<DailyAgentChart weeks={dailyWeeks}/>:<ChartEmpty>所选日期暂无日粒度数据</ChartEmpty>}</div><div className="executive-module"><div className="executive-title-row"><h3>每日交付任务数与日有效 Agent 数</h3><span className="executive-scope-badge">所选日期 · 日粒度</span></div>{dailyWeeks.length?<DailyDeliveryChart weeks={dailyWeeks}/>:<ChartEmpty>所选日期暂无日粒度数据</ChartEmpty>}</div></div><div className="executive-type-layout executive-type-layout-direct"><div className="executive-module executive-type-module"><AgentTypeDistribution weeks={dailyWeeks} total={data.summary.newAgents}/></div><div className="executive-module executive-type-module"><TaskTypeRanking weeks={dailyWeeks} total={data.summary.deliveredTasks} onTasks={type=>onTasks(type,'period')}/></div></div></Surface>
  <Section title="近六周经营数据" icon={ShieldCheck}>
   <div className="executive-weekly-overview"><div className="executive-weekly-total"><header><small>近六周累计</small></header><div className="executive-weekly-total-metrics"><button type="button" onClick={onOrders}><small>验收 GMV</small><strong>{money(weeklyAcceptedGmv)}</strong></button><span><small>交付任务数</small><b>{integer(weeklyDeliveredTasks)}</b></span></div></div><div className="executive-latest-week-summary"><header><div><small>最新统计周</small><strong>{latestScope}</strong></div></header><div className="executive-latest-week-metrics"><span><small>周验收 GMV</small><b>{latest?money(latest.acceptedGmv):'—'}</b></span><span><small>有效 Agent</small><b>{latest?integer(latest.effectiveAgents):'—'}</b></span><span><small>单个有效 Agent 周均 GMV</small><b>{latest&&latest.effectiveAgents>0?money(latest.acceptedGmv/latest.effectiveAgents):'—'}</b></span><span><small>异构 Agent 比例</small><b>{percent(latest?.heterogeneousRate??null)}</b></span></div></div></div>
   <div className="executive-two-column executive-weekly-charts"><div className="executive-module"><div className="executive-title-row"><h3>周验收 GMV 与同周有效 Agent</h3><span className="executive-scope-badge">周粒度</span></div><WeeklyGmvChart weeks={weeklyWeeks}/></div><div className="executive-module"><div className="executive-title-row"><h3>周度异构 Agent 比例</h3><span className="executive-scope-badge">周粒度</span></div><WeeklyHeterogeneityChart weeks={weeklyWeeks}/></div></div>
   <div className="executive-quality-layout"><div className="executive-module executive-quality-module"><h3>各类型质检通过率</h3><p className="executive-module-note">自动交付金额 ÷ 分类验收 GMV；悬浮折线节点查看周次与通过率</p><QualityChart weeks={weeklyWeeks}/></div><div className="executive-module executive-settlement-trend"><header className="executive-settlement-trend-header"><div><h3>近六周待结算费用趋势</h3><p>按 Excel 5.1 周数据展示纯 Agent 与人 + Agent 待结算费用</p></div><div><small>近六周待结算费用合计</small><strong>{money(sixWeekSettlementTotal)}</strong></div></header>{weeklyWeeks.length?<SettlementTrendChart weeks={weeklyWeeks}/>:<ChartEmpty>暂无完整周待结算数据</ChartEmpty>}</div></div>
   <div className="executive-module executive-amount-module"><h3>分类交付金额</h3><p className="executive-module-note">按类型、按周明细；各周合计等于对应验收 GMV</p><Table className="executive-amount-table" size="small" pagination={false} rowKey="type" rowClassName={row=>row.type==='合计'?'is-total-row':''} dataSource={amountRows} scroll={{x:Math.max(800,weeklyWeeks.length*118+105)}} columns={amountColumns}/></div>
  </Section>
 </div>;
}
