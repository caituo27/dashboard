import { describe, expect, it } from "vitest";
import { hasPendingAgentEvaluation } from "./agentResult";
import type { Agent } from "../types";

describe("hasPendingAgentEvaluation", () => {
  it("detects a background evaluation from the latest evaluation status", () => {
    expect(
      hasPendingAgentEvaluation({
        evaluation: {
          status: "running",
          result: {
            status: "running",
            mode: "",
            overallScore: null,
            dimensions: {},
            summary: "",
            improvements: [],
            steps: [],
            transcript: [],
            error: null
          }
        }
      })
    ).toBe(true);
  });

  it("does not show pending just because stale score or evaluation time exists", () => {
    expect(
      hasPendingAgentEvaluation({
        score: 90,
        lastEvaluatedAt: "2026-06-27 18:15"
      } as Pick<Agent, "score" | "lastEvaluatedAt" | "evaluation">)
    ).toBe(false);
  });
});
