import {test} from 'node:test';
import assert from 'node:assert/strict';
import {START,DAY,timeline,appealTimeline,orderRange,taskScenario} from './business-scenario.mjs';
import {createAnalyticsSnapshot} from './analytics-data.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';
import {aggregateDashboard} from './dashboard-aggregation.mjs';
import {timestamp} from './record-order.mjs';
import {fundSummary} from './fund-summary.mjs';
const now=START+10*DAY,seed=createAnalyticsSnapshot(7,now);
const cents=n=>Math.round(n*100);
const indexOf=id=>Number(id.split(':')[2]);

test('appeals have ordered milestones and matching execution state and task-local sequence',()=>{
 const ledger=buildDemoLedger(seed);
 assert.ok(ledger.appeals.some(a=>a.appealStatus==='申诉通过'));
 for(const a of ledger.appeals) {
  const n=indexOf(a.executionId),e=ledger.execution(n),t=ledger.detail(e.taskId).task;
  assert.equal(e.appealStatus,a.appealStatus);
  assert.ok(timestamp(e.terminatedAt)<=timestamp(a.submittedAt));
  assert.ok(e.executionIndex>=1 && e.executionIndex<=t.executionTotal);
  assert.equal(a.executionIndex,e.executionIndex);
  assert.equal(a.deliverables,t.deliverables);
  if(a.appealStatus==='申诉通过') {
    assert.ok(timestamp(e.completedAt)>=timestamp(a.submittedAt));
    assert.equal(e.completedAt,a.resolvedAt);
    assert.equal(e.settlementStatus,'已入账');
  } else assert.equal(e.settlementStatus,'未入账');
  if(['待处理','处理中'].includes(a.appealStatus)) assert.ok(now-timestamp(a.submittedAt)<3*DAY);
 }
 const target=ledger.appeals.find(a=>['待处理','处理中'].includes(a.appealStatus));
 assert.ok(target);
 const actionAt=new Date(now).toISOString();
 const state={patches:{[target.backendId]:{appealStatus:'申诉通过',resolvedAt:actionAt,reason:'核验通过'},[target.executionId]:{status:'completed',completedAt:actionAt}}};
 const after=buildDemoLedger(seed,state),e=after.execution(indexOf(target.executionId));
 assert.equal(timestamp(e.completedAt),now);
 assert.equal(e.appealStatus,'申诉通过');
 assert.equal(timestamp(after.settlementRecord(indexOf(target.executionId)).createdAt),now);
 const review=ledger.acceptanceReviews[0];
 const legacy={patches:{[review.executionId]:{status:'terminated'}},events:[{id:review.executionId,action:'reject',at:actionAt}]};
 const rejected=buildDemoLedger(seed,legacy).execution(indexOf(review.executionId));
 assert.equal(timestamp(rejected.terminatedAt),now);
 const approvedDirectly=buildDemoLedger(seed,{patches:{[target.executionId]:{status:'completed',completedAt:actionAt}}});
 assert.equal(approvedDirectly.execution(indexOf(target.executionId)).appealStatus,'无申诉');
 assert.ok(!approvedDirectly.appeals.some(row=>row.executionId===target.executionId));
});

test('task repricing preserves past orders and payouts; balances reconcile without rewriting old withdrawals',()=>{
 const before=buildDemoLedger(seed),task=before.tasks.find(t=>t.completedExecutionCount>5);
 const n=orderRange(indexOf(task.id))[0],original=before.settlementRecord(n),at=new Date(now).toISOString();
 const state={patches:{[task.id]:{reward:99,rewardHistory:[{at,reward:99}]}}};
 const edited=buildDemoLedger(seed,state);
 assert.equal(edited.detail(task.id).task.reward,99);
 assert.deepEqual(edited.settlementRecord(n),original);
 assert.equal(edited.orderRecord(n).reward,original.taskIncome);
 const futureTask=before.tasks.find(t=>t.remainingSlots>0 && orderRange(indexOf(t.id))[1]>seed.overview.orders);
 assert.ok(futureTask);
 const changed={patches:{[futureTask.id]:{reward:77,rewardHistory:[{at,reward:77}]}}};
 const future=buildDemoLedger(createAnalyticsSnapshot(7,now+DAY),changed);
 const [first,last]=orderRange(indexOf(futureTask.id));
 for(let i=first;i<=last;i++) assert.equal(future.execution(i).reward,timeline(i).accepted>=now?77:taskScenario(indexOf(futureTask.id)).reward);
 const later=buildDemoLedger(createAnalyticsSnapshot(7,now+DAY));
 const laterWithdrawals=new Map(later.funds.withdrawals.map(r=>[r.backendId,r]));
 for(const row of before.funds.withdrawals) {
  const next=laterWithdrawals.get(row.backendId);assert.ok(next);
  assert.equal(next.applyAmount,row.applyAmount);assert.equal(next.appliedAt,row.appliedAt);
  if(row.withdrawStatus==='已提现') assert.equal(next.paidAt,row.paidAt);
 }
 for(const ledger of [before,edited,later]) {
  const f=fundSummary(ledger.funds);
  assert.equal(cents(f.settledNet),cents(f.paid)+cents(f.paying)+cents(f.available));
  assert.ok(f.available>0);
  const dashboard=aggregateDashboard(seed,{tasks:ledger.tasks,acceptanceReviews:ledger.acceptanceReviews,appealCount:ledger.appeals.length},ledger.funds);
  assert.equal(cents(dashboard.finance.settlementNet),cents(dashboard.finance.paidAmount)+cents(dashboard.finance.remainingNet));
 }
});
