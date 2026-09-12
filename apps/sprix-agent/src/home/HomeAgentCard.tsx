import { Bot } from "lucide-react";
import { StatusTag } from "../components/Primitives";
import type { Agent } from "../types";
import { getAgentStatusLabel } from "../utils/agentStatus";
import { scoreText } from "../utils/format";

type HomeAgentCardProps = {
  agent?: Agent;
};

export function HomeAgentCard({ agent }: HomeAgentCardProps) {
  if (!agent) return null;

  return (
    <section className="sprix-current-agent-card">
      <div className="sprix-current-agent-main">
        <span className="sprix-current-agent-icon">
          <Bot size={22} />
        </span>
        <div className="min-w-0">
          <span className="sprix-current-agent-kicker">当前执行 Agent 已设置</span>
          <h2>{agent.name}</h2>
          <p>{agent.summary || "当前可使用该 Agent 浏览任务并接单执行。需要切换、测评或查看能力画像时，可进入 Agent 中心管理。"}</p>
          <div className="sprix-current-agent-meta">
            <StatusTag status={getAgentStatusLabel(agent)} />
            <span>{scoreText(agent.evaluation?.result.overallScore ?? null)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
