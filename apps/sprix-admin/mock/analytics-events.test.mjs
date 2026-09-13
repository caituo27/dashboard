import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregateEvents, analyticsFromEvents, eventStream, queryEvents, stages} from './analytics-events.mjs';
const at = Date.parse('2026-09-12T04:00:00Z');
test('event identity, pagination, filters and exact aggregate reconciliation',()=>{
 const rows=eventStream(at);
 assert.equal(new Set(rows.map(e=>e.event_id)).size,rows.length);
 const all=analyticsFromEvents(30,at);
 assert.equal(all.pv,rows.filter(e=>[stages[0],stages[1]].includes(e.event_name)).length);
 assert.ok(all.uv < all.daily.reduce((sum,d)=>sum+d.uv,0));
 const first=queryEvents(new URLSearchParams('days=30&page=1&result=failure'),at);
 const next=queryEvents(new URLSearchParams('days=30&page=2&result=failure'),at);
 assert.equal(first.total,rows.filter(e=>e.result==='failure').length);
 assert.equal(first.rows.length,10);
 assert.ok(first.rows.every(e=>e.result==='failure' && e.error_code));
 assert.ok(next.rows.every(e=>!first.rows.some(r=>r.event_id===e.event_id)));
 assert.throws(()=>queryEvents(new URLSearchParams('page=NaN'),at));
});
test('funnel requires ordered successful events for same user, task and 24-hour window',()=>{
 const e=(index,time=at,extra={})=>({event_name:stages[index],event_time:new Date(time).toISOString(),user_id:'u',journey_id:'j',task_id:'t',result:'success',...extra});
 assert.deepEqual(aggregateEvents([e(0),e(1,at+1),e(2,at+2)]).funnel,[1,1,1,0,0]);
 for(const rows of [[e(1),e(0)],[e(0),e(1,at+86400001)],[e(0),e(1,at+1,{task_id:'other'})],[e(0),e(1,at+1,{result:'failure'})]]) assert.deepEqual(aggregateEvents(rows).funnel,[1,0,0,0,0]);
 assert.equal(aggregateEvents([e(0),e(0,at+86400000,{journey_id:'next'})]).uv,1);
});

test('cross-midnight delivery completes the period funnel without completing either daily funnel',()=>{
 const midnight=Date.parse('2026-09-12T00:00:00+08:00');
 const events=stages.map((name,i)=>({event_name:name,event_time:new Date(midnight-60000+i*20000).toISOString(),user_id:'cross-day',journey_id:'one-task',task_id:'task',result:'success'}));
 assert.deepEqual(aggregateEvents(events).funnel,[1,1,1,1,1]);
 assert.equal(aggregateEvents(events.filter(e=>Date.parse(e.event_time)<midnight)).funnel[4],0);
 assert.equal(aggregateEvents(events.filter(e=>Date.parse(e.event_time)>=midnight)).funnel[4],0);
});
