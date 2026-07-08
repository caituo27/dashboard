import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { HomeAgentStateResult } from "./homeTypes";
import { HomeAgentEntry } from "./HomeAgentEntry";

vi.mock("./useAgentBindPolling", () => ({
  useAgentBindPolling: () => ({
    recognizing: false,
    elapsedMs: 0,
    recognize: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  })
}));

const baseState: HomeAgentStateResult = {
  state: "guest",
  isLoggedIn: false,
  agents: [],
  currentAgent: undefined,
  canOpenAgentPicker: false,
  primaryActionLabel: "登录/注册"
};

beforeAll(() => {
  Object.defineProperty(window, "getComputedStyle", {
    value: () => ({ getPropertyValue: () => "" })
  });
});

function renderEntry(state: HomeAgentStateResult, connectModalOpen = false) {
  const props = {
    state,
    connectModalOpen,
    onOpenLogin: vi.fn(),
    onOpenConnectModal: vi.fn(),
    onCloseConnectModal: vi.fn(),
    onOpenAgentPicker: vi.fn(),
    onEnterMarket: vi.fn()
  };

  render(<HomeAgentEntry {...props} />);
  return props;
}

describe("HomeAgentEntry", () => {
  it("uses one homepage action and sends logged-out users to login first", () => {
    const props = renderEntry(baseState);

    expect(screen.getByRole("button", { name: "登录/注册" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "下载客户端" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "登录/注册" }));

    expect(props.onOpenLogin).toHaveBeenCalledOnce();
    expect(props.onOpenConnectModal).not.toHaveBeenCalled();
  });

  it("keeps the installer download inside the logged-in connection guide", () => {
    renderEntry(
      {
        ...baseState,
        state: "logged_in_without_agents",
        isLoggedIn: true,
        primaryActionLabel: "连接本地agent（仅限Mac）"
      },
      true
    );

    const downloadLink = screen.getByRole("link", { name: "下载 Sprix AI 连接插件（Mac 版）" });

    expect(screen.getByRole("button", { name: "连接本地agent（仅限Mac）" })).toBeTruthy();
    expect(screen.getByText("安装连接插件后，即可识别本机 Agent。")).toBeTruthy();
    expect(downloadLink).toHaveAttribute("href", "https://cnb.cool/yztx_qxun/LocalCLIAgentRelease/-/git/raw/main/LocalCLIAgent-latest.dmg");
    expect(screen.getByText("目前仅支持以下 Agent")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.getByText("Hermes")).toBeTruthy();
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByText("OpenCode")).toBeTruthy();
    expect(screen.queryByText("了解 CLI 模式")).toBeNull();
    expect(screen.queryByRole("link", { name: "下载客户端" })).toBeNull();
  });
});
