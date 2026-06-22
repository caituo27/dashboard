export interface Dimension {
  key: string;
  label: string;
}

export interface DimScore {
  score: number;
  comment: string;
}

export interface EvaluationResult {
  overallScore: number;
  dimensions: Record<string, DimScore>;
  summary: string;
  improvements: string[];
}

export interface TranscriptItem {
  question: string;
  answer: string;
}

export interface EvaluateResponse {
  dimensions: Dimension[];
  result: EvaluationResult;
  agent?: string;
  transcript?: TranscriptItem[];
}

export type EvaluateBody = { dir: string } | { config: string };

export interface AgentInfo {
  id: "codex" | "claude";
  label: string;
  available: boolean;
}

export type SubmitRequest =
  | { kind: "evaluate"; body: EvaluateBody }
  | { kind: "interview"; body: { agent: string; dir?: string } };
