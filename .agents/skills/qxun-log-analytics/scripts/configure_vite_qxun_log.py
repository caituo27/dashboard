#!/usr/bin/env python3
"""Configure @qianxun/log in a Vite project."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


DEFAULT_HOST = "https://ap-guangzhou.cls.tencentcs.com"
ENV_TYPES = """\

interface ImportMetaEnv {
  readonly VITE_QXUN_LOG_ENV?: string
  readonly VITE_QXUN_LOG_APP?: string
  readonly VITE_QXUN_LOG_HOST?: string
  readonly VITE_QXUN_LOG_ENDPOINT?: string
  readonly VITE_QXUN_LOG_TOPIC_ID?: string
  readonly VITE_QXUN_LOG_SIT_HOST?: string
  readonly VITE_QXUN_LOG_SIT_ENDPOINT?: string
  readonly VITE_QXUN_LOG_SIT_TOPIC_ID?: string
  readonly VITE_QXUN_LOG_PROD_HOST?: string
  readonly VITE_QXUN_LOG_PROD_ENDPOINT?: string
  readonly VITE_QXUN_LOG_PROD_TOPIC_ID?: string
  readonly VITE_QXUN_LOG_SOURCE?: string
  readonly VITE_QXUN_LOG_TIME?: string
  readonly VITE_QXUN_LOG_COUNT?: string
  readonly VITE_QXUN_LOG_MAX_REQUEST_COUNT?: string
  readonly VITE_QXUN_LOG_SHOW_CONSOLE_ERROR?: string
  readonly VITE_QXUN_LOG_AUTO_BUTTONS?: string
  readonly VITE_QXUN_LOG_DISABLED?: string
}
"""


ANALYTICS_TS = """\
import qxun, { type QxunLogFields } from '@qianxun/log'

let autoButtonTrackingStarted = false

function envFlag(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback
  return value === '1' || value === 'true'
}

function normalizeButtonText(value: string | null | undefined) {
  return value?.replace(/\\s+/g, ' ').trim() || ''
}

function resolveButtonId(element: Element) {
  return (
    element.getAttribute('data-qxun-id') ||
    element.id ||
    normalizeButtonText(element.getAttribute('aria-label')) ||
    normalizeButtonText(element.textContent).slice(0, 40) ||
    element.tagName.toLowerCase()
  )
}

function resolveButtonText(element: Element) {
  return (
    normalizeButtonText(element.getAttribute('data-qxun-label')) ||
    normalizeButtonText(element.getAttribute('aria-label')) ||
    normalizeButtonText(element.textContent)
  )
}

function startAutoButtonTracking() {
  if (autoButtonTrackingStarted || typeof document === 'undefined') return
  autoButtonTrackingStarted = true

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return

      const target = event.target.closest('button,[role="button"],a[href]')
      if (!target || target.getAttribute('data-qxun-track') === 'off') return

      trackClick(resolveButtonId(target), {
        button_text: resolveButtonText(target),
        tag_name: target.tagName.toLowerCase(),
        auto: true
      })
    },
    { capture: true }
  )
}

function trackInitialPageView() {
  const pageViewFields = {
    page_title: typeof document === 'undefined' ? '' : document.title,
    referrer: typeof document === 'undefined' ? '' : document.referrer,
    entry_type: 'initial_load'
  }

  console.info('[qxun.log] page_view', pageViewFields)
  qxun.pageView(pageViewFields, { immediate: true })
}

export function initAnalytics() {
  qxun.initFromEnv(import.meta.env, {
    app: import.meta.env.VITE_QXUN_LOG_APP || '__APP_NAME__',
    time: 10,
    count: 10,
    maxRequestCount: 10,
    showConsoleError: import.meta.env.MODE !== 'production'
  })

  trackInitialPageView()

  if (envFlag(import.meta.env.VITE_QXUN_LOG_AUTO_BUTTONS, import.meta.env.MODE !== 'production')) {
    startAutoButtonTracking()
  }
}

export function trackLog(fields: QxunLogFields) {
  return qxun.log(fields)
}

export function trackClick(buttonId: string, fields: QxunLogFields = {}) {
  return qxun.click(buttonId, fields)
}
"""


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def update_package_json(root: Path, version: str) -> None:
    package_path = root / "package.json"
    data = json.loads(read_text(package_path))
    dependencies = data.setdefault("dependencies", {})
    dependencies.setdefault("@qianxun/log", version)
    write_text(package_path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def update_main(entry: Path) -> None:
    text = read_text(entry)
    if "initAnalytics" not in text:
        last_import = list(re.finditer(r"^import .+$", text, flags=re.MULTILINE))[-1]
        insert_at = last_import.end()
        text = (
            text[:insert_at]
            + "\nimport { initAnalytics } from './services/analytics'"
            + text[insert_at:]
        )
    if "initAnalytics()" not in text:
        first_render = text.find("ReactDOM.createRoot")
        if first_render == -1:
            first_render = text.find("createRoot")
        if first_render == -1:
            text += "\n\ninitAnalytics()\n"
        else:
            text = text[:first_render] + "initAnalytics()\n\n" + text[first_render:]
    write_text(entry, text)


def update_vite_env(path: Path) -> None:
    text = read_text(path)
    if "VITE_QXUN_LOG_SIT_TOPIC_ID" not in text:
        text = text.rstrip() + "\n" + ENV_TYPES
    write_text(path, text)


def upsert_env(path: Path, values: dict[str, str]) -> None:
    lines = read_text(path).splitlines()
    current: dict[str, str] = {}
    order: list[str] = []
    for line in lines:
        if "=" not in line or line.strip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        current[key] = value
        order.append(key)
    for key, value in values.items():
        current[key] = value
        if key not in order:
            order.append(key)
    write_text(path, "\n".join(f"{key}={current[key]}" for key in order) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Configure @qianxun/log in a Vite app.")
    parser.add_argument("--root", default=".", help="Project root")
    parser.add_argument("--src-dir", default="src")
    parser.add_argument("--entry", default="src/main.tsx")
    parser.add_argument("--app", required=True)
    parser.add_argument("--sit-host", default=DEFAULT_HOST)
    parser.add_argument("--sit-topic-id", required=True)
    parser.add_argument("--prod-host", default=DEFAULT_HOST)
    parser.add_argument("--prod-topic-id", required=True)
    parser.add_argument("--dependency-version", default="latest")
    parser.add_argument("--auto-buttons", default="true")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    src = root / args.src_dir
    update_package_json(root, args.dependency_version)
    write_text(src / "services" / "analytics.ts", ANALYTICS_TS.replace("__APP_NAME__", args.app))
    update_main(root / args.entry)
    update_vite_env(src / "vite-env.d.ts")
    shared = {
        "VITE_QXUN_LOG_APP": args.app,
        "VITE_QXUN_LOG_TIME": "10",
        "VITE_QXUN_LOG_COUNT": "10",
        "VITE_QXUN_LOG_MAX_REQUEST_COUNT": "10",
        "VITE_QXUN_LOG_AUTO_BUTTONS": args.auto_buttons,
    }
    upsert_env(root / ".env.sit", {
        **shared,
        "VITE_QXUN_LOG_ENV": "sit",
        "VITE_QXUN_LOG_SIT_HOST": args.sit_host,
        "VITE_QXUN_LOG_SIT_TOPIC_ID": args.sit_topic_id,
        "VITE_QXUN_LOG_PROD_HOST": args.prod_host,
        "VITE_QXUN_LOG_PROD_TOPIC_ID": args.prod_topic_id,
        "VITE_QXUN_LOG_SHOW_CONSOLE_ERROR": "true",
    })
    upsert_env(root / ".env.production", {
        **shared,
        "VITE_QXUN_LOG_ENV": "prod",
        "VITE_QXUN_LOG_SIT_HOST": args.sit_host,
        "VITE_QXUN_LOG_SIT_TOPIC_ID": args.sit_topic_id,
        "VITE_QXUN_LOG_PROD_HOST": args.prod_host,
        "VITE_QXUN_LOG_PROD_TOPIC_ID": args.prod_topic_id,
        "VITE_QXUN_LOG_SHOW_CONSOLE_ERROR": "false",
    })
    print(json.dumps({
        "ok": True,
        "root": str(root),
        "entry": args.entry,
        "app": args.app,
        "sit_host": args.sit_host,
        "sit_topic_id": args.sit_topic_id,
        "prod_host": args.prod_host,
        "prod_topic_id": args.prod_topic_id,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
