import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeline, statusAt, terminalStatus, executionDuration, indexAt, MAX_LIFECYCLE_MS, executionCountsAt } from './business-scenario.mjs';
import { buildDemoLedger } from './demo-ledger.mjs';
import { createAnalyticsSnapshot, BASELINE_AT } from './analytics-data.mjs';
import { consumerExecution } from './consumer-records.mjs';
import { eventStream } from './analytics-events.mjs';
import { timestamp } from './record-order.mjs';

test('execution milestones determine state, including rejection and the old-history shortcut', () => {
  for (let n=1690000;n<=1700000;n+=55) {
    const dates=timeline(n);
    assert.equal(statusAt(n,dates.submitted-1),'running');
    assert.equal(statusAt(n,dates.submitted),'reviewing');
    assert.equal(statusAt(n,dates.completed-1),'reviewing');
    assert.equal(statusAt(n,dates.completed),terminalStatus(n));
    assert.equal(statusAt(n,dates.accepted+MAX_LIFECYCLE_MS),terminalStatus(n));
    assert.ok(dates.completed-dates.accepted<MAX_LIFECYCLE_MS);
  }
  assert.ok(executionDuration(123,'市场研究')>executionDuration(123,'数据处理'));
});

test('ledger counts, detail timestamps, events and settlement agree at one snapshot', () => {
  const seed=createAnalyticsSnapshot(7,BASELINE_AT), ledger=buildDemoLedger(seed);
  const counts={running:0,reviewing:0,completed:0,terminated:0};
  for(const task of ledger.tasks) for(const status of Object.keys(counts)) counts[status]+=task[`${status}ExecutionCount`];
  assert.deepEqual(counts,seed.operations.executions);
  assert.deepEqual(counts,executionCountsAt(BASELINE_AT));
  assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),indexAt(BASELINE_AT));
  for(let n=indexAt(BASELINE_AT-MAX_LIFECYCLE_MS);n<=indexAt(BASELINE_AT);n+=137) {
    const row=ledger.execution(n), dates=timeline(n), status=statusAt(n,BASELINE_AT);
    if(status==='running') { assert.equal(row.submittedAt,undefined); assert.equal(row.completedAt,undefined); }
    if(status==='reviewing') { assert.ok(timestamp(row.submittedAt)<=BASELINE_AT); assert.equal(row.completedAt,undefined); }
    if(status==='completed') {
      assert.equal(timestamp(row.completedAt),Math.floor(dates.completed/1000)*1000);
      const settlement=ledger.settlementRecord(n);
      assert.ok(timestamp(settlement.createdAt)<=timestamp(settlement.paidAt));
      assert.ok(timestamp(settlement.paidAt)<=BASELINE_AT);
    }
    assert.equal(row.settlementStatus,status==='completed'?'已入账':'未入账');
  }
  for(const event of eventStream(BASELINE_AT).filter(e=>e.event_name==='delivery_submitted')) {
    const n=Number(event.execution_id.split(':')[2]);
    assert.equal(n%64,0);
    assert.equal(Date.parse(event.event_time),Math.floor(timeline(n).submitted));
    assert.notEqual(statusAt(n,BASELINE_AT),'running');
  }
});

test('manual consumer execution uses category duration and waits for explicit review', () => {
  const index=9000000001, started=BASELINE_AT, row={index,taskId:'demo:task:1',startedAt:new Date(started).toISOString()};
  const task={id:row.taskId,category:'市场研究'}, submitted=started+executionDuration(index,task.category);
  assert.equal(consumerExecution(row,task,{},submitted-1).status,'running');
  assert.equal(consumerExecution(row,task,{},submitted-1).submittedAt,undefined);
  assert.equal(consumerExecution(row,task,{},submitted).status,'reviewing');
  assert.equal(consumerExecution(row,task,{},submitted+86400000).completedAt,undefined);
  const completedAt=new Date(submitted+60000).toISOString();
  assert.equal(consumerExecution(row,task,{status:'completed',completedAt},submitted+60000).completedAt,completedAt);
});
