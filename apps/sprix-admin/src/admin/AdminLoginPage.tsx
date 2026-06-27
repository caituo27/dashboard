import { useState } from "react";
import { Button, Form, Input, message } from "antd";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { authenticateAdmin } from "../services/sprixApi";

type LoginValues = {
  account: string;
  password: string;
};

export function hasAdminToken() {
  return Boolean(localStorage.getItem("sprix-admin-auth-token"));
}

function getSafeAdminRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/tasks";
  }
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/api/") || value.startsWith("/sprix-api/")) {
    return "/tasks";
  }
  return value;
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const redirect = getSafeAdminRedirect(searchParams.get("redirect"));

  if (hasAdminToken()) {
    return <Navigate to={redirect} replace />;
  }

  const login = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      await authenticateAdmin(values.account, values.password);
      message.success("登录成功");
      navigate(redirect, { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[440px] flex-col justify-center">
        <section className="rounded-[28px] border border-line bg-white p-8 shadow-soft">
          <div className="mb-8">
            <div className="sprix-title text-3xl text-ink">Sprix Admin</div>
            <p className="mt-2 text-sm text-ink-soft">登录后进入平台运营后台</p>
          </div>
          <Form<LoginValues>
            layout="vertical"
            onFinish={login}
          >
            <Form.Item label="账号" name="account" rules={[{ required: true, message: "请输入账号" }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password size="large" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" shape="round" block loading={submitting}>
              登录
            </Button>
          </Form>
        </section>
      </div>
    </main>
  );
}
