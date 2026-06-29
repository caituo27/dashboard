import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "../auth/AuthModal";
import { sendSmsCode } from "../services/sprixApi";

vi.mock("../services/sprixApi", () => ({
  authenticateConsumer: vi.fn(),
  createAlipayLoginSession: vi.fn().mockResolvedValue({
    sessionId: "alipay-session",
    qrPayload: "https://example.com/alipay",
    expiresInSeconds: 300,
    pollIntervalMs: 1000
  }),
  createWechatLoginSession: vi.fn().mockResolvedValue({
      sessionId: "wechat-session",
    qrPayload: "https://example.com/wechat",
      expiresInSeconds: 300,
    pollIntervalMs: 1000
  }),
  readAlipayLoginStatus: vi.fn(),
  readWechatLoginStatus: vi.fn(),
  readAgentSnapshot: vi.fn(),
  sendSmsCode: vi.fn().mockResolvedValue({
    mobile: "13812345678",
    expiresInSeconds: 900,
    resendIntervalSeconds: 60
  })
}));

function renderLoginModal() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthModal open onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

describe("AuthModal phone login", () => {
  beforeAll(() => {
    const getComputedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => getComputedStyle(element));
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
    vi.mocked(sendSmsCode).mockClear();
  });

  it("opens a local safety check dialog before sending an SMS code", async () => {
    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await waitFor(() => {
      expect(sendSmsCode).not.toHaveBeenCalled();
    });
    expect(await screen.findByText("请完成安全验证后发送验证码")).toBeTruthy();
  });

  it("sends an SMS code after the safety dialog succeeds", async () => {
    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await screen.findByText("请完成安全验证后发送验证码");
    const challenge = screen.getByText(/\d+ \+ \d+ =/).textContent ?? "";
    const [left, right] = challenge.match(/\d+/g)?.map(Number) ?? [];
    fireEvent.change(screen.getByPlaceholderText("请输入计算结果"), { target: { value: String(left + right) } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    await waitFor(() => {
      expect(sendSmsCode).toHaveBeenCalledWith("13812345678");
    });
  });
});
