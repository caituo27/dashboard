import { useEffect } from "react";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Modal, Tooltip } from "antd";
import { Download, PlugZap } from "lucide-react";
import { LOCAL_AGENT_DOWNLOAD_URL } from "../localAgentDownload";
import { ActionButton } from "../components/Primitives";
import type { HomeAgentStateResult } from "./homeTypes";
import { useAgentBindPolling } from "./useAgentBindPolling";

type HomeAgentEntryProps = {
  state: HomeAgentStateResult;
  checking?: boolean;
  localAgentHealthy?: boolean;
  connectModalOpen: boolean;
  onOpenLogin: () => void;
  onOpenConnectModal: () => void;
  onCloseConnectModal: () => void;
  onCompleteConnectModal?: () => void;
  onOpenAgentPicker: () => void;
  onEnterMarket: () => void;
};

const SUPPORTED_AGENTS = [
  {
    name: "Codex",
    iconSrc: "/agent-icons/gpt.png"
  },
  {
    name: "Hermes",
    iconSrc: "/agent-icons/hermes.png"
  },
  {
    name: "Claude",
    iconSrc: "/agent-icons/claude.png"
  },
  {
    name: "OpenCode",
    iconSrc: "/agent-icons/opencode.png"
  }
] as const;

export function HomeAgentEntry({
  state,
  checking = false,
  localAgentHealthy = false,
  connectModalOpen,
  onOpenLogin,
  onOpenConnectModal,
  onCloseConnectModal,
  onCompleteConnectModal,
  onOpenAgentPicker,
  onEnterMarket
}: HomeAgentEntryProps) {
  const { recognizing, syncing, recognitionComplete, recognitionFailed, recognitionTimedOut, start } = useAgentBindPolling({ open: connectModalOpen });
  const completeConnectModal = onCompleteConnectModal ?? onCloseConnectModal;

  useEffect(() => {
    if (!connectModalOpen) return;
    start({ minimumVisibleMs: 800 });
  }, [connectModalOpen, start]);

  useEffect(() => {
    if (!connectModalOpen) return;
    if (!recognitionComplete || recognitionFailed || recognitionTimedOut || recognizing || syncing) return;
    if (state.state === "logged_in_with_agents_without_current") {
      if (!localAgentHealthy) return;
      completeConnectModal();
      onOpenAgentPicker();
      return;
    }
    if (state.state === "logged_in_with_current_agent") {
      onCloseConnectModal();
    }
  }, [completeConnectModal, connectModalOpen, localAgentHealthy, onCloseConnectModal, onOpenAgentPicker, recognitionComplete, recognitionFailed, recognizing, recognitionTimedOut, state.state, syncing]);

  const handlePrimaryAction = () => {
    if (checking) return;
    if (state.state === "guest") {
      onOpenLogin();
      return;
    }
    if (state.state === "logged_in_without_agents") {
      if (localAgentHealthy) {
        onOpenAgentPicker();
      } else {
        onOpenConnectModal();
      }
      return;
    }
    if (state.state === "logged_in_with_agents_without_current") {
      if (localAgentHealthy) {
        onOpenAgentPicker();
      } else {
        onOpenConnectModal();
      }
      return;
    }
    onEnterMarket();
  };

  return (
    <>
      <div className="sprix-hero-actions sprix-home-primary-actions">
        <ActionButton icon={<PlugZap size={16} />} onClick={handlePrimaryAction} disabled={checking}>
          {checking
            ? "正在检查本地 Agent…"
            : state.state === "logged_in_with_agents_without_current" && !localAgentHealthy
              ? "连接本地 Agent"
              : state.primaryActionLabel}
        </ActionButton>
      </div>
      <Modal
        centered
        footer={null}
        open={connectModalOpen}
        width={540}
        onCancel={onCloseConnectModal}
        className="sprix-connect-agent-dialog"
      >
        <div className="sprix-connect-agent-modal">
          <img className="sprix-hero-logo" src="/sprix-wordmark.png" alt="Sprix AI" />
          <h2>连接本地 Agent</h2>
          <p className="sprix-connect-agent-primary-copy">安装后请稍候，插件启动后将自动打开连接页面。</p>
          <div className="sprix-connect-agent-cta">
            <ActionButton
              href={LOCAL_AGENT_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              icon={<Download size={16} />}
              className="sprix-connect-agent-download-button"
            >
              下载 Sprix AI 连接插件（Mac 版）
            </ActionButton>
          </div>
          <div className="sprix-supported-agent-section" aria-label="支持的 Agent 列表">
            <p className="sprix-supported-agent-copy">
              <span>目前仅支持以下 Agent</span>
              <Tooltip title="更多 Agent 陆续开放中" placement="top">
                <span className="sprix-supported-agent-hint">
                  <ExclamationCircleOutlined />
                </span>
              </Tooltip>
            </p>
            <div className="sprix-supported-agent-grid">
              {SUPPORTED_AGENTS.map((agent) => (
                <div key={agent.name} className="sprix-supported-agent-card">
                  <span className="sprix-supported-agent-icon" aria-hidden="true">
                    <img src={agent.iconSrc} alt="" loading="lazy" />
                  </span>
                  <strong>{agent.name}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
