# Excel 5.1 全类型任务参考数据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将用户提供的 112 条去重非数据标注参考任务接入 Sprix Admin mock，并更新 Excel 5.1 的 40 条非数据标注任务样例，同时严格保留六类数量和经营控制数。

**Architecture:** 将参考附件解析成只读静态数据模块，再由独立模板选择模块完成六类映射、确定性轮播、批次命名和附件生成。Excel 5.1 业务快照与通用 demo 场景复用该模板逻辑；工作簿只替换目标文本字段，不修改数字和汇总结构。

**Tech Stack:** Node.js ESM、Sprix Admin mock、`@oai/artifact-tool`、Excel `.xlsx`

---

### Task 1: 固化去重后的参考任务数据

**Files:**
- Create: `apps/sprix-admin/mock/other-task-reference-data.mjs`

- [ ] **Step 1: 解析五份 TSV 文本**

使用 Python 标准库 `csv` 以制表符和双引号规则读取五份附件，字段固定为 `sourceId`、`title`、`sourceCategory`、`sourceType`、`description`、`deliverables`、`acceptanceCriteria`、`referenceTotalAmount`、`referenceReward`、`estimatedTokens`、`referenceSlots`。

- [ ] **Step 2: 按来源编号去重**

保留第一次出现且四个核心文本字段完整的记录。输出计数必须为 FIN 16、CNT 11、OFF 20、MKT 12、WEB 16、UI 10、ADS 25、AGT 2，总计 112。

- [ ] **Step 3: 通过 apply_patch 写入静态模块**

导出冻结的 `OTHER_TASK_REFERENCE_ROWS`。运行时不读取 `/Users/yyx/.codex/attachments`，确保 mock 可独立启动。

### Task 2: 实现六类模板映射与附件生成

**Files:**
- Create: `apps/sprix-admin/mock/other-task-reference-templates.mjs`

- [ ] **Step 1: 建立分类模板池**

映射为：网站开发→WEB，营销→ADS，设计→UI，知识问答→CNT，其他→FIN/MKT/OFF/AGT 轮询混排。额外提供按来源前缀选择模板的函数，供通用 demo 场景使用。

- [ ] **Step 2: 实现确定性内容函数**

导出 `otherTaskReferenceContent(category, sequence, reward, totalSlots)`。首轮完整覆盖模板池；第二轮起追加六位批次号；返回标题、六类分类、来源类型、描述、交付、验收、预计 Token、附件名和提交摘要。

- [ ] **Step 3: 实现轻量输入附件**

导出 `otherTaskReferenceAttachmentFiles(taskId, category, sequence, reward, totalSlots, createdAt)`。每个任务生成 `任务背景说明.md` 与分类对应的 CSV/JSON 输入清单，并计算字节长度和 SHA-256；不伪造 PPTX/DOCX 二进制。

### Task 3: 接入 Excel 5.1 业务快照

**Files:**
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`

- [ ] **Step 1: 为任务蓝图增加分类内序号**

在生成 `taskBlueprints` 时维护六类累计序号 `typeSequence`，保证跨周轮播稳定且每类首轮完整覆盖。

- [ ] **Step 2: 更新非数据标注任务内容**

`businessTaskRecord()` 对数据标注继续使用现有模板，对另外五类调用 `otherTaskReferenceContent()`。保留 `MASTER_TOTALS`、`SLOT_TOTALS`、执行金额分配和周度数组，任务总金额仍按人均金额乘总名额计算。

- [ ] **Step 3: 扩展详情附件**

`businessTaskDetail()` 和 `businessTaskAttachment()` 对六类任务都返回可下载附件；数据标注走原附件函数，另外五类走新附件函数。

### Task 4: 接入通用 demo 场景

**Files:**
- Modify: `apps/sprix-admin/mock/business-scenario.mjs`

- [ ] **Step 1: 按现有细分类映射来源模板**

市场调研→MKT、AI 内容创作→CNT、企业经营 / 投融资咨询→FIN、UI 设计→UI、工具类→AGT、办公文档→OFF、网站开发类场景→WEB。翻译 / 本地化无对应样例，保留原内容。

- [ ] **Step 2: 保留场景数值和优先级**

仅覆盖任务文本、来源类型、预计 Token、附件名与提交摘要。现有 reward、索引、生命周期以及用户 patch 优先级不变。

### Task 5: 更新 Excel 5.1 非数据标注样例

**Files:**
- Create: `.tmp-xlsx-update/update-all-task-type-reference.mjs`
- Create: `outputs/20260913-excel5-all-task-types/sprixAI数据看板5.1_全类型任务版.xlsx`

- [ ] **Step 1: 导入数据标注任务版**

使用 `@oai/artifact-tool` 导入 `outputs/20260913-excel5-data-annotation/sprixAI数据看板5.1_数据标注任务版.xlsx`，保留十个工作表及原表格对象。

- [ ] **Step 2: 更新第 81 至 120 条样例**

按原分类维护分类内序号并调用新模板函数，只更新 E 任务名称、G 来源类型、H 详细描述、I 交付标准、J 验收标准、Q 附件。A、B、C、D、F、K 至 P、R、S、T 保持不变。

- [ ] **Step 3: 更新范围说明并导出**

将 A3 更新为全类型参考说明，导出唯一成品到指定目录，不覆盖输入工作簿。

### Task 6: 静态和工作簿验证

**Files:**
- Inspect: `apps/sprix-admin/mock/other-task-reference-data.mjs`
- Inspect: `apps/sprix-admin/mock/other-task-reference-templates.mjs`
- Inspect: `apps/sprix-admin/mock/business-metrics.mjs`
- Inspect: `apps/sprix-admin/mock/business-scenario.mjs`
- Inspect: `outputs/20260913-excel5-all-task-types/sprixAI数据看板5.1_全类型任务版.xlsx`

- [ ] **Step 1: 运行模块语法检查**

对四个目标 `.mjs` 文件运行 `node --check`，预期全部退出码为 0。

- [ ] **Step 2: 检查模板与数量不变量**

动态导入模块，断言来源模板总计 112，并检查六类任务主记录分别为 9,134、37、929、345、45、344；名额 18,370、执行 16,251、剩余 2,119、验收 GMV 1,699,400。

- [ ] **Step 3: 检查内容和附件不变量**

断言每类首轮标题不重复、第二轮标题带批次号、同一输入结果稳定；抽查六类详情附件的 `sizeBytes` 与下载字节一致，SHA-256 可重算一致。

- [ ] **Step 4: 检查任务预算关系**

遍历 10,834 条任务，断言 `totalAmount` 与 `reward × totalSlots` 的误差不超过 0.01，且周度验收金额数组未改变。

- [ ] **Step 5: 检查工作簿范围**

对比输入输出 `任务清单样例!A6:T125`，仅允许 E、G、H、I、J、Q 和 A3 变化；检查 40 条非数据标注行已更新，数字列逐格一致。

- [ ] **Step 6: 扫描和渲染**

扫描常见公式错误，渲染 `A76:T90`、`A106:T125`，确认分类边界、长文本和附件名可读。

- [ ] **Step 7: 检查差异并说明测试边界**

运行目标文件 `git diff --check`。按项目规则不运行单元测试、集成测试、构建、Playwright 或浏览器自动化，并在最终交付中明确说明。
