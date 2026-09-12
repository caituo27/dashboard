## 项目级验证覆盖规则

- 默认不要运行测试命令，除非用户在当前回合明确要求。
- 不要运行单元测试、集成测试、端到端测试、Playwright 或任何浏览器自动化检查，除非用户在当前回合明确要求。
- 默认使用非测试验证方式，例如重读改动文件、检查 diff、校验 Markdown/JSON/配置语法、运行非测试静态检查，或在不启动 Playwright/浏览器自动化的前提下做必要的人工检查。
- 最终回复需要说明测试和 Playwright 检查是按项目规则故意未运行的。

## API 刷新

To regenerate the API client when the backend updates the Swagger spec, run:

```bash
cd apps/sprix-agent/src/apis && pnpm exec qxun-api-generator
cd apps/sprix-admin/src/apis && pnpm exec qxun-api-generator
```

Or use the skill:

```text
/api-gen http://42.194.150.73:8084/v3/api-docs sprix
```

### 已配置的服务

| Service | Swagger URL | SIT | UAT | PROD |
| --- | --- | --- | --- | --- |
| sprix | http://42.194.150.73:8084/v3/api-docs | /sprix-api -> http://42.194.150.73:8084 | 待配置 | 待配置 |
