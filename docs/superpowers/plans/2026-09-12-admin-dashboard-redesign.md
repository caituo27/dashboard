# Admin Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Rebuild the Sprix admin Dashboard around cumulative platform scale, period business results, the real task lifecycle, Agent health, supply, traffic, and drilldowns.

**Architecture:** Extend the existing centralized Dashboard snapshot returned by `apps/sprix-admin/mock`, then render it through focused React sections coordinated by `AdminDashboard`. Keep cumulative totals independent from the selected range, derive all period data in the Mock layer, and reuse the existing task-list query parameters and analytics detail drawer for drilldowns.

**Tech Stack:** React 18, TypeScript, Ant Design, lucide-react, Vite, deterministic Node.js Mock modules, existing CSS tokens.

---

### Task 1: Extend the centralized Dashboard contract

**Files:**
- Modify: `apps/sprix-admin/src/services/dashboardAnalyticsMock.ts`
- Modify: `apps/sprix-admin/mock/analytics-data.mjs`
- Modify: `apps/sprix-admin/mock/analytics-events.mjs`
- Modify: `apps/sprix-admin/mock/admin-views.mjs`
- Modify: `apps/sprix-admin/mock/dashboard-aggregation.mjs`
- Modify: `apps/sprix-admin/src/admin/useDashboardAnalytics.ts`

- [x] Add typed `businessResults`, `taskOperations`, `businessTrends`, `agentEcosystem`, daily UV/PV series, and behavior ranking fields to `DashboardAnalyticsSnapshot`.
- [x] Generate the exact approved Mock values in `createAnalyticsSnapshot`; scale period series deterministically for 7-day, 30-day, four-week, and custom ranges.
- [x] Set cumulative values to orders `1_706_482`, tasks `1_428_376`, users `18_463`, agents `30_218`, amount `10_284_630` without tying them to range filters.
- [x] Update aggregation and live/demo merging so the new presentation snapshot is preserved and no negative or inconsistent ratio is introduced.
- [x] Run `pnpm --filter @sprix-ai/admin typecheck`; expect exit code 0.

### Task 2: Build business-result and task-operation sections

**Files:**
- Create: `apps/sprix-admin/src/admin/DashboardBusinessResults.tsx`
- Create: `apps/sprix-admin/src/admin/DashboardTaskOperations.tsx`
- Modify: `apps/sprix-admin/src/admin/DashboardOverview.tsx`

- [x] Replace five standalone platform cards with one five-column cumulative summary surface.
- [x] Implement the dominant weekly accepted GMV block, task value, accepted-task total, and subordinate Agent metrics using only snapshot data.
- [x] Implement the horizontal lifecycle `发布任务 → Agent 接单 → 执行完成 → 验收通过` and the three efficiency blocks with numerator and denominator.
- [x] Make every metric and lifecycle node a keyboard-accessible button when it has a drilldown callback.
- [x] Re-read the components and confirm none contains hard-coded business Mock values.

### Task 3: Build trends, Agent ecosystem, and task supply

**Files:**
- Create: `apps/sprix-admin/src/admin/DashboardBusinessTrend.tsx`
- Create: `apps/sprix-admin/src/admin/DashboardAgentEcosystem.tsx`
- Create: `apps/sprix-admin/src/admin/DashboardSupplyAnalysis.tsx`

- [x] Implement a single-metric business bar chart with the five approved selectors and clickable bars.
- [x] Implement compact Agent totals and the active/accepting Agent two-series line chart.
- [x] Replace the category pie with horizontal category bars and a Tab for publication trend.
- [x] Navigate category clicks to `/tasks?category=<value>` and publication clicks to `/tasks?publishedDate=<date>`.
- [x] Confirm charts include accessible labels and native SVG titles for hover values.

### Task 4: Consolidate traffic and key behaviors

**Files:**
- Rewrite: `apps/sprix-admin/src/admin/DashboardAnalytics.tsx`
- Modify: `apps/sprix-admin/src/admin/AnalyticsDetails.tsx`
- Modify: `apps/sprix-admin/src/admin/AnalyticsEvents.tsx`

- [x] Replace repeated UV/PV cards with three compact values and one dual-series UV/PV chart.
- [x] Replace the current funnel and button-card layout with the approved key-behavior ranking table.
- [x] Extend `AnalyticsSelection` so UV, PV, behavior, lifecycle stage, Agent metric, and business-trend drilldowns open the existing detail drawer with the selected range.
- [x] Keep event filtering aligned with the selected behavior and use real event identifiers in API queries.
- [x] Confirm displayed behavior names are `查看任务详情`, `接单`, `提交成果`, and `验收任务`.

### Task 5: Recompose the Dashboard page and style system

**Files:**
- Rewrite: `apps/sprix-admin/src/admin/AdminDashboard.tsx`
- Rewrite: `apps/sprix-admin/src/admin/dashboard.css`
- Modify: `apps/sprix-admin/src/index.css` only if a shared admin token or reusable control state is required.

- [x] Build the approved header with update time, range buttons, custom range, and complete Beijing-time range text.
- [x] Compose modules in the exact approved order and connect navigation and detail callbacks.
- [x] Use the existing white surface, light border, 8px radius, teal accent, compact spacing, and 12-column desktop grid.
- [x] Add responsive layouts for medium and small screens without changing routes or the shell.
- [x] Search visible Dashboard code for rejected terminology and remove any occurrence.

### Task 6: Verify the completed diff

**Files:**
- Inspect all files changed in Tasks 1-5.

- [x] Run `git diff --check`; expect no whitespace errors.
- [x] Run `pnpm --filter @sprix-ai/admin build`; expect TypeScript and Vite build success.
- [x] Inspect the final diff to ensure API base, auth, router foundation, deployment, and build configuration are unchanged.
- [x] Confirm all approved Mock values are centralized in `apps/sprix-admin/mock` and all requested interactions have callbacks.
- [x] Do not run unit tests or Playwright because the repository instructions prohibit them unless explicitly requested by the user.
