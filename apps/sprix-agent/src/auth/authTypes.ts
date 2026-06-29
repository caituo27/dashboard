export type AuthTabKey = "alipay" | "wechat" | "phone";
export type QrLoginProvider = "alipay" | "wechat";

export function isSessionExpired(status: string, expiresInSeconds: number) {
  const normalizedStatus = status.toUpperCase();
  return expiresInSeconds <= 0 || normalizedStatus === "EXPIRED" || normalizedStatus === "CANCELLED" || normalizedStatus === "FAILED";
}

export function getQrLoginStatusText(provider: QrLoginProvider, status: string, expiresInSeconds: number, hasSession: boolean) {
  if (!hasSession) return provider === "alipay" ? "正在生成支付宝登录二维码" : "正在生成微信登录二维码";
  if (status === "ERROR") return "扫码状态获取失败，请刷新二维码";
  if (isSessionExpired(status, expiresInSeconds)) return "二维码已更新，请重新扫码";
  const normalizedStatus = status.toUpperCase();
  if (provider === "wechat" && normalizedStatus === "SCANNED") return "已扫码，请在微信中确认登录";
  if (normalizedStatus === "PHONE_BIND_REQUIRED") return "验证成功，请继续绑定手机号";
  if (normalizedStatus === "CONFIRMED") return "登录确认中";
  return provider === "alipay" ? "请使用支付宝扫码授权，确认后会自动进入平台" : "请使用微信扫码，确认后会自动进入平台";
}
