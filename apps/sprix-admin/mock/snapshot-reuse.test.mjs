import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventStream} from './analytics-events.mjs';
import {createAnalyticsSnapshot,BASELINE_AT} from './analytics-data.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';
import {createFinanceLedger} from './finance-ledger.mjs';

test('clock updates reuse historical events, retain new arrivals, and can move backwards',()=>{
 const at=BASELINE_AT+6*3600000;
 const first=eventStream(at),byId=new Map(first.map(row=>[row.event_id,row]));
 const next=eventStream(at+60000);
 assert.ok(next.length>=first.length);
 for(const row of next) if(byId.has(row.event_id)) assert.equal(row,byId.get(row.event_id));
 assert.ok(next.every(row=>Date.parse(row.event_time)<=at+60000));
 assert.deepEqual(eventStream(at),first);
 const tomorrow=eventStream(at+86400000);
 assert.ok(tomorrow.every(row=>Date.parse(row.event_time)<=at+86400000));
 assert.deepEqual(eventStream(at),first);
});

test('historical task sharing does not overwrite older snapshots when state changes',()=>{
 const at=BASELINE_AT;
 const first=buildDemoLedger(createAnalyticsSnapshot(7,at));
 const old=first.tasks[0];
 const next=buildDemoLedger(createAnalyticsSnapshot(7,at+10000));
 assert.equal(next.tasks[0],old);
 const changed=buildDemoLedger(createAnalyticsSnapshot(7,at+20000),{patches:{[old.id]:{title:'更新后的任务标题'}}});
 assert.equal(changed.tasks[0].title,'更新后的任务标题');
 assert.notEqual(old.title,'更新后的任务标题');
 assert.equal(next.tasks[0],old);
});

test('finance cache reuses unchanged rows and retains previous amounts after new settlement',()=>{
 const ledger=createFinanceLedger();
 const one={id:'demo:task:1',title:'任务一'},two={id:'demo:task:2',title:'任务二'};
 ledger.add(one,1,1,10,BASELINE_AT);ledger.add(two,2,2,20,BASELINE_AT);
 const first=ledger.result();
 ledger.add(one,3,1,5,BASELINE_AT+10000);
 const next=ledger.result();
 assert.equal(first.settlements[1],next.settlements[1]);
 assert.notEqual(first.settlements[0],next.settlements[0]);
 assert.equal(first.settlements[0].taskIncome,10);
 assert.equal(next.settlements[0].taskIncome,15);
 assert.equal(next.paidAmount,31.5);
});
