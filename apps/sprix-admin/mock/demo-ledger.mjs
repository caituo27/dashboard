import {createFinanceLedger} from './finance-ledger.mjs';
import {timestamp} from "./record-order.mjs";
import {consumerExecution} from "./consumer-records.mjs";
import {publicationTime, publishedTaskCount, hash, timeline, userForExecution, taskScenario, taskForOrder, orderRange,statusAt,indexAt,MAX_LIFECYCLE_MS,appealTimeline} from "./business-scenario.mjs";
import { businessProfile } from "./business-profile.mjs";
// Pure virtual ledger shared by the HTTP service and the admin data adapter.
// IDs are isolated from real backend IDs. Only explicit mutations are persisted.
export const isDemoId = (id) => typeof id === "string" && id.startsWith("demo:");
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
  const orders = snapshot.overview.orders;
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
  const start = Date.parse(snapshot.overview.startedAt);
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
    if(row?.reward!=null) return row.reward;
    let reward=taskScenario(taskIndex).reward;
    if(patch?.rewardHistory?.length) {
      const acceptedAt=row?timestamp(row.startedAt):timeline(index).accepted;
      for(const term of patch.rewardHistory) if(timestamp(term.at)<=acceptedAt) reward=term.reward;
    } else if(patch?.reward!=null) {
      // Legacy edit logs have no before-price; use the original price before the first edit.
      const firstEdit=(state.events ?? []).find(e=>e.id===`demo:task:${taskIndex}`&&e.action==='edit');
      if(firstEdit && (row?timestamp(row.startedAt):timeline(index).accepted)>=timestamp(firstEdit.at)) reward=patch.reward;
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
  const tasks = Array.from({ length: taskCount }, (_, offset) => {
    const index = offset + 1;
    const id = `demo:task:${index}`;
    const [first, last] = executionRange(index);
    const cached=stableTasks.get(index);
    if(cached && now>=cached.after) return {...cached.task};
    const statuses = {running:0,reviewing:0,completed:0,terminated:0};
    let executionRewardCents=0;
    for(let n=first;n<=last;n++) {statuses[executionStatus(n)]++;executionRewardCents+=pennies(rewardAt(n));}
    const task = {
      id, title: "", category: "", sourceName: "平台任务", sourceType: "平台发布",
      description: "按任务要求处理数据并提交交付结果。", cardSummary: "标准化数据处理任务", deliverables: "结构化结果文件", acceptanceCriteria: "字段完整，格式正确，质量检查通过。",
      reward: Math.round(snapshot.overview.amount / Math.max(1, orders) * 100) / 100,
      totalSlots: taskSlots(index), remainingSlots: Math.max(0,taskSlots(index)-(last-first+1)), publishedAt: taskDate(index),
      taskStatus: hash(index,23)%100<84 ? "已发布" : "已下线", offlineReason: "", agentMatchScore: 78+hash(index,38)%22, recommendedTaskType: taskScenario(index).category, suggestedTeam: "", matchAnalysis: "", riskPrompt: "", recommendedReason: "", submittedFiles: [], resultFiles: [], acceptanceResult: "",
      executionRewardTotal:money(executionRewardCents), executionTotal: last - first + 1, runningExecutionCount: statuses.running, reviewingExecutionCount: statuses.reviewing, completedExecutionCount: statuses.completed, terminatedExecutionCount: statuses.terminated,
      ...taskScenario(index), ...patches[id]
    };
    task.remainingSlots=Math.max(0,task.totalSlots-task.executionTotal);
    if(!reservedByTask.has(id) && last===orderRange(index)[1] && timeline(last).completed+3*86400000<now)
      stableTasks.set(index,{after:timeline(last).completed+3*86400000,task:{...task}});
    return task;
  });
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  for(const row of consumerRows.values()) {
    const task=taskById.get(row.taskId);if(!task)continue;
    const status=executionStatus(row.index);
    task.executionTotal++;task[`${status}ExecutionCount`]++;task.executionRewardTotal=money(pennies(task.executionRewardTotal)+pennies(rewardAt(row.index)));
    task.remainingSlots=Math.max(0,task.remainingSlots-1);
  }
  function execution(index) {
    if(consumerRows.has(index)) {
      const row=consumerRows.get(index),task=taskById.get(row.taskId);
      return {...consumerExecution(row,task,patches[`demo:execution:${index}`],now),executionIndex:sequence(index),reward:rewardAt(index)};
    }
    const taskId = `demo:task:${taskForExecution(index)}`;
    const task = taskById.get(taskId);
    const status = executionStatus(index);
    const profile = businessProfile(userForExecution(index));
    const dates = timeline(index);
    const score = String(82+hash(index,24)%18);
    return { userId: `demo:user:${userForExecution(index)}`, agentId: `demo:agent:${userForExecution(index)}`, executionId: `demo:execution:${index}`, executionIndex: sequence(index), reward:rewardAt(index), taskId, taskTitle: task.title, taskCategory: task.category,
      userName: profile.userName, phone: profile.phone, agentName: profile.agentName, agentScore: score, currentNode: status === "running" ? "执行中" : "交付检查", progress: status === "running" ? `已完成 ${Math.min(99,Math.max(0,Math.floor((now-dates.accepted)/(dates.submitted-dates.accepted)*100)))}%` : "已完成交付", startedAt: time(dates.accepted),
      submittedAt: status === 'running' ? undefined : time(dates.submitted), completedAt: status === 'completed' ? time(completionTime(index)) : undefined, terminatedAt: status === 'terminated' || appealFacts.has(index) ? time(terminationTime(index)) : undefined,
      acceptanceStatus: status === "reviewing" ? "待平台验收" : status === "terminated" ? "验收未通过" : status === "running" ? "执行中" : "验收通过", acceptanceScore: score, score, acceptanceSummary: [`已提交${task.deliverables}，待复核关键字段`, `已完成${task.category}内容检查，来源信息已附后`, "结构校验通过，待确认内容准确性", "交付文件已上传，需抽查引用及异常项"][hash(index,25)%4], acceptanceIssues: hash(index,26)%7===0 ? "部分引用链接需人工复核" : "未发现格式问题", terminationReason: patches[`demo:execution:${index}`]?.reason ?? "执行终止", terminatedNode: "任务执行", appealStatus: appealFacts.get(index)?.status ?? "无申诉", settlementStatus: status === "completed" ? "已入账" : "未入账" };
  }
  const acceptanceReviews = [];
  for (const task of tasks) if (task.reviewingExecutionCount) {
    const [first, last] = executionRange(Number(task.id.split(":")[2]));
    for (let index = first; index <= last; index++) if (executionStatus(index) === "reviewing") acceptanceReviews.push(execution(index));
  }
  for(const row of consumerRows.values()) if(executionStatus(row.index)==="reviewing") acceptanceReviews.push(execution(row.index));
  let computedFunds;
  function readFunds() {
    if(computedFunds) return computedFunds;
    if(financeCache?.key!==stateKey || financeCache.at>now) financeCache={key:stateKey,at:-Infinity,future:new Set(),ledger:createFinanceLedger(now)};
    const finance=financeCache.ledger,previous=financeCache.at;
    const firstCandidate=Number.isFinite(previous)?indexAt(previous-3*86400000)+1:1;
    for(const task of tasks) {
      const [first,last]=executionRange(Number(task.id.split(':')[2]));
      if(last<firstCandidate)continue;
      for(let index=Math.max(first,firstCandidate);index<=last;index++) if(executionStatus(index)==='completed') {
        const completedAt=completionTime(index);
        if(completedAt>previous && !financeCache.future.has(index)) {
          finance.add(task,index,userForExecution(index),rewardAt(index),completedAt);
          if(completedAt>now)financeCache.future.add(index);
        }
      }
    }
    const consumerUsers=new Map();
    for(const row of consumerRows.values()) {
      if(!consumerUsers.has(row.owner)) consumerUsers.set(row.owner,30001+consumerUsers.size);
      if(executionStatus(row.index)==='completed' && completionTime(row.index)>previous && !financeCache.future.has(row.index)) {
        finance.add(taskById.get(row.taskId),row.index,consumerUsers.get(row.owner),rewardAt(row.index),completionTime(row.index),row);
        if(completionTime(row.index)>now)financeCache.future.add(row.index);
      }
    }
    financeCache.at=now;
    computedFunds={...finance.result(now),fundFlows};
    return computedFunds;
  }
  const appeals=[...appealFacts].map(([index,fact])=>{
    const record=execution(index),task=taskById.get(record.taskId),appealIndex=index/825;
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
  });
  function detail(id) {
    const task = taskById.get(id);
    if (!task) return null;
    const records = blankRecords();
    const [first, last] = executionRange(Number(id.split(":")[2]));
    for (let index = first; index <= last; index++) records[executionStatus(index)].push(execution(index));
    for(const row of consumerRows.values()) if(row.taskId===id) records[executionStatus(row.index)].push(execution(row.index));
    return { task, records, operationLogs: (state.events ?? []).filter((event) => event.id === id).map((event, index) => ({ id: String(index), action: event.action, beforeStatus: event.beforeStatus ?? "", afterStatus: event.afterStatus ?? "", reason: event.reason ?? "", occurredAt: event.at })) };
  }
  const fundFlows = (state.events ?? []).filter((event) => /demo:(withdrawal|settlement):/.test(event.id)).map((event, index) => ({ flowNo: `demo:flow:${index + 1}`, flowType: event.action, userName: businessProfile(Number(event.id.split(":")[2])).userName, taskTitle: event.id.startsWith("demo:settlement:") ? taskById.get(`demo:task:${event.id.split(":")[2]}`)?.title ?? "" : "", withdrawalNo: event.id.startsWith("demo:withdrawal:") ? event.id : "", amount: event.amount ?? 0, beforeStatus: event.beforeStatus ?? "", afterStatus: event.afterStatus ?? "", operator: "平台管理员", occurredAt: event.at, remark: event.reason ?? "" }));
  function orderRecord(index) {
    const e=execution(index),status=executionStatus(index);
    return {id:`${e.taskId}:${e.executionId}`,taskId:e.taskId,taskTitle:e.taskTitle,executionId:e.executionId,status,userName:e.userName,agentName:e.agentName,
      time:status==='running'?e.startedAt:status==='reviewing'?e.submittedAt:status==='completed'?e.completedAt:e.terminatedAt,reward:rewardAt(index)};
  }
  function settlementRecord(index) {
    if(executionStatus(index)!=='completed') throw new Error('Execution is not settled');
    const e=execution(index),reward=rewardAt(index),gross=pennies(reward),fee=Math.floor(gross*.10);
    const id=`demo:settlement:${index}`;
    return {backendId:id,settlementNo:id,executionId:e.executionId,taskId:e.taskId,taskTitle:e.taskTitle,userName:e.userName,userPhone:e.phone,agentName:e.agentName,
      taskIncome:money(gross),platformFee:money(fee),netIncome:money(gross-fee),settlementStatus:'已入账',createdAt:e.completedAt,
      paidAt:e.completedAt};
  }
  function withdrawalRecord(index) {
    const settlement=settlementRecord(index),id=`demo:withdrawal:${index}`;
    return {backendId:id,withdrawalNo:id,executionId:settlement.executionId,taskId:settlement.taskId,taskTitle:settlement.taskTitle,
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
  return { consumerRows, orders, stateKey, tasks, acceptanceReviews, appeals, get funds(){return readFunds();}, detail, execution, orderRecord, settlementRecord, withdrawalRecord, executionIndexes, settledAt:completionTime, recordTime, generatedAt: snapshot.generatedAt };
}
