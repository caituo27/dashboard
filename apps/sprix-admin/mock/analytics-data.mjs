import {indexAt,agentsAt,publishedTaskCount,publicationTime,taskScenario,executionCountsAt} from "./business-scenario.mjs";
import { analyticsFromEvents } from "./analytics-events.mjs";
// Presentation model, not collected business data. A fixed epoch makes all
// processes and users agree; restarts never reset the totals.
export const BASELINE_AT = Date.parse("2026-09-12T04:00:00Z");
const DAY = 86_400_000;
const CHINA_OFFSET = 8 * 3_600_000;
const STARTED_AT = BASELINE_AT - 45 * DAY;
const REFRESH_INTERVAL = 10_000;
export const DASHBOARD_CUMULATIVE_TOTALS = Object.freeze({
  orders: 1_703_286,
  agents: 30_184,
  amount: 10_027_643.58
});

// The admin dashboard is a daily report. During a calendar day every request
// reads the same completed snapshot, cut off at 23:59 on the previous day.
export function dashboardCutoffAt(at = Date.now()) {
  const startOfToday = Math.floor((at + CHINA_OFFSET) / DAY) * DAY - CHINA_OFFSET;
  return startOfToday - 1_000;
}

export function createAnalyticsSnapshot(period, at = Date.now()) {
  if (period !== 7 && period !== 30) throw new RangeError("Unsupported analytics period");
  const isDailyCutoff = (at + CHINA_OFFSET + 1_000) % DAY === 0;
  const now = isDailyCutoff ? at : Math.floor(at / REFRESH_INTERVAL) * REFRESH_INTERVAL;
  const orders = indexAt(now);
  const agents = agentsAt(now);
  // Calendar buckets use Asia/Shanghai, independent of the host timezone.
  const midnight = Math.floor((now + CHINA_OFFSET) / DAY) * DAY - CHINA_OFFSET;
  const {running,reviewing,completed,terminated} = executionCountsAt(now);
  const taskTotal = publishedTaskCount(now);
  const taskPublications = Array.from({ length: 30 }, (_, index) => {
    const from = midnight - (29 - index) * DAY;
    const to = index === 29 ? now : from + DAY;
    return {
      date: new Date(from + CHINA_OFFSET).toISOString().slice(0, 10),
      count: publishedTaskCount(to) - publishedTaskCount(from)
    };
  });
  const amount = Math.round(orders * (10_000_000 / 1_700_000) * 100) / 100;
  const completedAmount = Math.floor(amount * completed / Math.max(1, orders) * 100) / 100;
  const platformFee = Math.floor(completedAmount * 0.10 * 100) / 100;
  const settlementNet = Math.round((completedAmount - platformFee) * 100) / 100;
  const paidAmount = settlementNet;
  const latestTasks = Array.from({length:Math.min(5,taskTotal)},(_,offset)=>{
    const id=taskTotal-offset;
    return {id:`demo:task:${id}`,...taskScenario(id),taskStatus:'已发布',publishedAt:new Date(publicationTime(id)).toISOString()};
  });
  return {
    period,
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
      taskPublications
    },
    generatedAt: new Date(now).toISOString(),
    overview: {
      orders,
      agents,
      users: 18_742,
      amount,
      operatingDays: Math.max(0, Math.floor((now - STARTED_AT) / DAY)),
      startedAt: new Date(STARTED_AT).toISOString()
    },
    ...analyticsFromEvents(period, now)
  };
}
