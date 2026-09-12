import { ArrowRight, ClipboardList } from "lucide-react";
import { Surface } from "../components/Primitives";
import type { DashboardAnalyticsSnapshot } from "../services/dashboardAnalyticsMock";

const number = (value: number) => value.toLocaleString("zh-CN");
export function DashboardTaskOperations({ data, onNode }: { data: DashboardAnalyticsSnapshot; onNode: (node: "published" | "accepted" | "completed" | "passed") => void }) {
  const value = data.taskOperations;
  const periodRange=`${data.periodStart} 00:00:00 至 ${data.periodEnd} 23:59:59`;
  const nodes = [
    { key: "published" as const, label: "发布任务", value: value.publishedTasks, rate: "接单率 76.4%" },
    { key: "accepted" as const, label: "Agent 接单", value: value.acceptedTasks, rate: "完成率 88.7%" },
    { key: "completed" as const, label: "执行完成", value: value.completedTasks, rate: "验收通过率 92.3%" },
    { key: "passed" as const, label: "验收通过", value: value.acceptancePassedTasks }
  ];
  return <Surface className="dashboard-task-flow"><div className="dashboard-section-header"><div><h2><ClipboardList/>任务运营</h2><p>{periodRange} · 任务状态流转 · 来源表：tasks、taskExecutions</p></div></div><div className="dashboard-lifecycle">{nodes.map((node,index)=><div className="dashboard-lifecycle-group" key={node.key}><button type="button" className="dashboard-lifecycle-node dashboard-action" onClick={()=>onNode(node.key)}><span>{node.label}</span><strong>{number(node.value)}</strong></button>{index<nodes.length-1&&<div className="dashboard-lifecycle-connector"><ArrowRight size={18}/><small>{node.rate}</small></div>}</div>)}</div></Surface>;
}
