import { describe, expect, it } from "vitest";
import type { Agent } from "../types";
import { canSetAgentCurrent } from "./agentResult";

function agentWithEvaluation(status: "completed" | "failed" | "running"): Pick<Agent, "evaluation"> {
  return {
    evaluation: {
      evaluationId: "evaluation-1",
      agentId: "agent-1",
      localAgentId: "codex",
      status,
      questions: [],
      steps: [],
      transcript: [],
      result: {
        status,
        mode: "",
        overallScore: null,
        dimensions: {},
        careerProfile: null,
        abilityTags: [],
        summary: "",
        improvements: [],
        steps: [],
        transcript: [],
        error: null
      },
      startedAt: "",
      completedAt: null,
      lastEvaluatedAt: null,
      createdAt: "",
      updatedAt: ""
    }
  };
}

describe("Agent current selection", () => {
  it("only allows an Agent with a completed latest evaluation to be set current", () => {
    expect(canSetAgentCurrent(agentWithEvaluation("completed"))).toBe(true);
    expect(canSetAgentCurrent(agentWithEvaluation("failed"))).toBe(false);
    expect(canSetAgentCurrent(agentWithEvaluation("running"))).toBe(false);
    expect(canSetAgentCurrent({ evaluation: undefined })).toBe(false);
  });
});
