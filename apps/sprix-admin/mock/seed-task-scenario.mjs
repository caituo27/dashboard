import { businessProfileForBatchPosition } from './business-profile.mjs';
import { compareRecords, timestamp } from './record-order.mjs';

export const SEED_TASK_LIMIT = 20;
export const SEED_EXECUTION_PAGE_SIZE = 20;
export const SEED_EXECUTION_STATUSES = Object.freeze(['running', 'reviewing', 'completed', 'terminated']);

const agents = Object.freeze(['Codex Agent', 'Claude Code', 'OpenCode Agent', 'Hermes Agent']);

export function stableSeedHash(value, salt = 0) {
  let result = 2166136261 ^ salt;
  for (let index = 0; index < String(value).length; index++) {
    result ^= String(value).charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function isSeedTaskCandidate(task) {
  const total = Math.max(0, Math.trunc(task?.totalSlots ?? 0));
  const remaining = Math.max(0, Math.trunc(task?.remainingSlots ?? 0));
  const executions = Math.max(0, Math.trunc(task?.executionTotal ?? 0));
  return total > 1 && remaining === total && executions === 0;
}

export function selectSeedTaskIds(tasks, limit = SEED_TASK_LIMIT) {
  return new Set(tasks.filter(isSeedTaskCandidate).sort((a,b)=>compareRecords('tasks',a,b)).slice(0,limit).map(task=>task.id));
}

export function isSeedExecutionId(id) {
  return Boolean(parseSeedExecutionId(id));
}

export function parseSeedExecutionId(id) {
  const match = /^demo:seed-execution:([^:]+):(running|reviewing|completed|terminated):([1-9]\d*)$/.exec(String(id ?? ''));
  if (!match) return null;
  const ordinal = Number(match[3]);
  return Number.isSafeInteger(ordinal) ? {taskId:match[1],baseStatus:match[2],ordinal} : null;
}

export function seedExecutionId(taskId, status, ordinal) {
  return `demo:seed-execution:${taskId}:${status}:${ordinal}`;
}

function baseSeedCounts(task) {
  const total = Math.max(0, Math.trunc(task.totalSlots ?? 0));
  const exactSandbox = task.title?.includes('漏洞沙箱修复') && total >= 328;
  const consumedRatio = 50 + stableSeedHash(`${task.id}:${task.title}`,17) % 41;
  const all = exactSandbox ? 328 : Math.min(total-1,Math.max(1,Math.ceil(total*consumedRatio/100)));
  const reviewingRatio = 6 + stableSeedHash(`${task.id}:${task.category}`,31) % 15;
  const reviewing = exactSandbox ? 30 : Math.min(all,Math.max(1,Math.round(all*reviewingRatio/100)));
  const free = Math.max(0,all-reviewing);
  const running = exactSandbox ? 12 : Math.min(free,Math.max(all >= 8 ? 1 : 0,Math.round(all*(3+stableSeedHash(task.id,41)%5)/100)));
  const afterRunning = Math.max(0,free-running);
  const terminated = exactSandbox ? 9 : Math.min(afterRunning,Math.max(all >= 12 ? 1 : 0,Math.round(all*(2+stableSeedHash(task.id,43)%4)/100)));
  return {all,running,reviewing,terminated,completed:Math.max(0,all-running-reviewing-terminated)};
}

function seedPatchesForTask(taskId,state) {
  const rows=[];
  for(const [id,patch] of Object.entries(state?.patches ?? {})) {
    const parsed=parseSeedExecutionId(id);
    if(parsed?.taskId===taskId && parsed.baseStatus==='reviewing' && ['completed','terminated'].includes(patch?.status)) rows.push({id,parsed,patch});
  }
  return rows;
}

export function seedExecutionCounts(task,state={}) {
  const counts=baseSeedCounts(task);
  for(const {patch} of seedPatchesForTask(task.id,state)) {
    if(counts.reviewing>0) counts.reviewing--;
    counts[patch.status]++;
  }
  return counts;
}

export function applySeedTaskSummary(task,state={}) {
  const counts=seedExecutionCounts(task,state);
  return {...task,remainingSlots:Math.max(0,task.totalSlots-counts.all),executionTotal:counts.all,
    runningExecutionCount:counts.running,reviewingExecutionCount:counts.reviewing,
    completedExecutionCount:counts.completed,terminatedExecutionCount:counts.terminated};
}

export function decorateSeedTaskList(tasks,state={},limit=SEED_TASK_LIMIT) {
  const selected=selectSeedTaskIds(tasks,limit);
  return tasks.map(task=>selected.has(task.id)?applySeedTaskSummary(task,state):task);
}

function hasRealRecords(records) {
  return Object.values(records ?? {}).some(rows=>Array.isArray(rows)&&rows.length>0);
}

function statusRanges(task) {
  const counts=baseSeedCounts(task);
  let start=1;
  const ranges={};
  for(const status of SEED_EXECUTION_STATUSES) {
    ranges[status]={start,count:counts[status]};
    start+=counts[status];
  }
  return {counts,ranges};
}

function statusForOrdinal(task,ordinal) {
  const {ranges}=statusRanges(task);
  return SEED_EXECUTION_STATUSES.find(status=>ordinal>=ranges[status].start&&ordinal<ranges[status].start+ranges[status].count) ?? null;
}

function displayTime(value) {
  return new Date(value+8*3600000).toISOString().slice(0,19).replace('T',' ');
}

function executionTime(task,ordinal,phase=0) {
  const published=timestamp(task.publishedAt);
  const end=Math.max(Number.isFinite(published)?published+3600000:0,Date.parse('2026-09-12T18:00:00+08:00'));
  const span=Math.max(6*3600000,Math.min(45*86400000,(baseSeedCounts(task).all+1)*11*60000));
  return displayTime(end-Math.round((ordinal/(baseSeedCounts(task).all+1))*span)+phase*23*60000);
}

function currentSeedStatus(id,state) {
  const parsed=parseSeedExecutionId(id);
  return state?.patches?.[id]?.status ?? parsed?.baseStatus;
}

export function seedExecutionRecord(task,id,state={}) {
  const parsed=parseSeedExecutionId(id);
  if(!parsed||parsed.taskId!==task.id)return null;
  const base=statusRanges(task).ranges[parsed.baseStatus];
  if(!base||parsed.ordinal<base.start||parsed.ordinal>=base.start+base.count)return null;
  const patch=state?.patches?.[id] ?? {};
  const status=currentSeedStatus(id,state);
  const profile=businessProfileForBatchPosition(parsed.ordinal,`${task.id}:${parsed.ordinal}`);
  const score=86+stableSeedHash(id,53)%13;
  const agentName=agents[stableSeedHash(id,59)%agents.length];
  const executionNo=`SX-${String(stableSeedHash(task.id,61)%100000).padStart(5,'0')}-${String(parsed.ordinal).padStart(6,'0')}`;
  const common={executionId:id,executionNo,executionIndex:parsed.ordinal,taskId:task.id,taskTitle:task.title,taskCategory:task.category,
    userId:`seed-user-${stableSeedHash(id,67)}`,userName:profile.userName,phone:profile.phone,virtualPhone:profile.virtualPhone,
    agentId:`seed-agent-${stableSeedHash(agentName,71)%1000}`,agentName,agentScore:String(score)};
  const startedAt=executionTime(task,parsed.ordinal,0),submittedAt=executionTime(task,parsed.ordinal,1);
  if(status==='running') return {...common,currentNode:['数据准备','任务执行','质量校验'][stableSeedHash(id,73)%3],progress:`${32+stableSeedHash(id,79)%61}%`,startedAt};
  if(status==='reviewing') return {...common,reviewSource:'AGENT',acceptanceStatus:'待平台验收',acceptanceScore:String(score),
    acceptanceSummary:`已完成“${task.title}”交付并通过本地质检，等待平台复核。`,acceptanceIssues:'抽样项均可追溯，建议平台重点复核边界样本与验收口径。',
    acceptanceFailureReasons:[],acceptanceImprovementSuggestions:['复核通过后归档交付清单与质量报告。'],currentNode:'平台复核',progress:'100%',submittedAt,startedAt,updatedAt:submittedAt};
  if(status==='completed') {
    const completedAt=patch.completedAt ?? executionTime(task,parsed.ordinal,2);
    return {...common,submittedAt,acceptanceStatus:'验收通过',acceptanceScore:String(score),acceptanceSummary:`交付内容覆盖“${task.title}”的验收项，抽样复核通过。`,
      acceptanceIssues:'未发现阻断交付的问题。',score:String(score),currentNode:'任务完成',progress:'100%',appealStatus:'无申诉',settlementStatus:patch.status?'待结算':'已结算',completedAt};
  }
  const terminatedAt=patch.terminatedAt ?? executionTime(task,parsed.ordinal,2);
  return {...common,terminationReason:patch.reason ?? ['验收证据不完整','执行环境异常终止','交付内容与验收口径不一致'][stableSeedHash(id,89)%3],terminatedNode:patch.status?'平台复核':'质量校验',terminatedAt};
}

function unpatchedStatusIds(task,status,offset,limit,state) {
  const {start,count}=statusRanges(task).ranges[status];
  const excluded=seedPatchesForTask(task.id,state).filter(row=>row.parsed.baseStatus===status).map(row=>row.parsed.ordinal-start).sort((a,b)=>a-b);
  let actual=Math.max(0,offset);
  for(const index of excluded) if(index<=actual) actual++;
  const rows=[];
  while(actual<count&&rows.length<limit) {
    if(!excluded.includes(actual)) rows.push(seedExecutionId(task.id,status,start+actual));
    actual++;
  }
  return rows;
}

function statusPageIds(task,status,offset,limit,state) {
  const incoming=seedPatchesForTask(task.id,state).filter(row=>row.patch.status===status).sort((a,b)=>String(b.patch.completedAt??b.patch.terminatedAt??'').localeCompare(String(a.patch.completedAt??a.patch.terminatedAt??''))).map(row=>row.id);
  const incomingSlice=incoming.slice(offset,offset+limit);
  if(incomingSlice.length===limit)return incomingSlice;
  const baseOffset=Math.max(0,offset-incoming.length);
  return [...incomingSlice,...unpatchedStatusIds(task,status,baseOffset,limit-incomingSlice.length,state)];
}

export function seedExecutionPage(task,status='all',page=1,pageSize=SEED_EXECUTION_PAGE_SIZE,state={}) {
  const counts=seedExecutionCounts(task,state);
  const validStatus=SEED_EXECUTION_STATUSES.includes(status)?status:'all';
  const total=counts[validStatus];
  const safeSize=Math.max(1,Math.min(100,Math.trunc(pageSize)||SEED_EXECUTION_PAGE_SIZE));
  const safePage=Math.min(Math.max(1,Math.trunc(page)||1),Math.max(1,Math.ceil(total/safeSize)));
  const offset=(safePage-1)*safeSize;
  let ids;
  if(validStatus==='all') ids=Array.from({length:Math.max(0,Math.min(safeSize,total-offset))},(_,index)=>{
    const ordinal=offset+index+1,statusName=statusForOrdinal(task,ordinal);
    return seedExecutionId(task.id,statusName,ordinal);
  });
  else ids=statusPageIds(task,validStatus,offset,safeSize,state);
  const records={running:[],reviewing:[],completed:[],terminated:[]};
  for(const id of ids) {
    const row=seedExecutionRecord(task,id,state);
    if(row) records[currentSeedStatus(id,state)].push(row);
  }
  return {records,page:safePage,pageSize:safeSize,total,status:validStatus,counts};
}

function baseOperationLogs(task,attachments) {
  const createdAt=task.createdAt||task.publishedAt;
  return [
    {id:`seed-log-${task.id}-create`,action:'创建任务',operator:'平台运营',beforeStatus:'-',afterStatus:'草稿',reason:'录入任务内容与验收标准',occurredAt:createdAt},
    ...(attachments?.length?[{id:`seed-log-${task.id}-attachment`,action:'导入附件',operator:'平台运营',beforeStatus:'草稿',afterStatus:'草稿',reason:`已导入 ${attachments.length} 个任务附件`,occurredAt:createdAt}]:[]),
    {id:`seed-log-${task.id}-publish`,action:'发布任务',operator:'平台运营',beforeStatus:'草稿',afterStatus:'已发布',reason:'任务内容与预算校验通过',occurredAt:task.publishedAt}
  ];
}

export function seedOperationLogs(task,attachments,state={},existingLogs=[]) {
  const reviewLogs=(state?.events??[]).flatMap((event,index)=>{
    const parsed=parseSeedExecutionId(event.id);
    if(parsed?.taskId!==task.id||!['approve','reject'].includes(event.action))return [];
    return [{id:`seed-log-${task.id}-review-${index}`,action:event.action==='approve'?'审核通过':'审核不通过',operator:'平台管理员',beforeStatus:'待平台验收',afterStatus:event.action==='approve'?'验收通过':'已终止',reason:event.reason||'平台人工复核',occurredAt:event.at}];
  });
  const baseLogs=existingLogs.length?existingLogs:baseOperationLogs(task,attachments);
  return [...reviewLogs,...baseLogs].sort((a,b)=>String(b.occurredAt).localeCompare(String(a.occurredAt)));
}

export function seedStateView(state={}) {
  const patches=Object.fromEntries(Object.entries(state.patches??{}).filter(([id])=>isSeedExecutionId(id)));
  const events=(state.events??[]).filter(event=>isSeedExecutionId(event.id));
  return {patches,events};
}

export function seedTaskDetail(detail,selectedIds,state={},options={}) {
  if(!selectedIds?.has(detail.task.id)||!isSeedTaskCandidate(detail.task)||hasRealRecords(detail.records))return detail;
  const task=applySeedTaskSummary(detail.task,state);
  const requestedId=options.executionId;
  let pageData;
  if(requestedId) {
    const row=seedExecutionRecord(task,requestedId,state),records={running:[],reviewing:[],completed:[],terminated:[]};
    if(row)records[currentSeedStatus(requestedId,state)].push(row);
    const counts=seedExecutionCounts(task,state);
    pageData={records,page:1,pageSize:1,total:row?1:0,status:'all',counts};
  } else pageData=seedExecutionPage(task,options.status,options.page,options.pageSize,state);
  const {records,...presentation}=pageData;
  return {...detail,task,records,operationLogs:seedOperationLogs(task,detail.attachments,state,detail.operationLogs),presentation:{source:'seeded',...presentation}};
}
