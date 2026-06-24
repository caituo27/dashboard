---
name: qianxun-change-verification
description: >-
  Use when adding, modifying, or deleting Qianxun features, behavior, UI flows,
  React/TS code, Zustand state, services, shared UI, mock server logic, or
  before handoff/commit/merge when tests and browser checks must be selected.
---

# Qianxun Change Verification

Use this skill whenever a Qianxun feature or behavior is added, changed, or
deleted. Verification should match the risk: unit tests for logic, browser
click-through for UI/product flows, and build/check commands only when smaller
proof is not enough.

## Feature Change Intake Gate

When the user asks to add, modify, or delete a feature, run this gate before
editing code:

1. Locate the product source for the feature: product prompt / PRD, existing
   acceptance-case doc, page `.md`, Swagger/API contract, or the user's current
   request if no written product source exists.
2. Compare the requested behavior against that product source.
3. If the request conflicts with the product source, stop and ask whether the
   product prompt / PRD should be updated. Do not silently make implementation
   contradict product docs.
4. If the user confirms the product behavior is changing, update the product
   source or an acceptance-case document first, then update tests, then update
   implementation.
5. If the user says the product source should not change, treat the request as a
   bug fix or implementation alignment task and keep tests anchored to the
   existing product source.
6. If no product source exists, explicitly mark the source as "user request" and
   create or update a short acceptance-case document before adding durable tests.
7. After implementation, update the verification report and any required same-
   directory TSX handoff `.md` so the source, tests, and code stay in sync.

## Documentation Sync Rule

If the agent has already inspected a feature, found gaps, written a verification
report, or marked items as uncovered / pending / demo / placeholder, and the
user then asks to update or fix those gaps, documentation sync is mandatory. Do
not wait for a separate "update the md" request.

Update every document that would otherwise become stale:

- product prompt / PRD or acceptance-case docs when the expected behavior changes
- verification reports when coverage, commands, pass/fail status, or remaining
  gaps change
- same-directory TSX handoff docs when an important TSX behavior, data source,
  handler, or real/demo status changes
- handoff or audit docs that previously listed the fixed item as unfinished,
  placeholder, Toast-only, hardcoded, divergent, or missing

The work is not complete until stale "still missing" / "not covered" / "to do"
statements created by the agent are removed or rewritten with the new evidence.

## Documentation Ownership Rule

Keep documentation organized by module and document type:

- same module + same document type: update the existing md instead of creating a
  new dated or duplicate file
- same module + different document type: keep separate md files, for example
  product prompt / PRD, acceptance cases, verification report, TSX handoff, and
  audit/handoff notes should not be merged into one catch-all file
- new md files are allowed only when no existing document for that module + type
  exists
- prefer stable names such as `docs/employer-home-acceptance-cases.md` over
  date-stamped names when the document is meant to keep evolving
- before creating a docs md, search for an existing module/type owner with `rg`
  or `find`

Preferred order for behavior changes:

```text
product source -> acceptance cases -> tests -> code -> browser check -> report
```

Use a different order only when impractical, and explain why in the final
report.

## Core Rule

Before claiming work is complete, run fresh verification for the changed surface:

- routine bug fixes should not run full package `build` or `test` by default;
  first use the smallest proof that exercises the changed behavior
- every new or changed test must have a clear source: product prompt/PRD, bug
  report, API contract, code invariant, design-system rule, or smoke baseline
- logic change with existing tests: run the directly affected test file(s), then
  broaden if risk is not isolated
- logic change without a matching test: add the smallest useful test first, watch
  it fail when practical, then implement/fix and watch it pass
- tests must include meaningful boundary cases, not only the happy path
- service / store / hook / shared / cross-page behavior: run focused affected
  tests first; broaden to a package suite only when the shared risk is not
  isolated
- UI or product flow change: use Browser / Playwright-style automation to open
  the page, click the changed path, and record mismatches
- UI boundary cases must check layout, not just logic: empty data, long text,
  many items, error/loading/disabled states, and the 375px mobile baseline.
  Check narrower/wider mobile widths such as 320px and 430px when the change is
  layout-sensitive.
- mock server logic: run `node --check` for changed JS plus focused mock tests
  when present
- no unit test or browser path is practical: state what was not verified; run
  the closest build/check only when the risk justifies it or the user asks

Only skip verification when the user explicitly asks not to run it or the
environment cannot run it. If skipped, say why and what should be run next.

## Unit And Logic Tests

Use `git diff --name-only` and `git status --short` to choose the smallest
useful test command. Full package suites are escalation options, not the
routine default:

```bash
pnpm --dir qianxun-shared test
pnpm --dir qianxun-h5-candidate test
pnpm --dir qianxun-h5-employer test
pnpm --dir qianxun-mock-server test
pnpm --dir qianxun-h5-candidate test:e2e
pnpm --dir qianxun-h5-employer test:e2e
```

For focused Vitest runs:

```bash
pnpm --dir qianxun-h5-candidate exec vitest run tests/authSession.test.ts
pnpm --dir qianxun-h5-employer exec vitest run tests/taskCatalog.test.ts
pnpm --dir qianxun-shared exec vitest run tests/messageUi.test.ts
```

Good places to add missing tests:

- service adapter mapping, error normalization, request parameters
- Zustand actions, persistence migration, permission guards
- presentation helpers, task/card/message state derivation
- mock server business rules that can be exercised with `node --test`
- bug fixes where a regression test can fail before the fix

Boundary examples:

- empty lists, empty input, invalid input, duplicate submit
- missing optional API fields, unknown enum/status, 401/403/500 responses
- maximum/long text values, large counts, zero counts
- disabled/loading/retry states and repeated clicks

Do not force unit tests for pure copy/style-only changes.

## Test Source Traceability

When adding or changing tests, record where the case came from. Use a short code
comment, test title wording, or final report entry.

Common sources:

- `Product prompt / PRD`: user-facing requirement or acceptance criterion
- `Bug regression`: a reproduced bug or mismatch
- `API contract`: Swagger field, endpoint, enum, required param, or error code
- `Code invariant`: service/store/helper behavior that must remain true
- `Design-system rule`: mobile layout, token, component, or accessibility rule
- `Smoke baseline`: app shell, login, routing, tab, and basic render health

If a test is exploratory or agent-derived, say that plainly. Do not imply it came
from product requirements.

When product requirements change, update related test cases and tests in the
same change. A green test suite that still checks old requirements is not valid
verification.

## Browser / Playwright-Style Checks

For UI, routing, form, modal, tab, message, login, or product workflow changes:

1. Start the relevant local service or confirm it is already running.
2. Open the C or B H5 page at the expected local URL.
3. Drive the changed flow by clicking/typing like a user.
4. Check console errors, broken requests, visual overlap, missing states, and
   whether the result matches the product expectation.
5. Include at least one relevant boundary UI state when practical.
6. Record mismatches instead of hiding them.

Use the available Browser tool for interactive checks. If a durable regression
test is needed later, add a real Playwright setup/spec as a separate task.

Mismatch report shape:

```text
Flow checked:
Boundary case:
Expected:
Actual:
Evidence: screenshot/log/route
Likely owner file:
Severity:
```

## Build And Static Checks

Keep build/type checks as separate, heavier verification. Do not run them for
ordinary bug fixes unless at least one condition is true:

- the user explicitly asks for build/test
- release, merge, PR, or human handoff requires broader confidence
- dependency, build config, environment config, generated API, or shared public
  contract changed
- the failure is a compile/type/build regression
- no smaller command or browser path can prove the changed surface

```bash
pnpm --dir qianxun-shared build
pnpm --dir qianxun-h5-candidate build
pnpm --dir qianxun-h5-employer build
pnpm --dir qianxun-weapp build:weapp
node --check qianxun-mock-server/src/server.js
node --check qianxun-mock-server/src/db.js
```

## Mapping

- `qianxun-shared/src`: shared tests; affected H5 tests if shared UI/API
  behavior changed; browser check if visual behavior changed.
- `qianxun-h5-candidate/src`: candidate tests; browser check for changed C端 UI
  or flow.
- `qianxun-h5-employer/src`: employer tests; browser check for changed B端 UI or
  flow.
- `qianxun-mock-server/src`: mock-server tests and `node --check`; affected H5
  tests/browser checks if API behavior changed.
- `qianxun-weapp/src`: no unit test script is currently defined; use
  browser/manual shell checks first, and run `build:weapp` only for shell,
  config, dependency, or release/merge risk.
- generated Swagger/API updates: run affected package tests after adapter
  changes, not only API generation.

## Final Report

Always include:

```text
Product source:
- file/section or user request
Product-source changes:
- updated / unchanged / missing, with reason
Test sources:
- test/flow: source
Tests run:
- command: result
Browser flows checked:
- flow: result
Build/check run:
- command: result
Not verified:
- area: reason
Mismatches found:
- ...
```
