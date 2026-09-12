import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dropdown, message } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { adminRoutes } from "../navigation";
import { logoutAdmin } from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useSprixStore((state) => state.logout);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
      message.success("已退出登录");
    } catch (error) {
      message.warning(error instanceof Error ? `已清除本地登录状态，服务端退出失败：${error.message}` : "已清除本地登录状态");
    } finally {
      logout();
      queryClient.clear();
      navigate("/login", { replace: true });
    }
  };

  return (
    <aside className="sprix-sidebar">
      <Link to="/" className="mb-5 flex items-center gap-3 no-underline">
        <img src="/favicon.svg?v=sprix-brand-2" alt="" width={36} height={36} className="size-9 shrink-0" />
        <div>
          <div className="text-base font-semibold leading-none text-ink">Sprix Admin</div>
          <div className="mt-1 text-xs text-ink-soft">后台管理平台</div>
        </div>
      </Link>
      <nav className="sprix-sidebar-nav space-y-1">
        {adminRoutes.map((route) => {
          const Icon = route.icon;
          const active =
            location.pathname === route.path ||
            (route.key === "tasks" && location.pathname === "/") ||
            location.pathname.startsWith(`${route.path}/`);
          return (
            <Link
              key={route.key}
              to={route.path}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium no-underline transition ${
                active
                  ? "bg-pill text-white"
                  : "text-ink-soft hover:bg-[#f2f3f5] hover:text-ink"
              }`}
            >
              <Icon size={18} />
              {route.label}
            </Link>
          );
        })}
      </nav>
      <Dropdown
        trigger={["click"]}
        menu={{
          items: [
            {
              key: "logout",
              label: "退出登录",
              icon: <LogOut size={15} />,
              onClick: handleLogout
            }
          ]
        }}
      >
        <button className="sprix-operator-card" type="button">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pill text-white">
              <Menu size={16} />
            </span>
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-semibold text-ink">平台运营管理员</div>
              <div className="truncate text-xs text-ink-soft">ops@sprix.ai</div>
            </div>
          </div>
        </button>
      </Dropdown>
    </aside>
  );
}

export function AdminShell({ children }: { title: string; children: ReactNode }) {
  return (
    <div className="sprix-shell">
      <Sidebar />
      <main className="sprix-main">
        <div className="sprix-container">
          {children}
        </div>
      </main>
    </div>
  );
}
