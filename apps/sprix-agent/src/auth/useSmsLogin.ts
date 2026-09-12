import { useEffect, useState } from "react";
import { Form, message } from "antd";
import { authenticateConsumer, createSafetyChallenge, sendSmsCode, type SafetyChallenge } from "../services/sprixApi";
import { showRequestError } from "../components/requestErrors";
import { getPhoneNumberValidationMessage, normalizePhoneNumber, verificationCodeLength } from "./phoneValidation";

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
  const [challengeRefreshing, setChallengeRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<SafetyChallenge>();
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
    setChallengeRefreshing(false);
    setSubmitting(false);
    setChallengeOpen(false);
    setChallenge(undefined);
    setChallengeAnswer("");
    setChallengeError("");
    setPendingPhone("");
  }, [active]);

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
      setPendingPhone(phone);
      setSending(true);
      const nextChallenge = await createSafetyChallenge("SMS_LOGIN");
      setChallenge(nextChallenge);
      setChallengeAnswer("");
      setChallengeError("");
      setChallengeOpen(true);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      showRequestError(error, "验证码发送失败", "验证码发送失败：");
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
      const phone = pendingPhone || form.getFieldValue("phone");
      const result = await sendSmsCode({
        mobile: phone,
        challengeId: challenge.challengeId,
        challengeAnswer
      });
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

  const refreshChallenge = async () => {
    setChallengeRefreshing(true);
    try {
      const nextChallenge = await createSafetyChallenge("SMS_LOGIN");
      setChallenge(nextChallenge);
      setChallengeAnswer("");
      setChallengeError("");
    } catch (error) {
      showRequestError(error, "验证码刷新失败", "验证码刷新失败：");
    } finally {
      setChallengeRefreshing(false);
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
    const phone = normalizePhoneNumber(values.phone);
    const phoneError = getPhoneNumberValidationMessage(phone);
    if (phoneError) {
      form.setFields([{ name: "phone", errors: [phoneError] }]);
      return;
    }
    setSubmitting(true);
    try {
      await authenticateConsumer(phone, values.code);
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
    challengeRefreshing,
    requestCode,
    refreshChallenge,
    confirmChallenge,
    closeChallenge,
    updateChallengeAnswer,
    submit
  };
}
