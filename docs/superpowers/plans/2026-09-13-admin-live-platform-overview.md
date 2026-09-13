# Admin Live Platform Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make only the admin Dashboard top platform totals advance every five minutes without creating business records.

**Architecture:** A focused Mock-server module owns process-local cumulative counters. Only Dashboard `overview` reads that state, while all order, task, acceptance, detail, and result views continue to use the weekly snapshot.

**Tech Stack:** Node.js ESM Mock middleware, React, TypeScript, TanStack Query

---

### Task 1: Add the live cumulative model

**Files:**
- Create: `apps/sprix-admin/mock/live-platform-overview.mjs`

- [x] Define the five-minute interval and the four approved baseline totals.
- [x] Advance all missed intervals when the snapshot is read.
- [x] Increase the top order counter by 1–5 per interval, increase the top amount by simulated transaction values, keep task masters fixed, and independently increase the top Agent counter by 1–5.

### Task 2: Serve live values from the Dashboard endpoint

**Files:**
- Modify: `apps/sprix-admin/mock/server.mjs`

- [x] Overlay live values only onto the Dashboard `overview` fields.
- [x] Keep cached business metrics, ranges, historical records, Agent ecosystem, and operation counts unchanged.

### Task 3: Isolate live counters from business records

**Files:**
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`
- Modify: `apps/sprix-admin/mock/admin-views.mjs`
- Modify: `apps/sprix-admin/mock/server.mjs`

- [x] Do not expose available task seeds to the live counter module.
- [x] Keep paged orders, task details, delivery results, and artifacts unchanged.
- [x] Keep task execution totals, completed totals, remaining slots, and status unchanged.
- [x] Keep acceptance-center Agent totals on the weekly snapshot.

### Task 4: Refresh only the top snapshot

**Files:**
- Modify: `apps/sprix-admin/src/admin/useDashboardAnalytics.ts`
- Modify: `apps/sprix-admin/src/admin/DashboardBusinessMetrics.tsx`
- Modify: `apps/sprix-admin/src/admin/AdminDashboard.tsx`
- Modify: `apps/sprix-admin/src/admin/DashboardOrders.tsx`
- Modify: `apps/sprix-admin/src/services/dashboardRecords.ts`

- [x] Refetch the Dashboard query every five minutes while the page is active.
- [x] Keep cumulative amount and order metrics non-interactive; retain the historical six-week order view.

### Task 5: Non-test verification

**Files:**
- Inspect all files above.

- [x] Run `node --check` for changed `.mjs` files.
- [x] Inspect the focused diff and confirm that cumulative tasks never change in the live model.
- [x] Do not run tests or Playwright, per project instructions.
