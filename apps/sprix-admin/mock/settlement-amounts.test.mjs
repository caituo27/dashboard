import {test} from 'node:test';
import assert from 'node:assert/strict';
import {settlementAmounts} from './settlement-amounts.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';
import {createAnalyticsSnapshot,BASELINE_AT} from './analytics-data.mjs';
import {timeline,taskForOrder} from './business-scenario.mjs';
import {createFinanceLedger} from './finance-ledger.mjs';
test('stored fee and net round independently, including half-cent boundaries',()=>{
 for(const [reward,gross,fee,net] of [[1,100,10,90],[1.04,104,10,94],[1.05,105,11,95],[1.06,106,11,95],[2.55,255,26,230],[0,0,0,0]]) {
  assert.deepEqual(settlementAmounts(reward),{gross,fee,net});
  const finance=createFinanceLedger();finance.add({id:'demo:task:1',title:'任务'},1,1,reward,BASELINE_AT);
  const funds=finance.result();assert.equal(funds.settlements[0].platformFee,fee/100);
  assert.equal(funds.settlements[0].netIncome,net/100);assert.equal(funds.paidAmount,net/100);
 }
});
test('settlement uses price at creation, not acceptance or later task edits',()=>{
 const index=1000,dates=timeline(index),taskId=`demo:task:${taskForOrder(index)}`;
 const editedAt=new Date((dates.accepted+dates.completed)/2).toISOString();
 const laterAt=new Date(dates.completed+1000).toISOString();
 const state={patches:{[taskId]:{reward:9.99,rewardHistory:[{at:editedAt,reward:1.05},{at:laterAt,reward:9.99}]}}};
 const ledger=buildDemoLedger(createAnalyticsSnapshot(7,BASELINE_AT),state);
 assert.equal(ledger.detail(taskId).task.reward,9.99);
 const record=ledger.settlementRecord(index);
 assert.equal(record.taskIncome,1.05);assert.equal(record.platformFee,.11);assert.equal(record.netIncome,.95);
 assert.equal(ledger.withdrawalRecord(index).applyAmount,.95);
 assert.deepEqual(buildDemoLedger(createAnalyticsSnapshot(7,BASELINE_AT+60000),state).settlementRecord(index),record);
});
