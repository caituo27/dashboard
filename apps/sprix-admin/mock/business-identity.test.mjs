import test from 'node:test';
import assert from 'node:assert/strict';
import {businessProfile,businessProfileForIdentity,MOCK_PHONE_POOL,MOCK_PROFILE_POOL} from './business-profile.mjs';
import {BUSINESS_SNAPSHOT_ID} from './business-metrics.mjs';
import {getView,viewPage} from './admin-views.mjs';

test('Mock identity deterministically reuses the supplied 40 bound profiles', () => {
  assert.equal(MOCK_PROFILE_POOL.length,40);
  assert.equal(MOCK_PHONE_POOL.length,40);
  assert.equal(new Set(MOCK_PHONE_POOL).size,40);
  assert.ok(MOCK_PHONE_POOL.every(phone=>/^1\d{10}$/.test(phone)));
  assert.ok(MOCK_PROFILE_POOL.every(profile=>profile.userName&&profile.identityStatus&&profile.agentType));
  const assigned=Array.from({length:400},(_,index)=>businessProfile(index+1).phone);
  assert.equal(new Set(assigned).size,40);
  const profile=businessProfile(17);
  const source=MOCK_PROFILE_POOL.find(item=>item.phone===profile.phone);
  assert.equal(profile.userName,source.userName);
  assert.equal(profile.identityStatus,source.identityStatus);
  assert.equal(profile.agentType,source.agentType);
  assert.equal(businessProfile(17).phone,businessProfile(17).phone);
  assert.equal(businessProfileForIdentity('same-user').phone,businessProfileForIdentity('same-user').phone);
  assert.ok(MOCK_PHONE_POOL.includes(businessProfileForIdentity('same-user').phone));
});

test('latest two task pages are industrial data-labeling tasks', async () => {
  const view=await getView(BUSINESS_SNAPSHOT_ID);
  const tasks=viewPage(view,'tasks',{offset:0,limit:40}).rows;
  assert.ok(tasks.every(task=>task.category==='\u6570\u636e\u6807\u6ce8'));
  assert.ok(tasks.every(task=>['\u5927\u6a21\u578b\u8bed\u6599\u6807\u6ce8','\u8ba1\u7b97\u673a\u89c6\u89c9\u6807\u6ce8','\u4ee3\u7801\u6570\u636e\u6807\u6ce8'].some(kind=>`${task.title} ${task.description}`.includes(kind))));
});
