# Sprix Swagger 更新记录

最后更新：2026-06-27

## 拉取范围

- Swagger UI: http://42.194.150.73:8084/swagger-ui/index.html
- Swagger JSON: http://42.194.150.73:8084/v3/api-docs
- 生成范围: `apps/sprix-agent/src/apis/sprix`, `apps/sprix-admin/src/apis/sprix`
- 是否有生成 diff: 有，新增微信扫码登录、Agent Gateway 设备/执行上报、部分后台提现复核接口。
- 2026-06-27 本地后端新增支付宝登录、支付宝绑定和支付宝打款接口；当前前端先通过 service adapter 手写 HTTP 调用，待后端 Swagger 重新发布后再生成客户端。

## 接口变化

- Added:
  - 用户端：微信扫码登录会话创建、状态轮询、扫码确认接口：
    - `POST /api/v1/auth/wechat/scan-sessions`
    - `GET /api/v1/auth/wechat/scan-sessions/{sessionId}`
    - `POST /api/v1/auth/wechat/scan-sessions/{sessionId}/confirm`
  - Agent Gateway：设备 bootstrap/pair/heartbeat/token refresh/unbind、待执行命令、事件批量上报、执行日志/产物/验收上传、文件下载。
  - 管理端资金：提现异常处理与退回复核接口。
  - DTO：`WechatScanSessionResponse`、`WechatScanStatusResponse`、`WechatScanConfirmRequest`、
    Agent Gateway 请求/响应 DTO、`WithdrawalReviewRequest`。
  - 本地后端新增但当前生成客户端尚未覆盖：
    - `POST /api/v1/auth/alipay/login-sessions`
    - `GET /api/v1/auth/alipay/login-sessions/{sessionId}`
    - `GET /api/v1/auth/alipay/login-callback`
    - `POST /api/v1/account/alipay-bind-sessions`
    - `GET /api/v1/account/alipay-bind-sessions/{sessionId}`
    - `GET /api/v1/account/alipay-bind-callback`
    - `POST /api/v1/admin/funds/withdrawals/{withdrawalId}/payout`
    - `POST /api/v1/admin/funds/withdrawals/{withdrawalId}/payout-query`
- Removed:
  - 无。
- Changed:
  - `UserAccount` 新增 `wechatOpenId`、`wechatUnionId` 字段。

## 需要更新的前端交互

- Agent 端任务市场、任务详情、我的任务、Agent 中心、账户资质、提现和申诉需要优先读取真实接口。
- Agent 端登录弹窗的“微信扫码登录”需要生成后端扫码会话、展示 `qrPayload` 二维码，并轮询状态；后端返回 token 后写入现有登录态并刷新 `sprix-agent` 远端快照。
- Agent 端登录弹窗的“支付宝扫码登录”需要生成后端支付宝登录会话、展示 `qrPayload` 二维码，并轮询状态；后端返回 token 后写入现有登录态并刷新 `sprix-agent` 远端快照。
- Agent 端支付宝收款账户绑定需要生成后端支付宝授权会话，后端回调完成后写入提现账户和支付宝身份绑定。
- Agent 客户端/网关相关接口已生成，但当前 H5 页面不直接调用；后续桌面 Agent 客户端接入时需要独立适配。
- Admin 端任务管理、任务执行记录、申诉中心、资金中心需要优先读取后台接口。
- Admin 端待打款记录需要调用后端单笔支付宝打款和打款结果查询接口，并展示后端返回的打款审计字段。
- 写操作必须先走真实接口，再通过 TanStack Query 刷新远端快照；Swagger 未提供的操作只提示不可用，不再写本地模拟状态。

## 已完成适配

- Service:
  - `apps/sprix-agent/src/services/sprixApi.ts`
  - `apps/sprix-admin/src/services/sprixApi.ts`
- Login:
  - `apps/sprix-agent/src/components/GlobalModals.tsx` 接入真实微信扫码登录：创建扫码会话、展示二维码、轮询状态、token 落入 `sprix-auth-token`。
  - `apps/sprix-agent/src/components/LoginRegisterModal.tsx` 接入支付宝扫码登录，并保留微信扫码和手机号验证码登录。
- Account:
  - `apps/sprix-agent/src/components/BindAlipayModal.tsx` 接入支付宝授权绑定会话、状态轮询和授权链接兜底。
- Mock server: 当前项目没有独立 mock server；原 app 内 mock 数据文件与本地业务状态机已移除，接口失败时只展示错误提示。
- 页面 / 组件:
  - `apps/sprix-agent/src/App.tsx` 启动同步任务市场、账户、Agent、我的任务。
  - `apps/sprix-agent/src/components/GlobalModals.tsx` 接入真实登录、绑定收款、提现和申诉。
  - `apps/sprix-agent/src/user/UserPages.tsx` 接入真实 Agent 连接、设当前、断开、接单和重新执行。
  - `apps/sprix-admin/src/App.tsx` 启动同步后台任务、执行记录、申诉、资金记录。
  - `apps/sprix-admin/src/admin/AdminPages.tsx` 接入真实申诉处理、提现审核、支付宝单笔打款、打款结果查询、打款成功和打款失败接口。

## 未完成 / 需要后端确认

- Swagger 未提供分页参数说明，列表接口当前按全量数组处理。
- Swagger 未明确所有状态枚举中文展示文案，前端 adapter 需要维护一层状态映射。
- Swagger 暂未提供管理端任务发布、编辑、下线、删除、重新发布接口；这些入口现在只提示后端未提供，不再模拟成功。
- Swagger 暂未提供申诉补充材料、高风险流转、要求更换提现账户接口；这些入口现在只提示后端未提供，不再模拟成功。
- Swagger 已提供微信扫码确认接口，但 PC H5 当前只负责创建会话和轮询；真正“扫码确认”应由微信侧/移动端拿到 code 后调用，不在 PC 页面里伪造。
- 支付宝登录、支付宝绑定和支付宝打款接口当前尚未重新生成到客户端；前端 service 层暂用手写 HTTP，后续需要用最新 Swagger 替换。
- 真实支付宝打款仍依赖后端 `sprix.integrations.alipay.payout-enabled=true`、Open Platform appId、私钥、公钥、回调地址和支付宝出款产品开通状态；默认配置不直接出款。
- Agent Gateway 接口已生成但未接入 H5 交互，需要和客户端协议联调后再封装 service adapter。
- 后端当前未对 `localhost` 返回 CORS 头，本地开发默认通过 Vite proxy `/sprix-api` 转发；生产环境通过 `VITE_API_BASE_URL` 指定真实网关。

## 验证

- `npx qxun-api-generator` in `apps/sprix-agent/src/apis`: 通过。
- `npx qxun-api-generator` in `apps/sprix-admin/src/apis`: 通过。
- `curl -X POST http://42.194.150.73:8084/api/v1/auth/wechat/scan-sessions`: 通过，返回 `qrPayload` 和 `pollIntervalSeconds`。
- `./node_modules/.bin/vitest run src/services/sprixApi.test.ts`: 通过。
- `./node_modules/.bin/vitest run src/components/GlobalModals.test.tsx`: 通过。
- `./node_modules/.bin/vitest run` in `apps/sprix-agent`: 通过。
- `./node_modules/.bin/vitest run` in `apps/sprix-admin`: 通过。
- `./node_modules/.bin/tsc -b apps/sprix-agent apps/sprix-admin`: 通过。
- `./node_modules/.bin/eslint apps/sprix-agent apps/sprix-admin`: 通过。
- `./node_modules/.bin/vite build` in `apps/sprix-agent`: 通过，存在 Vite chunk size 警告。
- `./node_modules/.bin/vite build` in `apps/sprix-admin`: 通过，存在 Vite chunk size 警告。
- `pnpm test`: 通过。
- `pnpm build`: 通过，agent/admin 均存在 Vite chunk size 警告。
- Playwright + 本机 Chrome 视觉 QA：支付宝登录弹窗桌面/移动端、管理后台待打款页桌面/移动端通过；截图输出在 `output/playwright/`。
