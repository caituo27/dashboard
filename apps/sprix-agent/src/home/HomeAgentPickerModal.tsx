import { useEffect, useMemo, useState } from "react";
import { Modal } from "antd";
import { Bot, CheckCircle2 } from "lucide-react";
import { ActionButton, SecondaryButton, StatusTag } from "../components/Primitives";
import type { Agent } from "../types";

type HomeAgentPickerModalProps = {
  open: boolean;
  agents: Agent[];
  onSelect: (agent: Agent) => void;
  onClose: () => void;
};

export function HomeAgentPickerModal({ open, agents, onSelect, onClose }: HomeAgentPickerModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0], [agents, selectedAgentId]);

  useEffect(() => {
    if (open) {
      setSelectedAgentId(agents[0]?.id);
    }
  }, [agents, open]);

  return (
    <Modal centered footer={null} open={open} title={null} width={760} className="sprix-agent-picker-modal" onCancel={onClose}>
      <div className="sprix-agent-picker-head">
        <div className="sprix-hero-kicker">Sprix AI</div>
        <h2>选择当前执行 Agent</h2>
        <p>选择一台本地 Agent，系统会先生成能力画像，完成后设为当前执行 Agent。</p>
      </div>
      <div className="sprix-agent-picker-grid">
        {agents.map((agent) => {
          const isSelected = agent.id === selectedAgent?.id;
          return (
            <button
              key={agent.id}
              type="button"
              className={`sprix-agent-picker-item ${isSelected ? "is-selected" : ""}`}
              onClick={() => setSelectedAgentId(agent.id)}
              onDoubleClick={() => onSelect(agent)}
              aria-pressed={isSelected}
            >
              <span className="sprix-agent-picker-main">
                <span className="sprix-agent-picker-icon">
                  <Bot size={18} />
                </span>
                <span className="sprix-agent-picker-copy">
                  <strong>{agent.name}</strong>
                  <span>{agent.evaluation ? "已有能力画像，可重新评测并设为当前执行 Agent" : "未生成能力画像，评测完成后设为当前执行 Agent"}</span>
                </span>
              </span>
              <span className="sprix-agent-picker-meta">
                <StatusTag status={agent.status} />
                <span className="sprix-agent-picker-check">{isSelected ? <CheckCircle2 size={18} /> : "选择"}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="sprix-agent-picker-footer">
        <SecondaryButton onClick={onClose}>取消</SecondaryButton>
        <ActionButton disabled={!selectedAgent} onClick={() => selectedAgent && onSelect(selectedAgent)}>
          生成能力画像
        </ActionButton>
      </div>
    </Modal>
  );
}
