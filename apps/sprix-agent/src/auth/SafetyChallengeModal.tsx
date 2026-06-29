import { Input, Modal } from "antd";
import type { SafetyChallenge } from "../services/sprixApi";

type SafetyChallengeModalProps = {
  open: boolean;
  challenge?: SafetyChallenge;
  answer: string;
  error: string;
  confirmLoading: boolean;
  onAnswerChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SafetyChallengeModal({
  open,
  challenge,
  answer,
  error,
  confirmLoading,
  onAnswerChange,
  onConfirm,
  onCancel
}: SafetyChallengeModalProps) {
  return (
    <Modal
      title="安全验证"
      open={open}
      okText="发送验证码"
      cancelText="取消"
      width={380}
      confirmLoading={confirmLoading}
      onOk={onConfirm}
      onCancel={onCancel}
    >
      <p className="mb-4 text-sm leading-6 text-ink-soft">请输入图中字符后发送短信验证码</p>
      {challenge?.imageBase64 && (
        <div className="mb-3 flex h-14 items-center justify-center rounded-md border border-line bg-white">
          <img src={challenge.imageBase64} alt="安全验证码" className="h-12 max-w-full" />
        </div>
      )}
      <Input
        placeholder="请输入图中验证码"
        value={answer}
        status={error ? "error" : undefined}
        onChange={(event) => onAnswerChange(event.target.value)}
        onPressEnter={onConfirm}
      />
      {error && <p className="mb-0 mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
