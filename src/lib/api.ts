import type {
  AgentInfo,
  EvaluateBody,
  EvaluateResponse,
  TranscriptItem,
} from "../types";

async function postJson(url: string, body: unknown): Promise<EvaluateResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "请求失败");
  return data as EvaluateResponse;
}

export function evaluate(body: EvaluateBody): Promise<EvaluateResponse> {
  return postJson("/api/evaluate", body);
}

export function interview(body: {
  agent: string;
  dir?: string;
}): Promise<EvaluateResponse> {
  return postJson("/api/interview", body);
}

export async function getAgents(): Promise<AgentInfo[]> {
  const res = await fetch("/api/agents");
  const data = await res.json();
  return (data.agents as AgentInfo[]) || [];
}

export async function getQuestions(): Promise<string[]> {
  const res = await fetch("/api/interview/questions");
  const data = await res.json();
  return (data.questions as string[]) || [];
}

export async function askQuestion(body: {
  agent: string;
  question: string;
  dir?: string;
}): Promise<string> {
  const res = await fetch("/api/interview/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "提问失败");
  return data.answer as string;
}

export function judge(body: {
  agent: string;
  transcript: TranscriptItem[];
}): Promise<EvaluateResponse> {
  return postJson("/api/interview/judge", body);
}
