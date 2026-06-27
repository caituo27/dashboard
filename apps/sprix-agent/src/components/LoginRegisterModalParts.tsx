import { Checkbox } from "antd";

export function AgreementCheck({ agreed, onChange }: { readonly agreed: boolean; readonly onChange: (value: boolean) => void }) {
  return (
    <Checkbox checked={agreed} onChange={(event) => onChange(event.target.checked)} className="mb-4">
      我已阅读并同意《用户协议》和《隐私协议》
    </Checkbox>
  );
}

export function isSessionExpired(status: string, expiresInSeconds: number) {
  const normalizedStatus = status.toUpperCase();
  return expiresInSeconds <= 0 || normalizedStatus === "EXPIRED" || normalizedStatus === "CANCELLED" || normalizedStatus === "FAILED";
}

export function getAlipayStatusText(status: string, expiresInSeconds: number, hasSession: boolean) {
  if (!hasSession) return "正在生成支付宝登录二维码";
  if (status === "ERROR") return "扫码状态获取失败，请刷新二维码";
  if (isSessionExpired(status, expiresInSeconds)) return "二维码已更新，请重新扫码";
  if (status.toUpperCase() === "CONFIRMED") return "登录确认中";
  return "请使用支付宝扫码授权，确认后会自动进入平台";
}

export function getWechatStatusText(status: string, expiresInSeconds: number, hasSession: boolean) {
  if (!hasSession) return "正在生成微信登录二维码";
  if (status === "ERROR") return "扫码状态获取失败，请刷新二维码";
  if (isSessionExpired(status, expiresInSeconds)) return "二维码已更新，请重新扫码";
  const normalizedStatus = status.toUpperCase();
  if (normalizedStatus === "SCANNED") return "已扫码，请在微信中确认登录";
  if (normalizedStatus === "CONFIRMED") return "登录确认中";
  return "请使用微信扫码，确认后会自动进入平台";
}
