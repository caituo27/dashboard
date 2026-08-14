import axios, { type AxiosResponse } from "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    suppressGlobalAuth?: boolean;
  }
}

const DEFAULT_API_BASE_URL = "/sprix-api";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
const API_PATH_PREFIX = "/api/";

const ERROR_MESSAGES: Record<number, string> = {
  400: "请求参数错误",
  401: "登录已过期，请重新登录",
  403: "没有权限执行该操作",
  404: "请求资源不存在",
  408: "请求超时",
  409: "数据冲突，请刷新后重试",
  422: "请求数据验证失败",
  429: "请求过于频繁，请稍后再试",
  500: "服务器内部错误",
  502: "网关错误",
  503: "服务暂不可用",
  504: "网关超时"
};

type ApiEnvelope<T = unknown> = {
  success?: boolean;
  code?: string;
  message?: string;
  data?: T;
};

export class GlobalAuthError extends Error {
  readonly globalAuth = true;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

let lastAuthRequestAt = 0;

export function isGlobalAuthError(error: unknown): error is GlobalAuthError {
  return error instanceof GlobalAuthError || (typeof error === "object" && error !== null && (error as { globalAuth?: unknown }).globalAuth === true);
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function requestLogin(message: string) {
  const now = Date.now();
  if (now - lastAuthRequestAt < 1200) return;
  lastAuthRequestAt = now;
  localStorage.removeItem("sprix-auth-token");
  window.dispatchEvent(new CustomEvent("sprix-auth-required", { detail: { message } }));
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" }
});

export function resolveApiAssetUrl(value?: string | null): string {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue) return "";

  const absoluteApiPath = apiPathFromAbsoluteUrl(trimmedValue);
  if (absoluteApiPath) return resolveApiPath(absoluteApiPath);
  if (isApiPath(trimmedValue)) return resolveApiPath(trimmedValue);
  return trimmedValue;
}

function apiPathFromAbsoluteUrl(value: string): string {
  try {
    const url = new URL(value);
    if (isApiPath(url.pathname)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch (error) {
    if (error instanceof TypeError) return "";
    throw error;
  }
  return "";
}

function resolveApiPath(value: string): string {
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${baseUrl}${path}`;
}

function isApiPath(value: string): boolean {
  return value.startsWith(API_PATH_PREFIX);
}

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("sprix-auth-token");
  if (token) config.headers.token = token;
  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }
  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope | unknown>): AxiosResponse => {
    const body = response.data as ApiEnvelope;
    if (body && typeof body === "object" && "success" in body) {
      if (body.success === false) {
        if (body.code === "UNAUTHENTICATED") {
          const message = body.message ?? "登录已过期，请重新登录";
          if (response.config.suppressGlobalAuth) {
            throw new Error(message);
          }
          requestLogin(message);
          throw new GlobalAuthError(message);
        }
        throw new ApiRequestError(body.message ?? "请求失败", body.code);
      }
      return body.data as AxiosResponse;
    }
    return response.data as AxiosResponse;
  },
  (error) => {
    const status: number | undefined = error.response?.status;
    const serverMessage: string | undefined = error.response?.data?.message;
    const serverCode: string | undefined = error.response?.data?.code;
    const message = serverMessage ?? (status ? ERROR_MESSAGES[status] : undefined) ?? "网络错误，请稍后重试";

    window.dispatchEvent(new CustomEvent("sprix-api-error", { detail: { status, message } }));

    if (status === 401) {
      if (error.config?.suppressGlobalAuth) {
        return Promise.reject(new Error(message));
      }
      requestLogin(message);
      return Promise.reject(new GlobalAuthError(message));
    }

    return Promise.reject(new ApiRequestError(message, serverCode));
  }
);
