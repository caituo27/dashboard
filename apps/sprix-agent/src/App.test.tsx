import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createInitialSprixState } from "./store/domain";
import { useSprixStore } from "./store/sprixStore";

vi.mock("./services/useRemoteSprixBootstrap", () => ({
  useRemoteSprixBootstrap: vi.fn()
}));

vi.mock("./home/useHomeBootstrap", () => ({
  useHomeBootstrap: vi.fn()
}));

vi.mock("./services/sprixApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./services/sprixApi")>();
  return {
    ...actual,
    logoutConsumer: vi.fn()
  };
});

vi.mock("./components/GlobalModals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./components/GlobalModals")>();
  const emptyModal = {
    login: false,
    account: false,
    agreements: false,
    contact: false,
    bindAlipay: false
  };

  function TestModal({ open, label }: { open: boolean; label: string }) {
    return open ? React.createElement("div", null, label) : null;
  }

  return {
    ...actual,
    useGlobalModalState: () => {
      const [modal, setModal] = React.useState(emptyModal);
      return {
        modal,
        open: (key: keyof typeof emptyModal) => setModal((prev) => ({ ...prev, [key]: true })),
        close: (key: keyof typeof emptyModal) => setModal((prev) => ({ ...prev, [key]: false })),
        closeAll: () => setModal(emptyModal)
      };
    },
    AuthModal: ({ open }: { open: boolean }) => React.createElement(TestModal, { open, label: "login-modal-open" }),
    AccountModal: ({ open }: { open: boolean }) => React.createElement(TestModal, { open, label: "account-modal-open" }),
    AgreementModal: ({ open }: { open: boolean }) => React.createElement(TestModal, { open, label: "agreement-modal-open" }),
    AppealModal: ({ open }: { open: boolean }) => React.createElement(TestModal, { open, label: "appeal-modal-open" }),
    BindAlipayModal: ({ open }: { open: boolean }) => React.createElement(TestModal, { open, label: "bind-alipay-modal-open" }),
    ContactModal: ({ open }: { open: boolean }) => React.createElement(TestModal, { open, label: "contact-modal-open" })
  };
});

describe("App auth-required flow", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    localStorage.clear();
    useSprixStore.setState(createInitialSprixState());
  });

  it("shows login only for manual login, not for login-expired events", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "连接本地 Agent" }));
    expect(screen.getByText("login-modal-open")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new CustomEvent("sprix-auth-required"));
    });

    expect(screen.getByText("让你的 Agent 自动帮你赚钱")).toBeTruthy();
    expect(screen.queryByText("login-modal-open")).toBeNull();
  });

  it("clears stale auth and returns to logged-out landing state on login-expired events", () => {
    localStorage.setItem("sprix-auth-token", "expired-token");
    useSprixStore.setState((state) => ({
      account: {
        ...state.account,
        isLoggedIn: true,
        nickname: "测试用户"
      }
    }));

    render(<App />);

    act(() => {
      window.dispatchEvent(new CustomEvent("sprix-auth-required"));
    });

    expect(screen.getByRole("button", { name: "连接本地 Agent" })).toBeTruthy();
    expect(screen.queryByText("退出登录")).toBeNull();
    expect(localStorage.getItem("sprix-auth-token")).toBeNull();
  });
});
