import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskContent,editedTaskContent,taskAtSubmission} from './submission-task.mjs';
import {executionSubmission} from './execution-result.mjs';
const task={title:'原任务',category:'办公文档',description:'原说明',deliverables:'文档',acceptanceCriteria:'条件',estimatedTokens:8000,submissionRows:[['事项','内容']]};
test('edits select the submitted version and retain new token estimates',()=>{
 const after=editedTaskContent(task,{...task,title:'新任务',estimatedTokens:12000});
 assert.equal(after.estimatedTokens,12000);assert.equal(after.submissionRows,null);
 const patch={contentHistory:[{at:'2026-09-12T10:00:00Z',before:taskContent(task),after}]};
 assert.equal(taskAtSubmission(after,patch,'2026-09-12T09:00:00Z').title,'原任务');
 assert.equal(taskAtSubmission(after,patch,'2026-09-12T11:00:00Z').title,'新任务');
});
test('review decisions cannot rewrite submitted artifact bytes',()=>{
 const record={executionId:'demo:execution:1',taskId:'demo:task:1',submittedAt:'2026-09-12 17:00:00',agentName:'Codex',acceptanceStatus:'待平台验收'};
 const ledger={orders:1,consumerRows:new Map(),execution:()=>record,detail:()=>({task,records:{reviewing:[record]}})};
 const first=executionSubmission(ledger,record.executionId);
 record.acceptanceIssues='需补充材料';record.acceptanceStatus='验收未通过';
 const next=executionSubmission(ledger,record.executionId);
 assert.deepEqual(first.result.artifacts,next.result.artifacts);
 const output=next.result.output;
 assert.ok(output.inputTokens+output.outputTokens>=task.estimatedTokens*.8);
 assert.ok(output.inputTokens+output.outputTokens<=task.estimatedTokens*1.3);
});
