---
name: swagger-update-workflow
description: >-
  End-to-end workflow for Qianxun Swagger/OpenAPI updates. Use when Swagger changes,
  generated API files are updated, API fields/types/endpoints change, frontend calls
  break after generation, or Codex must regenerate API clients and automatically find
  and update affected frontend service/page/mock-server code.
---

# Swagger Update Workflow

Use this skill whenever the backend Swagger/OpenAPI contract changes.

This skill is broader than `api-gen`: `api-gen` generates the client; this workflow
also finds affected frontend code, updates service adapters, syncs the mock server,
and reports what changed.

Important distinction: the API generator does not automatically update
`qianxun-mock-server`. Mock updates are a required workflow step for
frontend-facing Swagger contract changes.

## Goal

Keep generated API, frontend adapters, UI calls, and mock server in sync.

Do not stop after regenerating `src/apis`. A Swagger update is only handled when
the app builds and the affected flows have a clear handoff summary.

## Default Qianxun Targets

- Candidate H5 API:
  - Project: `qianxun-h5-candidate`
  - API dir: `qianxun-h5-candidate/src/apis`
  - Generated service: `candidate`
  - Service adapter: `qianxun-h5-candidate/src/services/candidateApi.ts`
- Employer H5 API:
  - Project: `qianxun-h5-employer`
  - API dir: `qianxun-h5-employer/src/apis`
  - Generated service: `employer`
- Mock server:
  - `qianxun-mock-server/src/server.js`
  - `qianxun-mock-server/src/db.js`

If the user does not say which side changed, inspect git status/diff to infer it.

## Workflow

### 1. Establish Scope

Run:

```bash
git status --short
git diff --stat
git diff --name-only
```

Identify whether the update affects:

- candidate API
- employer API
- both
- mock server only
- generated files already changed

If there is no local Swagger/generated diff and no URL was provided, ask for the Swagger URL or the command they used.

### 2. Regenerate If Needed

If generated API files are not already updated, use `api-gen` or run the configured generator:

```bash
cd qianxun-h5-candidate/src/apis && npx qxun-api-generator
cd qianxun-h5-employer/src/apis && npx qxun-api-generator
```

Only regenerate the affected side unless the user asks for both.

Do not hand-edit generated API files except for emergency investigation; fixes belong in Swagger, generator config, service adapters, or mock server.

### 3. Summarize Contract Changes

Diff generated API and Swagger JSON:

```bash
git diff -- qianxun-h5-candidate/src/apis/_swaggers qianxun-h5-candidate/src/apis/candidate/api.ts
git diff -- qianxun-h5-employer/src/apis/_swaggers qianxun-h5-employer/src/apis/employer/api.ts
```

Extract concrete changes:

- endpoint added / removed / renamed
- operation name changed
- request body changed
- query/path parameter changed
- response DTO changed
- field added / removed / renamed
- field type changed, such as `string` -> `number`
- required/optional changed
- enum values changed

Report these before or while implementing, so the user sees the protocol impact.

### 4. Update Swagger Change MD

Every Swagger pull must create or update a Markdown record. Do this even when the generated
files have no diff, because the product and frontend owner need to know what was checked.

Default location:

```bash
docs/swagger-updates/<scope>-swagger-update.md
```

Use one stable Markdown record per scope and document type. Update the existing
file on later Swagger pulls instead of creating a new dated duplicate. Put the
latest date inside the document body.

Use a concise, concrete document with these sections:

```md
# <scope> Swagger 更新记录

最后更新：YYYY-MM-DD

## 拉取范围

- Swagger URL:
- 生成范围:
- 是否有生成 diff:

## 接口变化

- Added:
- Removed:
- Changed:

## 需要更新的前端交互

- ...

## 已完成适配

- Service:
- Mock server:
- 页面 / 组件:

## 未完成 / 需要后端确认

- ...

## 验证

- ...
```

Rules:

- “需要更新的前端交互” must name user-visible flows, not only DTO names.
- If the Swagger still lacks an endpoint required by product, record it as a backend gap.
- If generated files have no diff, write that explicitly and still list whether any product gap remains.
- If multiple packages will be split into separate repos, update the copied skill file in each affected package as well.

### 5. Find Affected Frontend Calls

Search by old operation names, DTO names, fields, endpoint fragments, and request types.

Useful commands:

```bash
rg -n "oldOperation|newOperation|oldField|newField|DtoName|endpoint-fragment" qianxun-h5-candidate/src qianxun-h5-employer/src qianxun-mock-server/src
rg -n "defaultApi\\(\\)|runApi\\(\\)|candidateApi\\.|employerApi\\." qianxun-h5-candidate/src qianxun-h5-employer/src
```

Always inspect service adapters first:

- `qianxun-h5-candidate/src/services/candidateApi.ts`
- employer service adapter if present

Prefer adapting backend DTOs at service boundaries instead of changing pages/components directly.

### 6. Update Service Adapters

Service adapters should:

- Convert API DTOs into local domain types.
- Convert local IDs/fields into API request types.
- Hide backend naming quirks from pages.
- Throw clear errors for invalid conversions.
- Keep generated API types out of page components where possible.

Examples:

- If backend changes task id `string` -> `number`, keep frontend domain stable if that avoids broad UI churn, and convert at the adapter.
- If endpoint split/merged, create readable service methods matching product intent, not generator operation names.
- If upload changes to multipart, put FormData handling in service adapter, not component JSX.

### 7. Update Mock Server

For every frontend-facing contract change, update mock server shapes and routes:

- `qianxun-mock-server/src/server.js`
- `qianxun-mock-server/src/db.js`

Mock server should match the generated DTO shape closely enough for local development.
If a Swagger change is backend-only or not used by local H5 flows, record why no
mock update was needed in the Swagger update MD. Do not silently skip mock parity.

Run at least:

```bash
node --check qianxun-mock-server/src/server.js
node --check qianxun-mock-server/src/db.js
```

### 8. Fix Compile Errors

Swagger updates often have type fallout, but do not run H5 builds automatically
when the change is backend-only or not used by the app. Run the affected build
only when generated types/service adapters touched H5 code, the user asks, or
the update is being prepared for release/handoff:

```bash
pnpm --dir qianxun-h5-candidate build
pnpm --dir qianxun-h5-employer build
```

Use TypeScript errors as the todo list. Fix root adapter issues before patching many components.

### 9. Add Or Update TSX Handoff Docs If TSX Changed

If this workflow modifies any important `.tsx`, create or update the same-directory `.md` file required by `AGENTS.md`.

The doc must say:

- what the TSX does
- what is real
- what is demo/placeholder
- data source
- main interactions
- next human actions

### 10. Final Response

Final summary should include:

- Swagger update MD path
- Swagger/contract changes
- generated files touched
- service adapter changes
- mock server changes
- frontend call sites updated
- verification commands and result
- remaining backend/frontend gaps

Keep the summary concrete. Mention file paths.

## Completion Checklist

Before saying done, confirm:

- Generated API client matches latest Swagger.
- Affected service adapter compiles.
- Affected mock server route/data shape matches new DTO.
- No stale operation names remain.
- No stale DTO field names remain in business code.
- Swagger update MD exists and lists updated endpoints plus frontend interactions to update.
- Affected H5 build passes, or the report explains why no H5 build was needed.
- If TSX changed, same-directory `.md` handoff exists.

## Common Qianxun Patterns

- Candidate code should route generated API calls through `candidateApi`.
- Keep page components using domain models from `src/domain.ts`.
- Prefer `mapXxx(dto)` and `toXxxRequest(domain)` helpers in adapters.
- Use `qianxun-feature-completion` to check whether the protocol change preserves product flow.
- Use `qianxun-human-handoff` when the Swagger update leaves partial work.
