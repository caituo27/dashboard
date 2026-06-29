import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "../auth/AuthModal";
import { createSafetyChallenge, readAlipayLoginStatus, sendSmsCode } from "../services/sprixApi";

vi.mock("../services/sprixApi", () => ({
  authenticateConsumer: vi.fn(),
  confirmPhoneBind: vi.fn(),
  createAlipayLoginSession: vi.fn().mockResolvedValue({
    sessionId: "alipay-session",
    qrPayload: "https://example.com/alipay",
    expiresInSeconds: 300,
    pollIntervalMs: 1
  }),
  createWechatLoginSession: vi.fn().mockResolvedValue({
      sessionId: "wechat-session",
    qrPayload: "https://example.com/wechat",
      expiresInSeconds: 300,
    pollIntervalMs: 1
  }),
  createSafetyChallenge: vi.fn().mockResolvedValue({
    challengeId: "challenge-1",
    challengeType: "IMAGE_ALPHANUMERIC",
    imageBase64: "data:image/png;base64,abc",
    expiresInSeconds: 120
  }),
  readAlipayLoginStatus: vi.fn(),
  readWechatLoginStatus: vi.fn(),
  readAgentSnapshot: vi.fn(),
  sendPhoneBindSmsCode: vi.fn(),
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
    vi.mocked(createSafetyChallenge).mockClear();
    vi.mocked(readAlipayLoginStatus).mockReset();
  });

  it("opens a server safety challenge dialog before sending an SMS code", async () => {
    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await waitFor(() => {
      expect(createSafetyChallenge).toHaveBeenCalledWith("SMS_LOGIN");
    });
    await waitFor(() => {
      expect(sendSmsCode).not.toHaveBeenCalled();
    });
    expect(await screen.findByText("请输入图中字符后发送短信验证码")).toBeTruthy();
    expect(screen.getByAltText("安全验证码")).toBeTruthy();
  });

  it("sends an SMS code with the server challenge answer", async () => {
    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await screen.findByText("请输入图中字符后发送短信验证码");
    fireEvent.change(screen.getByPlaceholderText("请输入图中验证码"), { target: { value: "a7K9" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    await waitFor(() => {
      expect(sendSmsCode).toHaveBeenCalledWith({
        mobile: "13812345678",
        challengeId: "challenge-1",
        challengeAnswer: "a7K9"
      });
    });
  });

  it("shows phone binding when Alipay scan requires a verified phone", async () => {
    vi.mocked(readAlipayLoginStatus).mockResolvedValue({
      sessionId: "alipay-session",
      status: "PHONE_BIND_REQUIRED",
      expiresInSeconds: 240,
      authenticated: false,
      phoneBindRequired: true,
      provider: "ALIPAY",
      bindTicket: "bind-ticket-1"
    });

    renderLoginModal();

    expect(await screen.findByText("支付宝验证成功")).toBeTruthy();
    expect(screen.getByText("为了保障账号安全，请绑定手机号")).toBeTruthy();
    expect(screen.getByRole("button", { name: "完成绑定并登录" })).toBeTruthy();
  });
});
