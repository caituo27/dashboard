---
name: pre-merge-verification-workflow
description: >-
  Use when Qianxun changes are ready for human review, handoff, staging, commit,
  merge, or PR, and the agent must verify the actual changed surface before
  claiming the work is complete.
---

# Pre Merge Verification Workflow

Use this workflow before telling a human that Qianxun work is ready to merge,
handoff, commit, or ship.

Do not use this workflow for every routine bug fix. Use it when the user asks
for commit, merge, PR, release, staging, or an explicit broad verification pass.

This workflow combines `verification-before-completion` and
`qianxun-change-verification` with Qianxun-specific checks. Evidence comes
before completion claims.

## Workflow

### 1. Inspect The Actual Diff

Run:

```bash
git status --short
git diff --stat
git diff --name-only
```

Separate your changes from pre-existing user changes. Do not revert unrelated
work.

### 2. Classify The Changed Surface

Use the touched files to decide verification:

- React/TS/service: focused affected tests first; affected H5 build only when
  build/type integration risk is real or requested; TSX handoff docs if TSX
  changed.
- Feature/behavior change: use `qianxun-change-verification`; add missing
  focused tests when logic is testable.
- UI/product flow: browser or Playwright-style click-through when practical,
  recording mismatches instead of hiding them.
- UI: 375px mobile baseline layout/browser check when practical; use 320px/430px as extra boundary widths for layout-sensitive changes.
- mock server: `node --check` for changed server/db files.
- generated API or Swagger: use `swagger-update-workflow`.
- shared package: build only when public contract, generated code, dependency,
  or build config changed.
- weapp shell: build only for shell/config/dependency/release risk.

If a product behavior changed, also apply `qianxun-feature-completion`.

### 3. Run Fresh Verification

Choose the smallest commands that prove the changed surface still works. The
following are heavier options; run only the commands justified by the diff and
handoff risk:

```bash
pnpm --dir qianxun-h5-candidate build
pnpm --dir qianxun-h5-employer build
pnpm --dir qianxun-shared build
pnpm --dir qianxun-weapp build:weapp
pnpm --dir qianxun-h5-candidate test
pnpm --dir qianxun-h5-employer test
pnpm --dir qianxun-shared test
pnpm --dir qianxun-mock-server test
pnpm --dir qianxun-h5-candidate test:e2e
pnpm --dir qianxun-h5-employer test:e2e
node --check qianxun-mock-server/src/server.js
node --check qianxun-mock-server/src/db.js
```

Read the output and exit code. Do not rely on previous runs.

### 4. Check Qianxun Handoff Rules

Before finalizing:

- important `.tsx` changes have same-directory `.md` docs
- no new product action is `Toast-only` unless explicitly demo
- server-owned data is not only page-local or Zustand without a refresh plan
- mock DTOs and service adapter expectations are aligned
- remaining unverified areas are named plainly

### 5. Final Report

Use this shape:

```text
Changed surface:
Verification run:
- command: result
Not verified:
Remaining risks:
Files changed:
```

If verification fails, report the failure and next fix instead of saying the work
is ready.
