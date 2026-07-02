import { describe, expect, it } from "vitest";
import { resolveApiAssetUrl } from "./http";

describe("resolveApiAssetUrl", () => {
  it("rebases backend avatar API paths to the configured frontend API base", () => {
    expect(resolveApiAssetUrl("/api/v1/account/users/user-1/avatar?v=avatar-1")).toBe(
      "/sprix-api/api/v1/account/users/user-1/avatar?v=avatar-1"
    );
  });

  it("rebases absolute backend avatar URLs so HTTPS pages do not load the backend host directly", () => {
    expect(resolveApiAssetUrl("http://42.194.150.73:8084/api/v1/account/users/user-1/avatar?v=avatar-1")).toBe(
      "/sprix-api/api/v1/account/users/user-1/avatar?v=avatar-1"
    );
  });

  it("preserves external asset URLs", () => {
    expect(resolveApiAssetUrl("https://cdn.sprix.ai/avatar.png")).toBe("https://cdn.sprix.ai/avatar.png");
  });
});
