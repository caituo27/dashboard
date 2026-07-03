import { useEffect } from "react";
import { Modal } from "antd";
import { Download, PlugZap } from "lucide-react";
import { LOCAL_AGENT_CLI_MODE_URL, LOCAL_AGENT_DOWNLOAD_URL } from "../localAgentDownload";
import { ActionButton } from "../components/Primitives";
import type { HomeAgentStateResult } from "./homeTypes";
import { useAgentBindPolling } from "./useAgentBindPolling";

type HomeAgentEntryProps = {
  state: HomeAgentStateResult;
  connectModalOpen: boolean;
  onOpenLogin: () => void;
  onOpenConnectModal: () => void;
  onCloseConnectModal: () => void;
  onOpenAgentPicker: () => void;
  onEnterMarket: () => void;
};

export function HomeAgentEntry({
  state,
  connectModalOpen,
  onOpenLogin,
  onOpenConnectModal,
  onCloseConnectModal,
  onOpenAgentPicker,
  onEnterMarket
}: HomeAgentEntryProps) {
  const { start } = useAgentBindPolling({ open: connectModalOpen, localAgent: state.localAgent });

  useEffect(() => {
    if (!connectModalOpen) return;
    start({ announceCompletion: true, minimumVisibleMs: 800 });
  }, [connectModalOpen, start]);

  useEffect(() => {
    if (!connectModalOpen) return;
    if (state.state === "logged_in_with_agents_without_current") {
      onCloseConnectModal();
      onOpenAgentPicker();
      return;
    }
    if (state.state === "logged_in_with_current_agent") {
      onCloseConnectModal();
    }
  }, [connectModalOpen, onCloseConnectModal, onOpenAgentPicker, state.state]);

  const handlePrimaryAction = () => {
    if (state.state === "guest") {
      onOpenLogin();
      return;
    }
    if (state.state === "logged_in_without_agents") {
      onOpenConnectModal();
      return;
    }
    if (state.state === "logged_in_with_agents_without_current") {
      onOpenAgentPicker();
      return;
    }
    onEnterMarket();
  };

  return (
    <>
      <div className="sprix-hero-actions">
        <ActionButton icon={<PlugZap size={16} />} onClick={handlePrimaryAction}>
          {state.primaryActionLabel}
        </ActionButton>
      </div>
      <Modal centered footer={null} open={connectModalOpen} width={620} onCancel={onCloseConnectModal}>
        <div className="sprix-connect-agent-modal">
          <div className="sprix-hero-kicker">Sprix AI</div>
          <h2>连接本地 Agent</h2>
          <p className="sprix-connect-agent-primary-copy">安装连接插件后，即可识别本机 Agent CLI。</p>
          <p className="sprix-connect-agent-helper">
            仅支持 Agent CLI，单独安装桌面 App 无法识别。
            <a href={LOCAL_AGENT_CLI_MODE_URL} target="_blank" rel="noreferrer">
              了解 CLI 模式
            </a>
          </p>
          <div className="sprix-hero-actions">
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
        </div>
      </Modal>
    </>
  );
}
