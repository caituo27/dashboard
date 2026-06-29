# GlobalModals 交接说明

## 组件职责

- 管理 Agent 端全局弹窗：登录注册、协议、联系信息、账户信息、绑定收款支付宝、申诉。
- `AuthModal` 负责登录入口，二维码登录、手机号验证码和安全验证逻辑拆在 `src/auth/` 内。

## 真实数据

- 微信扫码登录已接真实后端：
  - `createWechatLoginSession()` 创建扫码会话并获取 `qrPayload`。
  - `readWechatLoginStatus(sessionId)` 轮询扫码状态。
  - 后端返回 token 后写入 `sprix-auth-token`，并刷新 `sprix-agent` 查询缓存。
- 手机验证码登录已接真实后端：
  - `sendSmsCode(mobile)` 调用 `POST /api/v1/auth/sms-codes`。
  - `authenticateConsumer(mobile, code)` 调用 `POST /api/v1/auth/sms-login`。
  - 后端返回 token 后写入 `sprix-auth-token`，并刷新 `sprix-agent` 查询缓存。
- 绑定收款支付宝、申诉调用 `../services/sprixApi` 中的真实 service adapter。

## 暂未完整接入

- PC 页面不调用 `confirmWechatScanSession`，因为扫码确认应由微信侧或移动端拿到 code 后完成。
- 协议正文是简版展示文案，不是完整法务协议。

## 主要交互

- 用户选择支付宝或微信扫码登录时，页面展示后端 `qrPayload` 生成的二维码，并按后端 `pollIntervalSeconds` 轮询当前激活 tab 的扫码状态。
- 手机号验证码登录先打开安全验证弹框，安全验证通过后才调用短信验证码接口。
- 状态返回 token 后关闭弹窗、执行登录后的回调，并刷新远端账户/任务/Agent 快照。
- 二维码过期、取消、失败或轮询异常时，页面停止轮询并提示刷新二维码。

## 后续人工动作

- 和后端/微信侧确认扫码状态字符串全集，并把状态文案补齐为枚举映射。
- 法务提供正式协议后，更新 `AgreementModal` 文案和入口。
