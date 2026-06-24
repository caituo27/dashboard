---
name: qxun-log-analytics
description: Use when a Vite or React frontend needs Qianxun @qianxun/log analytics, 腾讯云 CLS 前端埋点, SIT/PROD 上报地址配置, TopicId 环境区分, page_view 初始化上报, or button click auto-tracking.
---

# QXun Log Analytics

Use this skill to add Qianxun frontend analytics to a Vite app.

The target developer experience is:

```ts
import qxun from '@qianxun/log'

qxun.log({ xxxx: '123' })
qxun.click('home_apply_job')
```

The app bootstrap should use environment-based initialization:

```ts
qxun.initFromEnv(import.meta.env, {
  app: 'qxun-h5-candidate'
})
```

## Inputs To Ask

If the user does not provide these values, ask concise questions:

1. `app` name, for example `qxun-h5-candidate`.
2. SIT CLS upload host, default `https://ap-guangzhou.cls.tencentcs.com`.
3. SIT CLS topic ID.
4. PROD CLS upload host, default same as SIT.
5. PROD CLS topic ID.
6. Whether to auto-track button clicks in debug/SIT, default yes.

Do not ask for Tencent Cloud `SecretId` or `SecretKey`. This skill uses CLS anonymous JS/HTTP upload and the official browser SDK under `@qianxun/log`.

## Preconditions

The CLS log topic must enable:

```text
匿名上传 -> JS/HTTP 日志上传
```

Quick validation:

```bash
curl -i -X POST 'https://ap-guangzhou.cls.tencentcs.com/tracklog?topic_id=<topic-id>' \
  -H 'Content-Type: application/json' \
  --data '{"logs":[{"time":'$(date +%s)',"contents":{"event_name":"curl_test","xxxx":"123"}}],"source":"local-curl"}'
```

`HTTP 200` means the topic accepts browser uploads.

## Automatic Setup

From the target Vite project root, run the bundled script:

```bash
python3 scripts/configure_vite_qxun_log.py \
  --app qxun-h5-candidate \
  --sit-host https://ap-guangzhou.cls.tencentcs.com \
  --sit-topic-id <sit-topic-id> \
  --prod-host https://ap-guangzhou.cls.tencentcs.com \
  --prod-topic-id <prod-topic-id>
```

If the app uses the monorepo workspace package, pass:

```bash
--dependency-version workspace:*
```

The script will:

- add `@qianxun/log` to `package.json`;
- create `src/services/analytics.ts`;
- update `src/main.tsx` to call `initAnalytics()`;
- add QXun log env types to `src/vite-env.d.ts`;
- write `.env.sit` and `.env.production` values;
- send an immediate `page_view` on app entry and print it in the browser console;
- auto-track button clicks unless disabled.

## Runtime Env

The package reads:

```text
VITE_QXUN_LOG_ENV=sit|prod
VITE_QXUN_LOG_SIT_HOST=https://ap-guangzhou.cls.tencentcs.com
VITE_QXUN_LOG_SIT_TOPIC_ID=...
VITE_QXUN_LOG_PROD_HOST=https://ap-guangzhou.cls.tencentcs.com
VITE_QXUN_LOG_PROD_TOPIC_ID=...
VITE_QXUN_LOG_TIME=10
VITE_QXUN_LOG_COUNT=10
VITE_QXUN_LOG_MAX_REQUEST_COUNT=10
VITE_QXUN_LOG_SHOW_CONSOLE_ERROR=true
VITE_QXUN_LOG_AUTO_BUTTONS=true
```

Resolution:

- `VITE_QXUN_LOG_ENV=prod` or `MODE=production` uses `PROD`.
- Everything else uses `SIT`.

## Manual Calls

```ts
import { trackClick, trackLog } from './services/analytics'

trackLog({ event_name: 'custom_event', xxxx: '123' })

trackClick('home_apply_job', {
  button_text: '立即求职',
  task_id: taskId
})
```

For stable auto-click IDs, add:

```tsx
<button data-qxun-id="home_apply_job">立即求职</button>
```

Opt out:

```tsx
<button data-qxun-track="off">不用自动上报</button>
```
