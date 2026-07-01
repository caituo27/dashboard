# Sprix Swagger 更新记录

最后更新：2026-07-01

## 拉取范围

- Swagger UI: http://42.194.150.73:8084/swagger-ui/index.html
- Swagger JSON: http://42.194.150.73:8084/v3/api-docs
- 生成范围: `apps/sprix-agent/src/apis/sprix`, `apps/sprix-admin/src/apis/sprix`
- 是否有生成 diff: 2026-07-01 有 Swagger JSON 和生成客户端 diff，新增头像接口、协议签署时间字段和后台执行行验收字段。2026-06-29 有 `api.ts` 注释空白格式 diff，但 Swagger JSON 无 diff，接口合同无变化。2026-06-27 曾新增支付宝登录/绑定、后台登录、Agent 评测、验收审核、支付宝打款/查询、我的任务详情等接口与 DTO。

## 接口变化

- 2026-07-01:
  - Added:
    - 账户头像上传接口：`POST /api/v1/account/profile/avatar`。
    - 用户头像读取接口：`GET /api/v1/account/users/{userId}/avatar`。
    - `UserAccount.freelancerAgreementSignedAt` 协议签署时间字段。
    - `AdminExecutionRow` 新增验收字段：`acceptanceStatus`、`acceptanceScore`、`acceptanceSummary`、`acceptanceIssues`、`acceptancePayload`、`submittedAt`。
  - Removed: 无。
  - Changed: 无破坏性变更。

- 2026-06-29:
  - Added:
    - 用户端平台统计接口：`GET /api/v1/platform/overview`，返回 `agentCount`、`taskCount`，用于首页“平台 Agent 数量 / 平台任务总量”。
  - Removed: 无。
  - Changed: 无破坏性变更。

- Added:
  - 用户端：微信扫码登录会话创建、状态轮询、扫码确认接口：
    - `POST /api/v1/auth/wechat/scan-sessions`
    - `GET /api/v1/auth/wechat/scan-sessions/{sessionId}`
    - `POST /api/v1/auth/wechat/scan-sessions/{sessionId}/confirm`
  - Agent Gateway：设备 bootstrap/pair/heartbeat/token refresh/unbind、待执行命令、事件批量上报、执行日志/产物/验收上传、文件下载。
  - 管理端资金：提现异常处理与退回复核接口。
  - 用户端支付宝扫码登录、支付宝绑定、收款账户查询接口：
    - `POST /api/v1/auth/alipay/login-sessions`
    - `GET /api/v1/auth/alipay/login-sessions/{sessionId}`
    - `POST /api/v1/auth/alipay/login-sessions/{sessionId}/confirm`
    - `GET /api/v1/auth/alipay/login-callback`
    - `GET /api/v1/account/withdrawal-account`
    - `POST /api/v1/account/alipay-bind-sessions`
    - `GET /api/v1/account/alipay-bind-sessions/{sessionId}`
    - `GET /api/v1/account/alipay-bind-callback`
  - Agent 评测接口：
    - `POST /api/v1/agents/{agentId}/evaluate`
    - `GET /api/v1/agents/{agentId}/evaluations/{evaluationId}`
    - `GET /api/v1/agents/{agentId}/evaluations/latest`
  - 管理端登录、验收审核、支付宝打款接口：
    - `POST /api/v1/auth/admin-login`
    - `GET /api/v1/admin/tasks/acceptance-reviews`
    - `POST /api/v1/admin/tasks/executions/{executionId}/acceptance/approve`
    - `POST /api/v1/admin/tasks/executions/{executionId}/acceptance/reject`
    - `POST /api/v1/admin/funds/withdrawals/{withdrawalId}/payout`
    - `POST /api/v1/admin/funds/withdrawals/{withdrawalId}/payout-query`
  - 我的任务详情接口：
    - `GET /api/v1/my-tasks/{executionId}`
  - DTO：`WechatScanSessionResponse`、`WechatScanStatusResponse`、`WechatScanConfirmRequest`、
    Agent Gateway 请求/响应 DTO、`WithdrawalReviewRequest`。
- Removed:
  - 无。
- Changed:
  - `UserAccount` 新增 `wechatOpenId`、`wechatUnionId` 字段。
  - `GET /api/v1/my-tasks` 返回更详细的 `MyTaskExecutionDetail` 列表，新增任务、Agent、交付、验收快照字段。
  - 2026-06-29：`AccountController` 新增/确认接单资格三段接口：
    - `POST /api/v1/account/qualification/face-verification`
    - `POST /api/v1/account/qualification/real-person-complete`
    - `POST /api/v1/account/qualification/agreement`

## 需要更新的前端交互

- Agent 端任务市场、任务详情、我的任务、Agent 中心、账户资质、提现和申诉需要优先读取真实接口。
- Agent 端首页统计卡片需要读取 `GET /api/v1/platform/overview`，不再前端硬编码横杠或自行兜底计算。
- Agent 端登录弹窗的“微信扫码登录”需要生成后端扫码会话、展示 `qrPayload` 二维码，并轮询状态；后端返回 token 后写入现有登录态并刷新 `sprix-agent` 远端快照。
- Agent 端登录弹窗的“支付宝扫码登录”需要生成后端支付宝登录会话、展示 `qrPayload` 二维码，并轮询状态；后端返回 token 后写入现有登录态并刷新 `sprix-agent` 远端快照。
- Agent 端支付宝收款账户绑定需要生成后端支付宝授权会话，后端回调完成后写入提现账户和支付宝身份绑定。
- Agent 客户端/网关相关接口已生成，但当前 H5 页面不直接调用；后续桌面 Agent 客户端接入时需要独立适配。
- Admin 端任务管理、任务执行记录、申诉中心、资金中心需要优先读取后台接口。
- Admin 端待打款记录需要调用后端单笔支付宝打款和打款结果查询接口，并展示后端返回的打款审计字段。
- 写操作必须先走真实接口，再通过 TanStack Query 刷新远端快照；Swagger 未提供的操作只提示不可用，不再写本地模拟状态。
- Agent 端接单资格页需要按真实接口完成支付宝人脸核验初始化、实人核验完成确认和协议签署，前端不再用 mock 写账户资格状态。
- Agent 端账户资料页可后续接入头像上传接口，并展示后端返回的协议签署时间。
- Admin 端执行记录和验收详情可后续直接读取 `AdminExecutionRow` 新增验收字段，减少详情二次拼接。

## 已完成适配

- Service:
  - `apps/sprix-agent/src/services/sprixApi.ts`
  - `apps/sprix-admin/src/services/sprixApi.ts`
  - 本次已将支付宝登录/绑定、收款账户查询、Agent 评测、后台登录、任务管理写操作、验收审核、支付宝打款/查询从手写 HTTP 切换为生成客户端调用。
  - 2026-06-29：`apps/sprix-agent/src/services/sprixApi.ts` 将 `initializeRemoteFaceVerification`、`completeRemoteFaceVerification`、`signRemoteFreelancerAgreement` 接到 `AccountController` 真实接口。
  - 2026-06-29：`apps/sprix-agent/src/services/sprixApi.ts` 接入 `PlatformControllerApi.overview`，首页统计改读后端平台统计接口。
- Login:
  - `apps/sprix-agent/src/components/GlobalModals.tsx` 接入真实微信扫码登录：创建扫码会话、展示二维码、轮询状态、token 落入 `sprix-auth-token`。
  - `apps/sprix-agent/src/components/LoginRegisterModal.tsx` 接入支付宝扫码登录，并保留微信扫码和手机号验证码登录。
- Account:
  - `apps/sprix-agent/src/components/BindAlipayModal.tsx` 接入支付宝授权绑定会话、状态轮询和授权链接兜底。
- Mock server: 当前项目没有独立 mock server；原 app 内 mock 数据文件与本地业务状态机已移除，接口失败时只展示错误提示。
- 页面 / 组件:
  - `apps/sprix-agent/src/App.tsx` 启动同步任务市场、账户、Agent、我的任务。
  - `apps/sprix-agent/src/components/GlobalModals.tsx` 接入真实登录、绑定收款支付宝和申诉。
  - `apps/sprix-agent/src/user/UserPages.tsx` 接入真实 Agent 连接、设当前、断开、接单和重新执行。
  - `apps/sprix-admin/src/App.tsx` 启动同步后台任务、执行记录、申诉、资金记录。
  - `apps/sprix-admin/src/admin/AdminPages.tsx` 接入真实申诉处理、提现审核、支付宝单笔打款、打款结果查询、打款成功和打款失败接口。

## 未完成 / 需要后端确认

- Swagger 未提供分页参数说明，列表接口当前按全量数组处理。
- Swagger 未明确所有状态枚举中文展示文案，前端 adapter 需要维护一层状态映射。
- Swagger 暂未提供管理端任务发布、编辑、下线、删除、重新发布接口；这些入口现在只提示后端未提供，不再模拟成功。
- Swagger 暂未提供申诉补充材料、高风险流转、要求更换提现账户接口；这些入口现在只提示后端未提供，不再模拟成功。
- Swagger 已提供微信扫码确认接口，但 PC H5 当前只负责创建会话和轮询；真正“扫码确认”应由微信侧/移动端拿到 code 后调用，不在 PC 页面里伪造。
- 正式自由职业者协议全文、协议版本、签署记录字段、核验回跳/回调和状态刷新口径仍需后端/法务确认；当前签署动作已接后端，正文仍是占位摘要。
- 真实支付宝打款仍依赖后端 `sprix.integrations.alipay.payout-enabled=true`、Open Platform appId、私钥、公钥、回调地址和支付宝出款产品开通状态；默认配置不直接出款。
- Agent Gateway 接口已生成但未接入 H5 交互，需要和客户端协议联调后再封装 service adapter。
- 后端当前未对 `localhost` 返回 CORS 头，本地开发默认通过 Vite proxy `/sprix-api` 转发；生产环境通过 `VITE_API_BASE_URL` 指定真实网关。

## 验证

- 2026-07-01 `pnpm exec qxun-api-generator` in `apps/sprix-agent/src/apis`: 通过。
- 2026-07-01 `pnpm exec qxun-api-generator` in `apps/sprix-admin/src/apis`: 通过。
- 2026-07-01 `git diff -- apps/sprix-agent/src/apis/_swaggers/sprix.json apps/sprix-admin/src/apis/_swaggers/sprix.json`: 确认新增头像接口、协议签署时间字段和后台执行行验收字段。
- 2026-07-01 `git diff -w --stat -- apps/sprix-agent/src/apis/sprix/api.ts apps/sprix-admin/src/apis/sprix/api.ts`: 确认生成客户端同步新增接口和字段。
- 2026-07-01 `pnpm --filter @sprix-ai/agent typecheck`: 通过。
- 2026-07-01 `pnpm --filter @sprix-ai/admin typecheck`: 通过。
- 2026-06-29 `npx qxun-api-generator` in `apps/sprix-agent/src/apis`: 通过。
- 2026-06-29 `npx qxun-api-generator` in `apps/sprix-admin/src/apis`: 通过。
- 2026-06-29 `git diff -w --stat -- apps/sprix-agent/src/apis/sprix/api.ts apps/sprix-admin/src/apis/sprix/api.ts apps/sprix-agent/src/apis/_swaggers/sprix.json apps/sprix-admin/src/apis/_swaggers/sprix.json`: 无输出，确认无接口合同变化。
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
- 2026-06-27 `/usr/bin/git pull --rebase cnb main`: 通过，远端已是最新。
- 2026-06-27 `npx qxun-api-generator` in `apps/sprix-agent/src/apis`: 通过。
- 2026-06-27 `npx qxun-api-generator` in `apps/sprix-admin/src/apis`: 通过。
- 2026-06-27 `npm run typecheck` in `apps/sprix-agent`: 通过。
- 2026-06-27 `npm run typecheck` in `apps/sprix-admin`: 通过。
- 2026-06-29 `pnpm exec qxun-api-generator` in `apps/sprix-agent/src/apis`: 通过。
