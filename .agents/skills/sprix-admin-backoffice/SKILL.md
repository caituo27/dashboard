---
name: sprix-admin-backoffice
description: >-
  Use when creating, editing, reviewing, or polishing SprixPortal
  apps/sprix-admin management pages, layouts, primitives, tables, filters,
  metrics, and admin workflows. Enforces a Sprix-themed backoffice/workbench UI:
  high information density, compact controls, table-first operations,
  restrained surfaces, and no API/schema/business behavior changes unless
  explicitly requested.
---

# Sprix Admin Backoffice

## Overview

Use this skill for Sprix Admin only: `SprixPortal/apps/sprix-admin`.
The goal is to keep Sprix's light, calm, slightly aurora visual identity while
making the admin app feel like an operations workbench instead of a product
landing page.

## Non-Negotiables

- Preserve API calls, schemas, auth flow, routes, data contracts, and business
  behavior unless the user explicitly asks to change them.
- Keep the existing Sprix theme tokens: black primary action, teal accent,
  white surfaces, soft pastel background, Inter UI text, and restrained borders.
- Prefer compact, scannable admin layouts over hero sections, marketing copy,
  decorative cards, oversized typography, and large rounded pill navigation.
- Keep destructive or state-changing operations explicit with confirmations
  already present in the app.
- Modify only the admin UI files needed for the request.

## Layout Direction

- Use a workbench shell: persistent left navigation, page title row, then
  metrics/toolbars/tables. Avoid a decorative top bar unless it carries real
  page-level controls.
- Page headers should be concise: eyebrow or section label, one clear title,
  optional short subtitle, and right-aligned actions. Avoid hero-scale spacing.
- Main data views should prioritize filters, segmented controls, search, table
  density, row actions, and batch-action bars.
- Detail pages should use summary strips and sectioned information blocks, then
  operational records/tables. Keep long text readable but not editorial.
- Keep responsive behavior practical: sidebar becomes stacked navigation on
  small screens; table scroll is acceptable for dense admin data.

## Component Rules

- Prefer shared primitives in `src/components/Primitives.tsx`.
- Use `Surface` for true panels and table containers, not decorative nested
  cards.
- Use `MetricCard` for compact operational counters; numbers should be clear
  but not landing-page sized.
- Use `StatusTag`/`SoftTag` for state and risk labels.
- Use Ant Design `Table`, `Tabs`, `Segmented`, `Input.Search`, `Modal`, and
  `Button` for admin controls instead of custom one-off controls.
- Keep card radius around 8-14px for admin surfaces unless an existing token
  requires otherwise. Avoid large 18-28px landing-page rounds.

## Styling Rules

- Source of truth: `apps/sprix-admin/src/index.css` `@theme` tokens and
  shared classes. Add reusable classes there instead of scattering one-off CSS.
- Keep the aurora background subtle and shallow; it should not dominate the
  first viewport.
- Avoid gradient hero blocks, decorative blobs, large shadows, and oversized
  serif headings in admin screens.
- Tables should have light header tint, stable row height, clear dividers, and
  readable fixed/right action columns.
- Buttons may keep Sprix black primary styling, but admin action groups should
  be compact and aligned to the data they affect.

## Verification

For UI-only admin changes, verify at least:

- `pnpm --filter @sprix-ai/admin build`
- Runtime browser check of `/tasks`, `/appeals`, and `/funds` when practical.
- Confirm the changed pages still render with existing data/loading/error paths
  and that no API/service files changed.
