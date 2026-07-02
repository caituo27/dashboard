import { Modal } from "antd";
import { Download, PlugZap } from "lucide-react";
import { LOCAL_AGENT_DOWNLOAD_URL } from "../localAgentDownload";
import { ActionButton, SecondaryButton } from "../components/Primitives";
import type { HomeAgentStateResult } from "./homeTypes";

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
          <p>未检测到本地 Agent，请重新下载。</p>
          <div className="sprix-hero-actions">
            <SecondaryButton href={LOCAL_AGENT_DOWNLOAD_URL} target="_blank" rel="noreferrer" icon={<Download size={16} />}>
              下载安装包
            </SecondaryButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
