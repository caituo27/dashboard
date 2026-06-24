---
name: api-gen
description: 'Generate a type-safe TypeScript API client from a Swagger/OpenAPI spec using the qxun-api-generator npm package. Creates src/apis/api.json config, runs generator from src/apis/, outputs to src/apis/<service-name>/. Use when the user wants to generate API client from swagger, create typed API hooks, auto-generate frontend API code from OpenAPI spec.'
---

# API Generator Skill

Generate a type-safe TypeScript API client from a Swagger/OpenAPI spec using the `qxun-api-generator` npm package.

## Usage

```
/api-gen [swagger-url] [service-name]
```

**Arguments** (from `$ARGUMENTS`):

- `swagger-url` — Remote Swagger JSON URL (optional; will ask if not provided)
- `service-name` — Name of the backend service, e.g. `consumer`, `user`, `order` (default: `api`)

---

## Instructions

Follow each step in order.

### Step 0 — Parse Arguments

Parse `$ARGUMENTS`:

- First token = swagger URL (may be empty)
- Second token = service name (default: `api`)

If no swagger URL is provided in `$ARGUMENTS`, ask the user:

> "请提供 Swagger API 文档地址（例如：https://your-server.com/v3/api-docs/service）"

Wait for the user's answer before continuing.

---

### Step 1 — Locate the Project Root and HTTP Utility

1. **Project root** — look for `package.json` in the current directory or its parents.

2. **HTTP utility import path** — check if `src/utils/http.ts` or `src/utils/request.ts` exists.
   - If found, note the path.
   - If NOT found, create `src/utils/http.ts` from the **Appendix** below.

Set:

- `HTTP_IMPORT_PATH` = relative import path from `src/apis/` to the http file (e.g. `../utils/http`)
- `APIS_DIR` = `<project-root>/src/apis`

---

### Step 1.5 — Ask for Environment Base URLs

Ask the user:

> "请提供各环境的 API base URL（用于生成刷新脚本，之后可手动修改）：
>
> - SIT（测试环境）base URL，例如 https://sit.example.com
> - UAT（预发布环境）base URL，例如 https://uat.example.com
> - PROD（生产环境）base URL，例如 https://api.example.com
>
> 如果暂时不知道可以直接回车跳过。"

Store answers as `SIT_URL`, `UAT_URL`, `PROD_URL`.

---

### Step 2 — Create `src/apis/` Directory and `api.json`

Create `src/apis/` if it doesn't exist.

Create or update `src/apis/api.json` (merge if exists, do NOT remove other entries):

```json
{
  "$schema": "../../node_modules/qxun-api-generator/lib/schema.json",
  "apis": [
    {
      "service": "<service-name>",
      "outputDir": "./",
      "path": "<swagger-url>",
      "httpPath": "import { http as globalAxios } from '<HTTP_IMPORT_PATH>'",
      "baseUrl": ""
    }
  ]
}
```

**Important:**

- `outputDir` is always `"./"` — generator creates `src/apis/<service-name>/` automatically
- `baseUrl` is `""` — runtime baseURL comes from `http.ts` via env vars
- `httpPath` is a full TypeScript import statement

---

### Step 3 — Update CLAUDE.md with Refresh Instructions

Check if `CLAUDE.md` exists at the project root.

- If it exists, append the following section (only if it doesn't already contain `## API 刷新`).
- If it doesn't exist, create it with the following content.

````markdown
## API 刷新

To regenerate the API client when the backend updates the Swagger spec, run:

```bash
cd src/apis && npx qxun-api-generator
```
````

Or use the skill:

```
/api-gen <swagger-url> <service-name>
```

### 已配置的服务

| Service        | Swagger URL   | SIT       | UAT       | PROD       |
| -------------- | ------------- | --------- | --------- | ---------- |
| <service-name> | <swagger-url> | <SIT_URL> | <UAT_URL> | <PROD_URL> |

````

Each time a new service is added via `/api-gen`, append a new row to the table.

---

### Step 4 — Install qxun-api-generator if Needed

```bash
npx qxun-api-generator --version 2>/dev/null || npm install qxun-api-generator --save-dev
````

---

### Step 5 — Run the Generator

```bash
cd <APIS_DIR> && npx qxun-api-generator
```

If auth error, ask user for token and retry:

```bash
cd <APIS_DIR> && npx qxun-api-generator --auth "Bearer <token>"
```

---

### Step 6 — Final Summary

Tell the user:

- `src/apis/api.json` — config file
- `src/apis/<service-name>/` — generated API client
- `CLAUDE.md` — updated with refresh command and service table; Claude reads this to know how to regenerate
- Configure runtime baseURL in `src/utils/http.ts`

---

## Appendix — Default `src/utils/http.ts`

Only create if no HTTP utility exists.

```typescript
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

const ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '未授权，请重新登录',
  403: '拒绝访问',
  404: '请求资源不存在',
  408: '请求超时',
  409: '数据冲突，请刷新后重试',
  422: '请求数据验证失败',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误',
  502: '网关错误',
  503: '服务不可用',
  504: '网关超时'
}

export const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' }
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    const status: number | undefined = error.response?.status
    const serverMessage: string | undefined = error.response?.data?.message

    const message =
      serverMessage ?? (status ? ERROR_MESSAGES[status] : undefined) ?? '网络错误，请稍后重试'

    window.dispatchEvent(new CustomEvent('api-error', { detail: { status, message } }))

    if (status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }

    return Promise.reject(new Error(message))
  }
)
```
