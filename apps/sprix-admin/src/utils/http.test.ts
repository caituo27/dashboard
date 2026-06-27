import { describe, expect, it, vi } from "vitest";
import { http, isGlobalAuthError } from "./http";

describe("admin http auth handling", () => {
  it("marks UNAUTHENTICATED envelopes as global auth errors", async () => {
    localStorage.setItem("sprix-admin-auth-token", "expired-token");
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: "/tasks",
        search: "",
        hash: "",
        assign: assignSpy
      }
    });

    let caught: unknown;
    try {
      await http.get("/api/v1/admin/tasks", {
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
    expect(localStorage.getItem("sprix-admin-auth-token")).toBeNull();
    expect(assignSpy).toHaveBeenCalledWith("/login?redirect=%2Ftasks");
  });
});
