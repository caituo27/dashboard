---
name: qianxun-feature-completion
description: >-
  Audit or implement Qianxun product features for end-to-end completion. Use when
  checking whether a feature is truly done, mapping product requirements to code,
  connecting UI to services/APIs/mock server, or identifying placeholder UI, toast-only
  behavior, missing state refresh, missing persistence, and incomplete edge states.
---

# Qianxun Feature Completion

Use this skill before declaring any Qianxun feature done.

The goal is to prevent AI-written code from looking complete while only wiring UI,
mock data, or toast messages.

## Completion Checklist

For each feature, verify:

- The user-facing entry exists in the expected page, tab, card, modal, or route.
- The happy path performs a real action, not only a toast.
- The action calls the correct service function.
- The service function calls the generated API client or an explicit mock-server endpoint.
- The mock server supports the same shape as the client expects.
- The UI refreshes after mutation or updates local state from the returned DTO.
- Reloading the app does not lose state that should be server-backed.
- Loading, empty, error, disabled, and unauthorized states are handled.
- Guest, candidate, employer, and inactive employer permissions match the product flow.
- Product copy and field list match the product spec.
- No behavior is duplicated across page-local state, Zustand, mock services, and API services.

## Source Trail

When auditing or implementing, trace in this order:

1. Product requirement or user story.
2. Acceptance case or test-case document that turns the requirement into
   verifiable behavior.
3. Page/component entry.
4. Event handler.
5. Zustand action or page-local mutation.
6. `candidateApi` / employer API / shared service.
7. Generated API client under `src/apis`.
8. Mock server route under `qianxun-mock-server/src`.
9. State refresh, cache update, or route transition.
10. Test/build/browser coverage.

If any step is missing, mark the feature as incomplete.

If the requested behavior conflicts with the product requirement, do not bury
the conflict in code. Ask whether to update the product prompt / PRD first, then
update acceptance cases and tests before or alongside implementation.

## Follow-Up Fix Rule

When an audit or completion review finds gaps and the user later asks to fix,
update, or implement them, treat the original report as part of the source of
truth. The fix must update any md that would otherwise stay stale:

- acceptance-case docs when expected behavior or coverage status changes
- verification reports when a previously uncovered item becomes covered
- TSX same-directory handoff docs when real/demo status, data source, handlers,
  or remaining work changes
- handoff/audit docs that listed the item as `Partial`, `Placeholder`,
  `Missing`, `Toast-only`, `Hardcoded`, `Divergent`, or `Local demo`

Do not require the user to separately ask for md updates after authorizing the
fix. A feature is not done if the code is fixed but the project docs still tell
the next human that the old gap remains.

Keep each module/type pair in one md. Update the existing acceptance-case,
verification, TSX handoff, or audit doc for that module instead of creating a
new dated duplicate. Do not merge different doc types into one file just to
avoid new files.

## Report Format

When asked to scan or review completion, report:

```text
Feature:
Status: Done / Partial / Placeholder / Missing
Evidence:
- UI entry: file:line
- State/service: file:line
- API/mock: file:line
Gap:
Next human action:
```

Prefer concrete file references and exact next edits over vague advice.

## Implementation Rules

- Do not add a button unless its action path is known.
- Do not leave a save/copy/open action as toast-only unless it is explicitly a demo placeholder.
- Do not add page-local state for server-owned entities unless there is a refresh plan.
- Prefer API/service-backed mutations over direct `useStore.setState`.
- After mutations, either use the returned DTO or reload the relevant list/detail.
- Keep mock server behavior close to the generated API DTOs.
- If backend support is missing, name the missing endpoint/schema clearly.

## Common Qianxun Risk Areas

- Candidate agent creation: profile, `hasAgent`, generated skills, and upload/chat source must stay in sync.
- Skill editing: all editable fields must round-trip through `SkillRequest` and `SkillResponse`.
- Run operations: dispatch, terminate, open, rerun, share, iterate, and compare are version-level features.
- Messages: C/B conversations must write to one shared conversation model.
- Employer activation: inactive employers may browse but should not mutate protected data.
- Demo state: local demo state and mock-server state must not silently diverge.
