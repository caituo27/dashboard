import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskScenario,hash} from './business-scenario.mjs';
import {executionSubmission} from './execution-result.mjs';

test('task briefs provide stable, varied inputs and matching delivery content',()=>{
  const categories=new Set(),titles=new Set();
  for(let i=1;i<=500;i++) {
    const task=taskScenario(i);
    categories.add(task.category);titles.add(task.title);
    assert.ok(task.description.length>70);
    assert.ok(task.acceptanceCriteria.length>30);
    assert.ok(task.submissionRows.length>=4);
    assert.ok(task.submissionRows.every(row=>row.length===2 && row.every(Boolean)));
    assert.doesNotMatch(task.title,/demo|mock|第\d+批|·\s*\d+/i);
    assert.equal(taskScenario(i),task);
    const row={executionId:`demo:execution:${i}`,taskId:`demo:task:${i}`,submittedAt:'2026-09-12 12:00:00',acceptanceStatus:'待平台验收',agentName:'Codex',acceptanceIssues:'未发现格式问题'};
    const ledger={orders:500,consumerRows:new Map(),execution:()=>row,detail:()=>({task,records:{reviewing:[row]}})};
    const submission=executionSubmission(ledger,row.executionId);
    const report=submission.files.find(file=>file.name.endsWith('.md')).content;
    for(const [label,content] of task.submissionRows) {assert.ok(report.includes(label));assert.ok(report.includes(content));}
    assert.equal(submission.files.length,task.category==='设计创意'?3:2);
  }
  assert.equal(categories.size,8);
  assert.ok(titles.size>300);
});

test('embedded numeric and classification briefs reconcile',()=>{
  for(let i=1;i<=150;i++) {
    const task=taskScenario(i),family=hash(i,2)%12;
    if(family===1) {
      assert.equal(task.submissionRows.length,5);
      assert.equal(task.submissionRows.filter(row=>row[1].endsWith('；保留')).length,3);
      assert.equal(task.submissionRows.filter(row=>row[1].includes('重复')).length,1);
    }
    if(family===6) {
      const counts={};
      for(const [,value] of task.submissionRows) {const label=value.split('：')[0];counts[label]=(counts[label]??0)+1;}
      assert.deepEqual(counts,{'使用问题':2,'功能建议':2,'价格反馈':1,'正向评价':1});
    }
    if(family===11) {
      const numbers=task.submissionRows.slice(0,2).map(([,value])=>Number(value.match(/小计 (\d+) 元/)[1]));
      assert.equal(numbers[0]+numbers[1],Number(task.submissionRows[3][1].match(/^\d+/)[0]));
    }
  }
});
