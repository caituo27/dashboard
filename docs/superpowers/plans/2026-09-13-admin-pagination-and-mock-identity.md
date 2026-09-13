# Admin Pagination and Mock Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This repository explicitly forbids tests and browser automation unless the user requests them, so the steps use static verification instead of TDD.

**Goal:** Make every Sprix Admin list use 10 rows per page, keep the existing 40 Mock accounts and phones as stable one-to-one identities, and apply the same English-username and virtual-phone presentation to real backend records globally.

**Architecture:** Export one JavaScript pagination constant that both React and the Node Mock can consume. Extend the deterministic business profile with stable presentation fields bound to each of the 40 source accounts, propagate them through Mock records, normalize real backend identities in the API adapter, and use the shared phone component to show virtual numbers while retaining the original number in a modal.

**Tech Stack:** React, TypeScript, Ant Design, Node ESM Mock service.

---

### Task 1: Centralize the admin page size

**Files:**
- Create: `apps/sprix-admin/shared/pagination.mjs`
- Modify: `apps/sprix-admin/src/admin/AdminPages.tsx`
- Modify: `apps/sprix-admin/src/admin/DashboardOrders.tsx`
- Modify: `apps/sprix-admin/src/admin/AnalyticsEvents.tsx`
- Modify: `apps/sprix-admin/src/admin/AnalyticsDetails.tsx`
- Modify: `apps/sprix-admin/src/services/dashboardRecords.ts`
- Modify: `apps/sprix-admin/mock/analytics-events.mjs`
- Modify: `apps/sprix-admin/mock/business-scenario.mjs`

- [x] Export `ADMIN_PAGE_SIZE = 10` from the shared ESM module.
- [x] Import the constant into each list/request implementation and replace fixed `20` page sizes, query-key values, slices, and visible copy.
- [x] Search non-test admin sources for fixed 20-row pagination and remove every result.

### Task 2: Generate stable Mock presentation identities

**Files:**
- Modify: `apps/sprix-admin/mock/business-profile.mjs`
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`
- Modify: `apps/sprix-admin/mock/demo-ledger.mjs`
- Modify: `apps/sprix-admin/mock/demo-state.mjs`
- Modify: `apps/sprix-admin/mock/consumer-records.mjs`
- Modify: `apps/sprix-admin/src/types.ts`

- [x] Generate a fixed 10-character ASCII-letter username from the stable Mock identity key.
- [x] Generate a unique international-format virtual phone from the same normalized Mock identity key while retaining the complete source phone as `phone`.
- [x] Add optional `virtualPhone` fields to execution records and `userVirtualPhone` to appeal/fund record shapes, and normalize real backend mappings through the same presentation helper.
- [x] Propagate the same profile fields from execution records into acceptance and appeal records, including persisted consumer records during read migration.

### Task 3: Reveal real Mock phones in a modal

**Files:**
- Modify: `apps/sprix-admin/src/components/PhoneNumber.tsx`
- Modify: `apps/sprix-admin/src/admin/AdminPages.tsx`

- [x] Add an optional `virtualValue` prop to the shared phone component.
- [x] When `virtualValue` exists, render it as the clickable page value and open an Ant Design modal containing the full real Mock phone and copy action.
- [x] When `virtualValue` is absent, retain the current masked fallback behavior.
- [x] Pass record-level virtual phone fields in platform acceptance and appeal list/detail views, plus other Mock execution record phone views.

### Task 4: Static verification

**Files:**
- Inspect all modified files.

- [x] Run `rg` to confirm no admin UI or admin data-source fixed 20-row pagination remains; the one retained `20` default is the separate C-side consumer market endpoint.
- [x] Run `git diff --check` and inspect the focused diff.
- [x] Do not run tests, build, or Playwright under the project-level verification rule; report that boundary explicitly.

### Task 5: Stabilize the 40 Mock identities and retain capability metadata

**Files:**
- Modify: `apps/sprix-admin/mock/business-profile.mjs`
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`
- Modify: `apps/sprix-admin/mock/demo-ledger.mjs`
- Modify: `apps/sprix-admin/mock/demo-state.mjs`
- Modify: `apps/sprix-admin/mock/consumer-records.mjs`
- Modify: `apps/sprix-admin/mock/business-identity.test.mjs`

- [x] Keep the supplied 40 accounts and phones as the complete identity pool and distribute each chronological block of 40 records across 40 distinct identities.
- [x] Define centralized capability keywords for website development, marketing, design, data annotation, knowledge Q&A, and other tasks without using them to remap identity.
- [x] Bind username, virtual phone, and specialty one-to-one to the source real Mock phone instead of the task category.
- [x] Propagate the selected specialty through execution and appeal records so both centers share the same identity.
- [x] Run non-test syntax, diff, and data consistency diagnostics.
- [x] Refine matching with title-level subject and delivery-format scoring before category fallback.
- [x] Exclude task-detail and acceptance-criteria prose from capability scoring so negative constraints cannot introduce unrelated specialties.
