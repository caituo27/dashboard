import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executionReview} from './execution-review.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';
import {createAnalyticsSnapshot,BASELINE_AT} from './analytics-data.mjs';
const task={title:'分页与权限用例',deliverables:'用例表',submissionRows:[['页码下限','校验页码'],['未登录','检查拒绝访问']]};
test('pending and passed reviews have no fabricated unmet goals',()=>{
 for(const status of ['running','reviewing','completed']) {
   const result=executionReview(task,status);
   assert.equal(result.acceptanceIssues,'');
   assert.equal(result.acceptanceFailureReasons,'');
   assert.equal(result.acceptanceImprovementSuggestions,'');
   assert.ok(result.acceptanceSummary.includes(task.title));
 }
 assert.match(executionReview(task,'reviewing').acceptanceSummary,/页码下限、未登录/);
 assert.doesNotMatch(executionReview(task,'completed').acceptanceSummary,/等待|抽查/);
});
test('rejected review preserves supplied reason and does not invent a specific defect',()=>{
 const review=executionReview(task,'terminated','缺少未登录用例');
 assert.equal(review.acceptanceIssues,'缺少未登录用例');
 assert.match(review.acceptanceImprovementSuggestions,/缺少未登录用例/);
 assert.match(executionReview(task,'terminated').acceptanceIssues,/未记录具体原因/);
});
test('execution details inherit the task publication category and meaningful review fields',()=>{
 const ledger=buildDemoLedger(createAnalyticsSnapshot(7,BASELINE_AT));
 for(const row of ledger.acceptanceReviews.slice(0,20)) {
   const task=ledger.detail(row.taskId).task;
   assert.equal(row.taskCategory,task.category);
   assert.equal(row.acceptanceIssues,'');
   assert.ok(row.acceptanceSummary.includes(task.title));
   assert.equal(row.currentNode,'平台验收');
 }
});
