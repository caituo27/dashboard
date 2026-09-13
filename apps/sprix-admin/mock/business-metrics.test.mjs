import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUSINESS_CUTOFF_AT,
  BUSINESS_SNAPSHOT_ID,
  BUSINESS_PERIOD,
  createBusinessMetricsSnapshot,
  businessAudit,
  businessExecutionCount,
  businessTaskCount,
  businessTaskRecord,
  weeklyBusinessFacts
} from './business-metrics.mjs';
import {getView,viewPage} from './admin-views.mjs';

test('Excel weekly Agent totals reconcile with deterministic daily and type splits', () => {
  const snapshot=createBusinessMetricsSnapshot({startDate:BUSINESS_PERIOD.startDate,endDate:BUSINESS_PERIOD.endDate});
  for(const week of snapshot.weeks) {
    assert.equal(week.dailyNewAgents.reduce((sum,day)=>sum+day.total,0),week.newAgents);
    assert.equal(week.agentTypes.reduce((sum,item)=>sum+item.count,0),week.newAgents);
    for(const type of week.agentTypes) assert.equal(type.daily.reduce((sum,value)=>sum+value,0),type.count);
    const weekdayAverage=week.dailyNewAgents.slice(0,5).reduce((sum,day)=>sum+day.total,0)/5;
    for(const day of week.dailyNewAgents.slice(5)) assert.ok(day.total<=weekdayAverage*0.5);
  }
});

test('task masters, slots and executions reconcile with Excel 5.1', () => {
  const audit=businessAudit();
  assert.equal(businessTaskCount,10834);
  assert.equal(businessExecutionCount,16251);
  assert.equal(audit.slots,18370);
  assert.equal(audit.remainingSlots,2119);
  const counts=new Map();
  for(let index=1;index<=businessTaskCount;index++){
    const task=businessTaskRecord(index);
    counts.set(task.category,(counts.get(task.category)??0)+1);
  }
  assert.deepEqual(Object.fromEntries([...counts].sort(([a],[b])=>a.localeCompare(b,'zh-CN'))),{
    '其他':344,'数据标注':9134,'知识问答':45,'网站开发':37,'营销':929,'设计':345
  });
});

test('dashboard drilldown version pages the same fixed task facts', async () => {
  const view=await getView(BUSINESS_SNAPSHOT_ID);
  const page=viewPage(view,'tasks',{offset:0,limit:20,startDate:BUSINESS_PERIOD.startDate,endDate:BUSINESS_PERIOD.endDate,endAt:'2026-09-06 23:59:59'});
  assert.equal(page.version,BUSINESS_SNAPSHOT_ID);
  assert.equal(page.total,businessTaskCount);
  const orders=viewPage(view,'orders',{offset:0,limit:20,status:'completed',startDate:BUSINESS_PERIOD.startDate,endDate:BUSINESS_PERIOD.endDate,endAt:'2026-09-06 23:59:59'});
  assert.equal(orders.total,businessExecutionCount);
  assert.ok(orders.rows.every(row=>row.status==='completed'));
});

test('Excel weekly GMV, delivery, quality and settlement formulas reconcile', () => {
  const snapshot=createBusinessMetricsSnapshot({startDate:BUSINESS_PERIOD.startDate,endDate:BUSINESS_PERIOD.endDate});
  for(const week of snapshot.weeks) {
    assert.equal(week.taskTypes.reduce((sum,item)=>sum+item.amount,0),week.acceptedGmv);
    assert.equal(week.taskTypes.reduce((sum,item)=>sum+item.tasks,0),week.deliveredTasks);
    assert.ok(week.deliveredTasks>week.effectiveAgents);
    assert.equal(week.averageGmvPerEffectiveAgent,week.acceptedGmv/week.effectiveAgents);
    for(const item of week.taskTypes) {
      if(item.amount===0) { assert.equal(item.passRate,null); continue; }
      if(item.type==='\u6570\u636e\u6807\u6ce8') assert.ok(item.passRate>=0.25&&item.passRate<=0.35);
      else if(item.type==='\u5176\u4ed6') assert.ok(item.passRate>=0.39&&item.passRate<=1);
      else assert.ok(item.passRate>=0.9&&item.passRate<=1);
      assert.equal(item.pureAgentPending,Math.round(item.amount*item.passRate*0.1*100)/100);
      assert.equal(item.hybridPending,Math.round(item.amount*(1-item.passRate)*0.6*100)/100);
    }
  }
  assert.equal(snapshot.weeks.at(-1).taskTypes.find(item=>item.type==='\u5176\u4ed6').passRate,0.39);
});

test('arbitrary day ranges keep the imported weekly region fixed', () => {
  const snapshot=createBusinessMetricsSnapshot({startDate:'2026-08-05',endDate:'2026-08-12'});
  assert.equal(snapshot.weeks.length,6);
  assert.equal(snapshot.summary.acceptedGmv,1699400);
  assert.equal(snapshot.summary.heterogeneousRate,weeklyBusinessFacts[5].heterogeneousRate);
  assert.equal(snapshot.summary.effectiveAgents,weeklyBusinessFacts[5].effectiveAgents);
  assert.equal(snapshot.generatedAt,new Date(BUSINESS_CUTOFF_AT).toISOString());
});

test('single week dashboard values match the verified Excel totals', () => {
  const snapshot=createBusinessMetricsSnapshot({startDate:'2026-08-31',endDate:'2026-09-06'});
  assert.equal(snapshot.summary.newAgents,3605);
  assert.equal(snapshot.summary.acceptedGmv,1699400);
  assert.equal(snapshot.summary.deliveredTasks,4544);
  assert.equal(snapshot.summary.effectiveAgents,3544);
  assert.equal(snapshot.summary.heterogeneousRate,0.1274);
  assert.equal(Math.round(snapshot.summary.averageGmvPerEffectiveAgent*100)/100,165.55);
  const visibleWeeks=snapshot.weeks.filter(week=>week.dailyDelivery.length>0);
  assert.equal(visibleWeeks.length,1);
  assert.equal(visibleWeeks[0].dailyDelivery.length,7);
});

test('partial ranges filter day metrics while latest complete week follows only the end date', () => {
  const snapshot=createBusinessMetricsSnapshot({startDate:'2026-09-01',endDate:'2026-09-02'});
  const week=snapshot.weeks.find(item=>item.dailyDelivery.length>0);
  assert.ok(week);
  assert.deepEqual(week.dailyNewAgents.map(day=>day.date),['2026-09-01','2026-09-02']);
  assert.deepEqual(week.dailyDelivery.map(day=>day.date),['2026-09-01','2026-09-02']);
  assert.equal(snapshot.summary.deliveredTasks,week.dailyDelivery.reduce((sum,day)=>sum+day.tasks,0));
  assert.equal(week.taskTypes.reduce((sum,item)=>sum+item.tasks,0),snapshot.summary.deliveredTasks);
  assert.equal(snapshot.weeks.length,6);
  assert.equal(snapshot.summary.acceptedGmv,1699400);
  assert.equal(snapshot.summary.effectiveAgents,weeklyBusinessFacts[5].effectiveAgents);
  assert.equal(snapshot.summary.heterogeneousRate,weeklyBusinessFacts[5].heterogeneousRate);
  assert.equal(snapshot.summary.averageGmvPerEffectiveAgent,weeklyBusinessFacts[5].acceptedGmv/weeklyBusinessFacts[5].effectiveAgents);
});

test('changing only the start date does not change the latest complete week summary', () => {
  const full=createBusinessMetricsSnapshot({startDate:'2026-07-27',endDate:'2026-09-06'});
  const shortened=createBusinessMetricsSnapshot({startDate:'2026-09-01',endDate:'2026-09-06'});
  assert.equal(shortened.summary.acceptedGmv,full.summary.acceptedGmv);
  assert.equal(shortened.summary.heterogeneousRate,full.summary.heterogeneousRate);
  assert.equal(shortened.summary.effectiveAgents,full.summary.effectiveAgents);
  assert.equal(shortened.summary.averageGmvPerEffectiveAgent,full.summary.averageGmvPerEffectiveAgent);
});

test('task scale metrics remain the fixed cutoff snapshot for every query range', () => {
  for(const range of [
    {startDate:'2026-07-27',endDate:'2026-09-06'},
    {startDate:'2026-09-01',endDate:'2026-09-02'},
    {startDate:'2026-09-07',endDate:'2026-09-12'}
  ]){
    const snapshot=createBusinessMetricsSnapshot(range);
    assert.equal(snapshot.summary.masterTasks,businessTaskCount);
    assert.equal(snapshot.summary.executions,businessExecutionCount);
    assert.equal(snapshot.summary.remainingSlots,2119);
    assert.equal(snapshot.summary.slots,snapshot.summary.executions+snapshot.summary.remainingSlots);
  }
});

test('a range after the cutoff has no daily data but keeps the fixed weekly region', () => {
  const snapshot=createBusinessMetricsSnapshot({startDate:'2026-09-07',endDate:'2026-09-12'});
  assert.equal(snapshot.summary.newAgents,0);
  assert.equal(snapshot.weeks.length,6);
  assert.equal(snapshot.summary.acceptedGmv,1699400);
  assert.equal(snapshot.summary.heterogeneousRate,weeklyBusinessFacts[5].heterogeneousRate);
  assert.equal(snapshot.summary.effectiveAgents,weeklyBusinessFacts[5].effectiveAgents);
  assert.equal(snapshot.summary.averageGmvPerEffectiveAgent,weeklyBusinessFacts[5].acceptedGmv/weeklyBusinessFacts[5].effectiveAgents);
});
