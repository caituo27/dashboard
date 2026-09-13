# 数据标注任务参考数据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以 `sprixai task1.xltx` 的 31 条任务及附件为内容参考，更新 Sprix Admin mock 与 Excel 5.1 任务清单样例，同时保持 5.1 经营控制数不变。

**Architecture:** 新增一个无外部运行时依赖的共享任务模板模块，业务快照和通用 ledger 都通过任务索引确定性选择模板。任务附件由模板声明元数据，并由 mock 服务按需生成可下载的轻量参考文件；Excel 只写入同一模板的任务字段和附件名，不嵌入大体积二进制。

**Tech Stack:** Node.js ESM、Sprix Admin mock、`@oai/artifact-tool`、Excel `.xlsx`

---

### Task 1: 建立共享数据标注任务模板

**Files:**
- Create: `apps/sprix-admin/mock/data-annotation-task-templates.mjs`

- [ ] **Step 1: 定义模板数据**

保存 31 条参考记录所需的 `title`、`description`、`deliverables`、`acceptanceCriteria`、来源金额/人均金额/名额和附件描述。20 条 ALE 领域任务通过领域名生成共同字段；重复的物流模板保留两条来源记录。

- [ ] **Step 2: 实现确定性选择函数**

导出 `DATA_ANNOTATION_TASK_TEMPLATES`、`dataAnnotationTaskTemplate(index, reward, totalSlots)` 和 `dataAnnotationTaskContent(...)`。选择先按现有 `reward` 与 `totalSlots` 的层级匹配来源层级，再以稳定索引分散模板；重复使用时在标题后追加稳定批次号。

- [ ] **Step 3: 实现附件元数据和内容函数**

每个模板声明一个或多个附件，例如 `ALE任务包标准.pdf`、`CTF-SOP规范.pdf`、`selected_1000_可交付清单.xlsx`。mock 下载内容使用 UTF-8 文本或 CSV/JSON 形式生成，不把 12 MB 的 OLE 二进制复制进仓库。

### Task 2: 将共享模板接入两套 mock 任务链路

**Files:**
- Modify: `apps/sprix-admin/mock/business-scenario.mjs`
- Modify: `apps/sprix-admin/mock/demo-ledger.mjs`
- Modify: `apps/sprix-admin/mock/business-metrics.mjs`

- [ ] **Step 1: 更新通用场景生成器**

当 `CATEGORY_BY_FAMILY[familyIndex] === '数据标注'` 时，用 `dataAnnotationTaskContent(index, reward, slotsHint)` 覆盖标题、说明、交付、验收、附件名与提交样例；非数据标注场景保持原逻辑。

- [ ] **Step 2: 更新最近 40 条任务覆盖**

将 `recentIndustrialTask()` 的三个泛化名称改为共享模板内容，保留当前任务索引、排序、金额和名额覆盖优先级。

- [ ] **Step 3: 更新 Excel 5.1 业务快照任务**

`businessTaskRecord()` 只对数据标注任务应用共享模板；继续用 `acceptedCents` 与现有执行/剩余名额计算 `reward`、`totalAmount`、`totalSlots`，不读取来源金额覆盖控制数。

- [ ] **Step 4: 补齐任务详情附件**

`businessTaskDetail()` 返回模板附件元数据，字段包含 `attachmentId`、`filename`、`sizeBytes`、`downloadUrl`；详情列表与任务内容来自同一模板。

### Task 3: 增加 mock 任务附件下载

**Files:**
- Modify: `apps/sprix-admin/mock/server.mjs`

- [ ] **Step 1: 增加只读下载路由**

新增 `/mock-api/admin/task-attachment?id=<taskId>&file=<attachmentId>` GET 处理器。它从共享模板按任务 ID 构建附件，设置 `Content-Type`、`Content-Length`、UTF-8 文件名和 `no-store`，不存在时返回 404。

- [ ] **Step 2: 保持现有执行结果附件路由不变**

不修改 `/mock-api/admin/artifact` 的语义，避免把任务输入附件与 Agent 交付附件混在一起。

### Task 4: 更新 Excel 5.1 任务清单样例

**Files:**
- Create: `.tmp-xlsx-update/update-data-annotation-reference.mjs`
- Create: `outputs/20260913-excel5-data-annotation/sprixAI数据看板5.1_数据标注任务版.xlsx`

- [ ] **Step 1: 导入最新后端字段版工作簿**

使用 `@oai/artifact-tool` 导入 `outputs/20260913-excel5-api-fields/sprixAI数据看板5.1_后端接口字段版.xlsx`，不增删、不改名、不重排工作表。

- [ ] **Step 2: 更新任务样例字段**

对 `任务清单样例!A6:T125` 中分类为“数据标注”的行，按任务编号末位索引和现有人均金额/总名额选择共享模板，更新任务名称、来源类型、描述、交付、验收和附件列。任务编号、日期、分页、金额、Token、名额、执行数、手机号、汇总标记和数据属性保持不变。

- [ ] **Step 3: 导出唯一成品**

导出到 `outputs/20260913-excel5-data-annotation/sprixAI数据看板5.1_数据标注任务版.xlsx`，不覆盖输入文件，不输出第二个工作簿版本。

### Task 5: 静态与工作簿验证

**Files:**
- Inspect: `apps/sprix-admin/mock/data-annotation-task-templates.mjs`
- Inspect: `apps/sprix-admin/mock/business-scenario.mjs`
- Inspect: `apps/sprix-admin/mock/demo-ledger.mjs`
- Inspect: `apps/sprix-admin/mock/business-metrics.mjs`
- Inspect: `apps/sprix-admin/mock/server.mjs`
- Inspect: `outputs/20260913-excel5-data-annotation/sprixAI数据看板5.1_数据标注任务版.xlsx`

- [ ] **Step 1: 运行模块语法检查**

运行 `node --check` 检查五个改动的 `.mjs` 文件，预期全部退出码为 0。

- [ ] **Step 2: 运行只读数据不变量脚本**

动态导入共享模板与 `business-metrics.mjs`，检查模板数为 31、字段完整、同索引结果稳定；检查业务汇总仍为任务 10,834、名额 18,370、执行 16,251、剩余 2,119、验收 GMV 1,699,400，并抽查 `totalAmount` 未被来源金额覆盖。

- [ ] **Step 3: 检查差异**

运行 `git diff --check`，并只审阅本次目标文件的 diff，确认没有改变非数据标注分类、API、Swagger、路由认证或生产配置。

- [ ] **Step 4: 检查工作簿内容与公式错误**

用 `workbook.inspect()` 检查 `任务清单样例!A1:T25` 和末尾样例行，扫描 `#REF!`、`#DIV/0!`、`#VALUE!`、`#NAME?`、`#N/A`、`#NUM!`、`#NULL!`、`#SPILL!`、`#CALC!`。对比关键金额、Token、名额和执行数字段与输入工作簿一致。

- [ ] **Step 5: 渲染视觉检查**

渲染 `任务清单样例!A1:T25` 和 `A106:T125`，确认任务名称、长描述、附件名称可读，表头、斑马纹、列宽和行高未被意外破坏。

- [ ] **Step 6: 明确未运行测试**

按项目规则不运行单元测试、集成测试、构建、Playwright 或浏览器自动化；最终交付中明确说明这一验证边界。
