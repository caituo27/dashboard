import { CircleDollarSign } from "lucide-react";
import { Surface } from "../components/Primitives";
import type { DashboardAnalyticsSnapshot, DashboardMetric } from "../services/dashboardAnalyticsMock";

const format = (value: number, prefix = "", decimals = 0, suffix = "") => `${prefix}${value.toLocaleString("zh-CN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

function Change({ metric }: { metric: DashboardMetric }) {
  const positive = metric.change >= 0;
  return <span className={`dashboard-change ${positive ? "is-positive" : "is-negative"}`}>{positive ? "↑" : "↓"} {Math.abs(metric.change)}%</span>;
}

function ResultMetric({ label, metric, prefix, suffix, decimals, onClick }: { label: string; metric: DashboardMetric; prefix?: string; suffix?: string; decimals?: number; onClick?: () => void }) {
  const content = <><span>{label}</span><strong>{format(metric.value, prefix, decimals, suffix)}</strong><Change metric={metric}/><small>上期 {format(metric.previous, prefix, decimals, suffix)}</small></>;
  return onClick ? <button type="button" className="dashboard-result-metric dashboard-action" onClick={onClick}>{content}</button> : <div className="dashboard-result-metric">{content}</div>;
}

function SnapshotMetric({ label, value, note, onClick }: { label: string; value: string; note: string; onClick: () => void }) {
  return <button type="button" className="dashboard-result-metric dashboard-snapshot-metric dashboard-action" onClick={onClick}><span>{label}</span><strong>{value}</strong><small>{note}</small></button>;
}

export function DashboardBusinessResults({ data, periodRange, cutoffTime, onAccepted, onTasks, onOperations, onAgent, onTraffic }: { data: DashboardAnalyticsSnapshot; periodRange: string; cutoffTime: string; onAccepted: () => void; onTasks: () => void; onOperations: () => void; onAgent: () => void; onTraffic: () => void }) {
  const results = data.businessResults;
  const isWeek = data.period === 7;
  const uvPv = data.uv ? data.pv / data.uv : 0;
  return <Surface className="dashboard-business-results">
    <div className="dashboard-section-header"><div><h2><CircleDollarSign/>经营结果</h2><p>{periodRange} · 对比上一等长周期 · 来源表：tasks、taskExecutions、users、agents、analyticsEvents</p></div></div>
    <div className="dashboard-kpi-groups">
      <div className="dashboard-kpi-group is-north">
        <div className="dashboard-kpi-group-label"><strong>北极星指标</strong><span>经营结果</span></div>
        <button type="button" className="dashboard-north-star dashboard-action" onClick={onAccepted}>
          <span>验收 GMV</span><strong>{format(results.acceptedGmv.value, "¥")}</strong><div><Change metric={results.acceptedGmv}/><em>较上期</em></div><p>上期 {format(results.acceptedGmv.previous, "¥")}</p>
        </button>
      </div>
      <div className="dashboard-kpi-group is-core-group">
        <div className="dashboard-kpi-group-label"><strong>核心经营指标</strong><span>活跃、价值与履约质量</span></div>
        <div className="dashboard-kpi-metrics is-core">
          <ResultMetric label={`${isWeek ? "周" : "周期"}活跃发单用户（>1 单）`} metric={results.activePublishingUsers} onClick={onTasks}/>
          <ResultMetric label={`人均发单频次（${isWeek ? "周" : "周期"}）`} metric={results.averagePublishingFrequency} decimals={1} onClick={onTasks}/>
          <ResultMetric label="单均任务价值" metric={results.averageTaskValue} prefix="¥" decimals={1} onClick={onAccepted}/>
          <ResultMetric label="履约率（接单 × 完成 × 验收）" metric={results.fulfillmentRate} suffix="%" decimals={1} onClick={onOperations}/>
          <ResultMetric label={`${isWeek ? "周" : "周期"}验收通过率`} metric={data.taskOperations.acceptancePassedRate} suffix="%" decimals={1} onClick={onOperations}/>
        </div>
      </div>
      <div className="dashboard-kpi-group is-vanity-group">
        <div className="dashboard-kpi-group-label"><strong>虚荣指标</strong><span>规模与访问参考</span></div>
        <div className="dashboard-kpi-metrics is-vanity">
          <SnapshotMetric label="Agent 数量" value={format(data.agentEcosystem.totalAgents)} note={`截至 ${cutoffTime}`} onClick={onAgent}/>
          <SnapshotMetric label="发单数量" value={format(data.taskOperations.publishedTasks)} note={periodRange} onClick={onTasks}/>
          <SnapshotMetric label="PV / UV" value={format(uvPv,"",2)} note={periodRange} onClick={onTraffic}/>
        </div>
      </div>
    </div>
  </Surface>;
}
