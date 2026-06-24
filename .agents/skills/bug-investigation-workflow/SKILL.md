---
name: bug-investigation-workflow
description: >-
  Use when a Qianxun page, feature, API flow, store state, mock server route, or
  C/B-side interaction behaves incorrectly, loses state after refresh, diverges
  between UI and backend data, or needs root-cause debugging before fixes.
---

# Bug Investigation Workflow

Use this workflow when the task is a bug, broken behavior, inconsistent state,
or a suspected regression.

This workflow combines `systematic-debugging` with Qianxun's feature-completion
rules. The goal is to fix the proven root cause, not the first suspicious line.

## Workflow

### 1. Establish The Symptom

- Record the exact user-visible problem.
- Identify the affected side: candidate H5, employer H5, shared UI, weapp shell,
  mock server, or generated API.
- Inspect current changes before editing:

```bash
git status --short
git diff --name-only
```

If the symptom is unclear, ask for the smallest reproducible action path.

### 2. Reproduce Or Prove The Failure

Use the smallest practical proof:

- local browser reproduction for UI behavior
- failing build or type error for compile regressions
- `node --check` for mock server syntax
- targeted log/trace for state or adapter mismatches

Do not run full H5 build/test just to start a routine bug investigation. Use it
only when the symptom is a compile/build failure or no smaller reproduction can
prove the issue.

Do not claim a bug is understood until there is evidence.

### 3. Trace The Qianxun Source Trail

Follow the behavior through:

1. route/page/component entry
2. click handler or lifecycle effect
3. Zustand action or page-local state
4. `candidateApi`, employer service, or shared service
5. generated API under `src/apis`
6. `qianxun-mock-server/src` route and data shape
7. UI refresh, cache update, or route transition

Look specifically for `Toast-only`, `Local demo`, `Hardcoded`, `Divergent`, and
`Missing` behavior.

### 4. Fix The Root Cause Minimally

- Fix the lowest correct layer, preferably service adapters over page DTO churn.
- Avoid broad refactors unless the bug is caused by unclear ownership.
- If React/TS/service code changes, apply `readable-react-code`.
- If UI changes, apply `qianxun-ui`.
- If the bug is product-flow related, apply `qianxun-feature-completion`.

If backend support is missing, name the missing endpoint/schema instead of
pretending the UI is complete.

### 5. Verify The Original Symptom

Run the smallest command or browser check that proves the original issue is fixed.
Prefer direct symptom verification. Use the heavier commands below only for
compile regressions, config/dependency changes, broad shared-contract changes,
release/merge handoff, or when the user asks:

```bash
pnpm --dir qianxun-h5-candidate build
pnpm --dir qianxun-h5-employer build
node --check qianxun-mock-server/src/server.js
node --check qianxun-mock-server/src/db.js
```

If a full verification is too expensive or blocked, state exactly what was and
was not verified.

## Final Report

Use this shape:

```text
Bug:
Root cause:
Fix:
Verification:
Remaining risk:
Files to open first:
```

Include concrete file paths and line numbers when possible.
