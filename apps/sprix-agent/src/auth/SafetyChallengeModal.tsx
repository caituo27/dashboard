import { Button, Input, Modal } from "antd";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { SafetyChallenge } from "../services/sprixApi";
import { verificationCodeMaxLength } from "./phoneValidation";

type SafetyChallengeModalProps = {
  open: boolean;
  challenge?: SafetyChallenge;
  answer: string;
  error: string;
  confirmLoading: boolean;
  refreshLoading: boolean;
  onAnswerChange: (value: string) => void;
  onRefresh: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SafetyChallengeModal({
  open,
  challenge,
  answer,
  error,
  confirmLoading,
  refreshLoading,
  onAnswerChange,
  onRefresh,
  onConfirm,
  onCancel
}: SafetyChallengeModalProps) {
  const composingRef = useRef(false);
  const compositionJustEndedRef = useRef(false);
  const compositionEndTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (compositionEndTimerRef.current) {
        window.clearTimeout(compositionEndTimerRef.current);
      }
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const isComposing = composingRef.current || compositionJustEndedRef.current || event.nativeEvent.isComposing || event.keyCode === 229;
    if (event.key === "Enter" && compositionJustEndedRef.current) {
      compositionJustEndedRef.current = false;
    }
    if (event.key !== "Enter" || isComposing) return;
    onConfirm();
  };

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
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-ink-soft">图形验证码</span>
        <Button type="link" size="small" loading={refreshLoading} onClick={onRefresh}>
          刷新验证码
        </Button>
      </div>
      {challenge?.imageBase64 && (
        <div className="mb-3 flex h-14 items-center justify-center rounded-md border border-line bg-white">
          <img src={challenge.imageBase64} alt="安全验证码" className="h-12 max-w-full" />
        </div>
      )}
      <Input
        placeholder="请输入图中验证码"
        value={answer}
        maxLength={verificationCodeMaxLength}
        status={error ? "error" : undefined}
        onChange={(event) => onAnswerChange(event.target.value)}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          compositionJustEndedRef.current = true;
          if (compositionEndTimerRef.current) {
            window.clearTimeout(compositionEndTimerRef.current);
          }
          compositionEndTimerRef.current = window.setTimeout(() => {
            compositionJustEndedRef.current = false;
            compositionEndTimerRef.current = undefined;
          }, 0);
        }}
        onKeyDown={handleKeyDown}
      />
      {error && <p className="mb-0 mt-2 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
