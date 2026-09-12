import axios from "axios";
import * as real from "./sprixApi";
import { isDemoId } from "../../mock/demo-ledger.mjs";
export type { UpsertAdminTaskPayload } from "./sprixApi";
export { createRemoteAdminTask } from "./sprixApi";

async function readDetail<T>(kind:string,id:string):Promise<T> {return (await axios.get<T>('/mock-api/admin/view',{params:{kind,id},timeout:15000})).data;}
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
export async function readRemoteTaskDetail(id:string) {return isDemoId(id)?readDetail<real.AdminTaskDetailView>('task-detail',id):real.readRemoteTaskDetail(id);}
export async function readRemoteAppealDetail(id:string) {return isDemoId(id)?readDetail<Awaited<ReturnType<typeof real.readRemoteAppealDetail>>>('appeal-detail',id):real.readRemoteAppealDetail(id);}

export const updateRemoteAdminTask: typeof real.updateRemoteAdminTask = (id, payload) => isDemoId(id) ? writeDemo(id, "edit", payload) : real.updateRemoteAdminTask(id, payload);
export const offlineRemoteAdminTask: typeof real.offlineRemoteAdminTask = (id, reason) => isDemoId(id) ? writeDemo(id, "offline", { reason }) : real.offlineRemoteAdminTask(id, reason);
export const republishRemoteAdminTask: typeof real.republishRemoteAdminTask = (id) => isDemoId(id) ? writeDemo(id, "republish") : real.republishRemoteAdminTask(id);
export const deleteRemoteAdminTask: typeof real.deleteRemoteAdminTask = (id, reason) => isDemoId(id) ? writeDemo(id, "delete", { reason }) : real.deleteRemoteAdminTask(id, reason);
export const approveRemoteAcceptanceReview: typeof real.approveRemoteAcceptanceReview = (id) => isDemoId(id) ? writeDemo(id, "approve") : real.approveRemoteAcceptanceReview(id);
export const rejectRemoteAcceptanceReview: typeof real.rejectRemoteAcceptanceReview = (id, reason) => isDemoId(id) ? writeDemo(id, "reject", { reason }) : real.rejectRemoteAcceptanceReview(id, reason);
export const startRemoteAppeal: typeof real.startRemoteAppeal = (id) => isDemoId(id) ? writeDemo(id, "start") : real.startRemoteAppeal(id);
export const approveRemoteAppeal: typeof real.approveRemoteAppeal = (id, reason) => isDemoId(id) ? writeDemo(id, "approve", {reason}) : real.approveRemoteAppeal(id, reason);
export const rejectRemoteAppeal: typeof real.rejectRemoteAppeal = (id, reason) => isDemoId(id) ? writeDemo(id, "reject", {reason}) : real.rejectRemoteAppeal(id, reason);
