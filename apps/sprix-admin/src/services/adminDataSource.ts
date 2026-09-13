import axios from "axios";
import * as real from "./sprixApi";
import { isDemoId } from "../../mock/demo-ledger.mjs";
import { isSeedExecutionId, isSeedTaskCandidate, seedTaskDetail, selectSeedTaskIds } from "../../mock/seed-task-scenario.mjs";
import type { SeedDemoState, SeedExecutionStatus } from "../../mock/seed-task-scenario.mjs";
import { sharedAdminRead } from "./adminQueryClient";
import type { CompletedExecution, ReviewingExecution, Task } from "../types";
export type { UpsertAdminTaskPayload } from "./sprixApi";
export { createRemoteAdminTask } from "./sprixApi";

async function readDetail<T>(kind:string,id?:string,params:Record<string,unknown>={}):Promise<T> {return (await axios.get<T>('/mock-api/admin/view',{params:{kind,id,...params},timeout:15000})).data;}
const readSeedState=()=>readDetail<SeedDemoState>('seed-state');
async function writeDemo<T>(id: string, action: string, payload: unknown = {}): Promise<T> {
  try {
    const { data } = await axios.post<T>("/mock-api/admin/actions", { id, action, payload }, { timeout: 15000 });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) throw new Error(error.response?.data?.message ?? "操作失败");
    throw error;
  }
}
export {readRemoteTaskCenterSnapshot,readRemoteAcceptanceReviews,readRemoteAppeals,readRemoteFunds} from './sprixApi';
export type AdminTaskDetailReadOptions={status?:SeedExecutionStatus;page?:number;pageSize?:number;executionId?:string};
export async function readRemoteTaskDetail(id:string,options:AdminTaskDetailReadOptions={}) {
  if(isDemoId(id))return readDetail<real.AdminTaskDetailView>('task-detail',id);
  const detail=await real.readRemoteTaskDetail(id);
  const hasRealRecords=Object.values(detail.records).some(rows=>rows.length>0);
  if(!isSeedTaskCandidate(detail.task)||hasRealRecords)return detail;
  try {
    const [tasks,state]=await Promise.all([sharedAdminRead('task-summaries',real.readRemoteTaskSummaries),readSeedState()]);
    return seedTaskDetail(detail,selectSeedTaskIds(tasks),state,options);
  } catch {
    return detail;
  }
}
export async function readRemoteAppealDetail(id:string) {return isDemoId(id)?readDetail<Awaited<ReturnType<typeof real.readRemoteAppealDetail>>>('appeal-detail',id):real.readRemoteAppealDetail(id);}

export const updateRemoteAdminTask: typeof real.updateRemoteAdminTask = (id, ...args) => isDemoId(id) ? writeDemo(id, "edit", args[0]) : real.updateRemoteAdminTask(id, ...args);
export const offlineRemoteAdminTask: typeof real.offlineRemoteAdminTask = (id, reason) => isDemoId(id) ? writeDemo(id, "offline", { reason }) : real.offlineRemoteAdminTask(id, reason);
export const republishRemoteAdminTask: typeof real.republishRemoteAdminTask = (id) => isDemoId(id) ? writeDemo(id, "republish") : real.republishRemoteAdminTask(id);
export const deleteRemoteAdminTask: typeof real.deleteRemoteAdminTask = (id, reason) => isDemoId(id) ? writeDemo(id, "delete", { reason }) : real.deleteRemoteAdminTask(id, reason);
export const approveRemoteAcceptanceReview: typeof real.approveRemoteAcceptanceReview = (id) => isDemoId(id) ? writeDemo(id, "approve") : real.approveRemoteAcceptanceReview(id);
export const rejectRemoteAcceptanceReview: typeof real.rejectRemoteAcceptanceReview = (id, reason) => isDemoId(id) ? writeDemo(id, "reject", { reason }) : real.rejectRemoteAcceptanceReview(id, reason);
export const startRemoteAppeal: typeof real.startRemoteAppeal = (id) => isDemoId(id) ? writeDemo(id, "start") : real.startRemoteAppeal(id);
export const approveRemoteAppeal: typeof real.approveRemoteAppeal = (id, reason) => isDemoId(id) ? writeDemo(id, "approve", {reason}) : real.approveRemoteAppeal(id, reason);
export const rejectRemoteAppeal: typeof real.rejectRemoteAppeal = (id, reason) => isDemoId(id) ? writeDemo(id, "reject", {reason}) : real.rejectRemoteAppeal(id, reason);

type SeedExecutionResultContext={task:Pick<Task,'id'|'title'|'category'|'deliverables'|'acceptanceCriteria'|'estimatedTokens'|'publishedAt'>;record:ReviewingExecution|CompletedExecution};
export async function readRemoteAdminExecutionResult(id:string,context?:SeedExecutionResultContext):Promise<real.AdminExecutionResult> {
  if(isSeedExecutionId(id)) {
    if(!context)throw new Error('执行结果缺少任务上下文');
    const {task,record}=context;
    const seedContext={
      task:{id:task.id,title:task.title,category:task.category,deliverables:task.deliverables,acceptanceCriteria:task.acceptanceCriteria,estimatedTokens:task.estimatedTokens,publishedAt:task.publishedAt},
      record:{executionId:record.executionId,executionNo:record.executionNo,submittedAt:record.submittedAt,completedAt:'completedAt' in record?record.completedAt:undefined,agentName:record.agentName,
        agentScore:'agentScore' in record?record.agentScore:record.score,acceptanceScore:record.acceptanceScore,acceptanceStatus:record.acceptanceStatus,reviewSource:'reviewSource' in record?record.reviewSource:undefined}
    };
    return readDetail<real.AdminExecutionResult>('execution-result',id,{context:JSON.stringify(seedContext)});
  }
  return isDemoId(id)?readDetail<real.AdminExecutionResult>('execution-result',id):real.readRemoteAdminExecutionResult(id);
}
export async function downloadAdminExecutionFile(url:string,name:string) {
  if(!url.startsWith('/mock-api/admin/artifact?')) return real.downloadRemoteAdminFile(url,name);
  const {data}=await axios.get<Blob>(url,{responseType:'blob',timeout:15000});
  const objectUrl=URL.createObjectURL(data);
  const link=document.createElement('a');
  link.href=objectUrl;link.download=name;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
