# Sprix C Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the C-side Sprix experience around login-first local Agent connection, quick profile assessment, recommended tasks, Token estimates, and demo-only auto accept.

**Architecture:** Keep the existing C-side shell, routing, store, task detail, qualification, execution, settlement, and appeal flows. Add a small pure helper module under `apps/sprix-agent/src/user/` for local Agent assessment and task recommendation rules, then wire those helpers into `TaskMarketPage` so the homepage becomes the PRD demo path without touching admin code.

**Tech Stack:** React 18, TypeScript, Vite, Ant Design, lucide-react, Zustand, Vitest.

---

### Task 1: C-Side Experience Helpers

**Files:**
- Create: `apps/sprix-agent/src/user/cSideExperience.ts`
- Test: `apps/sprix-agent/src/user/cSideExperience.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import {
  buildLocalAgentAssessment,
  buildRecommendedTasks,
  getDemoAutoAcceptResult,
  localAgentOptions
} from "./cSideExperience";

const baseTask = (patch: Partial<Task>): Task => ({
  id: "task-1",
  title: "竞品调研",
  category: "市场调研",
  sourceName: "Sprix Demo",
  sourceType: "平台",
  description: "整理竞品信息",
  cardSummary: "整理竞品信息并输出表格",
  deliverables: "表格",
  acceptanceCriteria: "字段完整",
  reward: 300,
  totalSlots: 3,
  remainingSlots: 2,
  publishedAt: "2026-06-26",
  taskStatus: "已发布",
  offlineReason: "",
  agentMatchScore: 81,
  recommendedTaskType: "资料整理",
  suggestedTeam: "单 Agent",
  matchAnalysis: "适合 Codex 执行",
  riskPrompt: "低风险",
  recommendedReason: "匹配资料整理能力",
  submittedFiles: [],
  resultFiles: [],
  acceptanceResult: "待验收",
  ...patch
});

describe("C-side homepage experience", () => {
  it("builds a local Agent assessment profile for the selected Agent", () => {
    const assessment = buildLocalAgentAssessment("codex");

    expect(assessment.agentName).toBe("Codex");
    expect(assessment.profileTitle).toContain("产品型");
    expect(assessment.score).toBe(76);
    expect(assessment.question).toBe("我在你眼里的职业画像是什么？");
  });

  it("sorts published tasks by match score and adds token estimates", () => {
    const recommended = buildRecommendedTasks([
      baseTask({ id: "task-low", title: "低匹配", agentMatchScore: 61, taskStatus: "已发布" }),
      baseTask({ id: "task-high", title: "高匹配", agentMatchScore: 92, taskStatus: "已发布" }),
      baseTask({ id: "task-offline", title: "已下线", agentMatchScore: 99, taskStatus: "已下线" })
    ]);

    expect(recommended.map((task) => task.id)).toEqual(["task-high", "task-low"]);
    expect(recommended[0].tokenEstimate).toMatch(/K Token/);
    expect(recommended[0].rankLabel).toBe("推荐 1");
  });

  it("keeps auto accept as a demo scan without accepting tasks", () => {
    const result = getDemoAutoAcceptResult([
      baseTask({ id: "task-high", agentMatchScore: 92 }),
      baseTask({ id: "task-mid", agentMatchScore: 76 })
    ]);

    expect(result.threshold).toBe(80);
    expect(result.eligibleCount).toBe(1);
    expect(result.acceptedTaskIds).toEqual([]);
    expect(result.message).toContain("演示");
  });

  it("exposes detected local Agent options without a download fallback", () => {
    expect(localAgentOptions.map((agent) => agent.name)).toEqual(["Codex", "Claude Code", "OpenCode"]);
    expect(localAgentOptions.some((agent) => agent.status === "未检测到")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/sprix-agent && npm test -- src/user/cSideExperience.test.ts`

Expected: FAIL because `./cSideExperience` does not exist.

- [ ] **Step 3: Implement the helper**

Create `apps/sprix-agent/src/user/cSideExperience.ts` with:

```ts
import type { Task } from "../types";

export type LocalAgentId = "codex" | "claude-code" | "opencode";

export type LocalAgentOption = {
  id: LocalAgentId;
  name: string;
  vendor: string;
  status: "可连接";
  summary: string;
  tags: string[];
};

export type LocalAgentAssessment = {
  agentId: LocalAgentId;
  agentName: string;
  question: string;
  profileTitle: string;
  profileSummary: string;
  score: number;
  dimensions: { label: string; value: number }[];
  recommendedDirection: string;
};

export type RecommendedTask = Task & {
  rankLabel: string;
  tokenEstimate: string;
};

export type DemoAutoAcceptResult = {
  threshold: number;
  eligibleCount: number;
  acceptedTaskIds: string[];
  message: string;
};

export const localAgentOptions: LocalAgentOption[] = [
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    status: "可连接",
    summary: "擅长产品拆解、代码实现、资料整理和自动化验证。",
    tags: ["产品理解", "代码执行", "资料整理"]
  },
  {
    id: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic",
    status: "可连接",
    summary: "适合长文档分析、需求推理和结构化交付。",
    tags: ["长上下文", "需求推理", "文档生成"]
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "Local",
    status: "可连接",
    summary: "适合本地脚本、批量处理和轻量自动化任务。",
    tags: ["本地执行", "批处理", "轻量自动化"]
  }
];

export function buildLocalAgentAssessment(agentId: LocalAgentId): LocalAgentAssessment {
  const agent = localAgentOptions.find((item) => item.id === agentId) ?? localAgentOptions[0];
  return {
    agentId: agent.id,
    agentName: agent.name,
    question: "我在你眼里的职业画像是什么？",
    profileTitle: "产品型创意技术建设者",
    profileSummary: "你更像能把产品想法、技术实现和交付验证串起来的人，适合承接调研、原型、代码辅助和结构化内容生产类任务。",
    score: 76,
    dimensions: [
      { label: "产品判断", value: 82 },
      { label: "技术协作", value: 78 },
      { label: "资料整理", value: 75 },
      { label: "交付稳定", value: 70 }
    ],
    recommendedDirection: "优先推荐产品调研、竞品分析、原型整理、代码辅助和内容结构化任务。"
  };
}

export function buildRecommendedTasks(tasks: Task[]): RecommendedTask[] {
  return tasks
    .filter((task) => task.taskStatus === "已发布")
    .sort((left, right) => right.agentMatchScore - left.agentMatchScore)
    .map((task, index) => ({
      ...task,
      rankLabel: `推荐 ${index + 1}`,
      tokenEstimate: estimateTaskTokens(task)
    }));
}

export function getDemoAutoAcceptResult(tasks: Pick<Task, "agentMatchScore" | "id">[], threshold = 80): DemoAutoAcceptResult {
  const eligibleCount = tasks.filter((task) => task.agentMatchScore >= threshold).length;
  return {
    threshold,
    eligibleCount,
    acceptedTaskIds: [],
    message: `已扫描 ${tasks.length} 个推荐任务，发现 ${eligibleCount} 个匹配率超过 ${threshold}% 的任务。本版本为演示模式，暂不自动接单。`
  };
}

function estimateTaskTokens(task: Task): string {
  const complexity = task.description.length + task.deliverables.length + task.acceptanceCriteria.length;
  const base = task.agentMatchScore >= 88 ? 18 : task.agentMatchScore >= 75 ? 14 : 10;
  const extra = Math.min(10, Math.ceil(complexity / 120));
  return `${base + extra}K Token`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/sprix-agent && npm test -- src/user/cSideExperience.test.ts`

Expected: PASS.

### Task 2: C-Side Homepage Flow

**Files:**
- Modify: `apps/sprix-agent/src/user/UserPages.tsx`
- Modify: `apps/sprix-agent/src/index.css`

- [ ] **Step 1: Replace search-led market state with local Agent state**

In `TaskMarketPage`, remove the `keyword` state and search filtering. Add assessment, connect modal, selected Agent, assessment loading, and auto accept modal state. Use `buildRecommendedTasks(tasks)` as the visible task list.

- [ ] **Step 2: Add login-first homepage actions**

Set `PageHeader` copy to C-side homepage language. Primary action should open login when logged out and open the local Agent modal when logged in. Secondary action should open the auto accept demo after assessment exists.

- [ ] **Step 3: Render assessment and detected local Agent sections**

Add a two-column section below the hero:
- Left: detected local Agents with `Codex`, `Claude Code`, `OpenCode` and connect buttons.
- Right: assessment card with the question, profile title, 76/100 score, and four dimension bars.

- [ ] **Step 4: Update task cards**

Pass `RecommendedTask` into `TaskCard`. Show `rankLabel` and `tokenEstimate`, keep reward, slots, source, and recommendation reason. Keep the existing `接单` and `查看详情` behavior.

- [ ] **Step 5: Add modals**

Add `LocalAgentConnectModal` for selecting a local Agent and producing the fake assessment. Add `AutoAcceptDemoModal` to show threshold 80%, eligible count, and the “demo-only no real accept” result.

- [ ] **Step 6: Add focused CSS**

Append classes for:
- `.sprix-home-workbench`
- `.sprix-agent-option`
- `.sprix-assessment-panel`
- `.sprix-token-badge`
- `.sprix-auto-accept-flow`

Use existing tokens and keep responsive behavior under `860px`.

### Task 3: Verification

**Files:**
- No additional files expected.

- [ ] **Step 1: Run helper tests**

Run: `cd apps/sprix-agent && npm test -- src/user/cSideExperience.test.ts`

Expected: PASS.

- [ ] **Step 2: Run C-side typecheck**

Run: `cd apps/sprix-agent && npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Keep dev server on C-side**

Check `http://localhost:5173/` remains reachable. Admin is out of scope.

---

Self-review:
- C-side only: yes, tasks touch `apps/sprix-agent` and one plan document.
- Latest PRD coverage: login-first homepage, local Agent connection, one-question assessment, fake 76 score, recommended tasks, Token estimate, manual accept, demo auto accept.
- Explicitly out of scope: admin rewrite, backend QR generation, real automatic task acceptance, local Agent binary detection.
