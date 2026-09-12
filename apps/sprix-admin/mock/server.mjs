import {consumerMyTask} from "./consumer-records.mjs";
import {fundSummary} from "./fund-summary.mjs";
import {getView,viewPage} from "./admin-views.mjs";
import { queryEvents, queryUserProfile } from "./analytics-events.mjs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { readDemoState, applyDemoAction } from "./demo-state.mjs";
import { createAnalyticsSnapshot } from "./analytics-data.mjs";

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
    const profile = queryUserProfile(url.searchParams.get("user_id"));
    sendJson(response, profile ? 200 : 404, profile ?? {message:"未找到用户画像"});
    return;
  }
  if (url.pathname === "/mock-api/dashboard/events" && request.method === "GET") {
    try { sendJson(response, 200, queryEvents(url.searchParams)); }
    catch (error) { sendJson(response, 400, { message: error.message }); }
    return;
  }
  if (url.pathname === "/mock-api/admin/view" && request.method === "GET") {
    getView(url.searchParams.get('version')).then(view=>{
      const kind=url.searchParams.get('kind');
      if(kind==='acceptance-stats') return sendJson(response,200,{tasks:new Set(view.ledger.acceptanceReviews.map(r=>r.taskId)).size,users:new Set(view.ledger.acceptanceReviews.map(r=>r.userId ?? r.userName)).size});
      if(kind==='appeal-stats') {const rows=view.ledger.appeals,today=new Date(Date.now()+28800000).toISOString().slice(0,10);return sendJson(response,200,{pending:rows.filter(r=>r.appealStatus==='待处理').length,processing:rows.filter(r=>r.appealStatus==='处理中').length,today:rows.filter(r=>r.submittedAt.startsWith(today)).length,done:rows.filter(r=>['申诉通过','申诉不通过'].includes(r.appealStatus)).length});}
      if(kind==='fund-stats') return sendJson(response,200,fundSummary(view.ledger.funds));
      if(kind==='dashboard') return sendJson(response,200,view.dashboard);
      if(kind==='task-detail') {const row=view.ledger.detail(url.searchParams.get('id'));return sendJson(response,row?200:404,row ?? {message:'任务不存在'});}
      if(kind==='acceptance-detail'||kind==='appeal-detail') {const row=(kind==='acceptance-detail'?view.ledger.acceptanceReviews:view.ledger.appeals).find(r=>(kind==='acceptance-detail'?r.executionId:r.backendId)===url.searchParams.get('id'));return sendJson(response,row?200:404,row ?? {message:'记录不存在'});}
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
  const days = url.searchParams.get("days") ?? "7";
  if ((days !== "7" && days !== "30") || url.searchParams.getAll("days").length > 1) {
    sendJson(response, 400, { message: "days 必须为 7 或 30" });
    return;
  }
  sendJson(response, 200, createAnalyticsSnapshot(Number(days)));
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
