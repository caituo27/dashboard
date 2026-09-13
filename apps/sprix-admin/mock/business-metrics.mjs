import {hash} from './business-scenario.mjs';
import {businessProfileForBatchPosition} from './business-profile.mjs';
import {dataAnnotationTaskContent} from './data-annotation-task-templates.mjs';
import {dataAnnotationTaskAttachmentFiles} from './data-annotation-task-attachments.mjs';
import {otherTaskReferenceContent} from './other-task-reference-templates.mjs';
import {otherTaskReferenceAttachmentFiles} from './other-task-reference-attachments.mjs';
import {buildBusinessExecutionSubmission} from './business-execution-submission.mjs';
const DAY=86_400_000,SHANGHAI_OFFSET=8*3_600_000;
const MASTER_TOTALS=[9134,37,929,345,45,344],SLOT_TOTALS=[15487,62,1575,586,77,583];
const WEEKDAY_WEIGHTS=[1.08,1.16,0.96,1.12,1.02,0.38,0.34];
export const BUSINESS_CUTOFF_AT=Date.parse('2026-09-06T23:59:59+08:00');
export const PLATFORM_CUTOFF_AT=Date.parse('2026-09-13T23:59:59+08:00');
export const BUSINESS_PERIOD=Object.freeze({startDate:'2026-07-27',endDate:'2026-09-06'});
export const BUSINESS_SNAPSHOT_ID='sprix-excel-v5.1-2026-09-06';
export const AGENT_TYPE_NAMES=Object.freeze(['工程师（算法/开发）','设计师','产品经理','3D工程师','营销','其他']);
export const TASK_TYPE_NAMES=Object.freeze(['数据标注','网站开发','营销','设计','知识问答','其他']);

const rawWeeks=[
 ['07.27–08.02','2026-07-27','2026-08-02',18033,0.055,15500,355,[17832,12,41,45,21,82],[377,0,0,0,0,0],[15500,0,0,0,0,0],[0.255,null,null,null,null,null]],
 ['08.03–08.09','2026-08-03','2026-08-09',1689,0.2246,108850,1785,[1389,37,56,38,68,101],[1633,15,237,0,0,78],[95800,4500,4520,0,0,4030],[0.3108,0.94,0.91,null,null,0.67]],
 ['08.10–08.16','2026-08-10','2026-08-16',1201,0.287,203600,2133,[537,55,86,155,335,33],[1806,6,255,40,0,126],[187660,3000,6600,4320,0,2020],[0.2655,0.91,0.99,0.96,null,0.55]],
 ['08.17–08.23','2026-08-17','2026-08-23',1877,0.2154,308950,2655,[970,121,221,245,270,50],[2604,11,240,54,0,146],[285000,7600,4500,6650,0,5200],[0.297,0.96,0.99,0.94,null,0.73]],
 ['08.24–08.30','2026-08-24','2026-08-30',4509,0.1933,475800,3079,[3283,115,199,575,276,61],[3494,5,310,189,0,81],[448800,2550,9000,10200,0,5250],[0.3356,0.9,0.97,0.93,null,0.85]],
 ['08.31–09.06','2026-08-31','2026-09-06',3605,0.1274,586700,3544,[2818,148,228,101,244,66],[3787,18,351,235,68,85],[497400,9000,28900,34620,6380,10400],[0.3005,0.95,0.95,0.98,0.96,0.39]]
];
const PURE_AGENT_PENDING_BY_WEEK=[
 [395,0,0,0,0,0],
 [2977,423,411,0,0,270],
 [4982,273,653,415,0,111],
 [8465,730,446,625,0,380],
 [15062,230,873,949,0,446],
 [14947,855,2746,3393,612,406]
];
const HYBRID_PENDING_BY_WEEK=[
 [6928.5,0,0,0,0,0],
 [39615.216,162,244.08,0,0,797.94],
 [82701.762,162,39.6,103.68,0,545.4],
 [120213,182.4,27,239.4,0,842.4],
 [178909.632,153,162,428.4,0,472.5],
 [208758.78,270,867,415.44,153.12,3806.4]
];
const money=value=>Math.round((value+1e-9)*100)/100;
const dateAt=value=>Date.parse(`${value}T00:00:00+08:00`);
const dateKey=value=>new Date(value+SHANGHAI_OFFSET).toISOString().slice(0,10);
const localTime=value=>new Date(value+SHANGHAI_OFFSET).toISOString().slice(0,19).replace('T',' ');
const executionNo=(index,submittedAt)=>`EXE-${submittedAt.slice(0,10).replaceAll('-','')}-${String(index).padStart(6,'0')}`;
function parseDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value??''))throw new RangeError('日期格式必须为 YYYY-MM-DD');
 const at=dateAt(value);if(!Number.isFinite(at)||dateKey(at)!==value)throw new RangeError('日期无效');return at;
}
function allocate(total,weights,capacities){
 if(total===0)return weights.map(()=>0);
 const available=capacities?capacities.map(value=>Math.max(0,value)):weights.map(()=>Infinity);
 const normalized=weights.map(value=>Math.max(0,value)),weightTotal=normalized.reduce((sum,value)=>sum+value,0);
 const exact=normalized.map(value=>weightTotal?total*value/weightTotal:total/normalized.length);
 const result=exact.map((value,index)=>Math.min(available[index],Math.floor(value)));
 let remaining=total-result.reduce((sum,value)=>sum+value,0);
 const order=exact.map((value,index)=>({index,fraction:value-Math.floor(value),salt:hash(total+index,71)})).sort((a,b)=>b.fraction-a.fraction||a.salt-b.salt);
 while(remaining>0){let changed=false;for(const {index} of order)if(result[index]<available[index]&&remaining){result[index]++;remaining--;changed=true;}if(!changed)throw new RangeError('无法完成整数分配');}
 return result;
}
function weightedDays(total,seed,capacities){return allocate(total,WEEKDAY_WEIGHTS.map((value,index)=>value*(0.94+(hash(seed+index,72)%13)/100)),capacities);}
function dailyEffectiveAgents(weeklyUnique,dailyTasks,weekIndex){
 const delivered=dailyTasks.reduce((sum,value)=>sum+value,0),repeatRates=[1.03,1.04,1.02,1.06,1.1,1.08],dailyTotal=Math.min(delivered,Math.ceil(weeklyUnique*repeatRates[weekIndex]));
 return allocate(dailyTotal,dailyTasks.map((value,index)=>value*(0.98+(hash((weekIndex+1)*97+index,78)%5)/100)),dailyTasks);
}
function typeDailyMatrix(typeTotals,dayTotals,weekIndex){
 const capacities=[...dayTotals];return typeTotals.map((total,typeIndex)=>{if(typeIndex===typeTotals.length-1)return [...capacities];const row=allocate(total,dayTotals.map((value,dayIndex)=>value*(0.96+(hash((weekIndex+1)*101+typeIndex*11+dayIndex,73)%9)/100)),capacities);row.forEach((value,index)=>capacities[index]-=value);return row;});
}

const categoryWeekMasters=TASK_TYPE_NAMES.map((_,typeIndex)=>allocate(MASTER_TOTALS[typeIndex],rawWeeks.map(week=>week[8][typeIndex]),rawWeeks.map(week=>week[8][typeIndex])));
const categoryWeekRemaining=TASK_TYPE_NAMES.map((_,typeIndex)=>allocate(SLOT_TOTALS[typeIndex]-rawWeeks.reduce((sum,week)=>sum+week[8][typeIndex],0),rawWeeks.map(week=>week[8][typeIndex])));
const taskBlueprints=[null],executionBlueprints=[null],taskExecutionIndexes=new Map(),weeklyDailyTasks=[],weeklyDailyTasksByType=[],weeklyDailyEffective=[],taskTypeSequence=Array(TASK_TYPE_NAMES.length).fill(0);
for(const [weekIndex,raw] of rawWeeks.entries()){
 const taskCounts=raw[8],dailyByType=taskCounts.map((total,typeIndex)=>weightedDays(total,(weekIndex+1)*1000+typeIndex*37));
 const dailyTotals=Array.from({length:7},(_,day)=>dailyByType.reduce((sum,row)=>sum+row[day],0));
 const dailySeen=Array(7).fill(0);
 weeklyDailyTasks.push(dailyTotals);weeklyDailyTasksByType.push(dailyByType);weeklyDailyEffective.push(dailyEffectiveAgents(raw[6],dailyTotals,weekIndex));
 for(const [typeIndex,type] of TASK_TYPE_NAMES.entries()){
  const executionTotal=taskCounts[typeIndex];if(!executionTotal)continue;
  const masterTotal=categoryWeekMasters[typeIndex][weekIndex],remainingTotal=categoryWeekRemaining[typeIndex][weekIndex];
  const executionWeights=Array.from({length:masterTotal},(_,index)=>{const bucket=hash(index+weekIndex*97+typeIndex*29,74)%100;return bucket<12?12+bucket%5:bucket<35?4:1;});
  const executionsPerTask=allocate(executionTotal-masterTotal,executionWeights).map(value=>value+1);
  const remainingPerTask=allocate(remainingTotal,executionsPerTask.map((value,index)=>value*(1+(hash(index+typeIndex*31,75)%5)/10)),executionsPerTask);
  const taskIndexes=[];
  for(let localTask=0;localTask<masterTotal;localTask++){const index=taskBlueprints.length,typeSequence=++taskTypeSequence[typeIndex];taskIndexes.push(index);taskBlueprints.push({index,weekIndex,typeIndex,type,typeSequence,localTask,executionTotal:executionsPerTask[localTask],remainingSlots:remainingPerTask[localTask],executionIndexes:[]});}
  const daySequence=dailyByType[typeIndex].flatMap((count,day)=>Array.from({length:count},()=>day)),rate=raw[10][typeIndex];
  const autoCount=rate==null?0:Math.min(executionTotal-1,Math.max(1,Math.round(executionTotal*rate))),totalCents=Math.round(raw[9][typeIndex]*100),autoCents=Math.round(totalCents*(rate??0));
  const agentCents=allocate(autoCents,Array.from({length:autoCount},(_,index)=>1+(hash(index+typeIndex*17,76)%11)));
  const manualCents=allocate(totalCents-autoCents,Array.from({length:executionTotal-autoCount},(_,index)=>1+(hash(index+weekIndex*19,77)%11)));
  const shuffleSeed=(weekIndex+1)*100_000+(typeIndex+1)*10_000,deliverySlots=[...agentCents.map((acceptedCents,index)=>({deliveryMode:'AGENT',acceptedCents,sequence:index})),...manualCents.map((acceptedCents,index)=>({deliveryMode:'USER_MANUAL',acceptedCents,sequence:autoCount+index}))].sort((a,b)=>hash(shuffleSeed+a.sequence,79)-hash(shuffleSeed+b.sequence,79)||a.sequence-b.sequence);
  let localExecution=0;
  for(const taskIndex of taskIndexes){const task=taskBlueprints[taskIndex];for(let slot=0;slot<task.executionTotal;slot++){const index=executionBlueprints.length,day=daySequence[localExecution],delivery=deliverySlots[localExecution];executionBlueprints.push({index,taskIndex,weekIndex,typeIndex,type,day,dayPosition:dailySeen[day]++,deliveryMode:delivery.deliveryMode,acceptedCents:delivery.acceptedCents});task.executionIndexes.push(index);localExecution++;}taskExecutionIndexes.set(taskIndex,task.executionIndexes);}
 }
}
export const businessTaskCount=taskBlueprints.length-1;
export const businessExecutionCount=executionBlueprints.length-1;
export const businessAgentCount=rawWeeks.reduce((sum,week)=>sum+week[3],0);
export const businessSlotCount=SLOT_TOTALS.reduce((sum,value)=>sum+value,0);
export const businessRemainingSlotCount=businessSlotCount-businessExecutionCount;
export const businessPublishedTaskCount=taskBlueprints.slice(1).filter(task=>task.remainingSlots>0).length;

function executionSubmittedAt(index,item){return dateAt(rawWeeks[item.weekIndex][1])+item.day*DAY+(15+(hash(index,82)%7))*3_600_000+(hash(index,83)%60)*60_000;}
const acceptanceDisplayPositions=new Uint32Array(businessExecutionCount+1);
executionBlueprints.slice(1).map(item=>({index:item.index,submittedAt:executionSubmittedAt(item.index,item)}))
 .sort((a,b)=>b.submittedAt-a.submittedAt||`demo:business-order:${a.index}`.localeCompare(`demo:business-order:${b.index}`))
 .forEach((item,position)=>{acceptanceDisplayPositions[item.index]=position+1;});

function executorOrdinalForExecution(item){
 // Profiles may repeat for display; the business identity follows the effective-Agent pools.
 const weeklyPool=rawWeeks[item.weekIndex][6],dailyPools=weeklyDailyEffective[item.weekIndex],dailyPool=dailyPools[item.day];
 const previousWeeks=rawWeeks.slice(0,item.weekIndex).reduce((sum,week)=>sum+week[6],0);
 const dayOffset=dailyPools.slice(0,item.day).reduce((sum,value)=>sum+value,0);
 return previousWeeks+(dayOffset+(dailyPool?item.dayPosition%dailyPool:0))%weeklyPool+1;
}
function profileForExecution(index,item,task){
 return businessProfileForBatchPosition(acceptanceDisplayPositions[index],executorOrdinalForExecution(item),task);
}
function taskTitle(task){return `${task.type}·${rawWeeks[task.weekIndex][0]}·${String(task.localTask+1).padStart(4,'0')}`;}
function taskPublishedAt(task){const firstDay=Math.min(...task.executionIndexes.map(index=>executionBlueprints[index].day));return dateAt(rawWeeks[task.weekIndex][1])+firstDay*DAY+(task.type==='数据标注'?10:6)*3_600_000+(hash(task.index,96)%(3*60))*60_000;}
function defaultExecutionStatus(index){const bucket=hash(index,87)%100;return bucket<7?'running':bucket<34?'reviewing':bucket<92?'completed':'terminated';}
export function businessTaskRecord(index,patch={},executionPatches={}){
 const task=taskBlueprints[index];if(!task)return null;const week=rawWeeks[task.weekIndex],scale=task.type==='数据标注'?2000+hash(index,98)%8001:Math.max(1,task.executionTotal);
 const amountCents=task.executionIndexes.reduce((sum,executionIndex)=>sum+executionBlueprints[executionIndex].acceptedCents,0),first=executionBlueprints[task.executionIndexes[0]],last=executionBlueprints[task.executionIndexes.at(-1)],publishedAt=taskPublishedAt(task),firstAt=dateAt(week[1])+first.day*DAY+15*3_600_000,lastAt=dateAt(week[1])+last.day*DAY+21*3_600_000;
 const reward=money(amountCents/100/task.executionTotal),totalSlots=task.executionTotal+task.remainingSlots,reference=task.type==='数据标注'?dataAnnotationTaskContent(task.typeSequence,reward,totalSlots):otherTaskReferenceContent(task.type,task.typeSequence,reward,totalSlots);
 const record={id:`demo:business-task:${index}`,title:taskTitle(task),category:task.type,sourceName:'平台运营',sourceType:'平台发布',description:`${task.type}交付任务，请按照任务要求完成交付。`,cardSummary:`${task.type}任务`,deliverables:'结构化交付结果及任务要求对应附件',acceptanceCriteria:'内容完整且通过对应类型质检标准',reward,estimatedTokens:task.type==='数据标注'?scale*4:8000,tokenBillingUnit:1000,tokenUnitPrice:0,pricingModel:'任务承包制',pricingQuoteId:'',pricingEstimatedAt:'',totalAmount:money(reward*totalSlots),totalSlots,remainingSlots:task.remainingSlots,publishedAt:localTime(publishedAt),taskStatus:task.remainingSlots>0?'已发布':'已下线',offlineReason:task.remainingSlots>0?'':'SLOT_FULL',executionTotal:task.executionTotal,runningExecutionCount:0,reviewingExecutionCount:task.executionTotal,completedExecutionCount:0,terminatedExecutionCount:0,firstAcceptedAt:localTime(firstAt),firstCompletedAt:localTime(lastAt),firstAcceptancePassedAt:'',agentMatchScore:92,recommendedTaskType:task.type,suggestedTeam:'',matchAnalysis:'',riskPrompt:'',recommendedReason:'',submittedFiles:[],resultFiles:[],acceptanceResult:'待审核',...(reference??{}),...patch};
 const statusCounts={running:0,reviewing:0,completed:0,terminated:0};
 for(const executionIndex of task.executionIndexes){const status=executionPatches[`demo:business-execution:${executionIndex}`]?.status??defaultExecutionStatus(executionIndex);statusCounts[status in statusCounts?status:'reviewing']++;}
 record.runningExecutionCount=statusCounts.running;record.reviewingExecutionCount=statusCounts.reviewing;record.completedExecutionCount=statusCounts.completed;record.terminatedExecutionCount=statusCounts.terminated;
 record.totalAmount=money(record.reward*record.totalSlots);
 record.remainingSlots=Math.max(0,record.totalSlots-record.executionTotal);
 if(record.taskStatus==='已发布'&&record.remainingSlots===0){record.taskStatus='已下线';record.offlineReason='SLOT_FULL';}
 return record;
}
export function businessExecutionRecord(index,patch={}){
 const item=executionBlueprints[index];if(!item)return null;const task=businessTaskRecord(item.taskIndex),executorOrdinal=executorOrdinalForExecution(item),profile=profileForExecution(index,item,task),at=executionSubmittedAt(index,item),submittedAt=localTime(at),updatedAt=localTime(at+(1+hash(index,85)%16)*60_000),manual=item.deliveryMode==='USER_MANUAL';
 const agentScore=String(90+hash(index,84)%10);
 const row={index,executionIndex:index,id:`demo:business-order:${index}`,executionId:`demo:business-execution:${index}`,executionNo:executionNo(index,submittedAt),taskId:task.id,taskTitle:task.title,taskCategory:task.category,status:defaultExecutionStatus(index),userId:`demo:business-user:${profile.identityIndex}`,userName:profile.userName,phone:profile.phone,virtualPhone:profile.virtualPhone,userSpecialty:profile.agentType,agentId:`demo:business-agent:${executorOrdinal}`,agentName:profile.agentName,time:submittedAt,reward:money(item.acceptedCents/100),reviewSource:item.deliveryMode,acceptanceStatus:'待审核',acceptanceScore:'-',agentScore,acceptanceSummary:manual?'用户已人工上传交付，等待平台审核。':'Agent 已自动交付并完成质检，等待平台审核。',acceptanceIssues:'待平台审核',currentNode:'平台待审核',progress:'待审核',submittedAt,updatedAt,...patch};
 if(row.status==='running')Object.assign(row,{acceptanceStatus:'未提交',currentNode:'任务执行中',progress:'执行中'});
 if(row.status==='completed')Object.assign(row,{acceptanceStatus:'验收通过',acceptanceResult:'验收通过',currentNode:'验收完成',progress:'已完成'});
 if(row.status==='terminated')Object.assign(row,{acceptanceStatus:'验收不通过',acceptanceResult:'验收不通过',currentNode:'验收结束',progress:'未通过'});
 return row;
}
export function businessAcceptanceRecord(index,patch={}){const row=businessExecutionRecord(index,patch);return row?{...row,manualSubmissionNo:row.reviewSource==='USER_MANUAL'?1:undefined,manualSubmissionDescription:row.reviewSource==='USER_MANUAL'?'用户按任务要求上传交付文件，等待平台人工审核。':undefined}:null;}
const appealExecutionIndexes=executionBlueprints.slice(1).filter(item=>item.deliveryMode==='USER_MANUAL'&&hash(item.index,90)%23===0).map(item=>item.index);
export const businessAppealCount=appealExecutionIndexes.length;
export function businessAppealRecord(position,patch={}){
 const executionIndex=appealExecutionIndexes[position-1];if(!executionIndex)return null;const execution=businessExecutionRecord(executionIndex),variant=hash(executionIndex,91)%10,appealStatus=variant<2?'待处理':variant<3?'处理中':variant<7?'申诉通过':'申诉不通过',submittedAt=localTime(Date.parse(execution.submittedAt.replace(' ','T')+'+08:00')+2*3_600_000);
 return {backendId:`demo:business-appeal:${position}`,appealNo:`AP-${String(position).padStart(6,'0')}`,taskTitle:execution.taskTitle,taskCategory:execution.taskCategory,userId:execution.userId,userName:execution.userName,userPhone:execution.phone,userVirtualPhone:execution.virtualPhone,userSpecialty:execution.userSpecialty,agentName:execution.agentName,issueSummary:'人工上传交付的验收结果复核',appealReason:'申请按原任务交付标准复核本次人工上传结果。',appealStatus,priority:variant===0?'加急':'普通',submittedAt,handledAt:['待处理','处理中'].includes(appealStatus)?undefined:localTime(Date.parse(submittedAt.replace(' ','T')+'+08:00')+DAY),handler:['待处理','处理中'].includes(appealStatus)?'待分配':'平台复核专员',expectedProcessTime:'24 小时内',originalScore:'-',originalRejectReason:'验收结果存在争议',userSupplement:'已补充对应交付说明。',resultDescription:['待处理','处理中'].includes(appealStatus)?'等待平台复核。':`平台复核结果：${appealStatus}。`,linkedMyTaskId:execution.taskId,executionId:execution.executionId,executionNo:execution.executionNo,executionIndex,deliverables:'结构化交付结果及任务要求对应附件',acceptanceCriteria:'内容完整且通过对应类型质检标准',processLogs:[`${submittedAt} 用户提交申诉`,`${submittedAt} 平台已受理`],...patch};
}
export function businessTaskDetail(index,patch={},executionPatches={}){
 const blueprint=taskBlueprints[index],task=businessTaskRecord(index,patch,executionPatches);if(!blueprint||!task)return null;
 const records={running:[],reviewing:[],terminated:[],completed:[]};
 for(const executionIndex of taskExecutionIndexes.get(index)??[]){
  const row=businessAcceptanceRecord(executionIndex,executionPatches[`demo:business-execution:${executionIndex}`]??{});
  if(row.status==='completed')records.completed.push({...row,score:row.agentScore,appealStatus:'无申诉',settlementStatus:'待结算',completedAt:row.completedAt??row.submittedAt});
  else if(row.status==='terminated')records.terminated.push({...row,terminationReason:row.reason??'验收未通过',terminatedNode:row.currentNode,terminatedAt:row.terminatedAt??row.submittedAt});
  else if(row.status==='running')records.running.push({...row,startedAt:row.startedAt??row.submittedAt});
  else records.reviewing.push(row);
 }
 const files=task.category==='数据标注'?dataAnnotationTaskAttachmentFiles(task.id,blueprint.typeSequence,task.reward,task.totalSlots,task.publishedAt):otherTaskReferenceAttachmentFiles(task.id,task.category,blueprint.typeSequence,task.reward,task.totalSlots,task.publishedAt),attachments=files.map(file=>Object.fromEntries(Object.entries(file).filter(([key])=>key!=='bytes'&&key!=='content')));return {task,attachments,operationLogs:[],records};
}
export function businessTaskAttachment(taskId,attachmentId){
 const match=/^demo:business-task:(\d+)$/.exec(taskId??''),index=match?Number(match[1]):0,blueprint=taskBlueprints[index],task=businessTaskRecord(index);if(!blueprint||!task)return null;
 const files=task.category==='数据标注'?dataAnnotationTaskAttachmentFiles(task.id,blueprint.typeSequence,task.reward,task.totalSlots,task.publishedAt):otherTaskReferenceAttachmentFiles(task.id,task.category,blueprint.typeSequence,task.reward,task.totalSlots,task.publishedAt);
 return files.find(file=>file.attachmentId===attachmentId)??null;
}
export function businessAcceptanceDetail(id,patch={}){const match=/^demo:business-execution:(\d+)$/.exec(id??'');return match?businessAcceptanceRecord(Number(match[1]),patch):null;}
export function businessAppealDetail(id,patch={}){const match=/^demo:business-appeal:(\d+)$/.exec(id??'');return match?businessAppealRecord(Number(match[1]),patch):null;}
export function businessExecutionSubmission(id){
 const match=/^demo:business-execution:(\d+)$/.exec(id??''),row=match?businessAcceptanceRecord(Number(match[1])):null;if(!row)return null;
 const taskMatch=/^demo:business-task:(\d+)$/.exec(row.taskId),task=taskMatch?businessTaskRecord(Number(taskMatch[1])):null;
 return task?buildBusinessExecutionSubmission(task,row):null;
}

export const weeklyBusinessFacts=Object.freeze(rawWeeks.map((raw,weekIndex)=>{
 const [label,startDate,endDate,newAgents,heterogeneousRate,acceptedGmv,effectiveAgents,agentCounts,taskCounts,amounts,passRates]=raw,days=weightedDays(newAgents,(weekIndex+1)*17),typeDays=typeDailyMatrix(agentCounts,days,weekIndex),deliveredTasks=taskCounts.reduce((sum,value)=>sum+value,0);
 return Object.freeze({label,startDate,endDate,newAgents,heterogeneousRate,acceptedGmv,effectiveAgents,deliveredTasks,averageGmvPerEffectiveAgent:acceptedGmv/effectiveAgents,dailyNewAgents:Object.freeze(days.map((total,index)=>Object.freeze({date:dateKey(dateAt(startDate)+index*DAY),total}))),dailyDelivery:Object.freeze(weeklyDailyTasks[weekIndex].map((tasks,index)=>Object.freeze({date:dateKey(dateAt(startDate)+index*DAY),tasks,effectiveAgents:weeklyDailyEffective[weekIndex][index]}))),agentTypes:Object.freeze(AGENT_TYPE_NAMES.map((type,index)=>Object.freeze({type,count:agentCounts[index],daily:Object.freeze(typeDays[index])}))),taskTypes:Object.freeze(TASK_TYPE_NAMES.map((type,index)=>{const amount=amounts[index],passRate=passRates[index],autoDeliveryAmount=passRate==null?0:money(amount*passRate),manualDeliveryAmount=passRate==null?0:money(amount*(1-passRate));return Object.freeze({type,tasks:taskCounts[index],daily:Object.freeze(weeklyDailyTasksByType[weekIndex][index]),amount,passRate,autoDeliveryAmount,manualDeliveryAmount,pureAgentPending:PURE_AGENT_PENDING_BY_WEEK[weekIndex][index],hybridPending:HYBRID_PENDING_BY_WEEK[weekIndex][index]});})),masterTasks:TASK_TYPE_NAMES.reduce((sum,_,typeIndex)=>sum+categoryWeekMasters[typeIndex][weekIndex],0),slots:deliveredTasks+TASK_TYPE_NAMES.reduce((sum,_,typeIndex)=>sum+categoryWeekRemaining[typeIndex][weekIndex],0)});
}));
const latestCompleteWeek=weeklyBusinessFacts.at(-1);
export const platformCumulativeOverview=Object.freeze({
 amount:money(weeklyBusinessFacts.reduce((sum,week)=>sum+week.acceptedGmv,0)),
 orders:businessExecutionCount+(latestCompleteWeek?.deliveredTasks??0),
 tasks:businessTaskCount+(latestCompleteWeek?.masterTasks??0),
 agents:businessAgentCount+(latestCompleteWeek?.newAgents??0)
});
export function createBusinessMetricsSnapshot(range=BUSINESS_PERIOD){
 const startAt=parseDate(range.startDate),endAt=parseDate(range.endDate);if(startAt>endAt)throw new RangeError('开始日期不能晚于结束日期');
 const weeks=weeklyBusinessFacts.map(week=>{const includedIndexes=week.dailyNewAgents.map((day,index)=>day.date>=range.startDate&&day.date<=range.endDate?index:-1).filter(index=>index>=0),dailyNewAgents=week.dailyNewAgents.filter(day=>day.date>=range.startDate&&day.date<=range.endDate),dailyDelivery=week.dailyDelivery.filter(day=>day.date>=range.startDate&&day.date<=range.endDate);return {...week,dailyNewAgents,dailyDelivery,agentTypes:week.agentTypes.map(type=>({...type,count:includedIndexes.reduce((sum,index)=>sum+type.daily[index],0),daily:includedIndexes.map(index=>type.daily[index])})),taskTypes:week.taskTypes.map(type=>({...type,tasks:includedIndexes.reduce((sum,index)=>sum+type.daily[index],0),daily:includedIndexes.map(index=>type.daily[index])})),newAgents:dailyNewAgents.reduce((sum,day)=>sum+day.total,0),deliveredTasks:dailyDelivery.reduce((sum,day)=>sum+day.tasks,0)};});
 const masterTasks=businessTaskCount,executions=businessExecutionCount,remainingSlots=businessRemainingSlotCount,slots=businessSlotCount;
 const latest=weeklyBusinessFacts.at(-1),items=weeklyBusinessFacts.flatMap(week=>week.taskTypes),autoDeliveryAmount=money(items.reduce((sum,item)=>sum+item.autoDeliveryAmount,0)),manualDeliveryAmount=money(items.reduce((sum,item)=>sum+item.manualDeliveryAmount,0)),pureAgentPending=money(items.reduce((sum,item)=>sum+item.pureAgentPending,0)),hybridPending=money(items.reduce((sum,item)=>sum+item.hybridPending,0));return {snapshotVersion:BUSINESS_SNAPSHOT_ID,generatedAt:new Date(BUSINESS_CUTOFF_AT).toISOString(),periodStart:range.startDate,periodEnd:range.endDate,source:{file:'Sprix 经营数据中心',sheet:'经营指标',rows:'全量',note:'任务、执行、验收与申诉使用统一业务口径'},weeks,summary:{newAgents:weeks.reduce((sum,week)=>sum+week.newAgents,0),heterogeneousRate:latest?.heterogeneousRate??null,acceptedGmv:weeklyBusinessFacts.reduce((sum,week)=>sum+week.acceptedGmv,0),effectiveAgents:latest?.effectiveAgents??null,averageGmvPerEffectiveAgent:latest?.averageGmvPerEffectiveAgent??null,deliveredTasks:weeks.reduce((sum,week)=>sum+week.deliveredTasks,0),masterTasks,slots,executions,remainingSlots,autoDeliveryAmount,manualDeliveryAmount,pureAgentPending,hybridPending}};
}
export function businessAudit(){return {masterTasks:businessTaskCount,slots:businessSlotCount,executions:businessExecutionCount,remainingSlots:businessRemainingSlotCount,appeals:businessAppealCount,weeks:weeklyBusinessFacts.map(week=>({label:week.label,tasks:week.deliveredTasks,effectiveAgents:week.effectiveAgents,dailyValid:week.dailyDelivery.every(day=>day.tasks>=day.effectiveAgents),amount:money(week.taskTypes.reduce((sum,item)=>sum+item.amount,0)),gmv:week.acceptedGmv,settlementValid:week.taskTypes.every(item=>money(item.autoDeliveryAmount+item.manualDeliveryAmount)===item.amount)}))};}
