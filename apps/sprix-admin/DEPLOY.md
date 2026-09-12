# 管理端与 Mock 联合部署包

执行 `pnpm --filter @sprix-ai/admin build` 后，原静态产物仍在 `dist/`，
另外生成可整体上传的 `deploy/`：

```text
deploy/
  web/       前端静态文件，Nginx 站点根目录
  mock/      Node Mock 服务及其运行时模块
  README.md  本说明
```

Mock 只依赖 Node 内置模块，无需安装前端依赖。可使用与项目构建环境一致的
Node 22。测试文件、本地 `.data/` 和凭证不包含在 Mock 包中。

## 首次部署

将整个 `deploy/` 上传至服务器应用目录，例如 `/opt/sprix-desk/`。
Nginx 静态站点根目录必须指向 `/opt/sprix-desk/web`，不要指向上级应用目录。
现有 `/sprix-api/` 后端代理仍需配置，Mock 不代替真实后端或登录服务。

使用宝塔 Node 项目管理器或现有进程管理器配置一个常驻进程：

- 工作目录：`/opt/sprix-desk`
- 启动命令：`node mock/server.mjs`
- 实例数：1，启用异常重启和开机启动
- 环境变量：

```dotenv
MOCK_HOST=127.0.0.1
MOCK_PORT=5176
MOCK_STATE_PATH=/var/lib/sprix-desk-mock/state.json
```

预先创建数据目录并授予服务运行用户写权限。状态文件不存在时自动初始化；
不要预先创建空文件。状态目录应独立于发布目录，并保留备份。
同一个状态文件只能由一个服务进程写入。

在站点 Nginx `server` 中合并以下配置；保留已有真实 API 代理：

```nginx
root /opt/sprix-desk/web;

location / {
    try_files $uri $uri/ /index.html;
}

location /mock-api/ {
    # 不加尾部 /，保留服务需要的 /mock-api/ 路径。
    proxy_pass http://127.0.0.1:5176;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

当前 Mock 接口没有身份校验且包含写操作。对外提供演示前，需要在站点入口配置
访问保护，或为 Mock 增加服务端身份校验；前端登录页不保护直接访问 Mock 的请求。
5176 仅绑定本机，不需要开放公网端口。

## 验证和更新

启动后，在服务器执行只读检查：

```bash
curl --fail 'http://127.0.0.1:5176/mock-api/dashboard/analytics?days=7'
```

然后检查站点域名下同一接口及管理页面。后续整体更新 `web/`、`mock/`，
重启 Mock 进程使新代码生效，保留外部状态目录。

打包不会自动启动服务或修改线上配置。仓库现有 CNB 流水线仍只上传 `dist/`；
自动发布这个联合包还需要配置服务部署目录和进程重启步骤。
