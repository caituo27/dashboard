import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialSprixState } from "../store/domain";
import { useSprixStore } from "../store/sprixStore";
import type { Agent } from "../types";
import { HomePage } from "./HomePage";

vi.mock("./useHomeBootstrap", () => ({
  useHomeBootstrap: vi.fn()
}));

const currentAgent: Agent = {
  id: "agent-1",
  name: "Codex Agent",
  status: "可用",
  role: "当前执行 Agent",
  score: 88,
  lastEvaluatedAt: "2026-06-29 23:30",
  summary: "软件开发、网页生成、代码修复",
  tags: ["软件开发", "网页生成", "代码修复"]
};

describe("HomePage routing", () => {
  beforeEach(() => {
    localStorage.clear();
    useSprixStore.setState(createInitialSprixState());
  });

  it("redirects logged-in users with a current execution Agent to the task market", async () => {
    const initialState = createInitialSprixState();
    useSprixStore.setState({
      account: {
        ...initialState.account,
        isLoggedIn: true
      },
      agents: [currentAgent],
      currentAgent
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage openLogin={vi.fn()} />} />
          <Route path="/agent/market" element={<div>Task market route</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Task market route")).toBeTruthy();
    });
    expect(screen.queryByText("当前执行 Agent 已设置")).toBeNull();
  });
});
