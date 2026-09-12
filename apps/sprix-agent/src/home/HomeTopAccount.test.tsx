import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialSprixState } from "../store/domain";
import { HomeTopAccount } from "./HomeTopAccount";

describe("HomeTopAccount", () => {
  it("opens logout from the account menu", async () => {
    const initialState = createInitialSprixState();
    const onLogout = vi.fn();

    render(
      <HomeTopAccount
        account={{
          ...initialState.account,
          isLoggedIn: true,
          nickname: "用户5160",
          maskedPhone: "188****5160"
        }}
        onLogout={onLogout}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "用户5160，打开账户菜单" }));

    expect(screen.getAllByText("用户5160").length).toBeGreaterThan(0);
    expect(await screen.findByText("188****5160")).toBeTruthy();
    fireEvent.click(await screen.findByText("退出登录"));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
