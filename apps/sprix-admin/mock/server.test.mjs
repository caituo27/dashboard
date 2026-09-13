import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { BASELINE_AT, createAnalyticsSnapshot } from "./analytics-data.mjs";
import { dashboardMockMiddleware } from "./server.mjs";
import { aggregateEvents, eventStream } from "./analytics-events.mjs";

test("dashboard HTTP mock contract", async () => {
  const server = createServer((req, res) => dashboardMockMiddleware(req, res, () => {
    res.writeHead(404);
    res.end("outside mock");
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const days of [7, 30]) {
      const url = `${base}/mock-api/dashboard/analytics?days=${days}`;
      const response = await fetch(url);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /application\/json/);
      const data = await response.json();
      assert.equal(data.visits.reduce((sum, value) => sum + value, 0), data.pv);
      assert.equal(data.buttons.reduce((sum, item) => sum + item.clicks, 0), data.clicks);
      assert.equal(data.funnel.length, 5);
      assert.ok(data.funnel.every((value, index) => index === 0 || value <= data.funnel[index - 1]));
      const repeated = await (await fetch(url)).json();
      if (repeated.generatedAt === data.generatedAt) assert.deepEqual(repeated, data);
      else assert.ok(repeated.overview.orders >= data.overview.orders);
    }
    const business = await (await fetch(`${base}/mock-api/dashboard/analytics?startDate=2026-07-27&endDate=2026-09-06`)).json();
    assert.equal(business.snapshotVersion, "sprix-excel-v5.1-2026-09-06");
    assert.equal(business.businessMetrics.weeks.length, 6);
    assert.equal(business.businessMetrics.summary.deliveredTasks, 16_251);
    assert.equal(business.generatedAt, "2026-09-06T15:59:59.000Z");
    const defaults = await (await fetch(`${base}/mock-api/dashboard/analytics`)).json();
    const sevenDays = await (await fetch(`${base}/mock-api/dashboard/analytics?days=7`)).json();
    if (defaults.generatedAt === sevenDays.generatedAt) assert.deepEqual(defaults, sevenDays);
    for (const days of ["0", "__proto__", "7&days=30"]) {
      assert.equal((await fetch(`${base}/mock-api/dashboard/analytics?days=${days}`)).status, 400);
    }
    assert.equal((await fetch(`${base}/mock-api/dashboard/analytics`, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${base}/mock-api/unknown`)).status, 404);
    assert.equal(await (await fetch(`${base}/unrelated`)).text(), "outside mock");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test("dynamic presentation totals are deterministic and grow from the supplied baseline", () => {
  const baseline = createAnalyticsSnapshot(7, BASELINE_AT);
  assert.equal(baseline.overview.orders, 1_700_000);
  assert.equal(baseline.overview.agents, 30_000);
  assert.equal(baseline.overview.amount, 10_000_000);
  assert.equal(baseline.overview.operatingDays, 45);
  assert.deepEqual(createAnalyticsSnapshot(7, BASELINE_AT + 9_999), baseline);
  const next = createAnalyticsSnapshot(7, BASELINE_AT + 10_000);
  assert.ok(next.overview.orders > baseline.overview.orders);
  assert.ok(next.overview.amount > baseline.overview.amount);
  assert.ok(next.pv >= baseline.pv);
  const tomorrow = createAnalyticsSnapshot(7, BASELINE_AT + 86_400_000);
  assert.ok(tomorrow.overview.agents > baseline.overview.agents);
  assert.equal(tomorrow.overview.operatingDays, 46);
  for (const at of [BASELINE_AT - 46 * 86_400_000, BASELINE_AT, BASELINE_AT + 86_400_000]) {
    const seven = createAnalyticsSnapshot(7, at);
    const thirty = createAnalyticsSnapshot(30, at);
    assert.deepEqual(seven.overview, thirty.overview);
    assert.ok(thirty.pv >= seven.pv);
    for (const snapshot of [seven, thirty]) {
      assert.ok(snapshot.uv <= snapshot.pv);
      assert.equal(Object.values(snapshot.operations.executions).reduce((sum, count) => sum + count, 0), snapshot.overview.orders);
      assert.ok(snapshot.operations.paidAmount <= snapshot.overview.amount);
      assert.ok(snapshot.operations.publishedTasks <= snapshot.operations.taskTotal);
      assert.ok(snapshot.operations.taskPublications.reduce((sum, item) => sum + item.count, 0) <= snapshot.operations.taskTotal);
      assert.equal(snapshot.visits.reduce((sum, count) => sum + count, 0), snapshot.pv);
      assert.equal(snapshot.buttons.reduce((sum, row) => sum + row.clicks, 0), snapshot.clicks);
      assert.ok(snapshot.buttons.every((row) => row.users <= row.clicks));
      assert.ok(snapshot.funnel.every((count, index) => count >= 0 && (index === 0 || count <= snapshot.funnel[index - 1])));
    }
  }
});


test("whole dashboard stays consistent across launch, midnight and later dates", () => {
  const cents = (value) => Math.round(value * 100);
  for (const offset of [-46 * 86400000, -45 * 86400000 + 10000, -44 * 86400000, -43210000, 0, 43200000, 86400000, 90 * 86400000]) {
    for (const period of [7, 30]) {
      const snapshot = createAnalyticsSnapshot(period, BASELINE_AT + offset);
      const { overview, operations, finance } = snapshot;
      assert.equal(snapshot.period, period);
      assert.equal(snapshot.visits.length, period);
      assert.equal(Object.values(operations.executions).reduce((sum, count) => sum + count, 0), overview.orders);
      assert.ok(operations.executions.running <= overview.agents);
      assert.equal(cents(finance.completedAmount), cents(finance.platformFee) + cents(finance.settlementNet));
      assert.equal(cents(finance.settlementNet), cents(finance.paidAmount) + cents(finance.remainingNet));
      assert.equal(finance.paidAmount, operations.paidAmount);
      assert.ok(finance.completedAmount <= overview.amount);
      snapshot.buttons.forEach((row, index) => {
        assert.ok(row.users <= row.clicks);
        assert.ok(snapshot.funnel[index + 1] <= row.users);
      });
    }
  }
});

test("drilldown totals reconcile and historical dates stay stable as today's data grows", () => {
  const first = createAnalyticsSnapshot(7, BASELINE_AT);
  const later = createAnalyticsSnapshot(7, BASELINE_AT + 3600000);
  const thirty = createAnalyticsSnapshot(30, BASELINE_AT);
  assert.deepEqual(thirty.daily.slice(-7), first.daily);
  assert.deepEqual(first.daily.slice(0, -1), later.daily.slice(0, -1));
  assert.ok(later.daily.at(-1).pv > first.daily.at(-1).pv);
  assert.ok(later.uv >= first.uv);
  assert.ok(later.clicks > first.clicks);

  for (const snapshot of [first, later, thirty]) {
    for (const metric of ["pv", "clicks"]) assert.equal(snapshot.daily.reduce((sum, day) => sum + day[metric], 0), snapshot[metric]);
    assert.ok(snapshot.daily.reduce((sum, day) => sum + day.uv, 0) >= snapshot.uv);
    // A journey spanning midnight can complete in the period but in neither daily cohort.
    const start=Date.parse(`${snapshot.daily[0].date}T00:00:00+08:00`);
    const events=eventStream(Date.parse(snapshot.generatedAt)).filter(event=>Date.parse(event.event_time)>=start);
    assert.deepEqual(snapshot.funnel,aggregateEvents(events).funnel);
    snapshot.buttons.forEach((button, i) => {
      for (const metric of ["clicks"]) assert.equal(snapshot.daily.reduce((sum, day) => sum + day.buttons[i][metric], 0), button[metric]);
    });
  }
});
