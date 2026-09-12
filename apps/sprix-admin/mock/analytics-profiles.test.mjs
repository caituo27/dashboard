import { test } from 'node:test';
import assert from 'node:assert/strict';
import {eventStream,queryUserProfile} from './analytics-events.mjs';
const at = Date.parse('2026-09-12T04:00:00Z');
test('profile reconciles with user events and device context remains stable',()=>{
 const rows = eventStream(at);
 const user = rows.at(-1).user_id;
 const userRows = rows.filter(e=>e.user_id===user);
 const profile = queryUserProfile(user,at);
 assert.equal(profile.session_count,new Set(userRows.map(e=>e.session_id)).size);
 assert.equal(profile.first_seen,userRows[0].event_time);
 assert.equal(profile.last_seen,userRows.at(-1).event_time);
 assert.equal(profile.click_count,userRows.filter(e=>e.event_name==='button_click').length);
 assert.equal(profile.accepted_tasks,new Set(userRows.filter(e=>e.event_name==='task_accept_succeeded').map(e=>e.execution_id)).size);
 assert.equal(profile.page_views,userRows.filter(e=>['task_market_view','task_detail_view'].includes(e.event_name)).length);
 assert.deepEqual(profile.latest_context,queryUserProfile(user,at+10000).latest_context);
 assert.ok(userRows.every(e=>e.device_model===profile.latest_context.device_model));
 assert.equal(queryUserProfile('__proto__',at),null);
 assert.equal(queryUserProfile('visitor:30000',at),null);
});
test('cellular events have synthetic towers; wifi and wired events do not',()=>{
 for(const row of eventStream(at)) {
  assert.equal(row.context_source,'synthetic');
  if(['4G','5G'].includes(row.network_type)) {assert.match(row.base_station_id,/^DEMO-CELL-/);assert.ok(row.carrier);}
  else assert.equal(row.base_station_id,null);
 }
});

test('China regions cover different provinces and remain stable per visitor',async()=>{
 const {visitorContext}=await import('./analytics-profiles.mjs');
 const contexts=Array.from({length:1000},(_,i)=>visitorContext(i));
 assert.ok(contexts.every(row=>row.country==='中国'));
 assert.equal(new Set(contexts.map(row=>row.province)).size,31);
 for(let uid=0;uid<1000;uid++) assert.deepEqual(contexts[uid],visitorContext(uid));
});
