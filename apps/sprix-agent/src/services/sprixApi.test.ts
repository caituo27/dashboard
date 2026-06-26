import { beforeEach, describe, expect, it, vi } from "vitest";

const { authApiMock } = vi.hoisted(() => ({
  authApiMock: {
    createWechatScanSession: vi.fn(),
    wechatScanSession: vi.fn(),
    mockLogin: vi.fn(),
    logout: vi.fn()
  }
}));

vi.mock("../apis/sprix", () => ({
  AccountControllerApiFactory: vi.fn(() => ({})),
  AgentControllerApiFactory: vi.fn(() => ({})),
  AppealControllerApiFactory: vi.fn(() => ({})),
  AuthControllerApiFactory: vi.fn(() => authApiMock),
  EarningsControllerApiFactory: vi.fn(() => ({})),
  MyTaskControllerApiFactory: vi.fn(() => ({})),
  TaskControllerApiFactory: vi.fn(() => ({})),
  WithdrawalControllerApiFactory: vi.fn(() => ({}))
}));

import { createWechatLoginSession, readWechatLoginStatus } from "./sprixApi";

describe("Sprix API WeChat login adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("creates a QR login session from the backend scan session", async () => {
    authApiMock.createWechatScanSession.mockResolvedValue({
      sessionId: "session-1",
      qrPayload: "sprix://wechat-login?sessionId=session-1",
      expiresInSeconds: 300,
      pollIntervalSeconds: 2
    });

    await expect(createWechatLoginSession()).resolves.toEqual({
      sessionId: "session-1",
      qrPayload: "sprix://wechat-login?sessionId=session-1",
      expiresInSeconds: 300,
      pollIntervalMs: 2000
    });
  });

  it("stores the returned auth token when the scan session is confirmed", async () => {
    authApiMock.wechatScanSession.mockResolvedValue({
      sessionId: "session-1",
      status: "CONFIRMED",
      expiresInSeconds: 250,
      token: {
        token: "token-1",
        nickname: "Andy"
      }
    });

    await expect(readWechatLoginStatus("session-1")).resolves.toEqual({
      sessionId: "session-1",
      status: "CONFIRMED",
      expiresInSeconds: 250,
      authenticated: true
    });
    expect(localStorage.getItem("sprix-auth-token")).toBe("token-1");
  });

  it("rejects incomplete scan sessions before rendering an unusable QR code", async () => {
    authApiMock.createWechatScanSession.mockResolvedValue({
      sessionId: "session-1"
    });

    await expect(createWechatLoginSession()).rejects.toThrow("微信扫码登录二维码不可用");
  });
});
