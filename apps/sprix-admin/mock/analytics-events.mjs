import {businessProfile} from "./business-profile.mjs";
import {hash,indexAt,timeline,userForExecution,taskForOrder} from "./business-scenario.mjs";
import { visitorContext, profileFromEvents } from "./analytics-profiles.mjs";
// A deterministic sample of web journeys, tied to one candidate execution per 64 orders.
// This is sampled web analytics, not the complete stream of automatic Agent executions.
const DAY = 86400000;
export const stages = ['task_market_view', 'task_detail_view', 'task_accept_requested', 'task_accept_succeeded', 'delivery_submitted'];
export const buttonNames = ['查看任务详情','确认接单','智能接单','查看执行详情','连接本地 Agent','开始测评','设为当前执行 Agent','查看收益'];
const buttonPages=['任务市场','任务详情','任务市场','我的任务','首页','Agent 中心','Agent 中心','提现记录'];
let cache;
let summaries = new Map();
// A journey is deterministic. Retain its event objects across clock ticks;
// only the visible time window changes. Keep at most one 30-day window.
const dayEvents = new Map();
const eventTimes = new WeakMap();
export function eventStream(at = Date.now()) {
  const now = Math.floor(at / 10000) * 10000;
  if (cache?.now === now) return cache.events;
  const midnight = Math.floor((now + 28800000) / DAY) * DAY - 28800000;
  const events = [];
  summaries.clear();
  for (let d = 0; d < 30; d++) {
    const day = midnight - d * DAY;
    if (dayEvents.has(day)) {
      events.push(...dayEvents.get(day));
      continue;
    }
    const dayStartIndex = events.length;
    const first=indexAt(day), last=indexAt(day+DAY);
    const dayNumber=Math.floor((day+28800000)/DAY);
    const weekday=new Date(day+28800000).getUTCDay();
    const baseStride=[78,64,58,67,61,56,82][weekday];
    const sampleStride=baseStride+(hash(dayNumber,103)%7)-3;
    for (let executionIndex=(Math.floor(first/sampleStride)+1)*sampleStride; executionIndex<=last; executionIndex+=sampleStride) {
      const dates=timeline(executionIndex);
      const time=dates.accepted-180000-hash(executionIndex,93)%240000;
      const uid = userForExecution(executionIndex)-1;
      const context = visitorContext(uid);
      const journey = `sample-${executionIndex}`;
      const task = `demo:task:${taskForOrder(executionIndex)}`;
      const roll=hash(executionIndex,94)%100;
      const depth=context.device_type==='手机' ? (roll<60?0:1) : roll<22?0:roll<43?1:roll<61?2:roll<78?3:4;
      let sequence = 0;
      const add = (name, page, button, result = 'success') => {
        const milestone=result==='failure'?dates.accepted+50:name==='acceptance_completed'?dates.submitted+60_000:name===stages[3]?dates.accepted:name===stages[4]?dates.submitted:name===stages[2]?dates.accepted-2000:button===3?dates.accepted+15000:button===1||button===2?dates.accepted-5000:time+sequence*(3000+hash(executionIndex,95)%9000);
        const timestamp = milestone;
        const id = `evt:${journey}:${sequence++}`;
        if (timestamp < Date.parse("2026-07-29T04:00:00Z")) return;
        events.push({ event_id: id, event_name: name, schema_version: 2, ...context, event_time: new Date(timestamp).toISOString(), received_at: new Date(timestamp + 35 + hash(executionIndex+sequence,96)%1800).toISOString(), user_id: `visitor:${uid}`, user_name:businessProfile(uid+1).userName, agent_type:businessProfile(uid+1).agentName, anonymous_id: `anon:${uid}`, session_id: `session:${journey}`, page_id: page, button_id: button == null ? null : `button:${button}`, button_name: button == null ? null : buttonNames[button], referrer: 'task_market', channel: ['direct', 'search', 'campaign'][hash(uid,97)%3], task_id: task, execution_id: name === 'task_accept_succeeded' || name === 'delivery_submitted' ? `demo:execution:${executionIndex}` : null, agent_id: `demo:agent:${uid+1}`, agent_role: 'executor', result, error_code: result === 'failure' ? 'TASK_UNAVAILABLE' : null, duration_ms: name.includes('succeeded') || result === 'failure' ? 80+hash(executionIndex+sequence,98)%2400 : null, event_source: name==='delivery_submitted' ? 'agent' : name.includes('succeeded') || result === 'failure' ? 'server' : 'web', app: 'sprix', env: 'demo', release: '1.0.0', trace_id: `trace:${journey}`, action_id: `action:${journey}:${button ?? 'view'}`, journey_id: journey });
        eventTimes.set(events[events.length - 1], timestamp);
      };
      add(stages[0], 'task_market');
      if(depth>=1) {add('button_click','task_market',0);add(stages[1],'task_detail');}
      if(depth>=2) {
        add('button_click','task_detail',1);
        add(stages[2],'task_detail');
        if(depth>=3) {
          add(stages[3],'task_detail');
          add('button_click','my_tasks',3);
          add(stages[4],'execution_detail');
          if(hash(executionIndex,104)%100<92) add('acceptance_completed','execution_detail');
        } else add('task_action_failed','task_detail',1,'failure');
      }
      // Actual C-end entry points. Agent setup belongs to its own page, not task evaluation.
      if(context.device_type==='电脑' && hash(executionIndex,101)%5===0) {
        const button=2+hash(executionIndex,102)%6;
        const page=['task_market','my_tasks','landing','agent_center','agent_center','earnings'][button-2];
        add('button_click',page,button);
      }

    }
    dayEvents.set(day, events.slice(dayStartIndex));
  }
  for (const day of dayEvents.keys()) {
    if (day < midnight - 29 * DAY || day > midnight) dayEvents.delete(day);
  }
  const visible = events.filter(event => {
    const timestamp = eventTimes.get(event);
    return timestamp <= now && timestamp >= midnight - 29 * DAY;
  });
  visible.sort((a,b) => a.event_time.localeCompare(b.event_time) || a.event_id.localeCompare(b.event_id));
  cache = {now, events: visible};
  return visible;
}
const distinct = (rows) => new Set(rows.map(e => e.user_id || e.anonymous_id)).size;
export function aggregateEvents(events) {
  const views = events.filter(e => e.event_name === stages[0] || e.event_name === stages[1]);
  const clicks = events.filter(e => e.event_name === 'button_click');
  const cohorts = stages.map(() => new Set());
  const journeys = new Map();
  for (const event of events) {
    const index = stages.indexOf(event.event_name);
    if (index < 0 || event.result !== 'success') continue;
    const key = `${event.user_id || event.anonymous_id}:${event.journey_id}:${event.task_id}`;
    const previous = journeys.get(key);
    if (index === 0) journeys.set(key, {stage: 0, start: Date.parse(event.event_time), last: Date.parse(event.event_time)});
    else if (!previous || previous.stage !== index - 1 || Date.parse(event.event_time) < previous.last || Date.parse(event.event_time) - previous.start > DAY) continue;
    else { previous.stage = index; previous.last = Date.parse(event.event_time); }
    cohorts[index].add(event.user_id || event.anonymous_id);
  }
  return {pv: views.length, uv: distinct(views), clicks: clicks.length, funnel: cohorts.map(set => set.size), buttons: buttonNames.map((name,i) => {const rows = clicks.filter(e => e.button_id === `button:${i}`); return {name, page: buttonPages[i], clicks: rows.length, users: distinct(rows)};})};
}
export function analyticsFromEvents(period, at) {
  const now = Math.floor(at / 10000) * 10000;
  const midnight = Math.floor((now + 28800000) / DAY) * DAY - 28800000;
  const start = midnight - (period - 1) * DAY;
  return analyticsFromEventsRange(start, period, now);
}
export function analyticsFromEventsRange(start, period, at) {
  const now = Math.floor(at / 10000) * 10000;
  const stream = eventStream(now);
  const cacheKey = `${start}:${period}`;
  if (summaries.has(cacheKey)) return summaries.get(cacheKey);
  const end = start + period * DAY;
  const events = stream.filter(e => Date.parse(e.event_time) >= start && Date.parse(e.event_time) < end);
  const buckets = Array.from({length: period}, () => []);
  for (const event of events) buckets[Math.floor((Date.parse(event.event_time) - start) / DAY)]?.push(event);
  const daily = buckets.map((rows,i) => ({
    date: new Date(start + i * DAY + 28800000).toISOString().slice(0,10), ...aggregateEvents(rows)
  }));
  const summary = {...aggregateEvents(events), daily, visits: daily.map(d => d.pv)};
  summaries.set(cacheKey, summary);
  return summary;
}
export function queryEvents(params, at = Date.now()) {
  const period = Number(params.get('days') ?? 7);
  if (!Number.isSafeInteger(period) || period < 1 || period > 30) throw new Error('days 必须为 1 至 30');
  const page = Number(params.get('page') ?? 1);
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('无效页码');
  const now = Math.floor(at / 10000) * 10000;
  const cutoffDay = Math.floor((now + 28800000) / DAY) * DAY - 28800000;
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  const parseDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? Date.parse(`${value}T00:00:00+08:00`) : NaN;
  const start = startDate ? parseDate(startDate) : cutoffDay - (period - 1) * DAY;
  const end = endDate ? parseDate(endDate) + DAY : cutoffDay + DAY;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end > cutoffDay + DAY || start < cutoffDay - 29 * DAY) throw new Error('统计日期范围无效');
  let rows = eventStream(now).filter(e => Date.parse(e.event_time) >= start && Date.parse(e.event_time) < end);
  for (const field of ['event_name','result','channel','event_source','page_id','button_name']) {
    const value = params.get(field);
    if (value) rows = rows.filter(e => e[field] === value);
  }
  const date = params.get('date');
  if (date) rows = rows.filter(e => new Date(Date.parse(e.event_time) + 28800000).toISOString().slice(0,10) === date);
  const search = params.get('search')?.trim();
  if (search) rows = rows.filter(e => [e.event_id,e.user_id,e.task_id,e.execution_id,e.trace_id].some(v => v?.includes(search)));
  return {total: rows.length, page, pageSize: 20, generatedAt: new Date(now).toISOString(), rows: rows.slice().reverse().slice((page-1)*20,page*20)};
}

export function queryUserProfile(userId, at = Date.now()) {
  if (!/^visitor:(0|[1-9]\d*)$/.test(userId ?? '') || Number(userId.split(':')[1]) >= 30000) return null;
  return profileFromEvents(eventStream(at), userId);
}
