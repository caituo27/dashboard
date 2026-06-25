import type { ReactNode } from "react";
import { Dropdown, message } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bot, LogOut, UserRound } from "lucide-react";
import { useSprixStore } from "../store/sprixStore";
import { ActionButton } from "./Primitives";
import { userRoutes } from "../navigation";
import { logoutConsumer } from "../services/sprixApi";

function Sidebar() {
  const location = useLocation();
  return (
    <aside className="sprix-sidebar">
      <Link to="/" className="mb-8 flex items-center gap-3 no-underline">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-pill text-white">
          <Bot size={20} />
        </div>
        <div>
          <div className="sprix-title text-2xl leading-none text-ink">Sprix AI</div>
          <div className="mt-1 text-xs text-ink-soft">Agent 任务平台</div>
        </div>
      </Link>
      <nav className="space-y-2">
        {userRoutes.map((route) => {
          const Icon = route.icon;
          const active =
            location.pathname === route.path ||
            (route.key === "market" && location.pathname === "/") ||
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

function UserTopBar({
  title,
  onOpenLogin,
  onOpenAccount,
  onOpenAgreements,
  onOpenContact
}: {
  title: string;
  onOpenLogin: () => void;
  onOpenAccount: () => void;
  onOpenAgreements: () => void;
  onOpenContact: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const account = useSprixStore((state) => state.account);
  const logout = useSprixStore((state) => state.logout);
  return (
    <header className="sprix-topbar">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">C 端用户站点</div>
        <h2 className="mt-1 text-xl font-semibold text-ink">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {account.isLoggedIn ? (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                {
                  key: "profile",
                  label: (
                    <div className="py-1">
                      <div className="font-semibold text-ink">{account.nickname}</div>
                      <div className="text-xs text-ink-soft">{account.email}</div>
                    </div>
                  ),
                  disabled: true
                },
                { key: "account", label: "账户信息", onClick: onOpenAccount },
                { key: "agreements", label: "相关协议", onClick: onOpenAgreements },
                { key: "contact", label: "联系我们", onClick: onOpenContact },
                {
                  key: "logout",
                  label: "退出登录",
                  icon: <LogOut size={15} />,
                  onClick: async () => {
                    try {
                      await logoutConsumer();
                      logout();
                      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
                      navigate("/agent/market");
                      message.success("已退出登录");
                    } catch (error) {
                      message.error(error instanceof Error ? `退出失败：${error.message}` : "退出失败");
                    }
                  }
                }
              ]
            }}
          >
            <button className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#e7f7f2] text-accent">
                <UserRound size={17} />
              </span>
              {account.nickname}
            </button>
          </Dropdown>
        ) : (
          <ActionButton onClick={onOpenLogin}>登录 / 注册</ActionButton>
        )}
      </div>
    </header>
  );
}

export function UserShell({
  title,
  children,
  onOpenLogin,
  onOpenAccount,
  onOpenAgreements,
  onOpenContact
}: {
  title: string;
  children: ReactNode;
  onOpenLogin: () => void;
  onOpenAccount: () => void;
  onOpenAgreements: () => void;
  onOpenContact: () => void;
}) {
  return (
    <div className="sprix-shell">
      <Sidebar />
      <main className="sprix-main">
        <div className="sprix-container">
          <UserTopBar
            title={title}
            onOpenLogin={onOpenLogin}
            onOpenAccount={onOpenAccount}
            onOpenAgreements={onOpenAgreements}
            onOpenContact={onOpenContact}
          />
          {children}
        </div>
      </main>
    </div>
  );
}
