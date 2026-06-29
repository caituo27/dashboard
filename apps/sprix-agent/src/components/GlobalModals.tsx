import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, message } from "antd";
import { useSprixStore } from "../store/sprixStore";
import { ActionButton, SecondaryButton, StatusTag } from "./Primitives";
import { submitRemoteAppeal } from "../services/sprixApi";
import { getAccountEditActions, getAccountProfileRows } from "../user/accountView";
import { showRequestError } from "./requestErrors";

export { BindAlipayModal } from "./BindAlipayModal";
export { LoginRegisterModal } from "./LoginRegisterModal";

type ModalState = {
  login: boolean;
  account: boolean;
  agreements: boolean;
  contact: boolean;
  bindAlipay: boolean;
};

export function useGlobalModalState() {
  const [modal, setModal] = useState<ModalState>({
    login: false,
    account: false,
    agreements: false,
    contact: false,
    bindAlipay: false
  });
  const open = (key: keyof ModalState) => setModal((prev) => ({ ...prev, [key]: true }));
  const close = (key: keyof ModalState) => setModal((prev) => ({ ...prev, [key]: false }));
  const closeAll = () => setModal({ login: false, account: false, agreements: false, contact: false, bindAlipay: false });
  return { modal, open, close, closeAll };
}

export function AgreementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal title="相关协议" open={open} onCancel={onClose} footer={<ActionButton onClick={onClose}>我知道了</ActionButton>}>
      <div className="space-y-4 text-sm leading-7 text-ink-soft">
        <section className="rounded-2xl bg-[#fff7e8] px-4 py-3">
          <h3 className="font-semibold text-ink">正式协议全文待接入</h3>
          <p>当前仅展示产品流程摘要，正式用户协议、隐私协议和自由职业者服务框架协议全文待法务/后端配置后接入。</p>
        </section>
        <section>
          <h3 className="font-semibold text-ink">《用户协议》</h3>
          <p>用户应遵守平台任务规则，按页面提示完成接单、交付、申诉和账户管理。</p>
        </section>
        <section>
          <h3 className="font-semibold text-ink">《隐私协议》</h3>
          <p>平台仅在业务流程中处理必要账户、认证、任务和资金状态信息。</p>
        </section>
        <section>
          <h3 className="font-semibold text-ink">《自由职业者服务框架协议》</h3>
          <p>用户以自由职业者身份接取任务，确认交付、验收、结算、申诉和自动打款规则。</p>
        </section>
      </div>
    </Modal>
  );
}

export function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal title="联系我们" open={open} onCancel={onClose} footer={<ActionButton onClick={onClose}>我知道了</ActionButton>}>
      <div className="space-y-3 text-sm text-ink-soft">
        <section className="rounded-2xl bg-[#fafafa] px-4 py-3">
          <h3 className="font-semibold text-ink">客服联系信息待配置</h3>
          <p className="mt-1">客服渠道、服务时间和问题分类待运营配置或后端接口返回后展示。</p>
        </section>
        <p>如遇接单资格、任务执行、申诉或收款相关问题，可联系客服协助处理。</p>
      </div>
    </Modal>
  );
}

export function AccountModal({
  open,
  onClose,
  onBindAlipay
}: {
  open: boolean;
  onClose: () => void;
  onBindAlipay: () => void;
}) {
  const account = useSprixStore((state) => state.account);
  const profileRows = getAccountProfileRows(account);
  const editActions = getAccountEditActions();
  return (
    <Modal title="账户信息" open={open} onCancel={onClose} footer={<ActionButton onClick={onClose}>关闭</ActionButton>} width={620}>
      <div className="grid gap-3 text-sm">
        {profileRows.map((row) => (
          <InfoRow key={row.label} label={row.label} value={row.label === "接单资格" ? <StatusTag status={row.value} /> : row.value} />
        ))}
        <InfoRow
          label="收款支付宝"
          value={
            account.alipayBound ? (
              <span>{account.alipayAccountMasked || "已绑定"}</span>
            ) : (
              <SecondaryButton size="small" onClick={onBindAlipay}>
                绑定支付宝
              </SecondaryButton>
            )
          }
        />
        <div className="mt-2 grid gap-2 rounded-2xl bg-[#fafafa] p-3">
          {editActions.map((action) => (
            <div key={action.label} className="flex flex-col gap-2 rounded-2xl border border-line bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-ink">{action.label}</div>
                <div className="mt-1 text-xs text-ink-soft">{action.reason}</div>
              </div>
              <SecondaryButton size="small" disabled={action.disabled}>
                待接口接入
              </SecondaryButton>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-[#fafafa] px-4 py-3 sm:grid-cols-[112px_minmax(0,1fr)]">
      <span className="text-ink-soft">{label}</span>
      <div className="min-w-0 justify-self-end break-words text-right font-medium text-ink [overflow-wrap:anywhere]">
        {value}
      </div>
    </div>
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
