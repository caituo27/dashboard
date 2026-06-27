export function getAdminLoginBackendState() {
  return {
    title: "后台登录接口待正式接入",
    description: "当前后台登录仍调用 /api/v1/auth/mock-admin-login；正式管理员登录接口接入前，不把它标记为生产登录。",
    endpoint: "/api/v1/auth/mock-admin-login"
  };
}
