import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAnalyticsSnapshot,BASELINE_AT} from './analytics-data.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';

test('generated published tasks include pricing fields and recompute totals after edits',()=>{
 const snapshot=createAnalyticsSnapshot(7,BASELINE_AT);
 const ledger=buildDemoLedger(snapshot);
 for(const task of ledger.tasks) {
   assert.equal(Math.round(task.totalAmount*100),Math.round(task.reward*100)*task.totalSlots);
   assert.ok(task.estimatedTokens>0);
 }
 const task=ledger.tasks.at(-1);
 const updated=buildDemoLedger(snapshot,{patches:{[task.id]:{reward:5.93,totalSlots:30}}}).detail(task.id).task;
 assert.equal(updated.totalAmount,177.90);
 assert.equal(updated.estimatedTokens,task.estimatedTokens);
});
