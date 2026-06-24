import type { ReactNode } from "react";
import { message } from "antd";
import { Link, useLocation } from "react-router-dom";
import { Bot, Menu } from "lucide-react";
import { SecondaryButton } from "./Primitives";
import { adminRoutes } from "../navigation";

function Sidebar() {
  const location = useLocation();
  return (
    <aside className="sprix-sidebar">
      <Link to="/" className="mb-8 flex items-center gap-3 no-underline">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-pill text-white">
          <Bot size={20} />
        </div>
        <div>
          <div className="sprix-title text-2xl leading-none text-ink">Sprix Admin</div>
          <div className="mt-1 text-xs text-ink-soft">管理后台</div>
        </div>
      </Link>
      <nav className="space-y-2">
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
              className={`flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium no-underline transition ${
                active
                  ? "bg-pill text-white shadow-[0_10px_24px_rgba(17,17,17,0.12)]"
                  : "text-ink-soft hover:bg-white hover:text-ink"
              }`}
            >
              <Icon size={18} />
              {route.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function AdminTopBar({ title }: { title: string }) {
  return (
    <header className="sprix-topbar">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">管理后台</div>
        <h2 className="mt-1 text-xl font-semibold text-ink">{title}</h2>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-pill text-white">
          <Menu size={16} />
        </span>
        <div>
          <div className="text-sm font-semibold text-ink">平台运营管理员</div>
          <div className="text-xs text-ink-soft">ops@sprix.ai</div>
        </div>
      </div>
    </header>
  );
}

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="sprix-shell">
      <Sidebar />
      <main className="sprix-main">
        <div className="sprix-container">
          <AdminTopBar title={title} />
          {children}
          <div className="mt-6 flex justify-end">
            <SecondaryButton onClick={() => message.info("后台已作为独立 app 运行，当前页面不提供 C 端跳转")}>
              独立后台已启用
            </SecondaryButton>
          </div>
        </div>
      </main>
    </div>
  );
}
