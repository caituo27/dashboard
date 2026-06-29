import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialSprixState } from "../store/domain";
import { HomeTopAccount } from "./HomeTopAccount";

describe("HomeTopAccount", () => {
  it("shows logout without displaying the account name", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    expect(screen.queryByText("用户5160")).toBeNull();
    expect(screen.queryByText("188****5160")).toBeNull();
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
