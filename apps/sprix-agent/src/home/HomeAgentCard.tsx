import { Bot } from "lucide-react";
import { SecondaryButton, StatusTag } from "../components/Primitives";
import type { Agent } from "../types";
import { scoreText } from "../utils/format";

type HomeAgentCardProps = {
  agent?: Agent;
  onEnterMarket: () => void;
  onManageAgent: () => void;
};

export function HomeAgentCard({ agent, onEnterMarket, onManageAgent }: HomeAgentCardProps) {
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
            <StatusTag status={agent.status} />
            <span>{scoreText(agent.score)}</span>
          </div>
        </div>
      </div>
      <div className="sprix-current-agent-actions">
        <SecondaryButton onClick={onEnterMarket}>进入任务市场</SecondaryButton>
        <SecondaryButton onClick={onManageAgent}>管理 Agent</SecondaryButton>
      </div>
    </section>
  );
}
