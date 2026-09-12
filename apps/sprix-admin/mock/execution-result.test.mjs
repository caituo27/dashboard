import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {executionSubmission} from './execution-result.mjs';
import {getView} from './admin-views.mjs';
import {dashboardMockMiddleware} from './server.mjs';

test('submission links stable output and downloadable bytes to the execution',async()=>{
  const view=await getView();
  const record=view.ledger.acceptanceReviews[0];
  assert.ok(record);
  const {result,files}=executionSubmission(view.ledger,record.executionId);
  assert.equal(result.output.receivedAt,record.submittedAt);
  assert.ok(result.output.inputTokens>0);
  assert.match(result.output.finalMessage,new RegExp(record.taskTitle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.deepEqual(executionSubmission(view.ledger,record.executionId).result,result);
  assert.ok(files.length>=2);
  for(const file of files) {
    const meta=result.artifacts.find(item=>item.artifactId===file.artifactId);
    assert.equal(meta.sizeBytes,file.bytes.length);
    assert.equal(meta.sha256,createHash('sha256').update(file.bytes).digest('hex'));
  }
  assert.equal(executionSubmission(view.ledger,'demo:execution:999999999'),null);
  assert.equal(executionSubmission(view.ledger,'real-id'),null);
  const server=createServer((req,res)=>dashboardMockMiddleware(req,res,()=>res.end()));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const response=await fetch(`${base}/mock-api/admin/view?kind=execution-result&id=${encodeURIComponent(record.executionId)}`);
    assert.equal(response.status,200);
    const data=await response.json();
    for(const artifact of data.artifacts) {
      const download=await fetch(base+artifact.downloadUrl);
      assert.equal(download.status,200);
      const bytes=Buffer.from(await download.arrayBuffer());
      assert.equal(bytes.length,artifact.sizeBytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256);
    }
    assert.equal((await fetch(`${base}/mock-api/admin/artifact?id=${encodeURIComponent(record.executionId)}&file=nonexistent`)).status,404);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('running executions do not claim to have delivered results',()=>{
  const row={executionId:'demo:execution:1',taskId:'demo:task:1',acceptanceStatus:'执行中'};
  const ledger={orders:1,consumerRows:new Map(),execution:()=>row,detail:()=>({task:{},records:{running:[row]}})};
  const {result,files}=executionSubmission(ledger,row.executionId);
  assert.equal(result.output,undefined);
  assert.deepEqual(files,[]);
});
