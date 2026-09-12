import {taskContent,editedTaskContent} from './submission-task.mjs';
import {CONSUMER_EXECUTION_BASE} from "./consumer-records.mjs";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemoLedger, isDemoId } from "./demo-ledger.mjs";
import { createAnalyticsSnapshot } from "./analytics-data.mjs";
const statePath = process.env.MOCK_STATE_PATH ?? fileURLToPath(new URL("./.data/state.json", import.meta.url));
let queue = Promise.resolve();
export async function readDemoState() {
  try { return JSON.parse(await readFile(statePath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { patches: {}, events: [] }; throw error; }
}
export function applyDemoAction({ id, action, payload = {} }) {
  const result = queue.then(async () => {
    if (!isDemoId(id) || !/^demo:(task|execution|appeal):[1-9]\d*$/.test(id) || !payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("操作参数无效");
    if (!["edit", "offline", "republish", "delete", "approve", "reject", "start", "accept"].includes(action)) throw new Error("不支持此操作");
    const state = await readDemoState();
    const ledger = buildDemoLedger(createAnalyticsSnapshot(7), state);
    const kind = id.split(":")[1];
    const actionAt = new Date().toISOString();
    let patch;
    let accepted;
    let current;
    if (kind === "task") {
      current = ledger.tasks.find((row) => row.id === id);
      if (!current) throw new Error("任务不存在");
      if (action === "accept") {
        if(current.taskStatus!=="已发布") throw new Error("任务未发布或已下线，无法执行");
        if(current.remainingSlots<1) throw new Error("任务名额已满，无法执行");
        if(!/^[a-zA-Z0-9-]{16,64}$/.test(payload.owner ?? '') || !/codex|claude|opencode|hermes/i.test(payload.agentName ?? '')) throw new Error("请选择已连接的执行 Agent");
        state.consumerExecutions ??= [];
        const existing=state.consumerExecutions.find(r=>r.owner===payload.owner&&r.taskId===id&&ledger.execution(r.index).status!=='terminated');
        if(existing) return {id:`demo:execution:${existing.index}`,taskId:id};
        const index=CONSUMER_EXECUTION_BASE+state.consumerExecutions.length+1;
        const phone=String(payload.phone ?? '').replace(/\D/g,'').slice(-11),tail=phone.slice(-4);
        if(!/^1\d{10}$/.test(phone)) throw new Error("用户手机号不完整");
        state.consumerExecutions.push({index,owner:payload.owner,taskId:id,userName:`用户${tail}`,phone,agentId:String(payload.agentId ?? ''),agentName:String(payload.agentName),reward:current.reward,category:current.category,startedAt:actionAt});
        accepted={id:`demo:execution:${index}`,taskId:id}; patch=current.remainingSlots===1?{taskStatus:"已下线",offlineReason:"SLOT_FULL"}:{};
      } else if (action === "edit") {
        patch = {};
        for (const key of ["title", "category", "sourceType", "description", "deliverables", "acceptanceCriteria"]) {
          if (typeof payload[key] !== "string") throw new Error("任务字段不完整");
          patch[key] = payload[key];
        }
        if (!Number.isFinite(payload.reward) || payload.reward < 0 || !Number.isInteger(payload.totalSlots) || payload.totalSlots < current.executionTotal) throw new Error("任务金额或名额不合法");
        if(payload.estimatedTokens!==undefined && (!Number.isInteger(payload.estimatedTokens)||payload.estimatedTokens<=0)) throw new Error('Token 预估不合法');
        const after=editedTaskContent(current,payload);
        Object.assign(patch,after);
        patch.contentHistory=[...(state.patches?.[id]?.contentHistory ?? []),{at:actionAt,before:taskContent(current),after}];
        patch.rewardHistory=[...(state.patches?.[id]?.rewardHistory ?? [])];
        if(!patch.rewardHistory.length) {
          const previousEdit=(state.events ?? []).find(event=>event.id===id&&event.action==='edit');
          if(previousEdit) patch.rewardHistory.push({at:previousEdit.at,reward:current.reward});
        }
        patch.rewardHistory.push({at:actionAt,reward:payload.reward});
        patch.reward = payload.reward; patch.totalSlots = payload.totalSlots; patch.remainingSlots = payload.totalSlots - current.executionTotal;
      } else if (action === "offline") {
        if(current.taskStatus!=="已发布") throw new Error("只有已发布任务可以下线");
        const reason=String(payload.reason ?? '').trim();
        if(!reason) throw new Error("请填写操作原因");
        patch={taskStatus:"已下线",offlineReason:reason==='SLOT_FULL'?'SLOT_FULL':'OFFLINE'};
      } else if (action === "republish") {
        if(current.taskStatus!=="已下线") throw new Error("只有已下线任务可以重新发布");
        if(current.offlineReason==='SLOT_FULL'||current.remainingSlots<=0) throw new Error("名额已满的任务不能重新发布");
        patch={taskStatus:"已发布",offlineReason:"",publishedAt:new Date(Date.parse(actionAt)+8*3600000).toISOString().slice(0,19).replace("T"," ")};
      }
      else if (action === "delete") patch = { taskStatus: "已删除" };
    } else if (kind === "execution") {
      current = ledger.acceptanceReviews.find((row) => row.executionId === id);
      if (!current) throw new Error("该执行记录已处理或不存在");
      if (action === "approve") patch = { status: "completed", completedAt: actionAt };
      else if (action === "reject") patch = { status: "terminated", terminatedAt: actionAt, reason: String(payload.reason ?? "验收未通过") };
    } else if (kind === "appeal") {
      current = ledger.appeals.find((row) => row.backendId === id);
      if (!current || ["申诉通过", "申诉不通过"].includes(current.appealStatus)) throw new Error("申诉已处理或不存在");
      const status = { start: "处理中", approve: "申诉通过", reject: "申诉不通过" }[action];
      if(action==='start' && current.appealStatus!=='待处理') throw new Error('申诉已开始处理');
      if (status) {
        patch = { ...(action==='start'?{startedAt:actionAt}:{resolvedAt:actionAt}), reason:String(payload.reason ?? ''), appealStatus: status, handler: "平台管理员", processLogs: [...current.processLogs, `${actionAt} ${status}${payload.reason ? `：${payload.reason}` : ""}`] };
        if (action === "approve") {
          state.patches ??= {};
          state.patches[current.executionId] = { ...state.patches[current.executionId], status: "completed", completedAt:actionAt };
        }
      }
    }
    if (!current || !patch) throw new Error("不支持此操作");
    state.patches ??= {};
    state.patches[id] = { ...state.patches[id], ...patch };
    state.events ??= [];
    state.events.push({ id, action, at: actionAt, reason: String(payload.reason ?? ""), beforeStatus: current.withdrawStatus ?? current.settlementStatus ?? current.appealStatus ?? current.taskStatus ?? "待验收", afterStatus: patch.withdrawStatus ?? patch.settlementStatus ?? patch.appealStatus ?? patch.taskStatus ?? patch.status, amount: current.applyAmount ?? current.netIncome ?? 0 });
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(`${statePath}.tmp`, JSON.stringify(state), { mode: 0o600 });
    await rename(`${statePath}.tmp`, statePath);
    return accepted ?? { ...current, ...patch };
  });
  queue = result.catch(() => {});
  return result;
}
