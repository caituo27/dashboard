import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "../auth/AuthModal";
import { authenticateConsumer, createSafetyChallenge, readAlipayLoginStatus, sendSmsCode } from "../services/sprixApi";

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
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthModal open onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

function renderLoginModalWithOpen(open: boolean) {
  const queryClient = new QueryClient();
  const onClose = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthModal open={open} onClose={onClose} />
    </QueryClientProvider>
  );

  return {
    ...view,
    onClose,
    rerenderOpen: (nextOpen: boolean) =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <AuthModal open={nextOpen} onClose={onClose} />
        </QueryClientProvider>
      )
  };
}

function expectPhoneLabelToBeRequired(container: ParentNode) {
  const phoneLabel = container.querySelector(".sprix-phone-required-label");

  expect(phoneLabel?.textContent).toBe("*手机号");
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
    vi.mocked(authenticateConsumer).mockClear();
    vi.mocked(sendSmsCode).mockClear();
    vi.mocked(createSafetyChallenge).mockReset();
    vi.mocked(createSafetyChallenge).mockResolvedValue({
      challengeId: "challenge-1",
      challengeType: "IMAGE_ALPHANUMERIC",
      imageBase64: "data:image/png;base64,abc",
      expiresInSeconds: 120
    });
    vi.mocked(readAlipayLoginStatus).mockReset();
  });

  it("opens a server safety challenge dialog before sending an SMS code", async () => {
    const { baseElement } = renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    expectPhoneLabelToBeRequired(baseElement);
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

  it("does not open the safety challenge when the phone number format is invalid", async () => {
    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    expect(await screen.findByText("请输入正确的手机号")).toBeTruthy();
    await waitFor(() => {
      expect(createSafetyChallenge).not.toHaveBeenCalled();
    });
    expect(screen.queryByText("请输入图中字符后发送短信验证码")).toBeNull();
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

  it("does not submit the safety challenge while IME composition is confirming text", async () => {
    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await screen.findByText("请输入图中字符后发送短信验证码");
    const challengeInput = screen.getByPlaceholderText("请输入图中验证码");
    fireEvent.change(challengeInput, { target: { value: "a7K9" } });
    fireEvent.compositionStart(challengeInput);
    fireEvent.keyDown(challengeInput, { key: "Enter", code: "Enter" });

    expect(sendSmsCode).not.toHaveBeenCalled();

    fireEvent.compositionEnd(challengeInput);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    fireEvent.keyDown(challengeInput, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(sendSmsCode).toHaveBeenCalledWith({
        mobile: "13812345678",
        challengeId: "challenge-1",
        challengeAnswer: "a7K9"
      });
    });
  });

  it("requires a 4-digit login SMS verification code before submitting", async () => {
    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13812345678" } });
    const codeInput = screen.getByPlaceholderText("请输入验证码");

    expect(codeInput.getAttribute("maxlength")).toBe("4");
    fireEvent.change(codeInput, { target: { value: "123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "登录 / 注册" }));

    expect(await screen.findByText("请输入完整验证码")).toBeTruthy();
    await waitFor(() => {
      expect(authenticateConsumer).not.toHaveBeenCalled();
    });
  });

  it("refreshes the safety challenge without closing the dialog", async () => {
    vi.mocked(createSafetyChallenge)
      .mockResolvedValueOnce({
        challengeId: "challenge-1",
        challengeType: "IMAGE_ALPHANUMERIC",
        imageBase64: "data:image/png;base64,abc",
        expiresInSeconds: 120
      })
      .mockResolvedValueOnce({
        challengeId: "challenge-2",
        challengeType: "IMAGE_ALPHANUMERIC",
        imageBase64: "data:image/png;base64,def",
        expiresInSeconds: 120
      });
    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机号验证码" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13812345678" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    expect((await screen.findByAltText("安全验证码")).getAttribute("src")).toBe("data:image/png;base64,abc");
    fireEvent.change(screen.getByPlaceholderText("请输入图中验证码"), { target: { value: "a7K9" } });
    fireEvent.click(screen.getByRole("button", { name: "刷新验证码" }));

    await waitFor(() => {
      expect(createSafetyChallenge).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByAltText("安全验证码").getAttribute("src")).toBe("data:image/png;base64,def");
    expect((screen.getByPlaceholderText("请输入图中验证码") as HTMLInputElement).value).toBe("");
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

    const { baseElement } = renderLoginModal();

    expect(await screen.findByText("支付宝验证成功")).toBeTruthy();
    expect(screen.getByText("绑定手机号后即可完成登录。")).toBeTruthy();
    expectPhoneLabelToBeRequired(baseElement);
    expect(screen.getByRole("button", { name: "完成绑定并登录" })).toBeTruthy();
  });

  it("resets an unfinished Alipay phone binding flow after the login modal closes", async () => {
    vi.mocked(readAlipayLoginStatus).mockResolvedValue({
      sessionId: "alipay-session",
      status: "PHONE_BIND_REQUIRED",
      expiresInSeconds: 240,
      authenticated: false,
      phoneBindRequired: true,
      provider: "ALIPAY",
      bindTicket: "bind-ticket-1"
    });

    const view = renderLoginModalWithOpen(true);

    expect(await screen.findByText("支付宝验证成功")).toBeTruthy();

    view.rerenderOpen(false);
    vi.mocked(readAlipayLoginStatus).mockResolvedValue({
      sessionId: "alipay-session",
      status: "PENDING",
      expiresInSeconds: 240,
      authenticated: false,
      phoneBindRequired: false
    });
    view.rerenderOpen(true);

    await waitFor(() => {
      expect(screen.queryByText("支付宝验证成功")).toBeNull();
    });
    expect(await screen.findByText("请使用支付宝扫码授权，确认后会自动进入平台")).toBeTruthy();
  });
});
