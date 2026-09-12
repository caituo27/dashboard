import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAnalyticsSnapshot,BASELINE_AT} from './analytics-data.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';
import {eventStream} from './analytics-events.mjs';
import {businessProfile} from './business-profile.mjs';
import {taskForOrder,userForExecution,orderRange} from './business-scenario.mjs';
import {timestamp} from './record-order.mjs';
test('business rows vary, reconcile per execution, and follow the shared timeline',()=>{
 const ledger=buildDemoLedger(createAnalyticsSnapshot(7,BASELINE_AT));
 assert.ok(new Set(ledger.tasks.slice(-30).map(t=>t.reward)).size>15);
 assert.ok(new Set(ledger.tasks.filter(t=>t.executionTotal>0).slice(-30).map(t=>t.executionTotal)).size>3);
 assert.ok(new Set(Array.from({length:20},(_,i)=>businessProfile(23470+i).userName)).size>15);
 for(let n=1;n<1600000;n+=7919){
  const task=ledger.tasks[taskForOrder(n)-1], execution=ledger.execution(n);
  if(execution.settlementStatus!=='已入账') { assert.throws(()=>ledger.settlementRecord(n),/not settled/); continue; }
  const record=ledger.settlementRecord(n);
  assert.equal(record.taskIncome,task.reward);
  const cents=Math.round(record.taskIncome*100);
  assert.equal(Math.round(record.platformFee*100),Math.floor((cents+5)/10));
  assert.equal(Math.round(record.netIncome*100),Math.floor((cents*9+5)/10));
  assert.equal(record.userName,execution.userName);
  assert.ok(timestamp(task.publishedAt)<=timestamp(execution.startedAt));
  assert.ok(timestamp(execution.startedAt)<timestamp(execution.submittedAt));
  assert.ok(timestamp(execution.submittedAt)<=timestamp(record.createdAt));
  assert.ok(timestamp(record.createdAt)<=timestamp(record.paidAt));
  const range=orderRange(taskForOrder(n));assert.ok(n>=range[0]&&n<=range[1]);
 }
 const accepted=eventStream(BASELINE_AT).filter(e=>e.event_name==='task_accept_succeeded');
 for(const event of accepted){
  const index=Number(event.execution_id.split(':')[2]);
  const task=ledger.tasks[taskForOrder(index)-1];
  assert.equal(event.task_id,task.id);
  assert.equal(event.user_id,`visitor:${userForExecution(index)-1}`);
  assert.ok(timestamp(task.publishedAt)<=timestamp(event.event_time));
  assert.ok(Math.abs(timestamp(ledger.execution(index).startedAt)-timestamp(event.event_time))<1000);
 }
});
