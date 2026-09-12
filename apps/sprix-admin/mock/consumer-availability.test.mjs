import {test} from 'node:test';
import assert from 'node:assert/strict';
import {viewPage} from './admin-views.mjs';

test('consumer availability is filtered before totals and paging without hiding admin records',()=>{
 const tasks=Array.from({length:8},(_,i)=>({id:`task-${i}`,title:`任务${i}`,publishedAt:`2026-09-12 12:00:0${7-i}`,taskStatus:i===3?'已下线':'已发布',remainingSlots:[0,2,0,4,1,0,3,0][i]}));
 const view={version:'test',lists:new Map(),ledger:{tasks}};
 // Warm the admin cache first: the consumer must not reuse that unfiltered list.
 assert.equal(viewPage(view,'tasks',{status:'已发布'}).total,7);
 const first=viewPage(view,'tasks',{status:'已发布',availableOnly:true,offset:0,limit:2});
 const second=viewPage(view,'tasks',{status:'已发布',availableOnly:true,offset:2,limit:2});
 assert.equal(first.total,3);assert.equal(second.total,3);
 assert.deepEqual(first.rows.map(row=>row.id),['task-1','task-4']);
 assert.deepEqual(second.rows.map(row=>row.id),['task-6']);
 assert.equal(viewPage(view,'tasks',{}).total,8);
 // A refreshed snapshot after the final place is accepted removes the card,
 // while its underlying record remains available for admin/detail views.
 tasks[1].remainingSlots=0;
 const refreshed={...view,version:'next',lists:new Map()};
 assert.equal(viewPage(refreshed,'tasks',{availableOnly:true}).total,2);
 assert.equal(viewPage(refreshed,'tasks',{}).rows.find(row=>row.id==='task-1').remainingSlots,0);
});
