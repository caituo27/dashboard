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
  primaryActionLabel: "连接本地 Agent"
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

    expect(screen.getByRole("button", { name: "连接本地 Agent" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "下载客户端" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "连接本地 Agent" }));

    expect(props.onOpenLogin).toHaveBeenCalledOnce();
    expect(props.onOpenConnectModal).not.toHaveBeenCalled();
  });

  it("keeps the installer download inside the logged-in connection guide", () => {
    renderEntry(
      {
        ...baseState,
        state: "logged_in_without_agents",
        isLoggedIn: true
      },
      true
    );

    expect(screen.getByRole("button", { name: "连接本地 Agent" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "下载安装包" })).toHaveAttribute(
      "href",
      "https://cnb.cool/yztx_qxun/LocalCLIAgentRelease/-/blob/main/LocalCLIAgent-latest.dmg"
    );
    expect(screen.queryByRole("link", { name: "下载客户端" })).toBeNull();
  });
});
