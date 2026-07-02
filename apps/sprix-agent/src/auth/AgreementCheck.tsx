import { Checkbox, Modal } from "antd";
import { AgreementContent } from "../components/AgreementContent";
import { getAgreementDocument, type AgreementDocumentKey } from "../content/agreementDocuments";

type AgreementCheckProps = {
  agreed: boolean;
  onChange: (value: boolean) => void;
};

export function AgreementCheck({ agreed, onChange }: AgreementCheckProps) {
  const openAgreement = (key: AgreementDocumentKey) => {
    const document = getAgreementDocument(key);

    Modal.info({
      title: document.title,
      okText: "知道了",
      width: 620,
      className: "sprix-agreement-modal",
      content: (
        <div className="sprix-agreement-scroll">
          <AgreementContent compact hideFirstHeading markdown={document.markdown} />
        </div>
      )
    });
  };

  return (
    <Checkbox checked={agreed} onChange={(event) => onChange(event.target.checked)}>
      <span className="sprix-agreement-check-text">
        我已阅读并同意
        <button type="button" className="sprix-agreement-link" onClick={() => openAgreement("user")}>
          《用户协议》
        </button>
        和
        <button type="button" className="sprix-agreement-link" onClick={() => openAgreement("privacy")}>
          《隐私政策》
        </button>
      </span>
    </Checkbox>
  );
}
