import {buildDemoLedger} from "./demo-ledger.mjs";
import {createAnalyticsSnapshot,BASELINE_AT} from "./analytics-data.mjs";
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {dashboardMockMiddleware} from './server.mjs';
import {compareRecords} from './record-order.mjs';
test('HTTP views return bounded, ordered stable pages and summary/detail endpoints',async()=>{
 const server=createServer((req,res)=>dashboardMockMiddleware(req,res,()=>{res.writeHead(404);res.end();}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/mock-api/admin/view`;
 const get=async params=>{const response=await fetch(`${base}?${new URLSearchParams(params)}`);assert.equal(response.status,200);return response.json();};
 try {
  for(const kind of ['tasks','acceptance','appeals','settlements','withdrawals','payouts','orders']){
   const first=await get({kind,offset:0,limit:8});
   assert.equal(first.rows.length,Math.min(8,first.total));
   const next=await get({kind,offset:8,limit:8,version:first.version});
   const rows=[...first.rows,...next.rows];
   assert.ok(rows.every((row,i)=>i===0||compareRecords(kind,rows[i-1],row)<=0),kind);
   assert.ok(!('tasks' in first));
   assert.ok(JSON.stringify(first).length<40000);
  }
  const first=await get({kind:'tasks',limit:1});
  const detail=await get({kind:'task-detail',id:first.rows[0].id,version:first.version});
  assert.equal(detail.task.id,first.rows[0].id);
  const summary=await get({kind:'dashboard'});
  assert.ok(summary.overview.orders>1000000);
  assert.ok(!('tasks' in summary));
  assert.equal((await fetch(`${base}?kind=tasks&limit=1000000`)).status,400);
  assert.equal((await fetch(`${base}?kind=__proto__`)).status,400);
  assert.equal((await fetch(`${base}?kind=tasks&version=missing`)).status,409);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('publication timestamps remain stable across refreshes instead of moving to now',()=>{
 const before=buildDemoLedger(createAnalyticsSnapshot(7,BASELINE_AT+7200000));
 const after=buildDemoLedger(createAnalyticsSnapshot(7,BASELINE_AT+7260000));
 for(const task of before.tasks.slice(-50)) assert.equal(task.publishedAt,after.detail(task.id).task.publishedAt);
 assert.equal(new Set(before.tasks.slice(-20).map(t=>t.publishedAt)).size,20);
});
