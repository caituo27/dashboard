import {indexAt,publishedTaskCount,publicationTime,taskScenario,executionCountsAt} from "./business-scenario.mjs";
import { analyticsFromEventsRange } from "./analytics-events.mjs";
// Presentation model, not collected business data. A fixed epoch makes all
// processes and users agree; restarts never reset the totals.
export const BASELINE_AT = Date.parse("2026-09-12T04:00:00Z");
const DAY = 86_400_000;
const CHINA_OFFSET = 8 * 3_600_000;
const STARTED_AT = BASELINE_AT - 45 * DAY;
const APPROVED_PERIOD_START = Date.parse("2026-09-05T00:00:00+08:00");
const APPROVED_CUTOFF_AT = Date.parse("2026-09-11T23:59:59+08:00");
const DAILY_SHAPE = Object.freeze([0.88, 0.94, 1.08, 1.02, 0.96, 1.04, 1.08]);
export const DASHBOARD_CUMULATIVE_TOTALS = Object.freeze({
  orders: 1_706_482,
  tasks: 1_428_376,
  users: 18_463,
  agents: 30_218,
  amount: 10_284_630
});
const APPROVED_WEEKLY = Object.freeze({
  acceptedGmv: {value:326_840,previous:290_260,change:12.6},
  activePublishingUsers: {value:3_842,previous:3_551,change:8.2},
  averagePublishingFrequency: {value:4.6,previous:4.7,change:-2.1},
  acceptedTasks: {value:11_154,previous:10_301,change:8.3},
  activeAgents: {value:2_846,previous:2_632,change:8.1},
  publishedTasks:17_826,
  agentAcceptedTasks:13_621,
  completedTasks:12_084,
  acceptancePassedTasks:11_154,
  acceptingAgents:{value:2_421,previous:2_252,change:7.5},
  uv:{value:26_824,previous:24_736,change:8.4},
  pv:{value:92_481,previous:82_486,change:12.1},
  pvPerUv:{value:3.45,previous:3.33,change:3.4}
});
const CATEGORY_TOTALS = [
  {category:'数据标注',count:608_432},
  {category:'工具类',count:453_211},
  {category:'内容处理',count:176_918},
  {category:'数据处理',count:112_683},
  {category:'其他',count:77_132}
];
// The admin dashboard is a daily report. During a calendar day every request
// reads the same completed snapshot, cut off at 23:59 on the previous day.
export function dashboardCutoffAt(at = Date.now()) {
  const startOfToday = Math.floor((at + CHINA_OFFSET) / DAY) * DAY - CHINA_OFFSET;
  return startOfToday - 1_000;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) throw new RangeError("日期格式必须为 YYYY-MM-DD");
  const timestamp = Date.parse(`${value}T00:00:00+08:00`);
  if (!Number.isFinite(timestamp) || new Date(timestamp + CHINA_OFFSET).toISOString().slice(0, 10) !== value) throw new RangeError("日期无效");
  return timestamp;
}

function analyticsRange(period, at, range) {
  const cutoffDay = Math.floor((at + CHINA_OFFSET) / DAY) * DAY - CHINA_OFFSET;
  if (!range) {
    if (!Number.isInteger(period) || period < 1 || period > 30) throw new RangeError("统计周期必须为 1 至 30 天");
    return { period, start: cutoffDay - (period - 1) * DAY, end: cutoffDay };
  }
  const start = parseDateKey(range.startDate);
  const end = parseDateKey(range.endDate);
  const selectedDays = Math.round((end - start) / DAY) + 1;
  if (start > end || selectedDays < 1 || selectedDays > 30) throw new RangeError("自定义统计周期必须为 1 至 30 天");
  if (end > cutoffDay || start < cutoffDay - 29 * DAY) throw new RangeError("只能选择最近 30 个完整自然日");
  return { period: selectedDays, start, end };
}

function rebalance(values, total) {
  if (!values.length) return [];
  const sum = values.reduce((result,value)=>result+value,0);
  const weighted = values.map(value=>Math.max(0,Math.round((sum ? value/sum : 1/values.length)*total)));
  weighted[weighted.length-1] += total-weighted.reduce((result,value)=>result+value,0);
  return weighted;
}
function weekKey(timestamp) { return new Date(timestamp+CHINA_OFFSET).toISOString().slice(0,10); }
function dayStartAt(timestamp) { return Math.floor((timestamp + CHINA_OFFSET) / DAY) * DAY - CHINA_OFFSET; }
function dayIndexAt(timestamp) { return Math.round((dayStartAt(timestamp) - APPROVED_PERIOD_START) / DAY); }
function dailyMetric(weeklyTotal, timestamp, shift = 0, weeklyGrowth = 1.035) {
  const dayIndex = dayIndexAt(timestamp);
  const weekOffset = Math.floor(dayIndex / 7);
  const dayInWeek = ((dayIndex % 7) + 7) % 7;
  const weekTotal = Math.max(0, Math.round(weeklyTotal * Math.pow(weeklyGrowth, weekOffset)));
  const values = DAILY_SHAPE.map((_,index)=>Math.round(weekTotal / 7 * DAILY_SHAPE[(index+shift)%7]));
  values[6] += weekTotal-values.reduce((total,value)=>total+value,0);
  return values[dayInWeek];
}
function dailyBusinessAt(timestamp) {
  const publishedTasks = dailyMetric(APPROVED_WEEKLY.publishedTasks, timestamp, 0, 17_826/17_358);
  const acceptedTasks = Math.min(publishedTasks, dailyMetric(APPROVED_WEEKLY.agentAcceptedTasks, timestamp, 0, 13_621/12_897));
  const completedTasks = Math.min(acceptedTasks, dailyMetric(APPROVED_WEEKLY.completedTasks, timestamp, 0, 12_084/11_233));
  const acceptancePassedTasks = Math.min(completedTasks, dailyMetric(APPROVED_WEEKLY.acceptancePassedTasks, timestamp, 0, 11_154/10_301));
  return {
    date: weekKey(timestamp),
    timestamp,
    publishedTasks,
    acceptedTasks,
    completedTasks,
    acceptancePassedTasks,
    acceptedGmv: dailyMetric(APPROVED_WEEKLY.acceptedGmv.value, timestamp, 4, APPROVED_WEEKLY.acceptedGmv.value/APPROVED_WEEKLY.acceptedGmv.previous),
    uv: dailyMetric(APPROVED_WEEKLY.uv.value, timestamp, 5, APPROVED_WEEKLY.uv.value/APPROVED_WEEKLY.uv.previous),
    pv: dailyMetric(APPROVED_WEEKLY.pv.value, timestamp, 6, APPROVED_WEEKLY.pv.value/APPROVED_WEEKLY.pv.previous)
  };
}
function dailyBusinessRange(start, period) {
  return Array.from({length:period},(_,index)=>dailyBusinessAt(start+index*DAY));
}
function sumRows(rows,key) { return rows.reduce((total,row)=>total+row[key],0); }
function changeOf(value, previous, difference = false) {
  const change = difference
    ? Math.round((value - previous) * 10) / 10
    : Math.round((value / Math.max(1, previous) - 1) * 1_000) / 10;
  return {value,previous,change};
}
function periodParticipation(weeklyValue, rows, weeklyGrowth = 1.035) {
  const endGrowth = Math.pow(weeklyGrowth, Math.floor(dayIndexAt(rows.at(-1)?.timestamp ?? APPROVED_PERIOD_START) / 7));
  return Math.round(weeklyValue * Math.sqrt(rows.length / 7) * endGrowth);
}
function dailyParticipation(weeklyValue, row, weeklyGrowth, shift = 0) {
  const index=dayIndexAt(row.timestamp);
  const shape=DAILY_SHAPE[((index+shift)%7+7)%7];
  return Math.round(weeklyValue*Math.pow(weeklyGrowth,Math.floor(index/7))*(0.78+shape*0.18));
}
function rate(numerator, denominator) { return Math.round(numerator / Math.max(1, denominator) * 1_000) / 10; }
function cumulativeOverview(now) {
  const currentDay = dayStartAt(now);
  const anchorDay = dayStartAt(APPROVED_CUTOFF_AT);
  const direction = currentDay >= anchorDay ? 1 : -1;
  const rows = [];
  for (let day = direction > 0 ? anchorDay + DAY : currentDay + DAY; direction > 0 ? day <= currentDay : day <= anchorDay; day += DAY) rows.push(dailyBusinessAt(day));
  const signed = value => direction * value;
  return {
    orders:DASHBOARD_CUMULATIVE_TOTALS.orders+signed(sumRows(rows,'acceptedTasks')),
    tasks:DASHBOARD_CUMULATIVE_TOTALS.tasks+signed(sumRows(rows,'publishedTasks')),
    users:DASHBOARD_CUMULATIVE_TOTALS.users+signed(rows.reduce((total,row)=>total+dailyMetric(154,row.timestamp,2),0)),
    agents:DASHBOARD_CUMULATIVE_TOTALS.agents+signed(rows.reduce((total,row)=>total+dailyMetric(217,row.timestamp,4),0)),
    amount:DASHBOARD_CUMULATIVE_TOTALS.amount+signed(sumRows(rows,'acceptedGmv'))
  };
}
function trendBuckets(selected) {
  const bucketDays=selected.period<=14?1:7;
  return Array.from({length:Math.ceil(selected.period/bucketDays)},(_,index)=>{
    const start=selected.start+index*bucketDays*DAY;
    const end=Math.min(selected.end,start+(bucketDays-1)*DAY);
    return {startDate:weekKey(start),endDate:weekKey(end),days:Math.round((end-start)/DAY)+1};
  });
}
function periodTrendPoints(selected,dailyBusiness) {
  const buckets=trendBuckets(selected);
  const keys=['acceptedGmv','publishedTasks','acceptedTasks','completedTasks'];
  const result={};
  for(const metric of keys){
    const values=buckets.map(bucket=>dailyBusiness.filter(row=>row.date>=bucket.startDate&&row.date<=bucket.endDate).reduce((total,row)=>total+row[metric],0));
    result[metric]=buckets.map((bucket,index)=>({...bucket,value:values[index],previous:index?values[index-1]:undefined}));
  }
  const averageValues=buckets.map(bucket=>{
    const rows=dailyBusiness.filter(row=>row.date>=bucket.startDate&&row.date<=bucket.endDate);
    return Math.round(sumRows(rows,'acceptedGmv')/Math.max(1,sumRows(rows,'acceptancePassedTasks'))*10)/10;
  });
  result.averageTaskValue=buckets.map((bucket,index)=>({...bucket,value:averageValues[index],previous:index?averageValues[index-1]:undefined}));
  return result;
}

export function createAnalyticsSnapshot(period = 7, at = Date.now(), range) {
  const isDailyCutoff = (at + CHINA_OFFSET + 1_000) % DAY === 0;
  const now = isDailyCutoff ? at : dashboardCutoffAt(at);
  const selected = analyticsRange(period, now, range);
  const orders = indexAt(now);
  const {running,reviewing,completed,terminated} = executionCountsAt(now);
  const taskTotal = publishedTaskCount(now);
  const amount = Math.round(orders * (10_000_000 / 1_700_000) * 100) / 100;
  const completedAmount = Math.floor(amount * completed / Math.max(1, orders) * 100) / 100;
  const platformFee = Math.floor(completedAmount * 0.10 * 100) / 100;
  const settlementNet = Math.round((completedAmount - platformFee) * 100) / 100;
  const paidAmount = settlementNet;
  const latestTasks = Array.from({length:Math.min(5,taskTotal)},(_,offset)=>{
    const id=taskTotal-offset;
    return {id:`demo:task:${id}`,...taskScenario(id),taskStatus:'已发布',publishedAt:new Date(publicationTime(id)).toISOString()};
  });
  const rawAnalytics = analyticsFromEventsRange(selected.start, selected.period, now);
  const businessDays = dailyBusinessRange(selected.start,selected.period);
  const previousDays = dailyBusinessRange(selected.start-selected.period*DAY,selected.period);
  const daily = rawAnalytics.daily.map((day,index)=>({...day,pv:businessDays[index].pv,uv:Math.min(businessDays[index].uv,businessDays[index].pv)}));
  const total = key => sumRows(businessDays,key);
  const previousTotal = key => sumRows(previousDays,key);
  const publishedTasks=total('publishedTasks');
  const acceptedTaskCount=total('acceptedTasks');
  const completedTaskCount=total('completedTasks');
  const passedTaskCount=total('acceptancePassedTasks');
  const previousPublishedTasks=previousTotal('publishedTasks');
  const previousAcceptedTasks=previousTotal('acceptedTasks');
  const previousCompletedTasks=previousTotal('completedTasks');
  const previousPassedTasks=previousTotal('acceptancePassedTasks');
  const taskOperations = {
    publishedTasks,
    acceptedTasks:acceptedTaskCount,
    completedTasks:completedTaskCount,
    acceptancePassedTasks:passedTaskCount,
    acceptanceRate:changeOf(rate(acceptedTaskCount,publishedTasks),rate(previousAcceptedTasks,previousPublishedTasks),true),
    completionRate:changeOf(rate(completedTaskCount,acceptedTaskCount),rate(previousCompletedTasks,previousAcceptedTasks),true),
    acceptancePassedRate:changeOf(rate(passedTaskCount,completedTaskCount),rate(previousPassedTasks,previousCompletedTasks),true)
  };
  const acceptingAgentGrowth=APPROVED_WEEKLY.acceptingAgents.value/APPROVED_WEEKLY.acceptingAgents.previous;
  const currentAcceptingAgents=periodParticipation(APPROVED_WEEKLY.acceptingAgents.value,businessDays,acceptingAgentGrowth);
  const previousAcceptingAgents=periodParticipation(APPROVED_WEEKLY.acceptingAgents.value,previousDays,acceptingAgentGrowth);
  const acceptingAgents=changeOf(currentAcceptingAgents,previousAcceptingAgents);
  const acceptedGmv=changeOf(total('acceptedGmv'),previousTotal('acceptedGmv'));
  const acceptedTasks=changeOf(passedTaskCount,previousPassedTasks);
  const averageValue=Math.round(acceptedGmv.value/Math.max(1,acceptedTasks.value)*10)/10;
  const previousAverageValue=Math.round(acceptedGmv.previous/Math.max(1,acceptedTasks.previous)*10)/10;
  const fulfillment=rate(passedTaskCount,publishedTasks);
  const previousFulfillment=rate(previousPassedTasks,previousPublishedTasks);
  const acceptedPerAgent=Math.round(acceptedTaskCount/Math.max(1,acceptingAgents.value)*10)/10;
  const previousAcceptedPerAgent=Math.round(previousAcceptedTasks/Math.max(1,acceptingAgents.previous)*10)/10;
  const publishingUserGrowth=APPROVED_WEEKLY.activePublishingUsers.value/APPROVED_WEEKLY.activePublishingUsers.previous;
  const activeAgentGrowth=APPROVED_WEEKLY.activeAgents.value/APPROVED_WEEKLY.activeAgents.previous;
  const currentActivePublishingUsers=periodParticipation(APPROVED_WEEKLY.activePublishingUsers.value,businessDays,publishingUserGrowth);
  const previousActivePublishingUsers=periodParticipation(APPROVED_WEEKLY.activePublishingUsers.value,previousDays,publishingUserGrowth);
  const currentActiveAgents=periodParticipation(APPROVED_WEEKLY.activeAgents.value,businessDays,activeAgentGrowth);
  const previousActiveAgents=periodParticipation(APPROVED_WEEKLY.activeAgents.value,previousDays,activeAgentGrowth);
  const businessResults = {
    acceptedGmv,
    activePublishingUsers:changeOf(currentActivePublishingUsers,previousActivePublishingUsers),
    averagePublishingFrequency:changeOf(Math.round(publishedTasks/Math.max(1,currentActivePublishingUsers)*10)/10,Math.round(previousPublishedTasks/Math.max(1,previousActivePublishingUsers)*10)/10),
    averageTaskValue:changeOf(averageValue,previousAverageValue),
    acceptedTasks,
    fulfillmentRate:changeOf(fulfillment,previousFulfillment,true),
    activeAgents:changeOf(currentActiveAgents,previousActiveAgents),
    averageAcceptedTasksPerAgent:changeOf(acceptedPerAgent,previousAcceptedPerAgent)
  };
  const activeSeries = businessDays.map(row=>dailyParticipation(APPROVED_WEEKLY.activeAgents.value,row,activeAgentGrowth,0));
  const acceptingSeries = businessDays.map((row,index)=>Math.min(activeSeries[index],dailyParticipation(APPROVED_WEEKLY.acceptingAgents.value,row,acceptingAgentGrowth,2)));
  const behaviors = [
    {name:'查看任务详情',eventName:'task_detail_view',users:12_329,count:31_826,conversion:45.9},
    {name:'接单',eventName:'task_accept_succeeded',users:5_842,count:12_301,conversion:21.6},
    {name:'提交成果',eventName:'delivery_submitted',users:4_982,count:8_736,conversion:18.4},
    {name:'验收任务',eventName:'acceptance_completed',users:3_461,count:5_228,conversion:12.1}
  ].map(item=>{
    const count=Math.round(publishedTasks*(item.count/APPROVED_WEEKLY.publishedTasks));
    const users=Math.min(count,Math.round(count*(item.users/item.count)));
    return {...item,count,users,conversion:Math.round(users/Math.max(1,total('uv'))*1_000)/10};
  });
  const overview=cumulativeOverview(now);
  const categoryCounts=rebalance(CATEGORY_TOTALS.map(item=>item.count),overview.tasks);
  return {
    period:selected.period,
    periodStart:new Date(selected.start + CHINA_OFFSET).toISOString().slice(0, 10),
    periodEnd:new Date(selected.end + CHINA_OFFSET).toISOString().slice(0, 10),
    latestTasks,
    finance: { completedAmount, platformFee, settlementNet, paidAmount, remainingNet: Math.round((settlementNet - paidAmount) * 100) / 100 },
    operations: {
      taskTotal,
      publishedTasks: Math.floor(taskTotal * 0.84),
      executions: { running, reviewing, completed, terminated },
      paidAmount,
      pendingWithdrawals: 0,
      pendingPayouts: 0,
      appeals: Math.floor(Math.max(0,orders-running-reviewing)/825),
      taskPublications: businessDays.map(item=>({date:item.date,count:item.publishedTasks})),
      publishedTaskCategories:CATEGORY_TOTALS.map((item,index)=>({...item,count:categoryCounts[index]}))
    },
    generatedAt: new Date(now).toISOString(),
    overview: {
      ...overview,
      operatingDays: Math.max(0, Math.floor((now - STARTED_AT) / DAY)),
      startedAt: new Date(STARTED_AT).toISOString()
    },
    businessResults,
    taskOperations,
    businessTrends:periodTrendPoints(selected,businessDays),
    agentEcosystem:{
      totalAgents:overview.agents,
      activeAgents:businessResults.activeAgents,
      acceptingAgents,
      averageAcceptedTasksPerAgent:businessResults.averageAcceptedTasksPerAgent,
      daily:daily.map((day,index)=>({date:day.date,activeAgents:activeSeries[index],acceptingAgents:acceptingSeries[index]}))
    },
    behaviors,
    ...rawAnalytics,
    daily,
    pv:total('pv'),
    uv:total('uv'),
    visits:daily.map(day=>day.pv)
  };
}
