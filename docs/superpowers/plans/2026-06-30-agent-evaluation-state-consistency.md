# Agent Evaluation State Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Agent 中心“当前 Agent 显示能力画像生成中，但 Agent 列表点击后又重新测评”的状态不一致问题，并用后端幂等保护避免重复创建并行测评。

**Architecture:** 前端以 `latestEvaluation` 作为点击测评按钮前的唯一事实来源，避免使用列表里的旧 `agent.evaluation` 直接决定是否新建测评。后端把 `evaluate` 改成对运行中测评幂等：已有 `running/judging` 时返回现有记录，不重复下发测评命令。前端修复是必须项；后端幂等是长期稳定建议项。

**Tech Stack:** React 18, Zustand, Ant Design, Vitest, Spring Boot, Spring Data JPA, JUnit, AssertJ.

---

## Problem Summary

当前截图中的“能力画像生成中”来自 `CurrentAgentCard` 使用的 `currentWithEvaluation`：

- `apps/sprix-agent/src/user/UserPages.tsx` 会通过 `readLatestRemoteAgentEvaluation(current.id)` 拉取当前 Agent 最新测评。
- 这个结果只写入本地组件状态 `currentEvaluation`。
- 当前 Agent 卡片使用 `currentWithEvaluation`，所以能正确显示 `running/judging`。

但是 Agent 列表仍然使用 Zustand store 中的 `agents`：

- `AgentList` 的按钮文案来自 `getAgentEvaluationActionLabel(agent)`。
- 点击时 `openAgentEvaluation(agent)` 依赖这个旧 `agent.evaluation` 判断是否调用 `startRemoteAgentEvaluation`。
- 如果 store 中该 Agent 的旧状态是 `failed` 或没有 `evaluation`，点击就会直接重新发起测评。

后端当前行为也会放大这个问题：

- `AgentService.evaluate(...)` 每次调用都会 `createEvaluation(...)` 并 `enqueueAgentEvaluateProfile(...)`。
- 后端没有复用运行中测评的保护。

## Desired Behavior

1. 如果后端 latest evaluation 是 `running` 或 `judging`：
   - 当前 Agent 卡片显示“能力画像生成中/评分中”。
   - Agent 列表按钮显示“查看进度”。
   - 点击按钮只打开当前进度，不调用 `startRemoteAgentEvaluation`。

2. 如果后端 latest evaluation 是 `completed`：
   - Agent 列表按钮显示“查看结果”。
   - 点击按钮打开结果，不新建测评。

3. 如果后端 latest evaluation 是 `failed`：
   - Agent 列表按钮显示“重新评测”。
   - 点击按钮才调用 `startRemoteAgentEvaluation`。

4. 如果后端返回 `Agent evaluation not found`：
   - Agent 列表按钮显示“开始评测”。
   - 点击按钮调用 `startRemoteAgentEvaluation`。

5. 即使前端误触发 `evaluate`：
   - 后端已有 `running/judging` 测评时也不新建第二条测评。

## File Map

### Frontend Required Changes

- Modify: `apps/sprix-agent/src/user/UserPages.tsx`
  - 合并 `currentEvaluation` 到 Agent 列表数据。
  - 修改 `openAgentEvaluation` 为 latest-first。
  - 保持现有弹框、轮询、自动设为当前 Agent 的行为。

- Modify: `apps/sprix-agent/src/user/UserPages.test.tsx`
  - 增加运行中 latest 不重新测评的回归测试。
  - 增加 currentEvaluation 合并到列表文案的回归测试。
  - 增加 latest not found 才开始测评的回归测试。

### Backend Recommended Changes

- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/agent/AgentService.java`
  - 在 `evaluate(...)` 开头复用运行中的 latest evaluation。
  - 只在 latest 不存在、latest failed、latest completed 时创建新评测。

- Modify: `SprixServer/backend/src/test/java/ai/sprix/server/AgentServiceTests.java`
  - 增加已有 running 测评时 evaluate 返回同一个 evaluationId 的测试。
  - 验证不会重复创建 `agent.evaluateProfile` command。

---

## Task 1: Frontend Test for Running Latest Evaluation

**Files:**
- Modify: `apps/sprix-agent/src/user/UserPages.test.tsx`

- [ ] **Step 1: Update service mock to include `readLatestRemoteAgentEvaluation`**

In `apps/sprix-agent/src/user/UserPages.test.tsx`, change the existing mock block:

```ts
vi.mock("../services/sprixApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/sprixApi")>();
  return {
    ...actual,
    connectRemoteAgent: vi.fn(),
    markRemoteCurrentAgent: vi.fn(),
    readRemoteAgents: vi.fn(),
    readRemoteAgentEvaluation: vi.fn(),
    readLatestRemoteAgentEvaluation: vi.fn(),
    initializeRemoteFaceVerification: vi.fn(),
    startRemoteAgentEvaluation: vi.fn()
  };
});
```

- [ ] **Step 2: Add a reusable running evaluation fixture**

Place this after `completedEvaluation`:

```ts
const runningEvaluation = {
  evaluationId: "evaluation-running-1",
  agentId: "agent-1",
  localAgentId: "local-agent-1",
  status: "running" as const,
  questions: [],
  steps: [],
  transcript: [],
  result: {
    status: "running" as const,
    mode: "",
    overallScore: null,
    dimensions: {},
    summary: "",
    improvements: [],
    steps: [],
    transcript: [],
    error: null
  },
  startedAt: "",
  completedAt: null,
  createdAt: "",
  updatedAt: ""
};
```

- [ ] **Step 3: Reset the latest mock in `beforeEach`**

Inside the `HomePage agent module` `beforeEach`, add:

```ts
vi.mocked(sprixApi.readLatestRemoteAgentEvaluation).mockReset();
vi.mocked(sprixApi.readLatestRemoteAgentEvaluation).mockRejectedValue(new Error("Agent evaluation not found"));
```

- [ ] **Step 4: Add failing test: running latest opens progress without starting again**

Add this test inside `describe("HomePage agent module", ...)`:

```ts
it("opens an existing running evaluation instead of starting a new one from Agent Center", async () => {
  const initialState = createInitialSprixState();
  const staleFailedAgent: Agent = {
    ...connectedAgent,
    evaluation: {
      ...runningEvaluation,
      status: "failed",
      result: {
        ...runningEvaluation.result,
        status: "failed",
        error: "old failed evaluation"
      }
    }
  };
  vi.mocked(sprixApi.readLatestRemoteAgentEvaluation).mockResolvedValue(runningEvaluation);
  vi.mocked(sprixApi.readRemoteAgents).mockResolvedValue([{ ...connectedAgent, evaluation: runningEvaluation }]);
  useSprixStore.setState({
    account: {
      ...initialState.account,
      isLoggedIn: true
    },
    currentAgent: staleFailedAgent,
    agents: [staleFailedAgent]
  });

  renderAgentCenterPage();

  fireEvent.click(screen.getByRole("button", { name: "重新评测" }));

  await waitFor(() => expect(sprixApi.readLatestRemoteAgentEvaluation).toHaveBeenCalledWith("agent-1"));
  expect(sprixApi.startRemoteAgentEvaluation).not.toHaveBeenCalled();
  expect(await screen.findByText("Codex Agent 能力画像生成中")).toBeTruthy();
});
```

- [ ] **Step 5: Run test and verify it fails**

Run:

```bash
pnpm --filter @sprix-ai/agent exec vitest run src/user/UserPages.test.tsx
```

Expected failure before implementation:

```text
expected "spy" to not be called
```

or:

```text
Unable to find text: Codex Agent 能力画像生成中
```

This proves the current code starts a new evaluation instead of opening the existing latest running evaluation.

---

## Task 2: Frontend Latest-First Evaluation Action

**Files:**
- Modify: `apps/sprix-agent/src/user/UserPages.tsx`

- [ ] **Step 1: Add helper predicates near existing evaluation helpers**

Place these near `isEvaluationTerminal` and `isCompletedAgentEvaluation`:

```ts
function isEvaluationActive(status: AgentEvaluation["status"]) {
  return status === "running" || status === "judging";
}

function isAgentEvaluationNotFound(error: unknown) {
  return error instanceof Error && error.message === "Agent evaluation not found";
}

function shouldStartNewEvaluation(latestEvaluation: AgentEvaluation | undefined) {
  return !latestEvaluation || latestEvaluation.status === "failed";
}
```

- [ ] **Step 2: Replace the decision block inside `openAgentEvaluation`**

Replace this block:

```ts
let nextEvaluation: AgentEvaluation;
if (agent.evaluation && agent.evaluation.status !== "failed") {
  try {
    nextEvaluation = await readLatestRemoteAgentEvaluation(agent.id);
  } catch (error) {
    if (!(error instanceof Error && error.message === "Agent evaluation not found")) {
      throw error;
    }
    nextEvaluation = await startRemoteAgentEvaluation(agent.id);
  }
} else {
  nextEvaluation = await startRemoteAgentEvaluation(agent.id);
}
```

with:

```ts
let latestEvaluation: AgentEvaluation | undefined;
try {
  latestEvaluation = await readLatestRemoteAgentEvaluation(agent.id);
} catch (error) {
  if (!isAgentEvaluationNotFound(error)) {
    throw error;
  }
}

const nextEvaluation = shouldStartNewEvaluation(latestEvaluation)
  ? await startRemoteAgentEvaluation(agent.id)
  : latestEvaluation;
```

- [ ] **Step 3: Update the success toast condition**

Replace:

```ts
if (!agent.evaluation || agent.evaluation.status === "failed" || nextEvaluation.status === "running") {
  message.success("评测已开始");
}
```

with:

```ts
if (shouldStartNewEvaluation(latestEvaluation) && isEvaluationActive(nextEvaluation.status)) {
  message.success("评测已开始");
}
```

This prevents showing “评测已开始” when the user only opened an existing running evaluation.

- [ ] **Step 4: Run frontend test**

Run:

```bash
pnpm --filter @sprix-ai/agent exec vitest run src/user/UserPages.test.tsx
```

Expected:

```text
✓ src/user/UserPages.test.tsx
```

---

## Task 3: Frontend Sync Current Evaluation Into Agent List

**Files:**
- Modify: `apps/sprix-agent/src/user/UserPages.tsx`
- Modify: `apps/sprix-agent/src/user/UserPages.test.tsx`

- [ ] **Step 1: Add failing test for list action label**

Add this test inside `describe("HomePage agent module", ...)`:

```ts
it("shows view progress in the Agent list when the current agent has a running latest evaluation", async () => {
  const initialState = createInitialSprixState();
  vi.mocked(sprixApi.readLatestRemoteAgentEvaluation).mockResolvedValue(runningEvaluation);
  useSprixStore.setState({
    account: {
      ...initialState.account,
      isLoggedIn: true
    },
    currentAgent: connectedAgent,
    agents: [connectedAgent]
  });

  renderAgentCenterPage();

  expect(await screen.findByText("能力画像生成中")).toBeTruthy();
  expect(await screen.findByRole("button", { name: "查看进度" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "重新评测" })).toBeNull();
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm --filter @sprix-ai/agent exec vitest run src/user/UserPages.test.tsx
```

Expected failure before implementation:

```text
Unable to find role="button" and name "查看进度"
```

- [ ] **Step 3: Derive `agentsWithCurrentEvaluation`**

In `AgentCenterPage`, after `currentWithEvaluation`, add:

```ts
const agentsWithCurrentEvaluation = useMemo(() => {
  if (!currentEvaluation || !current?.id) return agents;
  return agents.map((agent) =>
    agent.id === current.id
      ? {
          ...agent,
          evaluation: currentEvaluation,
          score: currentEvaluation.result.overallScore ?? agent.score,
          lastEvaluatedAt: currentWithEvaluation?.lastEvaluatedAt ?? agent.lastEvaluatedAt
        }
      : agent
  );
}, [agents, current?.id, currentEvaluation, currentWithEvaluation?.lastEvaluatedAt]);
```

- [ ] **Step 4: Use merged agents in `AgentList`**

Replace:

```tsx
<AgentList
  title="Agent 列表"
  agents={agents}
  empty="暂无 Agent"
```

with:

```tsx
<AgentList
  title="Agent 列表"
  agents={agentsWithCurrentEvaluation}
  empty="暂无 Agent"
```

- [ ] **Step 5: Run frontend tests**

Run:

```bash
pnpm --filter @sprix-ai/agent exec vitest run src/user/UserPages.test.tsx
```

Expected:

```text
✓ src/user/UserPages.test.tsx
```

---

## Task 4: Backend Idempotent Running Evaluation

**Files:**
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/agent/AgentService.java`
- Modify: `SprixServer/backend/src/test/java/ai/sprix/server/AgentServiceTests.java`

This task is not required to fix the current UI inconsistency, but it is recommended for long-term stability.

- [ ] **Step 1: Add failing backend test**

Add this test to `AgentServiceTests`:

```java
@Test
void evaluateReturnsExistingRunningEvaluationWithoutEnqueuingDuplicateCommand() {
    UUID userId = UUID.fromString("00000000-0000-0000-0000-000000000101");
    UUID codexAgentId = UUID.fromString("00000000-0000-0000-0000-000000000401");
    saveLocalDevice(
            userId,
            "ONLINE",
            null,
            "[\"codex\"]",
            """
                    {
                      "currentAgentId": null,
                      "agents": [
                        {"id": "codex", "status": "available", "score": 87}
                      ]
                    }
                    """
    );
    var first = agentService.evaluate(userId, codexAgentId, new AgentDtos.AgentEvaluationRequest(List.of(
            "问题1", "问题2", "问题3", "问题4", "问题5"
    )));
    long commandCountAfterFirstEvaluate = localAgentCommandRepository.findAll().stream()
            .filter(command -> command.getType().equals("agent.evaluateProfile"))
            .count();

    var second = agentService.evaluate(userId, codexAgentId, new AgentDtos.AgentEvaluationRequest(List.of(
            "问题1", "问题2", "问题3", "问题4", "问题5"
    )));
    long commandCountAfterSecondEvaluate = localAgentCommandRepository.findAll().stream()
            .filter(command -> command.getType().equals("agent.evaluateProfile"))
            .count();

    assertThat(second.evaluationId()).isEqualTo(first.evaluationId());
    assertThat(second.status()).isEqualTo("running");
    assertThat(localAgentEvaluationRepository.findAll()).hasSize(1);
    assertThat(commandCountAfterSecondEvaluate).isEqualTo(commandCountAfterFirstEvaluate);
}
```

- [ ] **Step 2: Run backend test and verify it fails**

Run:

```bash
cd /Users/yyx/Desktop/sprix/SprixServer/backend
./gradlew test --tests ai.sprix.server.AgentServiceTests.evaluateReturnsExistingRunningEvaluationWithoutEnqueuingDuplicateCommand
```

Expected failure before implementation:

```text
Expecting actual:
  2
to be equal to:
  1
```

or an assertion showing the second evaluation id differs from the first.

- [ ] **Step 3: Add running evaluation helper**

In `AgentService.java`, add:

```java
private boolean isRunningEvaluation(LocalAgentEvaluation evaluation) {
    return evaluation != null
            && ("running".equalsIgnoreCase(evaluation.getStatus())
            || "judging".equalsIgnoreCase(evaluation.getStatus()));
}
```

- [ ] **Step 4: Reuse running latest evaluation in `evaluate`**

Replace the beginning of `evaluate(...)`:

```java
getUser(userId);
AgentProfile agent = getAgent(agentId);
LocalAgentDeviceSnapshot localSnapshot = requireInstalledLocalAgent(userId, agent);
List<String> questions = evaluationQuestions(request);
LocalAgentEvaluation evaluation = createEvaluation(userId, agent, localAgentId(agent), localSnapshot.deviceId(), questions);
agentGatewayCommandService.enqueueAgentEvaluateProfile(localSnapshot.deviceId(), agent, questions, evaluation.getId());
return evaluationDetailResponse(evaluation);
```

with:

```java
getUser(userId);
AgentProfile agent = getAgent(agentId);
LocalAgentEvaluation latestEvaluation = localAgentEvaluationRepository
        .findFirstByUserIdAndAgentIdOrderByCreatedAtDesc(userId, agentId)
        .orElse(null);
if (isRunningEvaluation(latestEvaluation)) {
    return evaluationDetailResponse(latestEvaluation);
}
LocalAgentDeviceSnapshot localSnapshot = requireInstalledLocalAgent(userId, agent);
List<String> questions = evaluationQuestions(request);
LocalAgentEvaluation evaluation = createEvaluation(userId, agent, localAgentId(agent), localSnapshot.deviceId(), questions);
agentGatewayCommandService.enqueueAgentEvaluateProfile(localSnapshot.deviceId(), agent, questions, evaluation.getId());
return evaluationDetailResponse(evaluation);
```

This intentionally still allows a new evaluation after `completed` or `failed`.

- [ ] **Step 5: Run backend test**

Run:

```bash
cd /Users/yyx/Desktop/sprix/SprixServer/backend
./gradlew test --tests ai.sprix.server.AgentServiceTests.evaluateReturnsExistingRunningEvaluationWithoutEnqueuingDuplicateCommand
```

Expected:

```text
BUILD SUCCESSFUL
```

---

## Task 5: Verification Gate

**Files:**
- No new code files. Run verification commands only.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
cd /Users/yyx/Desktop/sprix/SprixPortal
pnpm --filter @sprix-ai/agent exec vitest run src/user/UserPages.test.tsx src/components/AgentEvaluationProgressModal.test.tsx
```

Expected:

```text
Test Files  2 passed
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd /Users/yyx/Desktop/sprix/SprixPortal
pnpm --filter @sprix-ai/agent typecheck
```

Expected:

```text
tsc -b
```

Exit code must be 0.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd /Users/yyx/Desktop/sprix/SprixPortal
pnpm --filter @sprix-ai/agent build
```

Expected:

```text
✓ built
```

- [ ] **Step 4: Run focused backend test if Task 4 is implemented**

Run:

```bash
cd /Users/yyx/Desktop/sprix/SprixServer/backend
./gradlew test --tests ai.sprix.server.AgentServiceTests.evaluateReturnsExistingRunningEvaluationWithoutEnqueuingDuplicateCommand
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 5: Manual browser verification**

Run the frontend:

```bash
cd /Users/yyx/Desktop/sprix/SprixPortal
pnpm --filter @sprix-ai/agent dev
```

Manual path:

1. Log in with an account that has a current Agent.
2. Start an Agent evaluation and close the modal while it is running.
3. Open Agent Center.
4. Confirm the top card shows “能力画像生成中”.
5. Confirm the Agent list button for the same Agent says “查看进度”.
6. Click “查看进度”.
7. Confirm the progress modal opens and no new evaluation is created.

Evidence to capture:

```text
Network tab:
GET /api/v1/agents/{agentId}/evaluations/latest
No POST /api/v1/agents/{agentId}/evaluate when latest is running/judging
```

If backend Task 4 is implemented, also verify repeated POST:

```text
POST /api/v1/agents/{agentId}/evaluate returns the existing running evaluationId
```

---

## Backend Decision

前端修改是必须的，因为当前 UI 状态不一致的根因在前端使用了两份不同状态。

后端修改不是短期必需，但建议做。原因：

- 防止前端旧包、多个浏览器窗口、重复点击造成并行测评。
- 让 `evaluate` 具备业务幂等性，符合“同一个 Agent 同一时刻只应有一个运行中测评”的长期模型。
- 即使后续新增移动端或管理端入口，也不会重复下发 `agent.evaluateProfile` command。

推荐执行顺序：

1. Task 1-3：先修前端错判。
2. Task 4：补后端幂等保护。
3. Task 5：完成端到端验证。

## Self-Review

- Spec coverage: 已覆盖截图中的“生成中却重新测评”问题、前端状态同步、点击分支、后端是否需要改、测试验证。
- Placeholder scan: 没有使用 TBD、TODO、后续补充等占位表达。
- Type consistency: 使用现有 `AgentEvaluation["status"]`、`readLatestRemoteAgentEvaluation`、`startRemoteAgentEvaluation`、`AgentService.evaluate` 名称，与当前代码一致。
