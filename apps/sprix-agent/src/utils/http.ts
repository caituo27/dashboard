import axios, { type AxiosResponse } from "axios";

const DEFAULT_API_BASE_URL = "/sprix-api";

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
  message?: string;
  data?: T;
};

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" }
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("sprix-auth-token");
  if (token) config.headers.token = token;
  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope | unknown>): AxiosResponse => {
    const body = response.data as ApiEnvelope;
    if (body && typeof body === "object" && "success" in body) {
      if (body.success === false) {
        throw new Error(body.message ?? "请求失败");
      }
      return body.data as AxiosResponse;
    }
    return response.data as AxiosResponse;
  },
  (error) => {
    const status: number | undefined = error.response?.status;
    const serverMessage: string | undefined = error.response?.data?.message;
    const message = serverMessage ?? (status ? ERROR_MESSAGES[status] : undefined) ?? "网络错误，请稍后重试";

    window.dispatchEvent(new CustomEvent("sprix-api-error", { detail: { status, message } }));

    if (status === 401) {
      localStorage.removeItem("sprix-auth-token");
    }

    return Promise.reject(new Error(message));
  }
);
