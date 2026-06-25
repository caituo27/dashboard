# Sprix Swagger 更新记录

最后更新：2026-06-25

## 拉取范围

- Swagger UI: http://42.194.150.73:8084/swagger-ui/index.html
- Swagger JSON: http://42.194.150.73:8084/v3/api-docs
- 生成范围: `apps/sprix-agent/src/apis/sprix`, `apps/sprix-admin/src/apis/sprix`
- 是否有生成 diff: 首次接入，新增生成客户端与 `_swaggers/sprix.json`

## 接口变化

- Added:
  - 用户端：登录、账户、Agent 连接、任务市场、我的任务、收益、提现、申诉。
  - 管理端：任务、执行记录、申诉处理、资金概览、提现审核、结算、资金流水。
- Removed:
  - 无，本次为首次拉取。
- Changed:
  - 无历史生成客户端可对比。

## 需要更新的前端交互

- Agent 端任务市场、任务详情、我的任务、Agent 中心、账户资质、提现和申诉需要优先读取真实接口。
- Admin 端任务管理、任务执行记录、申诉中心、资金中心需要优先读取后台接口。
- 写操作必须先走真实接口，再通过 TanStack Query 刷新远端快照；Swagger 未提供的操作只提示不可用，不再写本地模拟状态。

## 已完成适配

- Service:
  - `apps/sprix-agent/src/services/sprixApi.ts`
  - `apps/sprix-admin/src/services/sprixApi.ts`
- Mock server: 当前项目没有独立 mock server；原 app 内 mock 数据文件与本地业务状态机已移除，接口失败时只展示错误提示。
- 页面 / 组件:
  - `apps/sprix-agent/src/App.tsx` 启动同步任务市场、账户、Agent、我的任务。
  - `apps/sprix-agent/src/components/GlobalModals.tsx` 接入真实登录、绑定收款、提现和申诉。
  - `apps/sprix-agent/src/user/UserPages.tsx` 接入真实 Agent 连接、设当前、断开、接单和重新执行。
  - `apps/sprix-admin/src/App.tsx` 启动同步后台任务、执行记录、申诉、资金记录。
  - `apps/sprix-admin/src/admin/AdminPages.tsx` 接入真实申诉处理、提现审核、打款成功和打款失败接口。

## 未完成 / 需要后端确认

- Swagger 未提供分页参数说明，列表接口当前按全量数组处理。
- Swagger 未明确所有状态枚举中文展示文案，前端 adapter 需要维护一层状态映射。
- Swagger 暂未提供管理端任务发布、编辑、下线、删除、重新发布接口；这些入口现在只提示后端未提供，不再模拟成功。
- Swagger 暂未提供申诉补充材料、高风险流转、要求更换提现账户接口；这些入口现在只提示后端未提供，不再模拟成功。
- 后端当前未对 `localhost` 返回 CORS 头，本地开发默认通过 Vite proxy `/sprix-api` 转发；生产环境通过 `VITE_API_BASE_URL` 指定真实网关。

## 验证

- `pnpm typecheck`: 通过。
- `pnpm lint`: 通过。
- `pnpm test`: 通过。
- `pnpm build`: 通过，存在 Vite chunk size 警告。
- 浏览器 smoke: `http://localhost:5174/tasks` 与 `http://localhost:5173/agent/market` 均能显示后端任务 `Enterprise website lead cleansing...`，控制台错误 0。
