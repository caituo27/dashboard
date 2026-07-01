import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, message } from "antd";
import { useSprixStore } from "../store/sprixStore";
import {
  confirmRemotePhoneChange,
  createSafetyChallenge,
  sendPhoneChangeSmsCode,
  type SafetyChallenge
} from "../services/sprixApi";
import {
  getPhoneNumberValidationMessage,
  normalizePhoneNumber,
  phoneNumberMaxLength,
  phoneNumberRules,
  smsCodeRules,
  verificationCodeLength,
  verificationCodeMaxLength
} from "../auth/phoneValidation";
import { PhoneNumberLabel } from "../auth/PhoneNumberLabel";
import { SafetyChallengeModal } from "../auth/SafetyChallengeModal";
import { ActionButton } from "./Primitives";
import { showRequestError } from "./requestErrors";

type PhoneChangeForm = {
  phone: string;
  code: string;
};

type AccountPhoneChangeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AccountPhoneChangeModal({ open, onClose }: AccountPhoneChangeModalProps) {
  const [form] = Form.useForm<PhoneChangeForm>();
  const [sending, setSending] = useState(false);
  const [challengeRefreshing, setChallengeRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [challenge, setChallenge] = useState<SafetyChallenge>();
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeError, setChallengeError] = useState("");
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (countdown <= 0) return;
    const timeoutId = window.setTimeout(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [countdown]);

  const requestCode = async () => {
    try {
      const { phone: rawPhone } = await form.validateFields(["phone"]);
      const phone = normalizePhoneNumber(rawPhone);
      const phoneError = getPhoneNumberValidationMessage(phone);
      if (phoneError) {
        form.setFields([{ name: "phone", errors: [phoneError] }]);
        return;
      }
      form.setFieldValue("phone", phone);
      setSending(true);
      setChallenge(await createSafetyChallenge("PHONE_CHANGE"));
      setChallengeAnswer("");
      setChallengeError("");
      setChallengeOpen(true);
    } catch (error) {
      if (isFormValidationError(error)) return;
      reportRequestError(error, "验证码发送失败", "验证码发送失败：");
    } finally {
      setSending(false);
    }
  };

  const confirmChallenge = async () => {
    if (!challenge) {
      setChallengeError("请重新获取安全验证码");
      return;
    }
    if (!challengeAnswer.trim()) {
      setChallengeError("请输入验证码");
      return;
    }
    if (challengeAnswer.trim().length < verificationCodeLength) {
      setChallengeError("请输入 4 位图形验证码");
      return;
    }
    setChallengeError("");
    setSending(true);
    try {
      const phone = normalizePhoneNumber(form.getFieldValue("phone"));
      const result = await sendPhoneChangeSmsCode({
        mobile: phone,
        challengeId: challenge.challengeId,
        challengeAnswer
      });
      setCountdown(Math.max(result.resendIntervalSeconds ?? 60, 1));
      setChallengeOpen(false);
      setChallengeAnswer("");
      message.success("验证码已发送");
    } catch (error) {
      reportRequestError(error, "验证码发送失败", "验证码发送失败：");
    } finally {
      setSending(false);
    }
  };

  const submit = async (values: PhoneChangeForm) => {
    const phone = normalizePhoneNumber(values.phone);
    const phoneError = getPhoneNumberValidationMessage(phone);
    if (phoneError) {
      form.setFields([{ name: "phone", errors: [phoneError] }]);
      return;
    }
    setSubmitting(true);
    try {
      const patch = await confirmRemotePhoneChange({ mobile: phone, code: values.code });
      mergeRemoteState({ account: patch });
      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
      message.success("手机号已更换");
      onClose();
    } catch (error) {
      reportRequestError(error, "手机号更换失败", "手机号更换失败：");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal title="修改手机号" open={open} onCancel={onClose} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label={<PhoneNumberLabel />} name="phone" rules={phoneNumberRules}>
            <Input placeholder="请输入新手机号" maxLength={phoneNumberMaxLength} inputMode="tel" />
          </Form.Item>
          <Form.Item label="短信验证码" name="code" rules={smsCodeRules}>
            <Input
              placeholder="请输入短信验证码"
              maxLength={verificationCodeMaxLength}
              suffix={
                <Button type="link" loading={sending} disabled={countdown > 0} onClick={requestCode}>
                  {countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
                </Button>
              }
            />
          </Form.Item>
          <ActionButton htmlType="submit" loading={submitting}>确认更换</ActionButton>
        </Form>
      </Modal>
      <SafetyChallengeModal
        open={challengeOpen}
        challenge={challenge}
        answer={challengeAnswer}
        error={challengeError}
        confirmLoading={sending}
        refreshLoading={challengeRefreshing}
        onAnswerChange={(value) => {
          setChallengeAnswer(value);
          setChallengeError("");
        }}
        onRefresh={() => void refreshChallenge(setChallenge, setChallengeAnswer, setChallengeError, setChallengeRefreshing)}
        onConfirm={() => void confirmChallenge()}
        onCancel={() => {
          setChallengeOpen(false);
          setChallengeAnswer("");
          setChallengeError("");
        }}
      />
    </>
  );
}

function isFormValidationError(error: unknown) {
  return typeof error === "object" && error !== null && "errorFields" in error;
}

function reportRequestError(error: unknown, title: string, prefix: string) {
  if (error instanceof Error) {
    showRequestError(error, title, prefix);
    return;
  }
  showRequestError(new Error(title), title, prefix);
}

async function refreshChallenge(
  setChallenge: (value: SafetyChallenge) => void,
  setChallengeAnswer: (value: string) => void,
  setChallengeError: (value: string) => void,
  setChallengeRefreshing: (value: boolean) => void
) {
  setChallengeRefreshing(true);
  try {
    setChallenge(await createSafetyChallenge("PHONE_CHANGE"));
    setChallengeAnswer("");
    setChallengeError("");
  } catch (error) {
    reportRequestError(error, "验证码刷新失败", "验证码刷新失败：");
  } finally {
    setChallengeRefreshing(false);
  }
}
