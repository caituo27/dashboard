---
name: qianxun-human-handoff
description: >-
  Explain Qianxun AI-written code so a human developer can take over. Use when
  summarizing what changed, auditing what is done or unfinished, preparing a handoff
  checklist, untangling mock/demo/API state, or documenting where humans should edit next.
---

# Qianxun Human Handoff

Use this skill when a human needs to understand, own, or continue AI-written code.

The goal is a clear handoff: what exists, what is fake, what is risky, and where to edit.

## Handoff Principles

- Separate product intent from current implementation.
- Name the exact source of truth for each feature: backend, mock server, localStorage, Zustand, or page state.
- Call out toast-only behavior and hardcoded demo content.
- Call out duplicated logic across page handlers, store actions, service adapters, and mock services.
- Point to the next file a human should open.
- Prefer small, ordered work items over broad refactor advice.
- Say "unknown" when the code does not prove behavior.

## Scan Workflow

Inspect these areas for a feature:

```bash
rg -n "featureName|modalName|buttonText|storeAction|apiMethod" qianxun-h5-candidate/src qianxun-h5-employer/src qianxun-mock-server/src
rg -n "getState\\(|setState\\(|showToast\\(|defaultValue=|TODO|FIXME" qianxun-h5-candidate/src qianxun-h5-employer/src
```

Then read:

- page route or component
- card/button component
- modal component
- Zustand slice
- service adapter
- generated API type
- mock server route
- tests, if present

## Handoff Report Shape

Use this shape when the user asks what to do:

```text
What is already real:
- ...

What is demo/placeholder:
- ...

Main risks:
- ...

Recommended next work:
1. ...
2. ...
3. ...

Files to open first:
- path:line - why
```

## Status Labels

Use consistent labels:

- `Real`: backed by API/mock-server route and refreshed in UI.
- `Local demo`: works only in Zustand/localStorage or in-memory data.
- `Toast-only`: button exists but does not perform the product action.
- `Hardcoded`: displays fixed demo text not derived from selected entity.
- `Divergent`: two paths implement the same feature differently.
- `Missing`: no meaningful implementation found.

## What Humans Need Most

For every feature, answer:

- Where does the data come from?
- Where does mutation happen?
- Does refresh preserve the result?
- Which file owns the UI?
- Which file owns the business action?
- Which fake/demo part must be replaced for production?
- What test would prove it works?
