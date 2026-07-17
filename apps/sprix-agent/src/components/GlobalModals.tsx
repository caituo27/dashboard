import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, Tabs, message } from "antd";
import { ActionButton } from "./Primitives";
import { submitRemoteAppeal } from "../services/sprixApi";
import { showRequestError } from "./requestErrors";
import { AgreementContent } from "./AgreementContent";
import { agreementDocuments } from "../content/agreementDocuments";

export { BindAlipayModal } from "./BindAlipayModal";
export { AuthModal } from "../auth/AuthModal";
export { AccountModal } from "./AccountModal";

type ModalState = {
  login: boolean;
  account: boolean;
  agreements: boolean;
  contact: boolean;
  about: boolean;
  bindAlipay: boolean;
};

export function useGlobalModalState() {
  const [modal, setModal] = useState<ModalState>({
    login: false,
    account: false,
    agreements: false,
    contact: false,
    about: false,
    bindAlipay: false
  });
  const open = (key: keyof ModalState) => setModal((prev) => ({ ...prev, [key]: true }));
  const close = (key: keyof ModalState) => setModal((prev) => ({ ...prev, [key]: false }));
  const closeAll = () => setModal({ login: false, account: false, agreements: false, contact: false, about: false, bindAlipay: false });
  return { modal, open, close, closeAll };
}

export function AgreementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      title="相关协议"
      open={open}
      onCancel={onClose}
      footer={<ActionButton onClick={onClose}>我知道了</ActionButton>}
      width={640}
      className="sprix-agreement-modal"
    >
      <Tabs
        className="sprix-agreement-tabs"
        items={agreementDocuments.map((document) => ({
          key: document.key,
          label: document.tabLabel,
          children: (
            <div className="sprix-agreement-scroll">
              <AgreementContent compact markdown={document.markdown} />
            </div>
          )
        }))}
      />
    </Modal>
  );
}

export function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal title="联系我们" open={open} onCancel={onClose} footer={<ActionButton onClick={onClose}>我知道了</ActionButton>}>
      <div className="space-y-3 text-sm text-ink-soft">
        <section className="rounded-2xl bg-[#fafafa] px-4 py-3">
          <h3 className="font-semibold text-ink">客服热线：18126292642</h3>
          <p className="mt-1">工作时间：工作日 10:00-18:00</p>
        </section>
        <p>如遇接单资格、任务执行、申诉或收款相关问题，可联系客服协助处理。</p>
      </div>
    </Modal>
  );
}

export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      title="关于我们"
      open={open}
      onCancel={onClose}
      footer={<ActionButton onClick={onClose}>我知道了</ActionButton>}
    >
      <div className="space-y-4  text-sm leading-7 text-ink-soft">
        <section>
          <h3 className="font-semibold text-ink">深圳市屿智同行科技有限公司</h3>
          <div className="mt-2 space-y-3">
            <p className="indent-[2em]">
              深圳市屿智同行科技有限公司系清华 i-Space 与清华 x-lab
              重点孵化企业，依托清华人工智能实验室，专注多模态大模型研发及公共就业服务、人才评估等产业场景规模化应用，以技术提升人才供需匹配效率。
            </p>
            <p className="indent-[2em]">
              核心团队源自清华、北大、麻省理工等知名高校，在自然语言处理等领域技术积累深厚，构建 “技术研发 — 产品落地 — 生态合作” 完整体系，推出 “AI
              面试官” 等标杆产品。
            </p>
            <p className="indent-[2em]">
              公司曾获清华校友三创大赛 “一带一路赛区” 五强，与 1000 余家政府及企业建立合作，正成长为 AI
              赋能公共就业与产业升级的重要创新力量。
            </p>
          </div>
        </section>
        <section className="rounded-2xl bg-[#fafafa] px-4 py-3">
          <h3 className="font-semibold text-ink">办公地址</h3>
          <p className="mt-1">深圳市南山区粤海街道高新区社区高新南九道39号深圳清华大学研究院新大楼B2101/B2104</p>
        </section>
      </div>
    </Modal>
  );
}

export function AppealModal({
  open,
  executionId,
  onClose
}: {
  open: boolean;
  executionId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal title="提交申诉" open={open} onCancel={onClose} footer={null}>
      <p className="mb-5 text-sm leading-7 text-ink-soft">如你认为本次验收结果存在误判，可提交申诉。平台将在 1-3 个工作日内返回处理结果。</p>
      <Form
        layout="vertical"
        onFinish={async (values) => {
          if (!executionId) return;
          setSubmitting(true);
          try {
            await submitRemoteAppeal(executionId, values.reason);
            await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
            message.success("申诉已提交，平台将在 1-3 个工作日内返回处理结果");
            onClose();
          } catch (error) {
            showRequestError(error, "申诉提交失败", "申诉提交失败：");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <Form.Item label="申诉理由" name="reason" rules={[{ required: true, message: "请输入申诉理由" }]}>
          <Input.TextArea rows={5} placeholder="请说明你认为验收存在误判的原因" />
        </Form.Item>
        <ActionButton htmlType="submit" loading={submitting}>提交</ActionButton>
      </Form>
    </Modal>
  );
}
