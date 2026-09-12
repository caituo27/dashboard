import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDemoLedger } from "./demo-ledger.mjs";
import { createAnalyticsSnapshot } from "./analytics-data.mjs";

test("demo writes persist, reconcile linked records, and reject real IDs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sprix-demo-test-"));
  process.env.MOCK_STATE_PATH = join(directory, "state.json");
  try {
    const api = await import(`./demo-state.mjs?test=${Date.now()}`);
    const seed = createAnalyticsSnapshot(7);
    const initial = buildDemoLedger(seed);
    const review = initial.acceptanceReviews[Math.floor(initial.acceptanceReviews.length / 2)];
    await assert.rejects(api.applyDemoAction({ id: "real-task", action: "delete" }));
    await api.applyDemoAction({ id: review.executionId, action: "approve" });
    const reloaded = await import(`./demo-state.mjs?reload=${Date.now()}`);
    const state = await reloaded.readDemoState();
    const after = buildDemoLedger(seed, state);
    assert.equal(after.detail(review.taskId).records.reviewing.length, initial.detail(review.taskId).records.reviewing.length - 1);
    assert.equal(after.detail(review.taskId).records.completed.length, initial.detail(review.taskId).records.completed.length + 1);
    await assert.rejects(api.applyDemoAction({ id: review.executionId, action: "approve" }));
    const payout = after.funds.withdrawals[0];
    const before = await api.readDemoState();
    for (const action of ["approve", "reject", "pay", "query", "fail", "return", "handled"]) {
      await assert.rejects(api.applyDemoAction({ id: payout.withdrawalNo, action }));
    }
    await assert.rejects(api.applyDemoAction({ id: after.funds.settlements[0].backendId, action: "post" }));
    assert.deepEqual(await api.readDemoState(), before);
    const task = after.tasks[0];
    await api.applyDemoAction({ id: task.id, action: "offline", payload: { reason: "test" } });
    assert.equal(buildDemoLedger(seed, await api.readDemoState()).detail(task.id).task.taskStatus, "已下线");
    const appeal = initial.appeals.find(row => row.appealStatus === '待处理');
    assert.ok(appeal);
    await api.applyDemoAction({id:appeal.backendId,action:'start',payload:{reason:'正在复核交付内容'}});
    await api.applyDemoAction({id:appeal.backendId,action:'approve',payload:{reason:'复核确认符合验收要求'}});
    const saved = await reloaded.readDemoState();
    const patch = saved.patches[appeal.backendId];
    assert.equal(patch.reason,'复核确认符合验收要求');
    assert.ok(patch.processLogs.some(line=>line.includes('正在复核交付内容')));
    assert.ok(patch.processLogs.some(line=>line.includes('复核确认符合验收要求')));
    assert.equal(saved.patches[appeal.executionId].completedAt,patch.resolvedAt);
    assert.equal(saved.events.at(-1).reason,patch.reason);
  } finally {
    delete process.env.MOCK_STATE_PATH;
    await rm(directory, { recursive: true, force: true });
  }
});
