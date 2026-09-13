import {describe,expect,it} from 'vitest';
import type {BusinessWeek} from '../services/dashboardAnalyticsMock';
import {AGENT_STRUCTURE_COLORS,TASK_STRUCTURE_COLORS,buildDailyAgentTypeComposition,buildQualityWeekSummary,buildTaskTypeComposition,selectDashboardWeekScopes} from './DashboardBusinessMetrics';

const week=(overrides:Partial<BusinessWeek>):BusinessWeek=>({
  label:'07.27–08.02',startDate:'2026-07-27',endDate:'2026-08-02',newAgents:100,
  heterogeneousRate:0,acceptedGmv:0,effectiveAgents:0,deliveredTasks:0,masterTasks:0,
  slots:0,averageGmvPerEffectiveAgent:0,dailyNewAgents:[],dailyDelivery:[],agentTypes:[],taskTypes:[],
  ...overrides
});

describe('Dashboard type structure',()=>{
  it('uses the approved visual-reference palette only inside this module',()=>{
    expect(AGENT_STRUCTURE_COLORS).toEqual(['#3498f5','#ff8a3d','#57c978','#e979b5','#9272e6','#35b7b3']);
    expect(TASK_STRUCTURE_COLORS).toEqual({primary:'#3498f5',secondary:'#86b7e7'});
  });

  it('builds one 100% Agent composition bar for every selected date',()=>{
    const rows=buildDailyAgentTypeComposition([week({
      dailyNewAgents:[{date:'2026-08-31',total:60},{date:'2026-09-01',total:40}],
      agentTypes:[
        {type:'工程师（算法/开发）',count:80,daily:[50,30]},
        {type:'其他',count:20,daily:[10,10]}
      ]
    })]);

    expect(rows.map(item=>item.date)).toEqual(['2026-08-31','2026-09-01']);
    expect(rows.map(item=>item.total)).toEqual([60,40]);
    expect(rows[0].segments.map(item=>item.count)).toEqual([50,10]);
    expect(rows[0].segments.reduce((sum,item)=>sum+item.share,0)).toBe(1);
    expect(rows[1].segments.map(item=>item.share)).toEqual([0.75,0.25]);
  });

  it('sorts task types by count and derives percentage from the selected-period total',()=>{
    const rows=buildTaskTypeComposition([week({
      taskTypes:[
        {type:'其他',tasks:516,daily:[],amount:0,passRate:null,autoDeliveryAmount:0,manualDeliveryAmount:0,pureAgentPending:0,hybridPending:0},
        {type:'数据标注',tasks:13701,daily:[],amount:0,passRate:null,autoDeliveryAmount:0,manualDeliveryAmount:0,pureAgentPending:0,hybridPending:0},
        {type:'营销',tasks:1393,daily:[],amount:0,passRate:null,autoDeliveryAmount:0,manualDeliveryAmount:0,pureAgentPending:0,hybridPending:0},
        {type:'设计',tasks:518,daily:[],amount:0,passRate:null,autoDeliveryAmount:0,manualDeliveryAmount:0,pureAgentPending:0,hybridPending:0},
        {type:'知识问答',tasks:68,daily:[],amount:0,passRate:null,autoDeliveryAmount:0,manualDeliveryAmount:0,pureAgentPending:0,hybridPending:0},
        {type:'网站开发',tasks:55,daily:[],amount:0,passRate:null,autoDeliveryAmount:0,manualDeliveryAmount:0,pureAgentPending:0,hybridPending:0}
      ]
    })]);

    expect(rows.map(item=>item.type)).toEqual(['数据标注','营销','设计','其他','知识问答','网站开发']);
    expect(rows.reduce((sum,item)=>sum+item.count,0)).toBe(16251);
    expect(rows[0].share).toBeCloseTo(13701/16251);
  });
});

describe('Dashboard time scopes',()=>{
  it('separates selected-day data from the fixed imported weekly series',()=>{
    const weeks=[
      week({label:'08.24–08.30',startDate:'2026-08-24',endDate:'2026-08-30'}),
      week({label:'08.31–09.06',startDate:'2026-08-31',endDate:'2026-09-06',dailyNewAgents:[{date:'2026-09-01',total:20}],dailyDelivery:[{date:'2026-09-01',tasks:18,effectiveAgents:12}]})
    ];
    const scopes=selectDashboardWeekScopes(weeks,'2026-09-01','2026-09-02');
    expect(scopes.dailyWeeks.map(item=>item.label)).toEqual(['08.31–09.06']);
    expect(scopes.weeklyWeeks.map(item=>item.label)).toEqual(['08.24–08.30','08.31–09.06']);
    expect(scopes.latestCompleteWeek?.label).toBe('08.31–09.06');
  });
});

describe('Dashboard quality summary',()=>{
  it('keeps every task type and its exact weekly pass rate for visible reading',()=>{
    const summary=buildQualityWeekSummary(week({
      taskTypes:[
        {type:'数据标注',tasks:10,daily:[],amount:100,passRate:.3005,autoDeliveryAmount:30.05,manualDeliveryAmount:69.95,pureAgentPending:3.01,hybridPending:41.97},
        {type:'知识问答',tasks:0,daily:[],amount:0,passRate:null,autoDeliveryAmount:0,manualDeliveryAmount:0,pureAgentPending:0,hybridPending:0}
      ]
    }));

    expect(summary).toEqual([
      {type:'数据标注',rate:.3005},
      {type:'知识问答',rate:null}
    ]);
  });
});
