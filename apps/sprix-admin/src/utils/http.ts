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

const LEGACY_API_MESSAGES: Readonly<Record<string, string>> = {
  "Please login first": "请先登录",
  "No permission": "没有权限执行该操作",
  "Server error": "服务器内部错误",
  "User not found": "用户不存在",
  "Current account not found": "当前账号不存在",
  "Admin account not found": "管理员账号不存在",
  "Password is invalid": "密码错误",
  "Phone is required": "请输入手机号",
  "Phone already bound": "手机号已被绑定",
  "Sms code is invalid": "验证码无效",
  "Safety challenge scene is invalid": "安全验证场景无效",
  "Task not found": "任务不存在",
  "Execution not found": "执行记录不存在",
  "File not found": "文件不存在",
  "Task is not published": "任务未发布或已下线，无法执行",
  "Task has no remaining slots": "任务名额已满，无法执行",
  "Account is frozen": "账户资格已冻结",
  "Real person verification is required before accepting tasks": "接单前请先完成实人认证",
  "Freelancer agreement is required before accepting tasks": "接单前请先签署自由职业者协议",
  "Current execution agent is required before accepting tasks": "接单前请先设置当前执行 Agent",
  "Only terminated or failed executions can rerun": "只有已终止或验收未通过的执行记录可以重新执行",
  "Only running executions can be cancelled": "只有执行中的任务可以终止",
  "Only published tasks can be offlined": "只有已发布任务可以下线",
  "Only offline tasks can be republished": "只有已下线任务可以重新发布",
  "Slot-full tasks cannot be republished": "名额已满的任务不能重新发布",
  "Reason is required": "请填写原因",
  "Task pricing tokens-per-unit must be greater than 0": "任务定价的 Token 计费单位必须大于 0",
  "Task pricing unit price must be greater than 0": "任务定价的单价必须大于 0",
  "Appeal not found": "申诉记录不存在",
  "Only acceptance failed tasks can be appealed": "只有验收未通过的任务可以申诉",
  "Execution already appealed": "该执行记录已提交过申诉",
  "Appeal is not pending": "申诉状态不是待处理",
  "Appeal is not processing": "申诉状态不是处理中",
  "Nickname is required": "请输入昵称",
  "Profile not found": "账户资料不存在",
  "Bind recipient Alipay through Alipay authorization": "请通过 Alipay 授权绑定收款账户",
  "Withdrawal account not found": "收款账户不存在",
  "Withdrawal account is missing Alipay user id": "收款账户缺少 Alipay 用户标识，请重新绑定",
  "Alipay bind session not found": "Alipay 绑定会话不存在",
  "Alipay bind session expired": "Alipay 绑定会话已过期",
  "Alipay login session not found": "Alipay 登录会话不存在",
  "Alipay login session expired": "Alipay 登录会话已过期",
  "Wechat scan login session not found": "Wechat 扫码登录会话不存在",
  "Wechat scan login session expired": "Wechat 扫码登录会话已过期",
  "Wechat account not found": "Wechat 账户不存在",
  "Alipay account not found": "Alipay 账户不存在",
  "Face verification session not found": "实人认证会话不存在",
  "Face verification failed": "实人认证失败",
  "Avatar file is required": "请上传头像文件",
  "Avatar file type is invalid": "头像文件类型无效",
  "Avatar file is too large": "头像文件过大",
  "Agent evaluation not found": "Agent 测评记录不存在",
  "Agent not found": "Agent 不存在",
  "Agent is not installed on bound LocalCLIAgent device": "绑定的 LocalCLIAgent 设备未安装该 Agent",
  "Evaluation requires exactly 5 questions": "Agent 测评需要 5 个问题",
  "Agent evaluation is required before setting current execution agent": "设为当前执行 Agent 前请先完成测评",
  "LocalCLIAgent device is not available": "LocalCLIAgent 设备不可用",
  "LocalCLIAgent device is not ready for evaluation": "LocalCLIAgent 设备尚未准备好测评",
  "Withdrawal not found": "提现记录不存在",
  "Withdrawal user not found": "提现用户不存在",
  "Withdrawal amount is invalid": "提现金额无效",
  "Withdrawal account is required": "请先绑定收款账户",
  "Only reviewing withdrawals can be approved": "只有审核中的提现可以通过",
  "Only reviewing withdrawals can be rejected": "只有审核中的提现可以驳回",
  "Only pending payout withdrawals can be approved": "只有待打款提现可以通过",
  "Only pending payout withdrawals can be rejected": "只有待打款提现可以驳回",
  "Payout failed withdrawals can be retried": "只有打款失败提现可以重试",
  "Only payout failed withdrawals can be handled": "只有打款失败提现可以处理异常",
  "Settlement not found": "结算记录不存在",
  "Only settling settlements can be paid": "只有结算中的记录可以打款",
  "Settlement user not found": "结算用户不存在",
  "Alipay payout failed": "Alipay 打款失败",
  "Alipay user id is missing": "Alipay 用户标识缺失",
  "Alipay authorization code exchange failed": "Alipay 授权码换取失败",
  "Alipay authorization did not return a user id": "Alipay 授权未返回用户标识",
  "Alipay authorization failed": "Alipay 授权失败",
  "Alipay app id is missing": "Alipay app id 未配置",
  "Alipay credentials are missing": "Alipay 配置缺失",
  "Alipay face verification initialize failed": "Alipay 人脸认证初始化失败",
  "Alipay face verification query failed": "Alipay 人脸认证查询失败",
  "Alipay face verification credentials are missing": "Alipay 人脸认证配置缺失",
  "Alipay transfer failed": "Alipay 转账失败",
  "Alipay transfer query failed": "Alipay 转账查询失败",
  "Alipay client initialization failed": "Alipay 客户端初始化失败",
  "Alipay payout is disabled": "Alipay 打款未启用",
  "Alipay payout transfer scene is missing": "Alipay 打款场景配置缺失",
  "Alipay payout credentials are missing": "Alipay 打款配置缺失",
  "Wechat open platform credentials are missing": "Wechat 开放平台配置缺失",
  "Wechat code exchange failed": "Wechat 授权码换取失败",
  "Wechat scan login configuration is missing": "Wechat 扫码登录配置缺失",
  "Tencent SMS configuration is missing": "Tencent SMS 配置缺失",
  "SMS send failed": "短信发送失败",
  "DeepSeek API key is missing": "DeepSeek API key 未配置",
  "DeepSeek token estimation failed": "DeepSeek Token 估算失败",
  "DeepSeek returned empty token estimate": "DeepSeek 返回了空的 Token 估算结果",
  "DeepSeek token estimate is invalid": "DeepSeek Token 估算结果无效",
  "DeepSeek returned invalid token estimate json": "DeepSeek 返回了无效的 Token 估算 JSON",
  "Artifact file cannot be stored": "工件文件无法保存",
  "Artifact file cannot be read": "工件文件无法读取",
  "Artifact file cannot be stored in COS": "工件文件无法保存到 COS",
  "File not found in COS": "COS 文件不存在",
  "COS storage is not configured": "COS 存储未配置",
  "Invalid gateway JSON payload": "网关 JSON 请求体无效",
  "Host header is required": "Host header 不能为空",
  "Claim device not found": "认领设备不存在",
  "Local agent enrollment token is not pending": "LocalCLIAgent 绑定令牌状态不是待处理",
  "Local agent enrollment token is expired": "LocalCLIAgent 绑定令牌已过期",
  "Enrollment user not found": "绑定用户不存在",
  "Local agent claim is not pending": "LocalCLIAgent 认领状态不是待处理",
  "Local agent claim is expired": "LocalCLIAgent 认领已过期",
  "Local agent device is not claimable": "LocalCLIAgent 设备不可认领",
  "Device is not paired": "设备未配对",
  "Device secret is invalid": "设备密钥无效",
  "Artifact sha256 mismatch": "工件 sha256 校验不匹配",
  "Agent token is invalid": "Agent token 无效",
  "Command not found": "命令不存在",
  "Event id is required": "Event id 不能为空",
  "Event type is required": "Event type 不能为空",
  "Local agent claim not found": "LocalCLIAgent 认领记录不存在",
  "Local agent enrollment token not found": "LocalCLIAgent 绑定令牌不存在",
  "Pairing user not found": "配对用户不存在",
  "Seed consumer account not found": "种子 C 端账号不存在",
  "Agent token is required": "Agent token 不能为空",
  "Artifact file cannot be hashed": "工件文件无法计算哈希"
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

export function isGlobalAuthError(error: unknown): error is GlobalAuthError {
  return error instanceof GlobalAuthError || (typeof error === "object" && error !== null && (error as { globalAuth?: unknown }).globalAuth === true);
}

export function localizeApiMessage(message: string | undefined, fallback = "请求失败"): string {
  const normalized = message?.trim();
  if (!normalized) return fallback;
  return LEGACY_API_MESSAGES[normalized] ?? normalized;
}

function redirectToLogin() {
  localStorage.removeItem("sprix-admin-auth-token");
  if (window.location.pathname === "/login") return;
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`);
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" }
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("sprix-admin-auth-token");
  if (token) config.headers.token = token;
  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope | unknown>): AxiosResponse => {
    const body = response.data as ApiEnvelope;
    if (body && typeof body === "object" && "success" in body) {
      if (body.success === false) {
        const message = localizeApiMessage(body.message);
        window.dispatchEvent(new CustomEvent("sprix-api-error", { detail: { code: body.code, message } }));
        if (body.code === "UNAUTHENTICATED") {
          redirectToLogin();
          throw new GlobalAuthError(message);
        }
        throw new Error(message);
      }
      return body.data as AxiosResponse;
    }
    return response.data as AxiosResponse;
  },
  (error) => {
    const status: number | undefined = error.response?.status;
    const serverMessage: string | undefined = error.response?.data?.message;
    const message = localizeApiMessage(serverMessage, (status ? ERROR_MESSAGES[status] : undefined) ?? "网络错误，请稍后重试");

    window.dispatchEvent(new CustomEvent("sprix-api-error", { detail: { status, message } }));

    if (status === 401) {
      redirectToLogin();
      return Promise.reject(new GlobalAuthError(message));
    }

    return Promise.reject(new Error(message));
  }
);
