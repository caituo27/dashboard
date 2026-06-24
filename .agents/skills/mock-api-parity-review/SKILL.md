---
name: mock-api-parity-review
description: >-
  Use when checking whether Qianxun mock server data, generated API DTOs, service
  adapters, Zustand/page state, and candidate/employer UI expectations are aligned
  or have divergent local-demo behavior.
---

# Mock API Parity Review

Use this workflow to check whether a feature has one coherent data contract across
generated API, service adapters, mock server, and UI state.

This is usually an audit workflow. Do not change code unless the user explicitly
asks to fix the mismatches.

## Workflow

### 1. Pick The Feature Or Entity

Identify the feature, entity, route, or endpoint being reviewed. If the user only
gives a page name, start from that page and trace outward.

Useful searches:

```bash
rg -n "candidateApi\\.|employerApi\\.|defaultApi\\(|runApi\\(" qianxun-h5-candidate/src qianxun-h5-employer/src
rg -n "TODO|FIXME|showToast\\(|localStorage|setState\\(" qianxun-h5-candidate/src qianxun-h5-employer/src
```

### 2. Compare Every Contract Layer

For the selected behavior, inspect:

- page/component props and local state
- Zustand store actions and persistence
- service adapter request/response mapping
- generated API DTO and operation name
- mock server route handler
- mock DB seed shape
- candidate/employer cross-side expectations, if applicable

Prefer service adapters as the translation boundary. Pages should not learn
backend DTO quirks unless there is no adapter yet.

### 3. Classify The Source Of Truth

Use these labels:

- `Real`: backed by generated API or mock-server route and refreshed in UI.
- `Local demo`: only Zustand, localStorage, or page memory.
- `Toast-only`: action exists but no product mutation happens.
- `Hardcoded`: fixed demo data unrelated to current entity/user/run.
- `Divergent`: two layers represent the same concept differently.
- `Missing`: no meaningful implementation found.

### 4. Report Mismatches

For each mismatch, name:

- frontend field or action
- generated DTO or endpoint
- mock route/data source
- current label
- smallest next edit

If the user asked to fix parity, update adapters and mock server first, then page
code only where necessary.

## Report Shape

```text
Feature/entity:
Status: Real / Local demo / Toast-only / Hardcoded / Divergent / Missing
Contract trail:
- UI:
- Store/service:
- Generated API:
- Mock route/db:
Mismatches:
- ...
Recommended next work:
1. ...
```
