import axios from "axios";
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
  updateRemoteAdminTask: vi.fn(),
  estimateRemoteTaskPricing: vi.fn()
}));

vi.mock("../services/sprixApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/sprixApi")>();
  return {
    ...actual,
    readRemoteTaskDetail: serviceMocks.readRemoteTaskDetail,
    createRemoteAdminTask: serviceMocks.createRemoteAdminTask,
    updateRemoteAdminTask: serviceMocks.updateRemoteAdminTask,
    estimateRemoteTaskPricing: serviceMocks.estimateRemoteTaskPricing
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
      estimatedTokens: 2000,
      tokenBillingUnit: 1000,
      tokenUnitPrice: 1,
      totalAmount: 200,
      pricingModel: "deepseek-v4-flash",
      pricingQuoteId: "quote-1",
      pricingEstimatedAt: "2026-06-30",
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
    attachments: [],
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
    serviceMocks.estimateRemoteTaskPricing.mockResolvedValue({
      quoteId: "quote-new",
      estimatedTokens: 2500,
      tokensPerUnit: 1000,
      unitPriceYuan: 1,
      perParticipantAmount: 3,
      totalAmount: 6,
      model: "deepseek-v4-flash",
      expiresAt: "2026-07-01T00:30:00+08:00",
      summary: "预计需要多轮执行"
    });
    vi.spyOn(Modal, "confirm").mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
  });

  it("returns to task center without confirmation when a new task form is untouched", () => {
    renderTaskForm("/tasks/new");

    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    expect(Modal.confirm).not.toHaveBeenCalled();
    expect(screen.getByText("task-center")).toBeTruthy();
  });

  it("retains the shared task reward when saving with the newer form contract", async () => {
    const detail = taskDetail();
    detail.task.id = "demo:task:42";
    const get = vi.spyOn(axios, "get").mockResolvedValue({data: detail});
    const post = vi.spyOn(axios, "post").mockResolvedValue({data: {}});
    try {
      renderTaskForm("/tasks/demo:task:42/edit");
      expect(await screen.findByDisplayValue("原始任务")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", {name: /保\s*存/}));
      await waitFor(() => expect(post).toHaveBeenCalledWith("/mock-api/admin/actions", expect.objectContaining({
        id: "demo:task:42", action: "edit", payload: expect.objectContaining({reward: 100, totalSlots: 2})
      }), expect.anything()));
      expect(serviceMocks.updateRemoteAdminTask).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
      post.mockRestore();
    }
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

  it("treats removal of an existing task attachment as an unsaved edit", async () => {
    const detail = taskDetail();
    detail.attachments = [{
      attachmentId: "attachment-1",
      fileId: "file-1",
      filename: "requirements.zip",
      mimeType: "application/zip",
      sizeBytes: 1024,
      sha256: "abc",
      sortOrder: 0,
      downloadUrl: "/api/v1/tasks/task-1/attachments/attachment-1/download",
      createdAt: "2026-08-03T10:00:00+08:00"
    }];
    serviceMocks.readRemoteTaskDetail.mockResolvedValue(detail);
    renderTaskForm("/tasks/task-1/edit");

    expect(await screen.findByText("requirements.zip")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "移除" }));
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    expect(Modal.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "当前填写内容尚未发布，取消后将不会保存。确认取消吗？" }));
  });

  it("rejects decimal total slots values", async () => {
    renderTaskForm("/tasks/task-1/edit");

    expect(await screen.findByRole("button", { name: /保\s*存/ })).toBeTruthy();

    const totalSlotsInput = await screen.findByDisplayValue("2");
    fireEvent.change(totalSlotsInput, { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));

    expect(await screen.findByText("总名额必须是整数")).toBeTruthy();
    expect(serviceMocks.updateRemoteAdminTask).not.toHaveBeenCalled();
  });

  it("submits a new task only after smart pricing returns a quote", async () => {
    renderTaskForm("/tasks/new");

    fireEvent.change(screen.getByLabelText("任务名称"), { target: { value: "新任务" } });
    fireEvent.mouseDown(screen.getByLabelText("任务类型"));
    fireEvent.click((await screen.findAllByText("企业经营 / 投融资咨询"))[1]);
    fireEvent.change(screen.getByLabelText("任务来源类型"), { target: { value: "平台" } });
    fireEvent.change(screen.getByLabelText("详细任务描述"), { target: { value: "整理一批客户反馈" } });
    fireEvent.change(screen.getByLabelText("交付标准"), { target: { value: "结构化表格" } });
    fireEvent.change(screen.getByLabelText("验收标准"), { target: { value: "字段完整" } });
    fireEvent.change(screen.getByLabelText("总名额"), { target: { value: "2" } });

    expect((screen.getByRole("button", { name: /发\s*布/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /智能定价/ }));

    await waitFor(() => expect(serviceMocks.estimateRemoteTaskPricing).toHaveBeenCalled());
    expect(await screen.findByText("¥6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /发\s*布/ }));

    await waitFor(() => expect(Modal.confirm).toHaveBeenCalledWith(expect.objectContaining({
      content: "确认发布后，该任务将在任务市场展示，用户可查看任务详情并接单。"
    })));
  });
});
