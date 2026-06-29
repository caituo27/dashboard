import { Input, Modal } from "antd";

export type SmsSafetyChallenge = {
  left: number;
  right: number;
  answer: string;
};

type SafetyChallengeModalProps = {
  open: boolean;
  challenge: SmsSafetyChallenge;
  answer: string;
  error: string;
  confirmLoading: boolean;
  onAnswerChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function createSmsSafetyChallenge(): SmsSafetyChallenge {
  const left = 2 + Math.floor(Math.random() * 8);
  const right = 1 + Math.floor(Math.random() * 9);
  return { left, right, answer: String(left + right) };
}

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
      <p className="mb-4 text-sm leading-6 text-ink-soft">请完成安全验证后发送验证码</p>
      <Input
        placeholder="请输入计算结果"
        prefix={`${challenge.left} + ${challenge.right} =`}
        value={answer}
        status={error ? "error" : undefined}
        onChange={(event) => onAnswerChange(event.target.value)}
        onPressEnter={onConfirm}
      />
      {error && <p className="mb-0 mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
