import { Modal } from "antd";
import { Download } from "lucide-react";
import { LOCAL_AGENT_DOWNLOAD_URL } from "../localAgentDownload";
import { ActionButton } from "./Primitives";

type AgentBindingInvalidModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AgentBindingInvalidModal({ open, onClose }: AgentBindingInvalidModalProps) {
  return (
    <Modal centered footer={null} open={open} width={540} onCancel={onClose} className="sprix-connect-agent-dialog">
      <div className="sprix-connect-agent-modal">
        <img className="sprix-hero-logo" src="/sprix-wordmark.png" alt="Sprix AI" />
        <h2>插件绑定已失效</h2>
        <p className="sprix-connect-agent-primary-copy">请重新安装插件，安装完成后重新识别本机 Agent。</p>
        <div className="sprix-connect-agent-cta">
          <ActionButton
            href={LOCAL_AGENT_DOWNLOAD_URL}
            target="_blank"
            rel="noreferrer"
            icon={<Download size={16} />}
            className="sprix-connect-agent-download-button"
          >
            重新下载 Sprix AI 连接插件（Mac 版）
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}
