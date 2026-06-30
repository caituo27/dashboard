import { useEffect, useState } from "react";
import { Button, Form, Input, message } from "antd";
import { CheckCircle2 } from "lucide-react";
import { ActionButton } from "../components/Primitives";
import { showRequestError } from "../components/requestErrors";
import {
  confirmPhoneBind,
  createSafetyChallenge,
  sendPhoneBindSmsCode,
  type SafetyChallenge
} from "../services/sprixApi";
import { SafetyChallengeModal } from "./SafetyChallengeModal";
import type { QrLoginProvider } from "./authTypes";
import {
  getPhoneNumberValidationMessage,
  normalizePhoneNumber,
  phoneNumberMaxLength,
  phoneNumberRules,
  smsCodeRules,
  verificationCodeLength,
  verificationCodeMaxLength
} from "./phoneValidation";

type PhoneBindForm = {
  phone: string;
  code: string;
};

type PhoneBindPanelProps = {
  provider: QrLoginProvider;
  bindTicket: string;
  onAuthenticated: () => Promise<void>;
};

export function PhoneBindPanel({ provider, bindTicket, onAuthenticated }: PhoneBindPanelProps) {
  const [form] = Form.useForm<PhoneBindForm>();
  const [sending, setSending] = useState(false);
  const [challengeRefreshing, setChallengeRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [challenge, setChallenge] = useState<SafetyChallenge>();
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeError, setChallengeError] = useState("");
  const providerLabel = provider === "alipay" ? "支付宝" : "微信";

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
      setChallenge(await createSafetyChallenge("PHONE_BIND"));
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
      const phone = normalizePhoneNumber(form.getFieldValue("phone"));
      const result = await sendPhoneBindSmsCode({
        bindTicket,
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
      setChallenge(await createSafetyChallenge("PHONE_BIND"));
      setChallengeAnswer("");
      setChallengeError("");
    } catch (error) {
      showRequestError(error, "验证码刷新失败", "验证码刷新失败：");
    } finally {
      setChallengeRefreshing(false);
    }
  };

  const submit = async (values: PhoneBindForm) => {
    const phone = normalizePhoneNumber(values.phone);
    const phoneError = getPhoneNumberValidationMessage(phone);
    if (phoneError) {
      form.setFields([{ name: "phone", errors: [phoneError] }]);
      return;
    }
    setSubmitting(true);
    try {
      await confirmPhoneBind({ bindTicket, mobile: phone, code: values.code });
      await onAuthenticated();
    } catch (error) {
      showRequestError(error, "绑定手机号失败", "绑定手机号失败：");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sprix-phone-bind-panel">
      <div className="sprix-phone-bind-status">
        <span>
          <CheckCircle2 size={18} />
        </span>
        <div>
          <strong>{providerLabel}验证成功</strong>
          <p>绑定手机号后即可完成登录。</p>
        </div>
      </div>
      <Form form={form} layout="vertical" onFinish={submit} className="sprix-phone-login-form space-y-2">
        <Form.Item label="手机号" name="phone" rules={phoneNumberRules}>
          <Input size="large" placeholder="请输入手机号" maxLength={phoneNumberMaxLength} inputMode="tel" />
        </Form.Item>
        <Form.Item label="短信验证码" name="code" rules={smsCodeRules}>
          <Input
            size="large"
            placeholder="请输入短信验证码"
            maxLength={verificationCodeMaxLength}
            suffix={
              <Button type="link" loading={sending} disabled={countdown > 0} onClick={requestCode}>
                {countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
              </Button>
            }
          />
        </Form.Item>
        <ActionButton size="large" block htmlType="submit" loading={submitting} className="sprix-login-submit-button">
          完成绑定并登录
        </ActionButton>
      </Form>
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
        onRefresh={() => void refreshChallenge()}
        onConfirm={() => void confirmChallenge()}
        onCancel={() => {
          setChallengeOpen(false);
          setChallengeAnswer("");
          setChallengeError("");
        }}
      />
    </div>
  );
}
