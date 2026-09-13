import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DAY,publishedTaskCount,indexAt,taskForOrder,executionCountsAt} from './business-scenario.mjs';
import {createAnalyticsSnapshot} from './analytics-data.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';

const baseline=Date.parse('2026-09-12T10:44:05Z');

test('publication and orders continue growing with the snapshot time',async()=>{
 const fresh=await import(`./business-scenario.mjs?publication-growth-test`);
 for(const at of [baseline,baseline+DAY,baseline+2*DAY]) {
   assert.equal(fresh.publishedTaskCount(at),publishedTaskCount(at));
   assert.ok(taskForOrder(indexAt(at))<=publishedTaskCount(at));
   const statuses=executionCountsAt(at);
   assert.equal(Object.values(statuses).reduce((a,b)=>a+b,0),indexAt(at));
 }
 assert.ok(publishedTaskCount(baseline+DAY)>publishedTaskCount(baseline));
 assert.ok(indexAt(baseline+DAY)>indexAt(baseline));
});

test('dashboard and task ledger add the tasks published by a later refresh',()=>{
 const before=buildDemoLedger(createAnalyticsSnapshot(7,baseline));
 const snapshot=createAnalyticsSnapshot(7,baseline+DAY);
 const after=buildDemoLedger(snapshot);
 assert.ok(after.tasks.length>before.tasks.length);
 assert.equal(snapshot.operations.taskTotal,after.tasks.length);
 assert.ok(snapshot.operations.taskPublications.at(-1).count>0);
 assert.ok(after.orders>before.orders);
 assert.ok(taskForOrder(after.orders)<=after.tasks.length);
});
