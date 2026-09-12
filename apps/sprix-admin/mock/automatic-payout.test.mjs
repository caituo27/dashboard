import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoLedger} from './demo-ledger.mjs';
import {createAnalyticsSnapshot,BASELINE_AT} from './analytics-data.mjs';
import {viewPage} from './admin-views.mjs';
import {filterRecords} from './record-order.mjs';
test('automatic payouts page by execution and agree with settlement amounts and times',()=>{
 const ledger=buildDemoLedger(createAnalyticsSnapshot(7,BASELINE_AT));
 const view={ledger,version:'payout-test',lists:new Map()};
 const settlements=viewPage(view,'settlements',{limit:20});
 const paid=viewPage(view,'withdrawals',{status:'已提现',limit:20});
 assert.equal(paid.total,settlements.total);assert.equal(paid.rows.length,20);
 for(let i=0;i<20;i++){
  assert.equal(paid.rows[i].executionId,settlements.rows[i].executionId);
  assert.equal(paid.rows[i].applyAmount,settlements.rows[i].netIncome);
  assert.equal(paid.rows[i].paidAt,settlements.rows[i].paidAt);
  assert.equal(paid.rows[i].appliedAt,settlements.rows[i].createdAt);
 }
 const unpaid=viewPage(view,'withdrawals',{status:'未提现'});
 assert.equal(unpaid.total,0);
 const next=viewPage(view,'withdrawals',{offset:20,limit:20});
 assert.ok(!next.rows.some(row=>paid.rows.some(first=>first.withdrawalNo===row.withdrawalNo)));
 const real=[{withdrawStatus:'已提现'},{withdrawStatus:'待打款'},{withdrawStatus:'提现审核中'},{withdrawStatus:'打款失败'},{withdrawStatus:'需更换账户'},{withdrawStatus:'已驳回'}];
 assert.deepEqual(filterRecords('withdrawals',real,{status:'未提现'}),real.slice(1,5));
});
