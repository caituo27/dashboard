import type {Task, MyTask} from '../types';
export const consumerMockEnabled = import.meta.env.DEV && import.meta.env.VITE_SHARED_MOCK !== 'false';
export const isMockTask = (id: string) => id.startsWith('demo:task:');
export const isMockExecution = (id: string) => id.startsWith('demo:execution:');
export function consumerOwner(phone: string) {
  const key=`sprix-consumer-mock-owner:${encodeURIComponent(phone)}`;
  let owner=localStorage.getItem(key);
  if(!owner) {owner=crypto.randomUUID();localStorage.setItem(key,owner);}
  return owner;
}
async function request<T>(url: string, body?: unknown):Promise<T> {
  const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  if(!response.ok) throw new Error(data.message ?? '任务数据读取失败');
  return data;
}
export async function readConsumerTaskPage(real:Task[],page:number) {
  const available=real.filter(task=>task.taskStatus==='已发布' && task.remainingSlots>0);
  const offset=(page-1)*20;
  const rows=available.slice(offset,offset+20);
  const data=await request<{rows:Task[];total:number}>(`/mock-api/consumer/view?kind=tasks&offset=${Math.max(0,offset-available.length)}&limit=${Math.max(1,20-rows.length)}`);
  return {rows:[...rows,...data.rows.slice(0,20-rows.length)],total:available.length+data.total};
}
export const readConsumerTask = (id:string) => request<Task>(`/mock-api/consumer/view?kind=task-detail&id=${encodeURIComponent(id)}`);
export async function readConsumerMyTasks(phone:string) {
  return (await request<{rows:MyTask[]}>(`/mock-api/consumer/view?kind=my-tasks&owner=${consumerOwner(phone)}`)).rows;
}
export function acceptConsumerTask(id:string, user:{phone:string}, agent:{id:string;name:string}) {
  return request<{id:string;taskId:string}>('/mock-api/consumer/accept',{id,payload:{owner:consumerOwner(user.phone),phone:user.phone,agentId:agent.id,agentName:agent.name}});
}
