# Admin Dashboard Reference Redesign Implementation Plan

**Goal:** 将现有经营数据看板按用户参考图重组为清晰、紧凑的浅色经营驾驶舱，同时完整保留 Excel 5.1 数据和已有交互。

**Architecture:** 保持 Dashboard 的现有接口入口和弹层交互；由 Mock 服务统一派生日筛选结果、相交完整周结果和同口径任务规模；重写 `DashboardBusinessMetrics` 展示层，用轻量 SVG/CSS 图表呈现同一份 `BusinessMetrics`；新增独立 Dashboard 样式前缀，避免影响其他业务页面。

**Tech Stack:** React、TypeScript、Ant Design Table、lucide-react、CSS、原生 SVG。

---

### Task 1: 调整页面壳层和页头

**Files:**
- Modify: `apps/sprix-admin/src/admin/AdminDashboard.tsx`
- Modify: `apps/sprix-admin/src/components/Layout.tsx`
- Modify: `apps/sprix-admin/src/index.css`

1. 将页头标题和副标题调整为参考图语义。
2. 为刷新按钮和侧边栏选中态增加明确类名，保留日期筛选与真实路由。
3. 将 Dashboard 所在后台壳层调整为浅蓝灰工作区和薄荷绿选中态，不增加资金管理菜单。

### Task 2: 重组经营看板展示层

**Files:**
- Modify: `apps/sprix-admin/src/admin/DashboardBusinessMetrics.tsx`

1. 实现六张 KPI 卡以及真实周环比提示。
2. 实现经营概览、任务履约、类型分布、质量与收入四个分区。
3. 用原生 SVG/CSS 组合图、堆叠条形图和折线图替代全宽原始表格堆叠。
4. 保留 GMV 弹层、任务中心和任务类型下钻。

### Task 3: 完成全局日期口径

**Files:**
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`
- Modify: `apps/sprix-admin/mock/business-metrics.test.mjs`
- Modify: `apps/sprix-admin/src/services/dashboardAnalyticsMock.ts`
- Modify: `apps/sprix-admin/src/admin/useDashboardAnalytics.ts`

1. 日新增、日交付和任务类型排名按所选日期过滤。
2. GMV、有效 Agent、异构性和质量保留相交整周口径。
3. 任务主记录、总名额、执行记录、剩余名额由同一所选任务集合计算。
4. 保留筛选器加载态，移除旧范围占位数据并支持请求取消。
5. 允许选择 09.07–09.12 并显示截止日之后的明确无数据状态。

### Task 4: 完成视觉样式和实际验证

**Files:**
- Modify: `apps/sprix-admin/src/admin/dashboard.css`

1. 添加 `executive-*` 样式，包括面板、图表、KPI、任务链路、金额表和结算卡。
2. 添加 1180px、820px、560px 响应式规则和减少动画规则。
3. 运行经营数据测试、TypeScript 类型检查、构建和 `git diff --check`。
4. 启动本地页面，验证全范围、单周、非完整周、截止日后无数据、刷新和快速切换；检查桌面及窄屏截图。

### Task 5: 明确期间、周度和截止快照层级

**Files:**
- Modify: `apps/sprix-admin/mock/business-metrics.test.mjs`
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`
- Modify: `apps/sprix-admin/src/admin/AdminDashboard.tsx`
- Modify: `apps/sprix-admin/src/admin/DashboardBusinessMetrics.tsx`
- Modify: `apps/sprix-admin/src/admin/dashboard.css`

1. 将任务规模改成固定的 2026-09-06 截止快照，不随查询开始日期变化。
2. 将六张 KPI 拆成“所选期间”和“最新统计周”两个三卡分组。
3. 将任务规模独立为截止快照横条，将两类交付金额留在周度结算区域。
4. 将顶部说明精简为“所选日期累计 / 相交整周 / 截至统计日”三种口径标签。
5. 按项目规则只运行非测试静态检查和生产构建；浏览器自动化留给明确要求验证的回合。

### Task 6: 修正类型分布图的数量语义

**Files:**
- Modify: `apps/sprix-admin/src/admin/DashboardBusinessMetrics.tsx`
- Modify: `apps/sprix-admin/src/admin/dashboard.css`

1. 将各周 Agent 类型堆叠条从 100% 归一化改为共享最大值的绝对数量刻度。
2. 增加 0、中位刻度和最大刻度，并明确“条长代表数量、颜色代表类型”。
3. 移除日交付 SVG 的浏览器原生标题提示，保留可访问名称，避免滚动时悬浮提示跨模块残留。
