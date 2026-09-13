import {taskAtSubmission} from './submission-task.mjs';
import {executionReview} from './execution-review.mjs';
import {localAcceptance} from './local-acceptance.mjs';
import {settlementAmounts} from "./settlement-amounts.mjs";
import {createFinanceLedger} from './finance-ledger.mjs';
import {timestamp} from "./record-order.mjs";
import {consumerExecution} from "./consumer-records.mjs";
import {publicationTime, publishedTaskCount, hash, timeline, userForExecution, taskScenario, taskCategory, taskForOrder, orderRange,statusAt,indexAt,executionCountsAt,MAX_LIFECYCLE_MS,appealTimeline} from "./business-scenario.mjs";
import { businessProfile } from "./business-profile.mjs";
import {dataAnnotationTaskContent} from './data-annotation-task-templates.mjs';
// Pure virtual ledger shared by the HTTP service and the admin data adapter.
// IDs are isolated from real backend IDs. Only explicit mutations are persisted.
export const isDemoId = (id) => typeof id === "string" && id.startsWith("demo:");
export function createDemoLedgerSeed(at=Date.now()) {
  const generatedAt=Math.floor(at/10000)*10000;
  return {generatedAt:new Date(generatedAt).toISOString(),operations:{executions:executionCountsAt(generatedAt)}};
}
const blankRecords = () => ({ running: [], reviewing: [], completed: [], terminated: [] });
const names = ["商品信息结构化提取", "文本分类与标签整理", "多语言内容校对", "数据格式清洗", "商品描述质量检查"];
const pad = (value) => String(value).padStart(7, "0");
const time = (at) => new Date(at + 8 * 3600000).toISOString().slice(0, 19).replace("T", " ");
const pennies = (amount) => Math.round(amount * 100);
const money = (amount) => Math.round(amount) / 100;
function split(total, count, index) { return Math.floor(total * index / count) - Math.floor(total * (index - 1) / count); }

let stableCache;
let financeCache;
export function buildDemoLedger(snapshot, state = {}) {
  const stateKey=JSON.stringify(state);
  if(stableCache?.key!==stateKey) stableCache={key:stateKey,tasks:new Map()};
  const stableTasks=stableCache.tasks;
  const taskCount = publishedTaskCount(Date.parse(snapshot.generatedAt));
  const orders = ['running','reviewing','completed','terminated'].reduce((total,status)=>total+(snapshot.operations.executions[status] ?? 0),0);
  const patches = Object.fromEntries(Object.entries(state.patches ?? {}).map(([id,patch])=>[id,{...patch}]));
  const lastActions=new Map();
  for(const event of state.events ?? []) lastActions.set(`${event.id}:${event.action}`,event);
  // Recover old action timestamps without changing the persisted file.
  for(const [id,patch] of Object.entries(patches)) {
    if(id.startsWith('demo:execution:')) {
      patch.terminatedAt ??= lastActions.get(`${id}:reject`)?.at;
      patch.completedAt ??= lastActions.get(`${id}:approve`)?.at;
    }
    if(id.startsWith('demo:appeal:')) {
      patch.startedAt ??= lastActions.get(`${id}:start`)?.at;
      patch.resolvedAt ??= lastActions.get(`${id}:approve`)?.at ?? lastActions.get(`${id}:reject`)?.at;
    }
  }
  const consumerRows = new Map((state.consumerExecutions ?? []).map(row=>[row.index,row]));
  const now = Date.parse(snapshot.generatedAt);
  const taskDate = index => time(publicationTime(index));
  const taskForExecution = (index) => consumerRows.has(index)?Number(consumerRows.get(index).taskId.split(":")[2]):Math.min(taskCount, taskForOrder(index));
  const reservedByTask=new Map();
  for(const row of consumerRows.values()) reservedByTask.set(row.taskId,(reservedByTask.get(row.taskId)??0)+1);
  const taskSlots=index=>patches[`demo:task:${index}`]?.totalSlots ?? Math.max(orderRange(index)[1]-orderRange(index)[0]+1,10+hash(index,22)%41);
  const executionRange = index => {
    const [first,last]=orderRange(index),capacity=taskSlots(index)-(reservedByTask.get(`demo:task:${index}`)??0);
    return [first,Math.max(first-1,Math.min(last,orders,first+capacity-1))];
  };
  const appealFacts=new Map();
  for(let index=825;index<=orders;index+=825) {
    if(index>executionRange(taskForExecution(index))[1]) continue;
    const schedule=appealTimeline(index),id=`demo:appeal:${index/825}`,patch=patches[id] ?? {};
    if(patches[`demo:execution:${index}`]?.status==='completed' && !patch.appealStatus) continue;
    const rejectedAt=timestamp(patches[`demo:execution:${index}`]?.terminatedAt);
    const shift=Number.isFinite(rejectedAt)?rejectedAt-schedule.rejected:0;
    const submittedAt=schedule.submitted+shift;
    if(submittedAt>now && !patch.appealStatus) continue;
    const startedAt=timestamp(patch.startedAt),resolvedAt=timestamp(patch.resolvedAt);
    const status=patch.appealStatus ?? (now<schedule.started+shift?'待处理':now<schedule.resolved+shift?'处理中':schedule.approved?'申诉通过':'申诉不通过');
    appealFacts.set(index,{id,status,submittedAt,startedAt:Number.isFinite(startedAt)?startedAt:schedule.started+shift,
      resolvedAt:Number.isFinite(resolvedAt)?Math.max(submittedAt,resolvedAt):schedule.resolved+shift,patch});
  }
  const finishedThrough=indexAt(now-MAX_LIFECYCLE_MS);
  const executionStatus = index => {
    const appeal=appealFacts.get(index);
    if(appeal) return appeal.status==='申诉通过'?'completed':'terminated';
    if(consumerRows.has(index)) return consumerExecution(consumerRows.get(index),{id:consumerRows.get(index).taskId},patches[`demo:execution:${index}`],now).status;
    return patches[`demo:execution:${index}`]?.status ?? statusAt(index,now,finishedThrough);
  };
  const completionTime = index => {
    const appeal=appealFacts.get(index);
    if(appeal?.status==='申诉通过') return appeal.resolvedAt;
    const patch=patches[`demo:execution:${index}`];
    if(patch?.completedAt) return timestamp(patch.completedAt);
    if(consumerRows.has(index)) return timestamp(consumerExecution(consumerRows.get(index),{},patch,now).completedAt);
    return timeline(index).completed;
  };
  const terminationTime = index => {
    const patch=patches[`demo:execution:${index}`];
    if(patch?.terminatedAt) return timestamp(patch.terminatedAt);
    if(consumerRows.has(index)) return timestamp(consumerExecution(consumerRows.get(index),{},patch,now).terminatedAt);
    return timeline(index).completed;
  };
  const rewardAt = index => {
    const row=consumerRows.get(index),taskIndex=taskForExecution(index),patch=patches[`demo:task:${taskIndex}`];
    const settled=executionStatus(index)==='completed';
    if(row?.reward!=null && !settled) return row.reward;
    let reward=taskScenario(taskIndex).reward;
    if(patch?.rewardHistory?.length) {
      const acceptedAt=settled?completionTime(index):row?timestamp(row.startedAt):timeline(index).accepted;
      for(const term of patch.rewardHistory) if(timestamp(term.at)<=acceptedAt) reward=term.reward;
    } else if(patch?.reward!=null) {
      // Legacy edit logs have no before-price; use the original price before the first edit.
      const firstEdit=(state.events ?? []).find(e=>e.id===`demo:task:${taskIndex}`&&e.action==='edit');
      if(firstEdit && (settled?completionTime(index):row?timestamp(row.startedAt):timeline(index).accepted)>=timestamp(firstEdit.at)) reward=patch.reward;
    }
    return reward;
  };
  const sequence = index => {
    const taskIndex=taskForExecution(index),[first,last]=executionRange(taskIndex),row=consumerRows.get(index);
    const peers=[...consumerRows.values()].filter(r=>r.taskId===`demo:task:${taskIndex}`);
    if(!row) return index-first+1+peers.filter(r=>timestamp(r.startedAt)<=timeline(index).accepted).length;
    const beforeGenerated=Math.max(0,Math.min(last,indexAt(timestamp(row.startedAt)))-first+1);
    return beforeGenerated+peers.filter(r=>timestamp(r.startedAt)<timestamp(row.startedAt)||(r.startedAt===row.startedAt&&r.index<=index)).length;
  };
  const consumerRowsByTask=new Map();
  for(const row of consumerRows.values()) {
    const rows=consumerRowsByTask.get(row.taskId) ?? [];
    rows.push(row);consumerRowsByTask.set(row.taskId,rows);
  }
  const taskCache=new Map();
  const recentIndustrialTask=index=>{
    if(index<=taskCount-40)return null;
    return dataAnnotationTaskContent(index,taskScenario(index).reward,taskSlots(index));
  };
  function taskAt(index) {
    if(!Number.isSafeInteger(index)||index<1||index>taskCount) return null;
    if(taskCache.has(index)) return taskCache.get(index);
    const id = `demo:task:${index}`;
    const [first, last] = executionRange(index);
    const cached=stableTasks.get(index);
    if(cached && now>=cached.after) {taskCache.set(index,cached.task);return cached.task;}
    const statuses = {running:0,reviewing:0,completed:0,terminated:0};
    let executionRewardCents=0,firstAcceptedAt=Infinity,firstCompletedAt=Infinity,firstAcceptancePassedAt=Infinity;
    for(let n=first;n<=last;n++) {
      const status=executionStatus(n),dates=timeline(n);
      statuses[status]++;executionRewardCents+=pennies(rewardAt(n));
      firstAcceptedAt=Math.min(firstAcceptedAt,dates.accepted);
      if(dates.submitted<=now) firstCompletedAt=Math.min(firstCompletedAt,dates.submitted);
      if(status==='completed') firstAcceptancePassedAt=Math.min(firstAcceptancePassedAt,completionTime(n));
    }
    const task = {
      id, title: "", category: "", sourceName: "平台任务", sourceType: "平台发布",
      description: "按任务要求处理数据并提交交付结果。", cardSummary: "标准化数据处理任务", deliverables: "结构化结果文件", acceptanceCriteria: "字段完整，格式正确，质量检查通过。",
      reward: taskScenario(index).reward,
      totalSlots: taskSlots(index), remainingSlots: Math.max(0,taskSlots(index)-(last-first+1)), publishedAt: taskDate(index),
      taskStatus: hash(index,23)%100<84 ? "已发布" : "已下线", offlineReason: "", agentMatchScore: 78+hash(index,38)%22, recommendedTaskType: taskScenario(index).category, suggestedTeam: "", matchAnalysis: "", riskPrompt: "", recommendedReason: "", submittedFiles: [], resultFiles: [], acceptanceResult: "",
      executionRewardTotal:money(executionRewardCents), executionTotal: last - first + 1, runningExecutionCount: statuses.running, reviewingExecutionCount: statuses.reviewing, completedExecutionCount: statuses.completed, terminatedExecutionCount: statuses.terminated,
      firstAcceptedAt:Number.isFinite(firstAcceptedAt)?time(firstAcceptedAt):undefined,
      firstCompletedAt:Number.isFinite(firstCompletedAt)?time(firstCompletedAt):undefined,
      firstAcceptancePassedAt:Number.isFinite(firstAcceptancePassedAt)?time(firstAcceptancePassedAt):undefined,
      ...taskScenario(index), ...recentIndustrialTask(index), ...patches[id]
    };
    for(const row of consumerRowsByTask.get(id) ?? []) {
      const status=executionStatus(row.index),record=consumerExecution(row,task,patches[`demo:execution:${row.index}`],now);
      task.executionTotal++;task[`${status}ExecutionCount`]++;task.executionRewardTotal=money(pennies(task.executionRewardTotal)+pennies(rewardAt(row.index)));
      if(record.startedAt && (!task.firstAcceptedAt || timestamp(record.startedAt)<timestamp(task.firstAcceptedAt))) task.firstAcceptedAt=record.startedAt;
      if(record.submittedAt && (!task.firstCompletedAt || timestamp(record.submittedAt)<timestamp(task.firstCompletedAt))) task.firstCompletedAt=record.submittedAt;
      if(status==='completed' && record.completedAt && (!task.firstAcceptancePassedAt || timestamp(record.completedAt)<timestamp(task.firstAcceptancePassedAt))) task.firstAcceptancePassedAt=record.completedAt;
    }
    task.totalAmount=money(pennies(task.reward)*task.totalSlots);
    task.remainingSlots=Math.max(0,task.totalSlots-task.executionTotal);
    if(task.taskStatus==='已发布' && task.remainingSlots===0) {
      task.taskStatus='已下线';task.offlineReason='SLOT_FULL';
    }
    if(!reservedByTask.has(id) && last===orderRange(index)[1] && timeline(last).completed+3*86400000<now) {
      // Finalize before sharing immutable history between retained snapshots.
      stableTasks.set(index,{after:timeline(last).completed+3*86400000,task:Object.freeze(task)});
    }
    taskCache.set(index,task);
    return task;
  }
  const taskFromId=id=>/^demo:task:[1-9]\d*$/.test(id ?? '')?taskAt(Number(id.split(':')[2])):null;
  let tasks;
  function readTasks() {return tasks ??=Array.from({length:taskCount},(_,index)=>taskAt(index+1));}
  function taskMeta(index) {
    if(!Number.isSafeInteger(index)||index<1||index>taskCount) return null;
    const id=`demo:task:${index}`,patch=patches[id] ?? {};
    const [first,last]=executionRange(index);
    const executionTotal=Math.max(0,last-first+1)+(consumerRowsByTask.get(id)?.length ?? 0);
    const totalSlots=taskSlots(index),remainingSlots=Math.max(0,totalSlots-executionTotal);
    let taskStatus=patch.taskStatus ?? (hash(index,23)%100<84?'已发布':'已下线');
    if(taskStatus==='已发布'&&remainingSlots===0) taskStatus='已下线';
    return {id,index,category:patch.category ?? recentIndustrialTask(index)?.category ?? taskCategory(index),publishedAt:patch.publishedAt ?? taskDate(index),taskStatus,remainingSlots,executionTotal};
  }
  function taskIdentityText(index) {
    const meta=taskMeta(index),patch=patches[meta?.id] ?? {},scenario=taskScenario(index);
    return `${meta?.id ?? ''} ${patch.title ?? recentIndustrialTask(index)?.title ?? scenario.title}`.toLowerCase();
  }
  const taskSearchText=index=>`${taskIdentityText(index)} ${taskMeta(index)?.category ?? ''} ${patches[`demo:task:${index}`]?.sourceType ?? '平台发布'}`.toLowerCase();
  function execution(index) {
    if(consumerRows.has(index)) {
      const row=consumerRows.get(index),task=taskFromId(row.taskId);
      const draft=consumerExecution(row,task,patches[`demo:execution:${index}`],now);
      const submittedTask=draft.submittedAt?taskAtSubmission(task,patches[row.taskId],draft.submittedAt):task;
      return {...consumerExecution(row,submittedTask,patches[`demo:execution:${index}`],now),executionIndex:sequence(index),reward:rewardAt(index)};
    }
    const taskId = `demo:task:${taskForExecution(index)}`;
    const task = taskFromId(taskId);
    const status = executionStatus(index);
    const profile = businessProfile(userForExecution(index));
    const dates = timeline(index);
    const score = String(82+hash(index,24)%18);
    const submittedTask=taskAtSubmission(task,patches[taskId],time(dates.submitted));
    const localReview=localAcceptance(index,submittedTask,status,score,patches[`demo:execution:${index}`]?.reason);
    const review=executionReview(submittedTask,status,patches[`demo:execution:${index}`]?.reason);
    return { userId: `demo:user:${userForExecution(index)}`, agentId: `demo:agent:${userForExecution(index)}`, executionId: `demo:execution:${index}`, executionIndex: sequence(index), reward:rewardAt(index), taskId, taskTitle: task.title, taskCategory: task.category,
      userName: profile.userName, phone: profile.phone, agentName: profile.agentName, agentScore: score, startedAt: time(dates.accepted),
      submittedAt: status === 'running' ? undefined : time(dates.submitted), completedAt: status === 'completed' ? time(completionTime(index)) : undefined, terminatedAt: status === 'terminated' || appealFacts.has(index) ? time(terminationTime(index)) : undefined,
      taskExecutionStatus:({running:'RUNNING',reviewing:'PLATFORM_REVIEWING',completed:'SETTLED',terminated:'TERMINATED'})[status], settlementStatusCode:status==='completed'?'POSTED':'NOT_POSTED', currentNodeCode:status==='reviewing'?'platform_reviewing':status, mappedBusinessStatus:status==='terminated'?'terminated':'platform_review_pending',
      acceptanceStatus: status === "reviewing" ? "待平台验收" : status === "terminated" ? "验收未通过" : status === "running" ? "执行中" : "验收通过", acceptanceScore:String(localReview?.score??score), score:String(localReview?.score??score), localAcceptance:localReview,
      ...review, currentNode:status==='reviewing'?'平台验收':review.currentNode, progress:status==='running'?`已完成 ${Math.min(99,Math.max(0,Math.floor((now-dates.accepted)/(dates.submitted-dates.accepted)*100)))}%`:status==='terminated'?'执行已终止':'100%',
      acceptanceSummary:localReview?.summary??review.acceptanceSummary, acceptanceIssues:localReview?.issues.join('；')??review.acceptanceIssues, acceptanceFailureReasons:localReview?.failureReasons??[], acceptanceImprovementSuggestions:localReview?.improvementSuggestions??[],
      terminationReason: patches[`demo:execution:${index}`]?.reason ?? "执行终止", terminatedNode: "任务执行", appealStatus: appealFacts.get(index)?.status ?? "无申诉", settlementStatus: status === "completed" ? "已入账" : "未入账" };
  }
  let acceptanceReviews;
  let acceptanceIndexes;
  function readAcceptanceIndexes() {
    if(acceptanceIndexes) return acceptanceIndexes;
    const indexes=new Set();
    for(let index=Math.max(1,finishedThrough+1);index<=orders;index++) {
      const task=taskForExecution(index);
      if(reservedByTask.has(`demo:task:${task}`)&&index>executionRange(task)[1]) continue;
      if(executionStatus(index)==='reviewing') indexes.add(index);
    }
    for(const [id,patch] of Object.entries(patches)) if(id.startsWith('demo:execution:')&&patch.status==='reviewing') {
      const index=Number(id.split(':')[2]),task=taskForExecution(index);
      if(index<=executionRange(task)[1]) indexes.add(index);
    }
    for(const row of consumerRows.values()) if(executionStatus(row.index)==='reviewing') indexes.add(row.index);
    return acceptanceIndexes=[...indexes];
  }
  function readAcceptanceReviews() {return acceptanceReviews ??=readAcceptanceIndexes().map(execution);}
  let computedFunds;
  function readFunds() {
    if(computedFunds) return computedFunds;
    if(financeCache?.key!==stateKey || financeCache.at>now) financeCache={key:stateKey,at:-Infinity,future:new Set(),ledger:createFinanceLedger(now)};
    const finance=financeCache.ledger,previous=financeCache.at;
    const firstCandidate=Number.isFinite(previous)?indexAt(previous-3*86400000)+1:1;
    for(let index=Math.max(1,firstCandidate);index<=orders;index++) if(executionStatus(index)==='completed') {
      const completedAt=completionTime(index);
      if(completedAt>previous && !financeCache.future.has(index)) {
        finance.add(taskAt(taskForExecution(index)),index,userForExecution(index),rewardAt(index),completedAt);
        if(completedAt>now)financeCache.future.add(index);
      }
    }
    const consumerUsers=new Map();
    for(const row of consumerRows.values()) {
      if(!consumerUsers.has(row.owner)) consumerUsers.set(row.owner,30001+consumerUsers.size);
      if(executionStatus(row.index)==='completed' && completionTime(row.index)>previous && !financeCache.future.has(row.index)) {
        finance.add(taskFromId(row.taskId),row.index,consumerUsers.get(row.owner),rewardAt(row.index),completionTime(row.index),row);
        if(completionTime(row.index)>now)financeCache.future.add(row.index);
      }
    }
    financeCache.at=now;
    computedFunds={...finance.result(now),fundFlows};
    return computedFunds;
  }
  let appeals;
  function readAppeals() {return appeals ??=[...appealFacts].map(([index,fact])=>{
    const record=execution(index),task=taskFromId(record.taskId),appealIndex=index/825;
    const processLogs=[`${time(fact.submittedAt)} 提交申诉`];
    if(fact.status!=='待处理') processLogs.push(`${time(Math.min(fact.startedAt,fact.resolvedAt))} 开始处理`);
    if(['申诉通过','申诉不通过'].includes(fact.status)) processLogs.push(`${time(fact.resolvedAt)} ${fact.status}`);
    return {backendId:fact.id,appealNo:fact.id,taskTitle:record.taskTitle,taskCategory:record.taskCategory,userName:record.userName,userPhone:record.phone,agentName:record.agentName,
      issueSummary:['引用来源判定存在分歧','请求复核字段完整性','交付格式与要求理解不一致','补充材料后申请重新评估'][hash(appealIndex,30)%4],
      appealReason:['引用链接已附在交付附件中，请重新核对。','已按清单补充缺失字段，请复核结果。','交付格式符合任务说明，希望确认具体不符合项。','已补充来源及说明，申请人工复核。'][hash(appealIndex,30)%4],
      priority:hash(appealIndex,28)%9===0?'高':'普通',handler:fact.status==='待处理'?'待分配':'质量复核组',
      ...fact.patch,appealStatus:fact.status,submittedAt:time(fact.submittedAt),resolvedAt:['申诉通过','申诉不通过'].includes(fact.status)?time(fact.resolvedAt):undefined,
      processLogs:[...new Set([...processLogs,...(fact.patch.processLogs ?? [])])],executionId:record.executionId,executionIndex:record.executionIndex,
      deliverables:task.deliverables,acceptanceCriteria:task.acceptanceCriteria};
  });}
  function detail(id) {
    const task = taskFromId(id);
    if (!task) return null;
    const records = blankRecords();
    const [first, last] = executionRange(Number(id.split(":")[2]));
    for (let index = first; index <= last; index++) records[executionStatus(index)].push(execution(index));
    for(const row of consumerRows.values()) if(row.taskId===id) records[executionStatus(row.index)].push(execution(row.index));
    return { task, records, operationLogs: (state.events ?? []).filter((event) => event.id === id).map((event, index) => ({ id: String(index), action: event.action, beforeStatus: event.beforeStatus ?? "", afterStatus: event.afterStatus ?? "", reason: event.reason ?? "", occurredAt: event.at })) };
  }
  const fundFlows = (state.events ?? []).filter((event) => /demo:(withdrawal|settlement):/.test(event.id)).map((event, index) => ({ flowNo: `demo:flow:${index + 1}`, flowType: event.action, userName: businessProfile(Number(event.id.split(":")[2])).userName, taskTitle: event.id.startsWith("demo:settlement:") ? taskFromId(`demo:task:${event.id.split(":")[2]}`)?.title ?? "" : "", withdrawalNo: event.id.startsWith("demo:withdrawal:") ? event.id : "", amount: event.amount ?? 0, beforeStatus: event.beforeStatus ?? "", afterStatus: event.afterStatus ?? "", operator: "平台管理员", occurredAt: event.at, remark: event.reason ?? "" }));
  function orderRecord(index) {
    const e=execution(index),status=executionStatus(index);
    return {id:`${e.taskId}:${e.executionId}`,taskId:e.taskId,taskTitle:e.taskTitle,taskCategory:e.taskCategory,executionId:e.executionId,status,userName:e.userName,agentName:e.agentName,
      time:status==='running'?e.startedAt:status==='reviewing'?e.submittedAt:status==='completed'?e.completedAt:e.terminatedAt,reward:rewardAt(index)};
  }
  function settlementRecord(index) {
    if(executionStatus(index)!=='completed') throw new Error('Execution is not settled');
    const e=execution(index),reward=rewardAt(index),{gross,fee,net}=settlementAmounts(reward);
    const id=`demo:settlement:${index}`;
    return {backendId:id,settlementNo:id,executionId:e.executionId,taskId:e.taskId,taskTitle:e.taskTitle,taskCategory:e.taskCategory,userName:e.userName,userPhone:e.phone,agentName:e.agentName,
      taskIncome:money(gross),platformFee:money(fee),netIncome:money(net),settlementStatus:'已入账',createdAt:e.completedAt,
      paidAt:e.completedAt};
  }
  function withdrawalRecord(index) {
    const settlement=settlementRecord(index),id=`demo:withdrawal:${index}`;
    return {backendId:id,withdrawalNo:id,executionId:settlement.executionId,taskId:settlement.taskId,taskTitle:settlement.taskTitle,taskCategory:settlement.taskCategory,
      userName:settlement.userName,userPhone:settlement.userPhone,agentName:settlement.agentName,
      applyAmount:settlement.netIncome,appliedAt:settlement.createdAt,paidAt:settlement.paidAt,withdrawStatus:'已提现',withdrawableBalance:0};
  }
  // Numeric indexes only; individual records are constructed for the requested page.
  function recordTime(index,kind) {
    if(consumerRows.has(index)) {const e=execution(index);return timestamp(kind==='settlements'||e.status==='completed'?e.completedAt:e.status==='running'?e.startedAt:e.status==='terminated'?e.terminatedAt:e.submittedAt);}
    const status=kind==='settlements'?'completed':executionStatus(index),dates=timeline(index);
    const at=status==='running'?dates.accepted:status==='reviewing'?dates.submitted:status==='completed'?completionTime(index):terminationTime(index);
    return Math.floor(at/1000)*1000;
  }
  function executionIndexes(status,from=1) {
    const result=[];
    for(let index=from;index<=orders;index++) {
      const task=taskForExecution(index);
      if(reservedByTask.has(`demo:task:${task}`) && index>executionRange(task)[1]) continue;
      if(!status || executionStatus(index)===status) result.push(index);
    }
    for(const row of consumerRows.values()) if(!status || executionStatus(row.index)===status) result.push(row.index);
    return result;
  }
  const settlementSummaries=new Map();
  function readSettlementSummaries(ranges) {
    const keys=ranges.map(({startAt,endExclusive})=>`${startAt}:${endExclusive}`);
    if(keys.every(key=>settlementSummaries.has(key))) return keys.map(key=>settlementSummaries.get(key));
    const unique=[...new Map(ranges.map(range=>[`${range.startAt}:${range.endExclusive}`,range])).values()];
    const totals=unique.map(()=>({taskIds:new Set(),count:0,gross:0})),seen=new Set();
    const first=Math.max(1,indexAt(Math.min(...unique.map(range=>range.startAt))-3*86400000));
    for(const index of executionIndexes('completed',first)) {
      if(seen.has(index)) continue;
      seen.add(index);
      const completedAt=completionTime(index);
      const matches=unique.map((range,position)=>completedAt>=range.startAt&&completedAt<range.endExclusive?position:-1).filter(position=>position>=0);
      if(!matches.length) continue;
      const record=settlementRecord(index);
      for(const position of matches) {
        const total=totals[position];
        total.taskIds.add(record.taskId);total.count++;total.gross=money(pennies(total.gross)+pennies(record.taskIncome));
      }
    }
    unique.forEach((range,index)=>settlementSummaries.set(`${range.startAt}:${range.endExclusive}`,Object.freeze({count:totals[index].count,taskCount:totals[index].taskIds.size,gross:totals[index].gross})));
    return keys.map(key=>settlementSummaries.get(key));
  }
  const settlementSummary=(startAt,endExclusive)=>readSettlementSummaries([{startAt,endExclusive}])[0];
  return { submissionPatch:id=>patches[id], consumerRows, orders, taskCount, stateKey, taskAt, taskMeta, taskIdentityText, taskSearchText, executionRange, executionStatus, acceptanceCount:()=>readAcceptanceIndexes().length, appealCount:appealFacts.size, fundFlows, get tasks(){return readTasks();}, get acceptanceReviews(){return readAcceptanceReviews();}, get appeals(){return readAppeals();}, get funds(){return readFunds();}, detail, execution, orderRecord, settlementRecord, withdrawalRecord, settlementSummary,settlementSummaries:readSettlementSummaries, executionIndexes, settledAt:completionTime, recordTime, generatedAt: snapshot.generatedAt };
}
