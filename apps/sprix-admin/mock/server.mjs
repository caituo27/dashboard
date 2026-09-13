import { executionSubmission } from './execution-result.mjs';
import {consumerMyTask} from "./consumer-records.mjs";
import {businessDetail,businessAcceptanceDetail,businessAppealDetail,getView,viewPage} from "./admin-views.mjs";
import { queryEvents, queryUserProfile } from "./analytics-events.mjs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { readDemoState, applyDemoAction } from "./demo-state.mjs";
import { createAnalyticsSnapshot } from "./analytics-data.mjs";
import { buildDemoLedger } from "./demo-ledger.mjs";
import { orderRange, statusAt } from "./business-scenario.mjs";
import {businessAcceptanceRecord,businessAppealCount,businessAppealRecord,businessExecutionCount,businessExecutionSubmission,businessPublishedTaskCount,businessTaskAttachment,businessTaskCount,createBusinessMetricsSnapshot} from './business-metrics.mjs';

const compactDashboardCache = new Map();
function applyStateToDashboard(snapshot,state) {
  const at=Date.parse(snapshot.generatedAt),ledger=buildDemoLedger(snapshot,state);
  const taskPublications=new Map(),categories=new Map();
  let taskTotal=0,publishedTasks=0;
  for(let index=1;index<=ledger.taskCount;index++) {
    const task=ledger.taskMeta(index);
    if(task.taskStatus==='已删除') continue;
    taskTotal++;
    if(task.taskStatus==='已发布') publishedTasks++;
    categories.set(task.category,(categories.get(task.category) ?? 0)+1);
    const date=String(task.publishedAt).slice(0,10);
    taskPublications.set(date,(taskPublications.get(date) ?? 0)+1);
  }
  const executions={...snapshot.operations.executions};
  const removed=new Set(),affected=new Set();
  for(const row of state.consumerExecutions ?? []) {
    const taskIndex=Number(row.taskId?.split(':')[2]),[,originalLast]=orderRange(taskIndex),[,currentLast]=ledger.executionRange(taskIndex);
    for(let index=currentLast+1;index<=Math.min(originalLast,ledger.orders);index++) removed.add(index);
    affected.add(row.index);
  }
  for(const index of removed) executions[statusAt(index,at)]--;
  for(const id of Object.keys(state.patches ?? {})) {
    if(id.startsWith('demo:execution:')) affected.add(Number(id.split(':')[2]));
    if(id.startsWith('demo:appeal:')) affected.add(Number(id.split(':')[2])*825);
  }
  for(const index of affected) {
    if(ledger.consumerRows.has(index)) executions[ledger.executionStatus(index)]++;
    else if(index>=1&&index<=ledger.orders&&!removed.has(index)) {
      const before=statusAt(index,at),after=ledger.executionStatus(index);
      if(before!==after) {executions[before]--;executions[after]++;}
    }
  }
  const orderTotal=Object.values(executions).reduce((total,value)=>total+(value ?? 0),0);
  return {...snapshot,
    overview:{...snapshot.overview,tasks:taskTotal,orders:orderTotal},
    operations:{...snapshot.operations,taskTotal,publishedTasks,executions,pendingAcceptance:ledger.acceptanceCount(),appeals:ledger.appealCount,
      publishedTaskCategories:[...categories].map(([category,count])=>({category,count})).sort((a,b)=>b.count-a.count||a.category.localeCompare(b.category,'zh-CN')),
      taskPublications:snapshot.operations.taskPublications.map(row=>({...row,count:taskPublications.get(row.date) ?? 0}))}
  };
}
async function compactDashboard(period, range) {
  if(range){
    const key=JSON.stringify(['business-dashboard',range]);
    if(!compactDashboardCache.has(key)){
      const businessMetrics=createBusinessMetricsSnapshot(range),platformAt=Math.floor(Date.now()/10000)*10000,snapshot=createAnalyticsSnapshot(period,platformAt);
      compactDashboardCache.set(key,{...snapshot,snapshotVersion:businessMetrics.snapshotVersion,periodStart:businessMetrics.periodStart,periodEnd:businessMetrics.periodEnd,businessMetrics});
    }
    return compactDashboardCache.get(key);
  }
  const state=await readDemoState();
  const at = Math.floor(Date.now() / 10000) * 10000;
  const stateHash=createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0,12);
  const key = JSON.stringify([period, range ?? null, at, stateHash]);
  if (!compactDashboardCache.has(key)) {
    const platformSnapshot=createAnalyticsSnapshot(period,at),snapshot=applyStateToDashboard(platformSnapshot,state),businessMetrics=createBusinessMetricsSnapshot();
    compactDashboardCache.set(key,{...snapshot,snapshotVersion:businessMetrics.snapshotVersion,periodStart:businessMetrics.periodStart,periodEnd:businessMetrics.periodEnd,businessMetrics,
      overview:platformSnapshot.overview,
      operations:{...snapshot.operations,taskTotal:businessTaskCount,publishedTasks:businessPublishedTaskCount,executions:{running:0,reviewing:businessExecutionCount,completed:0,terminated:0},pendingAcceptance:businessExecutionCount,appeals:businessAppealCount}});
    while (compactDashboardCache.size > 12) compactDashboardCache.delete(compactDashboardCache.keys().next().value);
  }
  return compactDashboardCache.get(key);
}
function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(data));
}

// Shared handler for the standalone HTTP service and Vite dev/preview servers.
export function dashboardMockMiddleware(request, response, next) {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/mock-api/")) return next();
  if(url.pathname==='/mock-api/consumer/view' && request.method==='GET') {
    getView().then(view=>{
      const kind=url.searchParams.get('kind');
      if(kind==='my-tasks') {
        const owner=url.searchParams.get('owner');
        const rows=[...view.ledger.consumerRows.values()].filter(row=>row.owner===owner).map(row=>consumerMyTask(view.ledger.execution(row.index)));
        return sendJson(response,200,{rows});
      }
      if(kind==='task-detail') {
        const detail=view.ledger.detail(url.searchParams.get('id'));
        return sendJson(response,detail?200:404,detail?.task ?? {message:'任务不存在'});
      }
      if(kind!=='tasks') throw new Error('INVALID_KIND');
      sendJson(response,200,viewPage(view,'tasks',{offset:url.searchParams.get('offset')??0,limit:url.searchParams.get('limit')??20,status:'已发布',availableOnly:true}));
    }).catch(error=>sendJson(response,400,{message:error.message}));return;
  }
  if (url.pathname === "/mock-api/dashboard/user-profile" && request.method === "GET") {
    const profile = queryUserProfile(url.searchParams.get("user_id"), Date.now());
    sendJson(response, profile ? 200 : 404, profile ?? {message:"未找到用户画像"});
    return;
  }
  if (url.pathname === "/mock-api/dashboard/events" && request.method === "GET") {
    try { sendJson(response, 200, queryEvents(url.searchParams, Date.now())); }
    catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }
  if (url.pathname === '/mock-api/admin/task-attachment' && request.method === 'GET') {
    const file=businessTaskAttachment(url.searchParams.get('id'),url.searchParams.get('file'));
    if(!file) return sendJson(response,404,{message:'任务附件不存在'});
    response.writeHead(200,{'Content-Type':file.mimeType+'; charset=utf-8','Content-Length':file.bytes.length,
      'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(file.bytes);
    return;
  }
  if (url.pathname === '/mock-api/admin/artifact' && request.method === 'GET') {
    getView().then(view=>{
      const id=url.searchParams.get('id');
      const submission=businessExecutionSubmission(id)??executionSubmission(view.ledger,id);
      const file=submission?.files.find(file=>file.fileId===url.searchParams.get('file'));
      if(!file) return sendJson(response,404,{message:'文件不存在'});
      response.writeHead(200,{'Content-Type':file.mimeType+'; charset=utf-8','Content-Length':file.bytes.length,
        'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      response.end(file.bytes);
    }).catch(()=>sendJson(response,500,{message:'文件读取失败'}));
    return;
  }
  if (url.pathname === "/mock-api/admin/view" && request.method === "GET") {
    const requestedKind=url.searchParams.get('kind');
    if (requestedKind === 'dashboard') {
      compactDashboard(30).then(data=>sendJson(response,200,data)).catch(error=>sendJson(response,400,{message:error.message}));
      return;
    }
    getView(url.searchParams.get('version')).then(view=>{
      const kind=url.searchParams.get('kind');
      if(kind==='execution-result') {const id=url.searchParams.get('id');const submission=businessExecutionSubmission(id)??executionSubmission(view.ledger,id);return sendJson(response,submission?200:404,submission?.result ?? {message:'执行记录不存在'});}
      if(kind==='acceptance-stats') {
        const category=url.searchParams.get('category');
        const rows=[];for(let index=1;index<=businessExecutionCount;index++){const row=businessAcceptanceRecord(index);if(!category||row.taskCategory===category)rows.push(row);}
        return sendJson(response,200,{tasks:new Set(rows.map(r=>r.taskId)).size,users:new Set(rows.map(r=>r.userId ?? r.userName)).size});
      }
      if(kind==='appeal-stats') {
        const category=url.searchParams.get('category');
        const rows=[];for(let index=1;index<=businessAppealCount;index++){const row=businessAppealRecord(index);if(!category||row.taskCategory===category)rows.push(row);}
        const today=new Date(Date.now()+28800000).toISOString().slice(0,10);
        return sendJson(response,200,{pending:rows.filter(r=>r.appealStatus==='待处理').length,processing:rows.filter(r=>r.appealStatus==='处理中').length,today:rows.filter(r=>r.submittedAt.startsWith(today)).length,done:rows.filter(r=>['申诉通过','申诉不通过'].includes(r.appealStatus)).length});
      }
      if(kind==='task-detail') {const id=url.searchParams.get('id');const row=businessDetail(id,view.state)??view.ledger.detail(id);return sendJson(response,row?200:404,row ?? {message:'任务不存在'});}
      if(kind==='acceptance-detail'||kind==='appeal-detail') {const id=url.searchParams.get('id'),patch=view.state?.patches?.[id]??{};const businessRow=kind==='acceptance-detail'?businessAcceptanceDetail(id,patch):businessAppealDetail(id,patch);const row=businessRow??(kind==='acceptance-detail'?view.ledger.acceptanceReviews:view.ledger.appeals).find(r=>(kind==='acceptance-detail'?r.executionId:r.backendId)===id);return sendJson(response,row?200:404,row ?? {message:'记录不存在'});}
      sendJson(response,200,viewPage(view,kind,Object.fromEntries(url.searchParams)));
    }).catch(error=>sendJson(response,error.message==='SNAPSHOT_EXPIRED'?409:400,{message:error.message}));
    return;
  }
  if (url.pathname === "/mock-api/admin/state" && request.method === "GET") {
    readDemoState().then((state) => sendJson(response, 200, { snapshot: createAnalyticsSnapshot(7), state })).catch(() => sendJson(response, 500, { message: "数据读取失败" }));
    return;
  }
  if (["/mock-api/admin/actions","/mock-api/consumer/accept"].includes(url.pathname) && request.method === "POST") {
    let body = "";
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > 65536 && !tooLarge) { tooLarge = true; sendJson(response, 413, { message: "请求过大" }); }
    });
    request.on("end", () => {
      if (tooLarge) return;
      try { const data=JSON.parse(body); const action=url.pathname==="/mock-api/consumer/accept"?{id:data.id,action:"accept",payload:data.payload}:data; applyDemoAction(action).then((result) => sendJson(response, 200, result)).catch((error) => sendJson(response, 400, { message: error.message })); }
      catch { sendJson(response, 400, { message: "Invalid JSON" }); }
    });
    return;
  }
  if (url.pathname !== "/mock-api/dashboard/analytics") {
    sendJson(response, 404, { message: "请求的接口不存在" });
    return;
  }
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { message: "Only GET is supported" });
    return;
  }
  const starts = url.searchParams.getAll("startDate");
  const ends = url.searchParams.getAll("endDate");
  const customRange = starts.length || ends.length;
  if (customRange) {
    if (starts.length !== 1 || ends.length !== 1 || url.searchParams.has("days")) {
      sendJson(response, 400, { message: "自定义周期必须同时提供唯一的 startDate 和 endDate" });
      return;
    }
    compactDashboard(7,{startDate:starts[0],endDate:ends[0]}).then(data=>sendJson(response,200,data)).catch(error=>sendJson(response,400,{message:error.message}));
    return;
  }
  const days = url.searchParams.get("days") ?? "7";
  if ((days !== "7" && days !== "28" && days !== "30") || url.searchParams.getAll("days").length > 1) {
    sendJson(response, 400, { message: "days 必须为 7、28 或 30" });
    return;
  }
  compactDashboard(Number(days)).then(data=>sendJson(response,200,data)).catch(error=>sendJson(response,400,{message:error.message}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.MOCK_PORT ?? 5176);
  const host = process.env.MOCK_HOST ?? "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid MOCK_PORT");
  const server = createServer((request, response) => {
    dashboardMockMiddleware(request, response, () => sendJson(response, 404, { message: "Not found" }));
  });
  server.listen(port, host, () => console.log(`Dashboard mock API: http://${host}:${port}/mock-api/dashboard/analytics?days=7`));
}
