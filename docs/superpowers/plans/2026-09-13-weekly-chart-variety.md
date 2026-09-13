# Weekly Chart Variety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将四张周经营折线图改为更符合数据语义的组合图、柱状图、堆叠柱状图和热力矩阵。

**Architecture:** 保留 `BusinessWeek` 数据结构和现有 Tooltip 组件，仅替换 `DashboardBusinessMetrics.tsx` 中的 SVG 图形表达，并在 `dashboard.css` 中补充对应图元样式。

**Tech Stack:** React 18、TypeScript、原生 SVG、CSS

---

### Task 1: 替换四张周图的 SVG 表达

**Files:**
- Modify: `apps/sprix-admin/src/admin/DashboardBusinessMetrics.tsx`

- [ ] 将 GMV 系列改为柱状图并保留有效 Agent 折线。
- [ ] 将异构比例折线改为单系列柱状图。
- [ ] 将两类待结算折线改为同周堆叠柱。
- [ ] 将质检多折线改为任务类型乘周次热力矩阵。
- [ ] 保留现有 Hover 数据和键盘聚焦入口。

### Task 2: 更新图形样式与静态验证

**Files:**
- Modify: `apps/sprix-admin/src/admin/dashboard.css`

- [ ] 添加组合柱、堆叠柱、热力格及热力图图例样式。
- [ ] 运行 `pnpm --filter @sprix-ai/admin typecheck`，预期 TypeScript 检查通过。
- [ ] 运行 `git diff --check`，预期无格式错误。
- [ ] 按项目规则不运行测试或 Playwright。
