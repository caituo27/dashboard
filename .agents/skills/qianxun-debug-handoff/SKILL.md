---
name: qianxun-debug-handoff
description: Use when debugging Qianxun WeChat mini-program login handoff in a normal browser, especially when wx.login wxCode or getPhoneNumber phoneCode must be copied from the mini-program into H5 so Codex can test cookie-backed H5 flows.
---

# Qianxun Debug Handoff

## Purpose

Use this skill to turn a WeChat mini-program login handoff into a normal browser session.

The core constraint: `wxCode` and `phoneCode` can only be produced by the WeChat mini-program environment. Codex cannot generate them. Once the mini-program copies a handoff URL, Codex can open it in Chrome and continue debugging H5 with cookies.

## When To Use

- The user says "跑 debug 模式", "debug handoff", "H5 换 cookie", "wxCode", or "小程序复制链接".
- The user wants Codex to test H5 login/session behavior without operating WeChat DevTools.
- The user pasted a link like:

```text
http://192.168.77.16:5173/handoff?wxCode=...&role=CANDIDATE#phoneCode=...
```

Do not use this for normal H5-only bugs that do not involve WeChat login handoff.

## Fixed Flow

1. Start the debug mini-program mode:

```bash
pnpm --dir qianxun-weapp dev:weapp:debug
```

This runs shared watch, Taro weapp watch, candidate H5, and employer H5. The debug package should make the login button read:

```text
授权并复制调试链接
```

2. If ports are occupied, stop only the old local dev processes on the relevant ports, then rerun:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:10088 -sTCP:LISTEN
kill <pid>
```

3. In WeChat DevTools or the mini-program:

- Open login page.
- Select role.
- Click `授权并复制调试链接`.
- Approve phone authorization.
- Confirm toast says `调试链接已复制`.
- The mini-program must not jump to web-view in debug mode.

4. Read the system clipboard:

```bash
pbpaste
```

Expected candidate shape in Codex debug mode:

```text
http://localhost:5173/handoff?wxCode=...&role=CANDIDATE#phoneCode=...
```

Expected employer shape in Codex debug mode:

```text
http://localhost:10088/handoff?wxCode=...&role=EMPLOYER#phoneCode=...
```

If the user pasted or copied an IP/HTTPS link, rewrite the H5 host to `localhost` while preserving path, query, hash, and port:

```bash
python3 - <<'PY'
from urllib.parse import urlsplit, urlunsplit
import subprocess

url = subprocess.check_output(['pbpaste'], text=True).strip()
parts = urlsplit(url)
host = 'localhost'
netloc = f'{host}:{parts.port}' if parts.port else host
local_url = urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
subprocess.run(['pbcopy'], input=local_url, text=True, check=True)
print(local_url)
PY
```

For a pasted link in conversation, rewrite manually:

```text
http://localhost:5173/handoff?wxCode=...&role=CANDIDATE#phoneCode=...
```

5. Open the rewritten URL in Chrome:

```bash
open -a "Google Chrome" "$(pbpaste)"
```

The code is one-time. Do not open the original IP link first if the goal is a `localhost` cookie.

## Playwright Check

Prefer Playwright for Codex-owned verification. If the package dependency is declared but not installed, install from the lockfile first:

```bash
pnpm --dir qianxun-h5-candidate install --frozen-lockfile
pnpm --dir qianxun-h5-candidate exec playwright --version
```

Run a one-off check with the clipboard URL:

```bash
node <<'NODE'
const { chromium } = require('./qianxun-h5-candidate/node_modules/@playwright/test')
const { execFileSync } = require('node:child_process')

const handoffUrl = execFileSync('pbpaste', { encoding: 'utf8' }).trim()

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  const responses = []

  page.on('response', async (response) => {
    if (!response.url().includes('/api/v1/auth/')) return
    let body = ''
    try {
      body = (await response.text()).slice(0, 500)
    } catch {}
    responses.push({ url: response.url(), status: response.status(), body })
  })

  await page.goto(handoffUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const afterHandoff = page.url()

  await page.goto('http://localhost:5173/debug', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1500)

  const debugText = await page.locator('body').innerText().catch(() => '')
  const cookies = await context.cookies('http://localhost:5173')
  console.log(JSON.stringify({ afterHandoff, debugUrl: page.url(), cookies, responses, debugText }, null, 2))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
NODE
```

Interpretation:

- `guest-login` status `200` followed by `phone-login` status `200` means the handoff succeeded.
- `guest-login` status `400` with `code been used` means the one-time `wxCode` was already consumed; ask for a fresh copied link.
- A `QXSESSION` cookie plus successful `/api/v1/auth/me` means the browser can continue H5 debugging.
- `/debug` body text is the source for `username`, `nickname`, `accountType`, and `openId` display.

## Verify Cookie And User

After opening the handoff URL:

1. Confirm the page leaves `/handoff` and loads the H5 app.

```bash
osascript -e 'tell application "Google Chrome" to get URL of active tab of front window' \
  -e 'tell application "Google Chrome" to get title of active tab of front window'
```

2. Open `/debug` in the same host to read user fields:

```bash
open -a "Google Chrome" "http://localhost:5173/debug"
```

The debug page should show `username`, `nickname`, `openId`, account type, and related user information.

3. If browser automation can read page text, check:

- Home page greeting: `你好，<nickname>`
- Debug page fields: `username`, `nickname`, `openId`
- Network: `/api/v1/auth/me` returns current user

4. If Chrome blocks AppleScript JavaScript, do not claim the username from DOM. Ask the user to allow Chrome menu `View > Developer > Allow JavaScript from Apple Events`, or verify via visible `/debug` page.

## Failure Diagnosis

| Symptom                                    | Likely Cause                                                     | Next Step                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Button says `授权进入...`                  | Debug package is not active                                      | Rerun `pnpm --dir qianxun-weapp dev:weapp:debug` and refresh WeChat DevTools |
| Clipboard is only `http://localhost:5173/` | Mini-program did not copy the handoff link                       | Click `授权并复制调试链接` again                                             |
| `guest-login` says `code been used`        | The one-time `wxCode` was already opened                         | Generate a fresh debug link and let Playwright open it first                 |
| No phone authorization dialog              | Role not selected or `getPhoneNumber` did not fire               | Select role first, then click the main button                                |
| Toast says no phone code                   | WeChat did not return `detail.code`                              | Retry authorization in WeChat DevTools                                       |
| Handoff URL opens but login fails          | `wxCode` was already consumed or expired                         | Generate a fresh link                                                        |
| Browser seems logged out after success     | Host mismatch between `192.168...`, `localhost`, and `127.0.0.1` | Use one host consistently, preferably `localhost` for Codex                  |
| `/debug` redirects to login                | Cookie was not established for that host                         | Generate fresh link and open only the `localhost` URL                        |

## Important Rules

- Never fabricate `wxCode` or `phoneCode`.
- Never open both the IP URL and localhost URL with the same code. Pick one host before the first open.
- For Codex browser testing, prefer `localhost` so the cookie lives on the local browser origin.
- Keep Vite proxy unchanged unless the user explicitly asks to change it.
- Do not commit `dist` output unless the user explicitly asks.
