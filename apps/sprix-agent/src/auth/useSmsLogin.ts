import { useEffect, useState } from "react";
import { Form, message } from "antd";
import { authenticateConsumer, sendSmsCode } from "../services/sprixApi";
import { showRequestError } from "../components/requestErrors";
import { createSmsSafetyChallenge, type SmsSafetyChallenge } from "./SafetyChallengeModal";

export type PhoneLoginForm = {
  phone: string;
  code: string;
};

type UseSmsLoginOptions = {
  active: boolean;
  onAuthenticated: () => Promise<void>;
};

export function useSmsLogin({ active, onAuthenticated }: UseSmsLoginOptions) {
  const [form] = Form.useForm<PhoneLoginForm>();
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<SmsSafetyChallenge>(createSmsSafetyChallenge);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeError, setChallengeError] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");

  useEffect(() => {
    if (!active || countdown <= 0) return;
    const timeoutId = window.setTimeout(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [active, countdown]);

  useEffect(() => {
    if (active) return;
    setSending(false);
    setSubmitting(false);
    setChallengeOpen(false);
    setChallenge(createSmsSafetyChallenge());
    setChallengeAnswer("");
    setChallengeError("");
    setPendingPhone("");
  }, [active]);

  const requestCode = async () => {
    try {
      const { phone } = await form.validateFields(["phone"]);
      setPendingPhone(phone);
      setChallenge(createSmsSafetyChallenge());
      setChallengeAnswer("");
      setChallengeError("");
      setChallengeOpen(true);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      showRequestError(error, "验证码发送失败", "验证码发送失败：");
    }
  };

  const confirmChallenge = async () => {
    if (challengeAnswer.trim() !== challenge.answer) {
      setChallengeError("安全验证不正确");
      return;
    }
    setChallengeError("");
    setSending(true);
    try {
      const phone = pendingPhone || form.getFieldValue("phone");
      const result = await sendSmsCode(phone);
      setCountdown(Math.max(result.resendIntervalSeconds ?? 60, 1));
      setChallengeOpen(false);
      setChallengeAnswer("");
      message.success("验证码已发送");
    } catch (error) {
      showRequestError(error, "验证码发送失败", "验证码发送失败：");
    } finally {
      setSending(false);
    }
  };

  const submit = async (values?: Partial<PhoneLoginForm>) => {
    if (!agreed) {
      message.warning("请先阅读并同意用户协议和隐私协议");
      return;
    }
    if (!values?.phone || !values.code) {
      message.warning("请输入手机号和验证码");
      return;
    }
    setSubmitting(true);
    try {
      await authenticateConsumer(values.phone, values.code);
      await onAuthenticated();
    } catch (error) {
      showRequestError(error, "登录失败", "登录失败：");
    } finally {
      setSubmitting(false);
    }
  };

  const closeChallenge = () => {
    setChallengeOpen(false);
    setChallengeAnswer("");
    setChallengeError("");
  };

  const updateChallengeAnswer = (value: string) => {
    setChallengeAnswer(value);
    setChallengeError("");
  };

  return {
    form,
    agreed,
    setAgreed,
    sending,
    countdown,
    submitting,
    challenge,
    challengeOpen,
    challengeAnswer,
    challengeError,
    requestCode,
    confirmChallenge,
    closeChallenge,
    updateChallengeAnswer,
    submit
  };
}
