import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AdminAppealDetail } from "./AdminPages";

const readDetail = vi.hoisted(() => vi.fn().mockResolvedValue({
  backendId: "demo:appeal:2071",
  appealNo: "demo:appeal:2071",
  appealStatus: "申诉通过",
  userName: "用户1472",
  userPhone: "13612341472",
  taskTitle: "demo:task:42",
  taskCategory: "数据处理",
  appealReason: "请复核执行记录 demo:execution:825",
}));
vi.mock("../services/adminDataSource", async (importOriginal) => ({
  ...await importOriginal<typeof import("../services/adminDataSource")>(),
  readRemoteAppealDetail: readDetail,
}));

it("formats detail identifiers while preserving the lookup ID and phone masking", async () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const { container } = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/appeals/demo:appeal:2071"]}>
        <Routes><Route path="/appeals/:id" element={<AdminAppealDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  expect(await screen.findByRole("heading", {name: "AP-00002071"})).toBeTruthy();
  expect(screen.getByText("TK-00000042")).toBeTruthy();
  expect(screen.getByText("请复核执行记录 EX-00000825")).toBeTruthy();
  expect(screen.getByText("136****1472")).toBeTruthy();
  expect(container.textContent).not.toContain("demo:");
  expect(readDetail).toHaveBeenCalledWith("demo:appeal:2071");
});
