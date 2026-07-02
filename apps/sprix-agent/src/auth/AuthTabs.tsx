import { Tabs } from "antd";
import { QrLoginPanel } from "./QrLoginPanel";
import { SmsLoginPanel } from "./SmsLoginPanel";
import type { AuthTabKey } from "./authTypes";

type AuthTabsProps = {
  activeKey: AuthTabKey;
  onChange: (key: AuthTabKey) => void;
  onAuthenticated: () => Promise<void>;
};

export function AuthTabs({ activeKey, onChange, onAuthenticated }: AuthTabsProps) {
  return (
    <Tabs
      activeKey={activeKey}
      onChange={(key) => onChange(key as AuthTabKey)}
      tabBarGutter={16}
      items={[
        {
          key: "alipay",
          label: "支付宝扫码登录",
          children: <QrLoginPanel provider="alipay" active={activeKey === "alipay"} onAuthenticated={onAuthenticated} />
        },
        {
          key: "phone",
          label: "手机号验证码",
          children: <SmsLoginPanel active={activeKey === "phone"} onAuthenticated={onAuthenticated} />
        }
      ]}
    />
  );
}
