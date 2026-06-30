import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Modal } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTaskForm } from "./AdminPages";
import type { AdminTaskDetailView } from "../services/sprixApi";

const serviceMocks = vi.hoisted(() => ({
  readRemoteTaskDetail: vi.fn(),
  createRemoteAdminTask: vi.fn(),
  updateRemoteAdminTask: vi.fn()
}));

vi.mock("../services/sprixApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/sprixApi")>();
  return {
    ...actual,
    readRemoteTaskDetail: serviceMocks.readRemoteTaskDetail,
    createRemoteAdminTask: serviceMocks.createRemoteAdminTask,
    updateRemoteAdminTask: serviceMocks.updateRemoteAdminTask
  };
});

function renderTaskForm(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/tasks/new" element={<AdminTaskForm />} />
          <Route path="/tasks/:id/edit" element={<AdminTaskForm />} />
          <Route path="/tasks" element={<div>task-center</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function taskDetail(): AdminTaskDetailView {
  return {
    task: {
      id: "task-1",
      title: "原始任务",
      category: "等待产品输入",
      sourceName: "Sprix",
      sourceType: "平台",
      description: "原始描述",
      cardSummary: "",
      deliverables: "原始交付",
      acceptanceCriteria: "原始验收",
      reward: 100,
      totalSlots: 2,
      remainingSlots: 2,
      publishedAt: "2026-06-30",
      taskStatus: "已发布",
      offlineReason: "",
      agentMatchScore: 0,
      recommendedTaskType: "",
      suggestedTeam: "",
      matchAnalysis: "",
      riskPrompt: "",
      recommendedReason: "",
      submittedFiles: [],
      resultFiles: [],
      acceptanceResult: ""
    },
    records: {
      running: [],
      reviewing: [],
      terminated: [],
      completed: []
    },
    operationLogs: []
  };
}

describe("AdminTaskForm cancel confirmation", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.readRemoteTaskDetail.mockResolvedValue(taskDetail());
    serviceMocks.createRemoteAdminTask.mockResolvedValue({});
    serviceMocks.updateRemoteAdminTask.mockResolvedValue({});
    vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  });

  it("returns to task center without confirmation when a new task form is untouched", () => {
    renderTaskForm("/tasks/new");

    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    expect(Modal.confirm).not.toHaveBeenCalled();
    expect(screen.getByText("task-center")).toBeTruthy();
  });

  it("returns to task center without confirmation when an edit task form is unchanged", async () => {
    renderTaskForm("/tasks/task-1/edit");

    expect(await screen.findByDisplayValue("原始任务")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    await waitFor(() => expect(screen.getByText("task-center")).toBeTruthy());
    expect(Modal.confirm).not.toHaveBeenCalled();
  });

  it("asks for confirmation when an edit task form has changed values", async () => {
    renderTaskForm("/tasks/task-1/edit");

    const titleInput = await screen.findByDisplayValue("原始任务");
    fireEvent.change(titleInput, { target: { value: "改过的任务" } });
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    expect(Modal.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "当前填写内容尚未发布，取消后将不会保存。确认取消吗？" }));
    expect(screen.queryByText("task-center")).toBeNull();
  });

  it("rejects decimal reward and total slots values", async () => {
    renderTaskForm("/tasks/task-1/edit");

    const rewardInput = await screen.findByDisplayValue("100");
    const totalSlotsInput = await screen.findByDisplayValue("2");
    fireEvent.change(rewardInput, { target: { value: "100.5" } });
    fireEvent.change(totalSlotsInput, { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: /编\s*辑/ }));

    expect(await screen.findByText("任务奖励不能输入小数")).toBeTruthy();
    expect(await screen.findByText("总名额不能输入小数")).toBeTruthy();
    expect(serviceMocks.updateRemoteAdminTask).not.toHaveBeenCalled();
  });
});
