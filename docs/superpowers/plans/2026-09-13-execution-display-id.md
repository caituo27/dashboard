# Sprix Admin 执行记录业务编号 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 16,251 条 Excel 5.1 Mock 执行记录生成唯一的 `EXE-YYYYMMDD-NNNNNN` 业务编号，并在管理端所有相关界面统一展示，同时保留内部 `demo:` 主键。

**Architecture:** Mock 事实层新增 `executionNo`，内部查询、路由和写操作继续使用 `executionId`。界面通过一个统一的展示函数优先读取 `executionNo`，真实后端没有该字段时回退显示原始 `executionId`。

**Tech Stack:** Node.js ESM、React、TypeScript、Ant Design、Sprix Admin HTTP Mock

---

### Task 1: 生成并传播业务执行编号

**Files:**
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`

- [ ] **Step 1: 增加编号生成函数**

在 `businessExecutionRecord()` 已生成 `submittedAt` 后，按日期和全局执行序号生成：

```js
const executionNo=(index,submittedAt)=>`EXE-${submittedAt.slice(0,10).replaceAll('-','')}-${String(index).padStart(6,'0')}`;
```

- [ ] **Step 2: 在同一事实链传播编号**

为执行记录增加 `executionNo`，并在任务详情完成记录、申诉记录及执行结果中从对应执行记录透传该字段。`executionId` 保持 `demo:business-execution:${index}` 不变。

### Task 2: 扩展前端记录类型和展示工具

**Files:**
- Modify: `apps/sprix-admin/src/types.ts`
- Modify: `apps/sprix-admin/src/services/sprixApi.ts`
- Modify: `apps/sprix-admin/src/services/dashboardRecords.ts`
- Modify: `apps/sprix-admin/src/utils/displayText.ts`

- [ ] **Step 1: 为相关类型增加可选字段**

在运行中、待验收、已终止、已完成、申诉、执行结果和订单行类型上增加：

```ts
executionNo?: string;
```

- [ ] **Step 2: 提供统一展示函数**

新增纯展示函数，不改变请求参数：

```ts
export function displayExecutionId(record: {executionNo?: string; executionId?: string}): string {
  return record.executionNo || (record.executionId ? displayText(record.executionId) : "-");
}
```

- [ ] **Step 3: 保留真实后端兼容**

后端映射不构造虚假业务编号；若响应存在 `executionNo` 则透传，否则界面回退到真实 `executionId`。订单聚合行同步传递 `executionNo`。

### Task 3: 替换运营界面的执行编号展示

**Files:**
- Modify: `apps/sprix-admin/src/admin/AdminPages.tsx`
- Modify: `apps/sprix-admin/src/admin/DashboardOrders.tsx`

- [ ] **Step 1: 更新平台验收与结果详情**

验收中心列表、验收详情、任务执行详情和执行结果详情使用 `displayExecutionId(record)`。所有跳转、查询、审批和驳回仍使用 `record.executionId`。

- [ ] **Step 2: 更新任务执行记录与申诉展示**

运行中、待验收、已完成、已终止的记录详情，以及申诉列表和申诉详情，统一优先显示 `executionNo`。

- [ ] **Step 3: 更新驾驶舱订单抽屉**

订单抽屉的执行 ID 列显示 `executionNo`，详情链接仍携带内部 `executionId`。

### Task 4: 支持业务编号搜索

**Files:**
- Modify: `apps/sprix-admin/mock/record-order.mjs`

- [ ] **Step 1: 扩展搜索字段**

将 `row.executionNo` 加入非任务记录全文搜索字段，同时保留 `row.executionId`，使两种编号均可检索。

### Task 5: 静态验证与差异检查

**Files:**
- Inspect: all files modified above

- [ ] **Step 1: 检查模块语法**

对改动的 `.mjs` 文件执行 `node --check`，预期退出码为 0。

- [ ] **Step 2: 检查编号不变量**

动态生成全部 16,251 条记录，断言 `executionNo` 全部唯一、符合 `^EXE-\d{8}-\d{6}$`，并抽查同一记录在验收详情、任务详情、申诉和执行结果中的编号一致。

- [ ] **Step 3: 检查内部 ID 未变化**

断言内部 `executionId` 仍符合 `^demo:business-execution:\d+$`，详情解析继续返回对应记录。

- [ ] **Step 4: 检查搜索与代码差异**

直接调用记录过滤函数确认业务编号可命中，运行 `git diff --check`。按项目规则不运行测试、构建、Playwright 或浏览器自动化。
