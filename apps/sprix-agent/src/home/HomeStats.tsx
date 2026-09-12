import { Surface } from "../components/Primitives";
import type { PlatformOverview } from "../types";

type HomeStatsProps = {
  overview: PlatformOverview;
};

export function HomeStats({ overview }: HomeStatsProps) {
  return (
    <div className="sprix-platform-metrics">
      <PlatformMetricCard label="平台 Agent 数量" value={formatPlatformMetricValue(overview.agentCount, 20_000)} />
      <PlatformMetricCard label="平台任务总量" value={formatPlatformMetricValue(overview.taskCount, 30_000)} />
    </div>
  );
}

function PlatformMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Surface className="sprix-platform-metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </Surface>
  );
}

function formatPlatformMetricValue(value: number | null, minimumValue: number) {
  const displayValue = Math.max(value ?? minimumValue, minimumValue);
  return `${Math.floor(displayValue / 10_000)}W+`;
}
