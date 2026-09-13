import test from 'node:test';
import assert from 'node:assert/strict';
import {agentTypeMatchScore,agentTypeMatchesTaskCategory,businessProfile,businessProfileForBatchPosition,businessProfileForIdentity,MOCK_PHONE_POOL,MOCK_PROFILE_POOL} from './business-profile.mjs';
import {BUSINESS_SNAPSHOT_ID} from './business-metrics.mjs';
import {getView,viewPage} from './admin-views.mjs';

test('Mock identities preserve the supplied 40 account and phone bindings', () => {
  assert.equal(MOCK_PROFILE_POOL.length,40);
  assert.equal(MOCK_PHONE_POOL.length,40);
  assert.equal(new Set(MOCK_PHONE_POOL).size,40);
  assert.ok(MOCK_PHONE_POOL.every(phone=>/^1\d{10}$/.test(phone)));
  assert.ok(MOCK_PROFILE_POOL.every(profile=>profile.userName&&profile.identityStatus&&profile.agentType));
  const assigned=Array.from({length:400},(_,index)=>businessProfileForBatchPosition(index+1,index+1));
  assert.equal(new Set(assigned.map(profile=>profile.userName)).size,40);
  assert.equal(new Set(assigned.map(profile=>profile.phone)).size,40);
  assert.equal(new Set(assigned.map(profile=>profile.virtualPhone)).size,40);
  assert.deepEqual(new Set(assigned.map(profile=>profile.phone)),new Set(MOCK_PHONE_POOL));
  for(let offset=0;offset<assigned.length;offset+=40)assert.equal(new Set(assigned.slice(offset,offset+40).map(profile=>profile.phone)).size,40);
  const profile=businessProfile(17);
  assert.match(profile.userName,/^[a-z]{10}$/);
  assert.match(profile.phone,/^1\d{10}$/);
  assert.match(profile.virtualPhone,/^\+(?:44|49|81|971)\d+$/);
  assert.ok(MOCK_PHONE_POOL.includes(profile.phone));
  assert.equal(businessProfile(17).phone,businessProfile(17).phone);
  assert.equal(businessProfile(17).virtualPhone,businessProfile(17).virtualPhone);
  assert.equal(businessProfileForIdentity('same-user').userName,businessProfileForIdentity('same-user').userName);
  assert.equal(businessProfileForIdentity('same-user').phone,businessProfileForIdentity('same-user').phone);
});

test('capability matching remains available without changing a user identity', () => {
  const categories=['网站开发','营销','设计','数据标注','知识问答','其他'];
  for(const category of categories)assert.ok(MOCK_PROFILE_POOL.some(profile=>agentTypeMatchesTaskCategory(profile.agentType,category)),category);
  const profile=businessProfile(17);
  assert.equal(businessProfile(17,{category:'数据标注',title:'金融领域ALE任务包设计'}).phone,profile.phone);
  assert.equal(businessProfileForIdentity('same-user','营销').phone,businessProfileForIdentity('same-user','数据标注').phone);
});

test('specific task subject and delivery format outrank broad category matches', () => {
  const examples=[
    [{category:'数据标注',title:'基于CT的肾癌智能检测标注任务'},'ct下的胃部观察','法律、材料学'],
    [{category:'数据标注',title:'金融领域ALE任务包设计'},'经济学','计算机、算法'],
    [{category:'数据标注',title:'视觉媒体领域ALE任务包设计'},'视频剪辑，视频图片生成','法律、材料学'],
    [{category:'设计',title:'生成亲子营地HTML卡片'},'平面设计、网页设计','视频剪辑，视频图片生成'],
    [{category:'营销',title:'撰写亲子营地活动EDM邮件'},'品牌、策划','3D设计、建模、动画设计师'],
    [{category:'营销',title:'生成企业培训课程SEO词表'},'新媒体运营','开发'],
    [{category:'知识问答',title:'制作咖啡早鸟套餐分镜脚本'},'视频剪辑，视频图片生成','运营、职业规划'],
    [{category:'数据标注',title:'化学工程领域ALE任务包设计'},'法律、材料学','团队管理'],
    [{category:'数据标注',title:'天文与空间科学领域ALE任务包设计'},'计算机、算法','数据清洗'],
    [{category:'数据标注',title:'图像推理数据标注与采集'},'计算机、算法','设计、会展、传媒'],
    [{category:'数据标注',title:'土木工程领域ALE任务包设计'},'python、autocad、revit','计算机、算法'],
    [{category:'数据标注',title:'网络安全与数字取证领域ALE任务包设计'},'计算机、算法','ct下的胃部观察'],
    [{category:'营销',title:'生成银发旅游服务社媒素材'},'新媒体运营','校园大使运营'],
    [{category:'其他',title:'制作活动复盘PPT文件售前'},'设计、会展、传媒','零售'],
    [{category:'其他',title:'整理供应链协同渠道清单'},'用户运营、销售','零售'],
  ];
  for(const [task,related,unrelated] of examples){
    assert.ok(agentTypeMatchScore(related,task)>agentTypeMatchScore(unrelated,task),task.title);
  }
});

test('negative wording in task details does not contaminate title capability matching', () => {
  const task={category:'营销',title:'优化亲子营地活动详情页',acceptanceCriteria:'不得包含医疗、金融或教育效果承诺'};
  assert.ok(agentTypeMatchScore('平面设计、网页设计',task)>agentTypeMatchScore('ct下的胃部观察',task));
});

test('latest two task pages are industrial data-labeling tasks', async () => {
  const view=await getView(BUSINESS_SNAPSHOT_ID);
  const tasks=viewPage(view,'tasks',{offset:0,limit:40}).rows;
  assert.ok(tasks.every(task=>task.category==='\u6570\u636e\u6807\u6ce8'));
  assert.ok(tasks.every(task=>['\u5927\u6a21\u578b\u8bed\u6599\u6807\u6ce8','\u8ba1\u7b97\u673a\u89c6\u89c9\u6807\u6ce8','\u4ee3\u7801\u6570\u636e\u6807\u6ce8'].some(kind=>`${task.title} ${task.description}`.includes(kind))));
});
