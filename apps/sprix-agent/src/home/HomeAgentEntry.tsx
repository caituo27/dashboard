import { Modal } from "antd";
import { Download, PlugZap, RefreshCw } from "lucide-react";
import { ActionButton, SecondaryButton } from "../components/Primitives";
import { useAgentBindPolling } from "./useAgentBindPolling";
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
  const bindPolling = useAgentBindPolling({ open: connectModalOpen });

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
        {(state.state === "guest" || state.state === "logged_in_without_agents") && (
          <SecondaryButton href={CLIENT_DOWNLOAD_URL} target="_blank" rel="noreferrer" icon={<Download size={16} />}>
            下载客户端
          </SecondaryButton>
        )}
      </div>
      <Modal centered footer={null} open={connectModalOpen} width={620} onCancel={onCloseConnectModal}>
        <div className="sprix-connect-agent-modal">
          <div className="sprix-hero-kicker">Sprix AI</div>
          <h2>未发现可连接 Agent</h2>
          <p>请先启动本地 Agent 客户端，绑定成功后再重新识别。前端只以后端 `/api/v1/agents` 返回结果判断是否连接成功。</p>
          <div className="sprix-hero-actions">
            <ActionButton icon={<RefreshCw size={16} />} loading={bindPolling.recognizing} onClick={() => void bindPolling.start()}>
              {bindPolling.recognizing ? "识别中" : "重新识别"}
            </ActionButton>
            <SecondaryButton href={CLIENT_DOWNLOAD_URL} target="_blank" rel="noreferrer" icon={<Download size={16} />}>
              下载客户端
            </SecondaryButton>
          </div>
        </div>
      </Modal>
    </>
  );
}
