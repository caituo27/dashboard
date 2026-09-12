import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoLedger} from './demo-ledger.mjs';
import {BASELINE_AT,createAnalyticsSnapshot} from './analytics-data.mjs';
import {viewPage} from './admin-views.mjs';
import {fundSummary} from './fund-summary.mjs';
const view=ledger=>({ledger,version:ledger.generatedAt,lists:new Map()});
test('incremental finance and settlement index match a cold rebuild and preserve older snapshots',()=>{
 const before=buildDemoLedger(createAnalyticsSnapshot(7,BASELINE_AT));
 const oldFunds=before.funds,oldSummary=fundSummary(oldFunds),oldView=view(before);
 const oldPage=viewPage(oldView,'settlements',{limit:20});
 const seed=createAnalyticsSnapshot(7,BASELINE_AT+60000);
 const updated=buildDemoLedger(seed),updatedFunds=updated.funds,updatedView=view(updated);
 const page=viewPage(updatedView,'settlements',{limit:20});
 const tail=viewPage(updatedView,'settlements',{offset:page.total-20,limit:20});
 // A harmless state marker forces the independent cold construction path.
 const cold=buildDemoLedger(seed,{testRebuild:true}),coldFunds=cold.funds,coldView=view(cold);
 assert.deepEqual(fundSummary(updatedFunds),fundSummary(coldFunds));
 const batches=new Map(coldFunds.withdrawals.map(row=>[row.withdrawalNo,row]));
 assert.equal(updatedFunds.withdrawals.length,batches.size);
 for(const row of updatedFunds.withdrawals)assert.deepEqual(row,batches.get(row.withdrawalNo));
 assert.deepEqual(page.rows,viewPage(coldView,'settlements',{limit:20}).rows);
 assert.deepEqual(tail.rows,viewPage(coldView,'settlements',{offset:page.total-20,limit:20}).rows);
 assert.deepEqual(fundSummary(oldFunds),oldSummary);
 assert.deepEqual(viewPage(oldView,'settlements',{limit:20}).rows,oldPage.rows);
});

test('approval between rounded refresh timestamps is counted only once',async()=>{
 const {clock}=await import('./business-scenario.mjs');
 const at=Math.ceil(clock(1000)/10000)*10000;
 const state={patches:{'demo:execution:1000':{status:'completed',completedAt:new Date(at+5000).toISOString()}}};
 const first=buildDemoLedger(createAnalyticsSnapshot(7,at),state);
 void first.funds;viewPage(view(first),'settlements');
 const seed=createAnalyticsSnapshot(7,at+10000),next=buildDemoLedger(seed,state);
 const summary=fundSummary(next.funds),page=viewPage(view(next),'settlements',{limit:100});
 const cold=buildDemoLedger(seed,{...state,testRebuild:'approval'});
 assert.deepEqual(summary,fundSummary(cold.funds));
 const expected=viewPage(view(cold),'settlements',{limit:100});
 assert.equal(page.total,expected.total);assert.deepEqual(page.rows,expected.rows);
});
