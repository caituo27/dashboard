import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { adminRoutes } from "../navigation";

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sprix-sidebar">
      <Link to="/" className="mb-5 flex items-center gap-3 no-underline">
        <div className="flex size-9 items-center justify-center rounded-xl bg-pill text-white">
          <img src="/favicon.svg" alt="" className="size-5" />
        </div>
        <div>
          <div className="text-base font-semibold leading-none text-ink">Sprix 管理后台</div>
          <div className="mt-1 text-xs text-ink-soft">管理后台</div>
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
      <div className="sprix-operator-card" aria-label="当前管理员">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pill text-white">
            <Menu size={16} />
          </span>
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-semibold text-ink">平台运营管理员</div>
            <div className="truncate text-xs text-ink-soft">ops@sprix.ai</div>
          </div>
        </div>
      </div>
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
