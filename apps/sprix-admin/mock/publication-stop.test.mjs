import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TASK_PUBLICATION_STOP_AT as stop,DAY,publishedTaskCount,indexAt,taskForOrder,orderRange,executionCountsAt} from './business-scenario.mjs';
import {createAnalyticsSnapshot} from './analytics-data.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';

test('publication freezes across future snapshots and module reloads',async()=>{
 const count=publishedTaskCount(stop);
 assert.ok(publishedTaskCount(stop-DAY)<count);
 const fresh=await import(`./business-scenario.mjs?publication-stop-test`);
 for(const at of [stop,stop+DAY,stop+30*DAY,stop+365*DAY]) {
   assert.equal(publishedTaskCount(at),count);
   assert.equal(fresh.publishedTaskCount(at),count);
   assert.ok(taskForOrder(indexAt(at))<=count);
 }
 assert.equal(indexAt(stop+30*DAY),orderRange(count)[1]);
 const statuses=executionCountsAt(stop+30*DAY);
 assert.equal(Object.values(statuses).reduce((a,b)=>a+b,0),indexAt(stop+30*DAY));
});

test('dashboard and task ledger keep the same existing tasks while executions settle',()=>{
 const before=buildDemoLedger(createAnalyticsSnapshot(7,stop));
 const snapshot=createAnalyticsSnapshot(7,stop+DAY);
 const after=buildDemoLedger(snapshot);
 assert.equal(after.tasks.length,before.tasks.length);
 assert.equal(snapshot.operations.taskTotal,after.tasks.length);
 assert.equal(snapshot.operations.taskPublications.at(-1).count,0);
 assert.equal(after.tasks.at(-1).id,before.tasks.at(-1).id);
 assert.equal(after.tasks.at(-1).publishedAt,before.tasks.at(-1).publishedAt);
 assert.ok(after.orders>=before.orders);
 assert.ok(taskForOrder(after.orders)<=after.tasks.length);
});
