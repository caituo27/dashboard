import { Modal } from "antd";
import { Bot } from "lucide-react";
import { StatusTag } from "../components/Primitives";
import type { Agent } from "../types";

type HomeAgentPickerModalProps = {
  open: boolean;
  agents: Agent[];
  onSelect: (agent: Agent) => void;
  onClose: () => void;
};

export function HomeAgentPickerModal({ open, agents, onSelect, onClose }: HomeAgentPickerModalProps) {
  return (
    <Modal centered footer={null} open={open} title="选择 Agent 进行测评" width={680} onCancel={onClose}>
      <div className="grid gap-3 pt-2">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className="sprix-agent-picker-item"
            onClick={() => onSelect(agent)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="sprix-agent-picker-icon">
                <Bot size={18} />
              </span>
              <span className="sprix-agent-picker-copy">
                <strong>{agent.name}</strong>
                <span>{agent.evaluation ? "已有能力画像，可进入后查看或重新测评" : "未生成能力画像，点击后进入测评"}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <StatusTag status={agent.status} />
              <span className="sprix-agent-picker-action">去测评</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
