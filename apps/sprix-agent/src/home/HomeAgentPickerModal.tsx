import { useEffect, useMemo, useState } from "react";
import { Empty, Modal, Spin } from "antd";
import { Bot, CheckCircle2, Download } from "lucide-react";
import { ActionButton, SecondaryButton, StatusTag } from "../components/Primitives";
import { LOCAL_AGENT_DOWNLOAD_URL } from "../localAgentDownload";
import type { Agent } from "../types";
import { getAgentStatusLabel, isAgentLoginRequired } from "../utils/agentStatus";

type HomeAgentPickerModalProps = {
  open: boolean;
  agents: Agent[];
  recognizing: boolean;
  recognitionFailed: boolean;
  recognitionTimedOut: boolean;
  onRetry: () => void;
  onSelect: (agent: Agent) => void;
  onClose: () => void;
};

function getAgentPickerDescription(agent: Agent, evaluationActive: boolean) {
  if (evaluationActive) return "能力画像生成中，点击可查看当前进度";
  if (isAgentLoginRequired(agent)) return "Claude Code 尚未登录，选择后将先打开登录流程";
  if (hasCompletedEvaluation(agent)) return "已有能力画像，可重新评测并设为当前执行 Agent";
  return "未生成能力画像，评测完成后设为当前执行 Agent";
}

function hasCompletedEvaluation(agent?: Agent) {
  return agent?.evaluation?.status === "completed" || agent?.evaluation?.result?.status === "completed";
}

function getAgentPickerActionLabel(agent: Agent | undefined, evaluationActive: boolean) {
  if (evaluationActive) return "查看生成进度";
  if (isAgentLoginRequired(agent)) return "登录并生成能力画像";
  return "生成能力画像";
}

export function HomeAgentPickerModal({
  open,
  agents,
  recognizing,
  recognitionFailed,
  recognitionTimedOut,
  onRetry,
  onSelect,
  onClose
}: HomeAgentPickerModalProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0], [agents, selectedAgentId]);
  const selectedEvaluationActive = selectedAgent?.evaluation?.status === "running" || selectedAgent?.evaluation?.status === "judging";
  const showInitialLoading = recognizing && agents.length === 0;
  const showRecognitionError = (recognitionFailed || recognitionTimedOut) && agents.length === 0;

  useEffect(() => {
    if (!open) return;
    setSelectedAgentId((currentAgentId) =>
      currentAgentId && agents.some((agent) => agent.id === currentAgentId)
        ? currentAgentId
        : agents[0]?.id
    );
  }, [agents, open]);

  return (
    <Modal centered footer={null} open={open} title={null} width={760} className="sprix-agent-picker-modal" onCancel={onClose}>
      <div className="sprix-agent-picker-head">
        <img className="sprix-hero-logo" src="/sprix-wordmark.png" alt="Sprix AI" />
        <h2>选择当前执行 Agent</h2>
        <p>选择一台本地 Agent，系统会先生成能力画像，完成后设为当前执行 Agent。</p>
      </div>
      {showInitialLoading ? (
        <div className="grid min-h-[240px] place-items-center px-6 py-10 text-center">
          <div>
            <Spin size="large" />
            <h3 className="mt-6 text-lg font-semibold text-ink">正在同步本地 Agent</h3>
            <p className="mt-2 text-sm text-ink-soft">绑定已完成，正在持续拉取当前设备上的可用 Agent，请保持弹框打开。</p>
          </div>
        </div>
      ) : agents.length === 0 ? (
        <div className="px-6 py-4">
          <Empty
            description={
              showRecognitionError
                ? recognitionFailed
                  ? "识别本机 Agent 失败，请确认插件已启动后重试。"
                  : "插件已启动，但暂未识别到 Agent，请重新识别或下载插件。"
                : recognizing
                  ? "暂时还没拿到可选 Agent，系统仍在自动刷新。"
                  : "当前还没有可选 Agent。"
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
          {showRecognitionError && (
            <div className="mt-4 flex justify-center gap-3">
              <ActionButton onClick={onRetry}>重新识别</ActionButton>
              <SecondaryButton href={LOCAL_AGENT_DOWNLOAD_URL} target="_blank" rel="noreferrer" icon={<Download size={16} />}>
                下载插件
              </SecondaryButton>
            </div>
          )}
        </div>
      ) : (
        <div className="sprix-agent-picker-grid">
          {agents.map((agent) => {
            const isSelected = agent.id === selectedAgent?.id;
            const evaluationActive = agent.evaluation?.status === "running" || agent.evaluation?.status === "judging";
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
                    <span>{getAgentPickerDescription(agent, evaluationActive)}</span>
                  </span>
                </span>
                <span className="sprix-agent-picker-meta">
                  <StatusTag status={getAgentStatusLabel(agent)} />
                  <span className="sprix-agent-picker-check">{isSelected ? <CheckCircle2 size={18} /> : "选择"}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {agents.length > 0 && (
        <div className="sprix-agent-picker-footer">
          <SecondaryButton onClick={onClose}>取消</SecondaryButton>
          <ActionButton disabled={!selectedAgent} onClick={() => selectedAgent && onSelect(selectedAgent)}>
            {getAgentPickerActionLabel(selectedAgent, selectedEvaluationActive)}
          </ActionButton>
        </div>
      )}
    </Modal>
  );
}
