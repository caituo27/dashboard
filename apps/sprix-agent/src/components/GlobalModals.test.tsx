import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginRegisterModal } from "./GlobalModals";

const { serviceMocks } = vi.hoisted(() => ({
  serviceMocks: {
    applyRemoteWithdrawal: vi.fn(),
    authenticateConsumer: vi.fn(),
    bindRemoteWithdrawalAccount: vi.fn(),
    createWechatLoginSession: vi.fn(),
    mapRemoteWithdrawal: vi.fn(),
    readWechatLoginStatus: vi.fn(),
    submitRemoteAppeal: vi.fn()
  }
}));

vi.mock("../services/sprixApi", () => serviceMocks);

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
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

  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Object.defineProperty(window, "getComputedStyle", {
    writable: true,
    value: vi.fn(() => ({
      getPropertyValue: vi.fn(() => ""),
      width: "0px",
      height: "0px",
      overflow: "hidden",
      overflowX: "hidden",
      overflowY: "hidden"
    }))
  });
});

describe("LoginRegisterModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a WeChat QR session after the user agrees to the policies", async () => {
    serviceMocks.createWechatLoginSession.mockResolvedValue({
      sessionId: "session-1",
      qrPayload: "sprix://wechat-login?sessionId=session-1",
      expiresInSeconds: 300,
      pollIntervalMs: 2000
    });
    serviceMocks.readWechatLoginStatus.mockResolvedValue({
      sessionId: "session-1",
      status: "PENDING",
      expiresInSeconds: 300,
      authenticated: false
    });

    renderLoginModal();

    fireEvent.click(screen.getByLabelText("我已阅读并同意《用户协议》和《隐私协议》"));
    fireEvent.click(screen.getByRole("button", { name: "生成微信登录二维码" }));

    await waitFor(() => expect(serviceMocks.createWechatLoginSession).toHaveBeenCalledTimes(1));
    expect(screen.getByText("请使用微信扫码，确认后会自动进入平台")).toBeInTheDocument();
  });
});

function renderLoginModal() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginRegisterModal open onClose={vi.fn()} />
    </QueryClientProvider>
  );
}
