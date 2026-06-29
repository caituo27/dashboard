import { Checkbox, Modal } from "antd";

type AgreementCheckProps = {
  agreed: boolean;
  onChange: (value: boolean) => void;
};

export function AgreementCheck({ agreed, onChange }: AgreementCheckProps) {
  const openAgreement = (title: string) => {
    Modal.info({
      title,
      okText: "知道了",
      content: (
        <p className="m-0 leading-7 text-ink-soft">
          当前仅展示产品流程摘要，正式全文待法务/后端配置后接入。用户应遵守平台任务规则，按页面提示完成接单、交付、申诉和账户管理。
        </p>
      )
    });
  };

  return (
    <Checkbox checked={agreed} onChange={(event) => onChange(event.target.checked)}>
      <span className="sprix-agreement-check-text">
        我已阅读并同意
        <button type="button" className="sprix-agreement-link" onClick={() => openAgreement("用户协议")}>
          《用户协议》
        </button>
        和
        <button type="button" className="sprix-agreement-link" onClick={() => openAgreement("隐私政策")}>
          《隐私政策》
        </button>
      </span>
    </Checkbox>
  );
}
