export function getAdminLoginBackendState() {
  return {
    title: "后台账号密码登录已接入",
    description: "管理后台调用正式管理员登录接口，账号和密码由 SprixServer 配置项控制。",
    endpoint: "/api/v1/auth/admin-login"
  };
}
