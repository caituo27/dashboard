import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AgreementModal, AppealModal, ContactModal, LoginRegisterModal } from "./GlobalModals";

const { serviceMocks } = vi.hoisted(() => ({
  serviceMocks: {
    applyRemoteWithdrawal: vi.fn(),
    authenticateConsumer: vi.fn(),
    bindRemoteWithdrawalAccount: vi.fn(),
    createWechatLoginSession: vi.fn(),
    mapRemoteWithdrawal: vi.fn(),
    readWechatLoginStatus: vi.fn(),
    sendSmsCode: vi.fn(),
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

  it("requests a real SMS code from the backend when the user clicks get code", async () => {
    serviceMocks.sendSmsCode.mockResolvedValue({
      mobile: "13800008624",
      expiresInSeconds: 300,
      resendIntervalSeconds: 60
    });

    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机验证码登录 / 注册" }));
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13800008624" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await waitFor(() => expect(serviceMocks.sendSmsCode).toHaveBeenCalledWith("13800008624"));
    expect(screen.getByRole("button", { name: "60s 后重发" })).toBeDisabled();
  });

  it("logs in with the phone and SMS code submitted by the user", async () => {
    serviceMocks.authenticateConsumer.mockResolvedValue("sms-token-1");

    renderLoginModal();

    fireEvent.click(screen.getByRole("tab", { name: "手机验证码登录 / 注册" }));
    const agreementChecks = screen.getAllByLabelText("我已阅读并同意《用户协议》和《隐私协议》");
    fireEvent.click(agreementChecks[agreementChecks.length - 1]);
    fireEvent.change(screen.getByPlaceholderText("请输入手机号"), { target: { value: "13800008624" } });
    fireEvent.change(screen.getByPlaceholderText("请输入验证码"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "登录 / 注册" }));

    await waitFor(() => expect(serviceMocks.authenticateConsumer).toHaveBeenCalledWith("13800008624", "123456"));
  });
});

describe("AgreementModal", () => {
  it("marks the displayed agreement copy as pending the formal legal text", () => {
    render(<AgreementModal open onClose={vi.fn()} />);

    expect(screen.getByText("正式协议全文待接入")).toBeInTheDocument();
    expect(screen.getByText("当前仅展示产品流程摘要，正式用户协议、隐私协议和自由职业者服务框架协议全文待法务/后端配置后接入。")).toBeInTheDocument();
  });
});

describe("ContactModal", () => {
  it("marks customer service contact information as pending configuration", () => {
    render(<ContactModal open onClose={vi.fn()} />);

    expect(screen.getByText("客服联系信息待配置")).toBeInTheDocument();
    expect(screen.queryByText("400-800-1024")).not.toBeInTheDocument();
  });
});

describe("AppealModal", () => {
  it("does not promise a fixed appeal processing SLA without backend data", () => {
    renderWithQueryClient(<AppealModal open executionId="execution-1" onClose={vi.fn()} />);

    expect(screen.queryByText(/1-3 个工作日/)).not.toBeInTheDocument();
    expect(screen.getByText(/平台将按后端返回的申诉状态和处理时限更新进度/)).toBeInTheDocument();
  });
});

function renderLoginModal() {
  return renderWithQueryClient(<LoginRegisterModal open onClose={vi.fn()} />);
}

function renderWithQueryClient(children: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
