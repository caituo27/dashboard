import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AdminTaskForm } from "./AdminPages";

describe("AdminTaskForm", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
      })
    });
  });

  it("does not prefill a source type while task write APIs are backend-pending", () => {
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminTaskForm />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect((screen.getByLabelText("任务来源类型") as HTMLInputElement).value).toBe("");
    expect((screen.getByText("发布任务（待接口）").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
