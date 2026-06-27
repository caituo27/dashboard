import { describe, expect, it, vi } from "vitest";
import { http, isGlobalAuthError } from "./http";

describe("agent http auth handling", () => {
  it("marks UNAUTHENTICATED envelopes as global auth errors and requests login", async () => {
    localStorage.setItem("sprix-auth-token", "expired-token");
    const authRequiredListener = vi.fn();
    window.addEventListener("sprix-auth-required", authRequiredListener);

    let caught: unknown;
    try {
      await http.get("/api/v1/agents", {
        adapter: async (config) => ({
          config,
          data: { success: false, code: "UNAUTHENTICATED", message: "Please login first" },
          headers: {},
          status: 200,
          statusText: "OK"
        })
      });
    } catch (error) {
      caught = error;
    }

    expect(isGlobalAuthError(caught)).toBe(true);
    expect(localStorage.getItem("sprix-auth-token")).toBeNull();
    expect(authRequiredListener).toHaveBeenCalledTimes(1);
    window.removeEventListener("sprix-auth-required", authRequiredListener);
  });
});
