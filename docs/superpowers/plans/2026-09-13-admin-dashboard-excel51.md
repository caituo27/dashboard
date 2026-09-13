# Sprix Admin Excel 5.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Sprix Admin Dashboard and mock-backed admin modules use the approved Excel 5.1 task, execution, acceptance, delivery-mode, GMV, and settlement totals.

**Architecture:** Keep one deterministic business generator in `business-metrics.mjs`. Generate 10,834 lazy task records and 16,251 lazy execution records from the six weekly category controls, then let Dashboard, task pagination, acceptance pagination, and appeal pagination consume those records. Preserve real API merging and use the business generator only for demo rows.

**Tech Stack:** Node.js ESM mock middleware, React, TypeScript, Ant Design, CSS.

**Project exception:** The repository explicitly prohibits tests and Playwright unless requested in the current turn and prohibits commits unless requested. This plan therefore uses read-only Node data audits, syntax checks, `git diff --check`, and focused source inspection only.

---

### Task 1: Replace the single-execution mock model

**Files:**
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`

- [ ] Define the Excel 5.1 weekly controls, including the 39% final-week rate for “其他”.
- [ ] Define category totals for 10,834 tasks, 18,370 slots, 16,251 executions, and 2,119 remaining slots.
- [ ] Allocate weekly category totals deterministically to days, tasks, slots, executions, effective Agents, accepted amounts, and delivery modes.
- [ ] Expose lazy task, execution, acceptance, appeal, detail, and result record helpers.
- [ ] Add a read-only audit export that reports every global and weekly reconciliation difference.

### Task 2: Serve the shared records to every admin module

**Files:**
- Modify: `apps/sprix-admin/mock/admin-views.mjs`
- Modify: `apps/sprix-admin/mock/server.mjs`

- [ ] Route demo task pages to 10,834 task masters and order/acceptance pages to 16,251 execution records.
- [ ] Route appeals to the generated appeal records and keep category/status/date/search filters.
- [ ] Resolve task, acceptance, appeal, and execution-result detail requests through the same business generator.
- [ ] Keep the legacy ledger as fallback for mutable demo actions and unrelated endpoints.

### Task 3: Extend the Dashboard contract

**Files:**
- Modify: `apps/sprix-admin/src/services/dashboardAnalyticsMock.ts`
- Modify: `apps/sprix-admin/src/admin/DashboardBusinessMetrics.tsx`

- [ ] Add task-master, slot, execution, remaining-slot, daily-delivery, daily-effective-Agent, automatic-delivery, and manual-upload fields.
- [ ] Display task/slot conservation in the KPI area.
- [ ] Show daily delivery tasks against daily effective Agents.
- [ ] Rename settlement explanations to describe final delivery paths.
- [ ] Keep weekly GMV at weekly granularity and retain the six category tables.

### Task 4: Align module copy and counters

**Files:**
- Modify: `apps/sprix-admin/src/admin/AdminPages.tsx`
- Modify: `apps/sprix-admin/src/admin/dashboard.css`

- [ ] Change acceptance counters and explanatory copy from “pending-only review” to all generated acceptance records.
- [ ] Show Agent automatic delivery and manual upload clearly without changing backend contracts.
- [ ] Add compact Dashboard styles for the new reconciliation strip and dual-series daily chart.

### Task 5: Verify the generated data and final diff

**Files:**
- Inspect: all files changed by Tasks 1–4

- [ ] Run `node --check` on modified mock ESM files.
- [ ] Run a read-only Node audit that checks all Excel 5.1 global, weekly, category, daily, delivery-mode, GMV, and settlement equations.
- [ ] Run `git diff --check`.
- [ ] Inspect the focused diff and report that tests, build, and Playwright were not run under the project rule.
