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
