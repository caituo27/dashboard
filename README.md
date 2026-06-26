# Sprix AI Workspace

Sprix AI 是一个前端本地状态驱动的 Web 端 Agent 任务执行与管理平台 Demo。项目使用 pnpm workspace 管理两个独立 Vite app：

- `apps/sprix-agent`：C 端 Agent 任务平台。
- `apps/sprix-admin`：管理后台平台，独立于 C 端 app 运行。
- `.agents/`：从 QXunPortal 迁移过来的 agent workflows 和 skills，并保留本项目的 `lessie-ui`。

## 私有包

仓库已配置 `@qianxun` scope 的 CNB npm registry：

```bash
@qianxun:registry=https://npm.cnb.cool/yztx_qxun/qxun/-/packages/
```

两个 app 的 `package.json` 都已声明以下私包为 `optionalDependencies`，避免没有 CNB 凭证的本地环境阻断安装：

- `@qianxun/shared@0.1.2`
- `@qianxun/api@0.1.0`
- `@qianxun/log@0.1.0`

如需实际拉取私包，请先在本机配置 CNB token：

```bash
pnpm config set //npm.cnb.cool/yztx_qxun/qxun/-/packages/:_authToken "$CNB_TOKEN"
```

## 安装与运行

```bash
pnpm install
pnpm dev:agent
pnpm dev:admin
```

本地预览地址：

- C 端用户站点：http://localhost:5173/
- 管理后台站点：http://localhost:5174/

也可以同时启动：

```bash
pnpm dev:all
```

## 常用命令

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## CNB 流水线发布

仓库根目录的 `.cnb.yml` 会在代码推送后构建两个前端包，并通过 rsync 直接同步到服务器站点目录：

- `apps/sprix-agent/dist` -> C 端站点目录
- `apps/sprix-admin/dist` -> 管理后台站点目录

流水线通过 `imports` 从私仓配置读取部署变量：

```yaml
imports:
  - https://cnb.cool/yztx_qxun/QXunSecurityCenter/-/blob/main/env.prod.yml
```

复用该私仓里已有的服务器 SSH 变量：

```text
PROD_PORTAL_NGINX_IP=<服务器 IP 或域名>
PROD_USERNAME=<SSH 用户>
PROD_SSH_PORT=<SSH 端口>
PROD_SSH_PRIVATE_KEY=<SSH 私钥>
```

SprixPortal 只需要额外提供站点目录和 API 前缀：

```text
SPRIX_PORTAL_AGENT_WEB_ROOT=/www/wwwroot/<c端站点目录>
SPRIX_PORTAL_ADMIN_WEB_ROOT=/www/wwwroot/<管理后台站点目录>
SPRIX_PORTAL_API_BASE_URL=/sprix-api
VITE_LOCAL_AGENT_CLAIM_BASE_URL=http://42.194.150.73:8084
```

`VITE_LOCAL_AGENT_CLAIM_BASE_URL` 用于从前端 `/local-agent/claim` 跳转到后端完成设备绑定；不配置时，生产环境默认使用当前前端域名并切换到 `8084` 端口。

## 已实现页面

C 端用户站点：

- 任务市场 `/`
- 任务详情 `/agent/task/:id`
- Agent 中心 `/agent/center`
- 我的任务 `/agent/my-tasks`
- 任务执行详情 `/agent/my-tasks/:id`
- 报酬结算 `/agent/earnings`
- 接单资格开通 `/agent/qualification`
- 绑定收款方式 `/agent/withdraw-account`

管理后台：

- 任务管理中心 `/`
- 发布任务 `/tasks/new`
- 任务详情 `/tasks/:id`
- 申诉处理中心 `/appeals`
- 申诉详情 `/appeals/:id`
- 资金管理中心 `/funds`

## 数据与后端替换点

当前所有业务数据由各 app 内的 `src/data/mock.ts` 和 `src/store/domain.ts` 本地模拟，并通过 Zustand persist 保存关键状态。接入真实后端时，优先替换：

- `src/data/mock.ts` 的初始数据来源
- `src/store/domain.ts` 中的状态变更为 API mutation
- C 端任务、Agent、申诉、提现流程的 query/mutation
- 管理后台任务、申诉、资金列表与操作接口
