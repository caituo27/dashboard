# Unified admin presentation data

The admin preserves live backend reads for management pages and adds independent synthetic records.
The core Dashboard period is a fixed, deterministic operating dataset sourced
read-only from `sprixAI数据看板4.0.xlsx` (`Sheet1`, rows 3-43): 2026-07-27
through 2026-09-06. Its cards, daily Agent split, weekly GMV, task type counts,
quality rates, settlement formulas, task drilldowns and order drilldowns share
the snapshot id `sprix-excel-v5.1-2026-09-06`.
`src/services/pagedAdminData.ts` merges real and synthetic pages in chronological
order. `adminDataSource.ts` routes details and mutations. The Dashboard reads one
compact, cached Mock summary and does not materialize the virtual order ledger;
task totals, category distribution and publication trends use the deterministic
analytics model. Task/detail Mock views remain separately materialized only when
their rows are requested; list queries keep lightweight numeric indexes and
instantiate business records only for the returned page.

## HTTP endpoints

- `GET /mock-api/dashboard/analytics?startDate=2026-07-27&endDate=2026-09-06`: Excel 4.0 core business snapshot.
- `GET /mock-api/dashboard/analytics?days=7|28|30`: behavior analytics snapshot used by the separate behavior-analysis menu.
- `GET /mock-api/admin/state`: seed plus persisted demo changes.
- `POST /mock-api/admin/actions`: `{ id, action, payload }` for demo-only writes.

Both Vite dev and preview mount the middleware. Standalone:
`pnpm --filter @sprix-ai/admin mock` (127.0.0.1:5176 by default).
`MOCK_PORT` and `MOCK_HOST` can override the listener. A static production build
needs a running service and same-origin reverse proxy for `/mock-api/`.
No production deployment/proxy changes have been made.

## Data and identity

The baseline at 2026-09-12 12:00 Asia/Shanghai is approximately 1.7 million
orders, 30,000 Agents, RMB 10 million of order rewards, 45 days of operation.
All clients share the same deterministic timeline. Server snapshots use the
request time. The Dashboard does not poll automatically: the user-triggered
refresh requests a new snapshot, including data generated since the previous
refresh. Task edit forms opt out so background refresh cannot overwrite edits.

The pure `demo-ledger.mjs` exposes virtual tasks and linked executions, acceptance
records, settlements, withdrawals and appeals from the seed.
Each task has 9 to 32 generated executions; all demo IDs use the reserved `demo:` prefix.
Only the compact seed and explicit patches cross HTTP, not 1.7 million records.
The Mock HTTP service keeps only lightweight state and numeric indexes on the
server. Task and execution objects are created for the requested page or detail;
Dashboard requests use the compact summary cache and never trigger ledger
materialization.
The browser receives a compact dashboard summary, paginated list rows and requested
details only. `/mock-api/admin/view` supports list kinds, offset/limit (max 100),
filters and a snapshot version; previous versions are briefly retained for stable
boundary queries. No full Mock task/finance list is transferred to the browser.

Real and synthetic rows are merged by business timestamp descending, then stable
ID for ties. Task lists use publication time, acceptance lists submission time,
orders their current status timestamp, appeals submission time, and finance lists
the corresponding record time. Unknown timestamps sort last. Binary partition
finds the merged page without fetching all earlier Mock pages. Filters run before
pagination. The existing real backend still returns full task/finance lists.
Real IDs and cached records are never modified.
Dashboard task totals, category counts and publication trends use the same
deterministic scenario and timeline model as list rows, without enumerating every
task or execution object. A claim adds an execution, not a published task. Agent count remains synthetic
because this admin has no global Agent-count source wired in. Behavior analytics
also remain synthetic; no real PV/UV collection is implemented.

Order reward total is task reward multiplied by execution count (contract reward,
not revenue). Settlement and payout metrics are calculated from their records,
not inferred from that reward total. The generated fee rate is 10%; real fees remain as
reported by the real settlement API. Pending acceptance uses the actual merged
acceptance queue. Deleted tasks retain execution history but leave the active
publication/list counters.

## Writes and persistence

Real IDs call their original APIs, including acceptance approval and automatic payout. Every
`demo:` ID, even malformed ones, is routed only to the mock service. The service
validates the entity/action and state transition before writing. Demo approval,
rejection, task edits and appeals update the linked ledger. Manual fund mutation
actions are not exposed or accepted by the Mock service.

Changes and audit events are saved atomically to `mock/.data/state.json` (ignored
by git). Override `MOCK_STATE_PATH` for a dedicated shared volume. Real records,
credentials and tokens are never stored there. Writes are serialized within one
service process. Run one writable service instance per state file; a multi-host
production deployment would need a database/locking layer. Restarting that
service preserves explicit changes. Fresh task publication from the existing
admin form remains a real backend operation; automatic demo tasks come from the
virtual sequence.

## Analytics drilldown

Metric cards, bars, funnel steps and ranking actions open daily summaries and
server-paginated event details. `/mock-api/dashboard/events` accepts days, date,
event_name, result, channel, event_source, page_id, button_name, search and page.
It returns 20 rows per page; no full event stream is sent to the browser.

`analytics-events.mjs` generates a deterministic, shared 30-day event stream.
Summary metrics and detail rows come from the same events. Returning users retain
identity across days; period UV and button users are distinct sets, not daily
sums. PV counts market/detail view events only. Button clicks include repeat
attempts and failed operations, independently of business success events.

The funnel requires successful ordered events for one user, task and journey,
within 24 hours, entirely within the selected date range; counts deduplicate
users at each stage. Its endpoint is delivery submission, not acceptance.
Daily funnels use events within each day and cannot be summed into period totals.
Event details expose identifiers, timestamps, identity, session, source, channel,
result, error, duration and trace fields. These remain synthetic analytics, not
real C-end collection or authenticated backend execution evidence. The behavior
volume is now determined by generated events, not extrapolated from order totals.
The event stream is generated deterministically on the server; individual metrics
change only when a new relevant event exists.

## Visitor context and profiles

Events now carry schema version 2 with synthetic device type/brand/model, OS and
browser versions, CSS screen dimensions, network type/carrier, city-level region,
language/timezone and a `context_source: synthetic` marker. Only cellular events
have a `DEMO-CELL-*` station identifier. Wi-Fi/wired events have no cell identifier.
No actual hardware identification, geolocation or cell-tower collection is added.

`GET /mock-api/dashboard/user-profile?user_id=visitor:N` returns a profile based
on that user's events in the shared 30-calendar-day stream, independent of event
list filters. First/last observed timestamps, session counts, page views, clicks,
distinct accepted/submitted executions, failed events and popular pages reconcile
with the stream. First observed is not lifetime signup/first visit. Average session
span measures first-to-last event elapsed time, not engaged time. Profiles and
event context retain consistent device identity across refreshes. Unknown users
return 404. The event list exposes a per-row user-profile modal.

## Dashboard operational drilldowns

Order KPI cards, donut segments and legend buttons open a status-filtered order
list. Mock executions are paged on the server using task counts rather than
materializing 1.7 million records. Real executions require per-task backend reads
because no global execution query is currently exposed; fanout is capped at six.
The browser caches these details for 30 seconds under task counter keys, so new
executions/state-count changes and write invalidations cause a refresh immediately.
The real index and synthetic pages merge by timestamp, not source priority.
Task links carry executionStatus/executionId; task detail selects the matching
status and execution, with a clear-filter action and existing acceptance controls.

Publication bars link to tasks filtered by publishedDate. Pending-work links open
acceptance or appeals. Funds links open the read-only settlement list. Existing
task, acceptance and appeal write routing and confirmation dialogs are preserved.


### Admin workflow scope

The Dashboard is the only added module. Task publication/editing, acceptance and
appeal handling retain their existing business actions. Real acceptance approval
continues through the original backend API, including its automatic payout flow.
The former funds-center route and sidebar entry have been removed. Generated
backend API bindings remain untouched; the two pending-settlement values shown
on the Dashboard are formula outputs from type amount and quality rate.
Manual withdrawal review, payout, payout retry/query, settlement posting and
exception-handling controls are not exposed. Their Mock write handlers are removed;
requests for withdrawal or settlement mutations are rejected. Unimplemented
execution-detail/result/report controls are not displayed. Historical data is kept.


### Business-data generation

Business fixtures now use seeded independent hashes for names, masked phone
numbers, Agent brands, task subjects, task sizes, prices and review scores.
`business-scenario.mjs` defines the execution-to-task mapping and the timeline
shared by event generation and the ledger. Settlement HTTP pages contain one row
per completed execution; task-level batches are internal accounting aggregates
only. Per-execution platform fees use 10%, matching the supplied reference rows,
with fee and net independently rounded to cents as in backend storage. Half-cent ties can leave a one-cent difference between gross and fee plus net. Completed approvals settle
automatically in the fixture; no manual payout workflow is exposed.
Events reference those execution IDs and users, and use their acceptance and
submission timestamps. Values are synthetic and deterministic, not collected
production telemetry. `business-scenario.test.mjs` covers variation, chronology,
per-execution amounts and event-to-business linkage.

### 2026-09-12 C 端口径校正

- 用户昵称统一为“用户 + 手机尾号”，同一身份在任务、验收、资金及埋点中保持一致。
- Agent 仅使用 Codex Agent、Claude Code、OpenCode Agent、Hermes Agent。
- 画像设定约 94% 电脑、6% 手机；这是场景假设，不是实际采集比例。手机以浏览为主，接单/执行事件限定电脑场景。
- 点击按 `apps/sprix-agent/src/user/UserPages.tsx` 的入口生成：任务详情、确认接单、智能接单、执行详情、连接本地 Agent、Agent 测评、设置当前 Agent、收益。漏斗为市场访问→详情→发起接单→接单成功→Agent 交付；不再生成“评估任务”和“人工提交交付”按钮。
- 服务快照按请求时间生成。Dashboard 不自动轮询，手动刷新会取得刷新时刻的最新日内数据。订单采用日内及 10/30 分钟负载波动；Agent 增长采用独立曲线；任务提前约 100～140 分钟发布，发布与接单不再同一次刷新固定增加。历史基准仍为 2026-07-29 开始、2026-09-12 中午约 170 万单 / 3 万 Agent。
- C 端本地开发默认启用共用数据（`VITE_SHARED_MOCK=false` 可关闭）。`/mock-api` 代理到管理端 `http://127.0.0.1:5174`，可用 `SPRIX_MOCK_PROXY_TARGET` 调整。管理端服务不可用时，登录态快照中的 C 端 Mock 读取降级为空，真实接口结果仍可使用。只有管理端服务写入 Mock 状态，避免两个进程同时改状态文件。
- C 端市场只展示已发布且剩余名额大于 0 的任务；Mock 在服务端过滤后统计总数并分页，真实任务同样过滤。真实任务保留在前，补充任务每页按 HTTP 加载 20 条；详情按 ID 请求。名额耗尽后从市场移除，管理端及我的任务保留对应记录。已登录账号的模拟执行以浏览器内的账号范围标识隔离。模拟接单保存到同一个状态文件；2～8 分钟后待验收，管理端审核通过后自动生成模拟结算。没有真实 Agent 运行或真实转账。
- 真实任务仍调用原后端。模拟 ID 不发送到真实写接口；模拟申诉暂不支持，真实申诉保持原样。生产构建关闭 C 端 Mock 接入，未改远程数据库或部署配置。


## Simulation timing (2026-09-12)

Execution state now follows each order's shared acceptance, submission and review
milestones. Task counts and review queues aggregate those states; they no longer
assign states from global count boundaries. Running records have no submission
or completion timestamp; only completed executions can produce settlement rows.
Settlement is credited and automatically paid at completion. Each completed
execution has one settlement and one payout, with the same net amount and time.
The Mock layer treats automatic payouts as immediately successful; it never
initiates real transfers. Task-level aggregates and a paid-total accumulator
avoid materializing millions of payout objects. `/admin/view?kind=withdrawals`
constructs only the requested page from the shared completed-execution index.
Real backend payout states and balances remain unchanged.
Dashboard finance links open read-only, paginated records for each metric.
The unpaid view lists pending/failed withdrawals; unapplied balances are part
of the aggregate difference but do not have withdrawal records.

Execution-duration assumptions (minutes, plus up to 58 seconds): data processing
5–25; content 15–60; office 10–45; HR 20–60; research 45–180; finance 30–120;
software 30–180; design 30–120. Ten percent of generated cases get an additional
15–60-minute second pass. Automatic review takes 5–120 minutes. These are explicit
simulation parameters, not measured production latency. Existing rejection and
appeal-outcome distributions are retained.

Generated appeals are submitted 5–120 minutes after rejection, enter processing
15–180 minutes later and resolve 2–48 hours after processing starts. Explicit
admin decisions override this schedule and retain the processing reason and
action time. Successful appeals settle at resolution, not at the earlier rejection.
An admin-approved execution does not subsequently generate a scheduled appeal.

Execution ordinals are local to each task. Settlements use task price at settlement
creation, reconstructed from price history. Later edits do not rewrite completed
settlements. Unsettled consumer acceptances retain their reward and category.
Older saved decisions recover timestamps from action logs where available.
Legacy price edits without reward history cannot reconstruct every prior price;
the earliest logged edit and saved price are used as the compatibility boundary.

Consumer mock executions use the same category-duration function. They stay in
review until an explicit admin action; saved IDs, edits and review decisions are
retained. Changed duration rules can change the calculated state of unreviewed
consumer executions already in progress.

Web analytics now selects one candidate journey per 64 generated orders instead
of an independent fixed number of daily visits. Bounce, mobile-only browsing and
failed attempts remain in that sample. Successful sampled web acceptance always
gets a delivery event when the corresponding order reaches submission. The UI
labels this section as sampled; PV/UV and funnel values describe this sample,
not all platform traffic or automatic Agent activity. Counts are not multiplied
by 64 (in particular, distinct users cannot be scaled that way).

The historical growth curve and total-order baseline remain unchanged. This
change corrects timing and measurement scope; it does not claim that throughput
has been calibrated against real active-Agent capacity. Snapshot granularity is
10 seconds. The dashboard does not poll automatically; an explicit refresh reads
the latest snapshot and retained versions keep paged drilldowns stable.

### 列表加载与增量缓存

- Dashboard 和资金统计读取紧凑汇总，不会触发任务、订单或资金明细账本生成。
- 任务列表扫描轻量元数据索引以计算筛选总数，只实例化当前页任务；详情只实例化目标任务及其 9～32 条执行记录。
- 订单、结算和提现列表缓存数字执行索引，具体订单/资金记录只为当前页构造；申诉与待验收只扫描可能仍在生命周期内的区间。
- 管理操作改变状态后会创建新的状态版本缓存；旧分页快照在保留期内继续使用原版本，保证翻页稳定。
- 真实申诉普通列表先读取基础字段，合并分页后仅补取当前页详情。按任务名称、手机号等搜索时，现有后端列表没有这些字段，仍需要加载详情以保证搜索结果完整。
