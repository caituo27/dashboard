import { Button, Form, Input } from "antd";
import { ActionButton } from "../components/Primitives";
import { AgreementCheck } from "./AgreementCheck";
import { SafetyChallengeModal } from "./SafetyChallengeModal";
import { useSmsLogin } from "./useSmsLogin";

type SmsLoginPanelProps = {
  active: boolean;
  onAuthenticated: () => Promise<void>;
};

export function SmsLoginPanel({ active, onAuthenticated }: SmsLoginPanelProps) {
  const sms = useSmsLogin({ active, onAuthenticated });

  return (
    <>
      <Form form={sms.form} layout="vertical" onFinish={sms.submit} className="sprix-phone-login-form space-y-2 pt-4">
        <Form.Item label="手机号" name="phone" rules={[{ required: true, message: "请输入手机号" }]}>
          <Input placeholder="请输入手机号" />
        </Form.Item>
        <Form.Item label="验证码" name="code" rules={[{ required: true, message: "请输入验证码" }]}>
          <Input
            placeholder="请输入验证码"
            suffix={
              <Button type="link" loading={sms.sending} disabled={sms.countdown > 0} onClick={sms.requestCode}>
                {sms.countdown > 0 ? `${sms.countdown}s 后重发` : "获取验证码"}
              </Button>
            }
          />
        </Form.Item>
        <div className="sprix-login-action-stack pt-2">
          <AgreementCheck agreed={sms.agreed} onChange={sms.setAgreed} />
          <ActionButton block htmlType="submit" loading={sms.submitting} className="sprix-login-submit-button">
            登录 / 注册
          </ActionButton>
        </div>
      </Form>
      <SafetyChallengeModal
        open={sms.challengeOpen}
        challenge={sms.challenge}
        answer={sms.challengeAnswer}
        error={sms.challengeError}
        confirmLoading={sms.sending}
        refreshLoading={sms.challengeRefreshing}
        onAnswerChange={sms.updateChallengeAnswer}
        onRefresh={() => void sms.refreshChallenge()}
        onConfirm={() => void sms.confirmChallenge()}
        onCancel={sms.closeChallenge}
      />
    </>
  );
}
