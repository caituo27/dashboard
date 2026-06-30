import { Modal } from "antd";
import { Download, PlugZap, RefreshCw } from "lucide-react";
import { ActionButton, SecondaryButton } from "../components/Primitives";
import { useAgentBindPolling } from "./useAgentBindPolling";
import { getLocalAgentEmptyMessage } from "./localAgentInventory";
import type { HomeAgentStateResult } from "./homeTypes";

const CLIENT_DOWNLOAD_URL = "https://cnb.cool/yztx_qxun/LocalCLIAgentRelease/-/git/raw/main/LocalCLIAgent.pkg";

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
  const bindPolling = useAgentBindPolling({ open: connectModalOpen, localAgent: state.localAgent });
  const localAgentMessage = getLocalAgentEmptyMessage(state.localAgent);

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
          <p>{bindPolling.recognizing ? "正在检测本机 Agent，请稍候。" : localAgentMessage}</p>
          <div className="sprix-hero-actions">
            <ActionButton icon={<RefreshCw size={16} />} loading={bindPolling.recognizing} onClick={() => void bindPolling.start()}>
              {bindPolling.recognizing ? "检测中" : "我已安装，重新检测"}
            </ActionButton>
            <SecondaryButton href={CLIENT_DOWNLOAD_URL} target="_blank" rel="noreferrer" icon={<Download size={16} />}>
              下载安装包
            </SecondaryButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
