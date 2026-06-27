import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AdminLoginPage } from "./AdminLoginPage";

describe("AdminLoginPage", () => {
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
    localStorage.clear();
  });

  it("shows that admin login still uses the mock backend endpoint", () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText("后台登录接口待正式接入")).toBeTruthy();
    expect(screen.getByText("/api/v1/auth/mock-admin-login")).toBeTruthy();
  });

  it("does not prefill mock admin credentials as production login values", () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );

    expect((screen.getByLabelText("邮箱") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("验证码") as HTMLInputElement).value).toBe("");
  });
});
