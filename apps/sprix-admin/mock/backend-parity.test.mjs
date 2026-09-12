import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildDemoLedger} from './demo-ledger.mjs';
import {createAnalyticsSnapshot} from './analytics-data.mjs';
test('task lifecycle follows backend publication and slot-full guards',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sprix-parity-'));
 const previous=process.env.MOCK_STATE_PATH;
 process.env.MOCK_STATE_PATH=join(dir,'state.json');
 try {
  const api=await import(`./demo-state.mjs?parity=${Date.now()}`);
  const ledger=buildDemoLedger(createAnalyticsSnapshot(7));
  for(const row of ledger.tasks) if(row.remainingSlots===0)assert.notEqual(row.taskStatus,'已发布');
  const task=ledger.tasks.findLast(row=>row.taskStatus==='已发布'&&row.executionTotal===0);
  assert.ok(task);
  await assert.rejects(api.applyDemoAction({id:task.id,action:'republish'}),/只有已下线/);
  await api.applyDemoAction({id:task.id,action:'offline',payload:{reason:'核对任务资料'}});
  await assert.rejects(api.applyDemoAction({id:task.id,action:'offline',payload:{reason:'重复下线'}}),/只有已发布/);
  await api.applyDemoAction({id:task.id,action:'republish'});
  const state=await api.readDemoState();
  assert.ok(state.patches[task.id].publishedAt);
  state.patches[task.id].totalSlots=1;
  await writeFile(process.env.MOCK_STATE_PATH,JSON.stringify(state));
  await api.applyDemoAction({id:task.id,action:'accept',payload:{owner:'parity-owner-00001',phone:'13800001234',agentId:'agent-1',agentName:'Codex Agent'}});
  const updated=await api.readDemoState();
  assert.equal(updated.patches[task.id].offlineReason,'SLOT_FULL');
  const full=buildDemoLedger(createAnalyticsSnapshot(7),updated).detail(task.id).task;
  assert.equal(full.remainingSlots,0);assert.equal(full.taskStatus,'已下线');
  await assert.rejects(api.applyDemoAction({id:task.id,action:'republish'}),/名额已满/);
 } finally {
  if(previous===undefined)delete process.env.MOCK_STATE_PATH;else process.env.MOCK_STATE_PATH=previous;
  await rm(dir,{recursive:true,force:true});
 }
});
