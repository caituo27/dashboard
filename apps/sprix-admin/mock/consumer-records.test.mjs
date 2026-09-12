import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {businessProfile} from './business-profile.mjs';
import {visitorContext} from './analytics-profiles.mjs';
import {indexAt,agentsAt,publishedTaskCount,clock,executionDuration} from './business-scenario.mjs';
import {buildDemoLedger} from './demo-ledger.mjs';
import {createAnalyticsSnapshot} from './analytics-data.mjs';
import {eventStream} from './analytics-events.mjs';

test('profiles and traffic follow desktop consumer capabilities; growth streams differ',()=>{
 let desktop=0;
 for(let n=1;n<=10000;n++) {
  const p=businessProfile(n);assert.equal(p.userName,`用户${p.phone.slice(-4)}`);
  assert.ok(['Codex Agent','Claude Code','OpenCode Agent','Hermes Agent'].includes(p.agentName));
  if(visitorContext(n).device_type==='电脑')desktop++;
 }
 assert.ok(desktop>9200&&desktop<9600);
 const at=Date.parse('2026-09-12T04:00:00Z');
 const deltas=fn=>new Set(Array.from({length:360},(_,n)=>fn(at+(n+1)*10000)-fn(at+n*10000)));
 assert.ok(deltas(indexAt).size>3);assert.ok(deltas(agentsAt).has(0));assert.ok(deltas(publishedTaskCount).has(0));
 for(let n=100;n<1700000;n+=4519)assert.ok(Math.abs(indexAt(clock(n))-n)<=1);
 for(const event of eventStream(at)) {
  assert.ok(!['评估任务','提交交付','确认接取'].includes(event.button_name));
  if(event.device_type==='手机') assert.ok(!['task_accept_requested','task_accept_succeeded','delivery_submitted'].includes(event.event_name));
  if(event.event_name==='delivery_submitted')assert.equal(event.event_source,'agent');
 }
});

test('consumer HTTP page/detail/accept shares persistent admin execution and review state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sprix-consumer-'));
 process.env.MOCK_STATE_PATH=join(dir,'state.json');
 const {dashboardMockMiddleware}=await import('./server.mjs');
 const {readDemoState}=await import('./demo-state.mjs');
 const server=createServer((req,res)=>dashboardMockMiddleware(req,res,()=>{res.writeHead(404);res.end();}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/mock-api`;
 const get=async path=>{const r=await fetch(base+path);assert.equal(r.status,200,await r.clone().text());return r.json();};
 const post=async(path,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200,await r.clone().text());return r.json();};
 try {
  const first=await get('/consumer/view?kind=tasks&limit=20');const second=await get('/consumer/view?kind=tasks&offset=20&limit=20');
  assert.ok([...first.rows,...second.rows].every(row=>row.taskStatus==='已发布'&&row.remainingSlots>0));
  assert.equal(first.rows.length,20);assert.ok(second.rows.every(row=>!first.rows.some(r=>r.id===row.id)));
  const task=first.rows.find(row=>row.remainingSlots>1);assert.ok(task);
  const detail=await get(`/admin/view?kind=task-detail&id=${task.id}`);assert.equal(task.title,detail.task.title);assert.equal(task.reward,detail.task.reward);
  const owner='test-consumer-owner-0001';
  const input={id:task.id,payload:{owner,phone:'13800001234',agentId:'local-codex',agentName:'Codex Agent'}};
  const accepted=await post('/consumer/accept',input);
  assert.deepEqual(await post('/consumer/accept',input),accepted);
  let mine=await get(`/consumer/view?kind=my-tasks&owner=${owner}`);assert.equal(mine.rows.length,1);assert.equal(mine.rows[0].status,'执行中');
  assert.equal((await get('/consumer/view?kind=my-tasks&owner=other')).rows.length,0);
  const after=await get(`/admin/view?kind=task-detail&id=${task.id}`);
  assert.equal(after.task.executionTotal,detail.task.executionTotal+1);
  assert.ok(after.records.running.some(row=>row.executionId===accepted.id&&row.userName==='用户1234'));
  // Advance only isolated persisted test data; no real backend or live mock mutations.
  const state=await readDemoState();state.consumerExecutions[0].startedAt=new Date(Date.now()-executionDuration(Number(accepted.id.split(':')[2]),task.category)-10000).toISOString();
  await writeFile(process.env.MOCK_STATE_PATH,JSON.stringify(state));
  const review=await get(`/admin/view?kind=acceptance-detail&id=${accepted.id}`);assert.equal(review.executionId,accepted.id);
  await post('/admin/actions',{id:accepted.id,action:'approve'});
  mine=await get(`/consumer/view?kind=my-tasks&owner=${owner}`);assert.equal(mine.rows[0].status,'已结算');
  const settled=await get('/admin/view?kind=settlements&limit=20');
  const row=settled.rows.find(row=>row.executionId===accepted.id);assert.ok(row);assert.equal(row.taskIncome,task.reward);
  assert.equal(Math.round(row.netIncome*100),Math.floor((Math.round(row.taskIncome*100)*9+5)/10));
  assert.equal(Math.round(row.platformFee*100),Math.floor((Math.round(row.taskIncome*100)+5)/10));
  const future=buildDemoLedger(createAnalyticsSnapshot(7,Date.now()+86400000),await readDemoState());
  const futureTask=future.tasks.find(row=>row.id===task.id);
  assert.ok(futureTask.executionTotal<=futureTask.totalSlots);
  assert.equal(futureTask.remainingSlots,futureTask.totalSlots-futureTask.executionTotal);
 } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
