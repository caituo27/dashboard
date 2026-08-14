import type { ReactNode } from "react";
import { Dropdown, message } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useSprixStore } from "../store/sprixStore";
import { ActionButton } from "./Primitives";
import { userRoutes } from "../navigation";
import { logoutConsumer } from "../services/sprixApi";
import { isGlobalAuthError } from "../utils/http";
import { LOCAL_AGENT_DOWNLOAD_URL } from "../localAgentDownload";

function Sidebar({
  onOpenLogin,
  onOpenAccount,
  onOpenAgreements,
  onOpenContact
}: {
  onOpenLogin: () => void;
  onOpenAccount: () => void;
  onOpenAgreements: () => void;
  onOpenContact: () => void;
}) {
  const location = useLocation();
  return (
    <aside className="sprix-sidebar">
      <Link to="/" className="mb-8 block no-underline">
        <img
          src="/sprix-logo.png"
          alt="Sprix AI Agent 任务平台"
          className="block h-auto w-[156px] max-w-full"
        />
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
              className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium no-underline transition ${
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
      <UserMenu
        onOpenLogin={onOpenLogin}
        onOpenAccount={onOpenAccount}
        onOpenAgreements={onOpenAgreements}
        onOpenContact={onOpenContact}
      />
    </aside>
  );
}

function UserMenu({
  onOpenLogin,
  onOpenAccount,
  onOpenAgreements,
  onOpenContact
}: {
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
    <div className="sprix-sidebar-user">
      <div className="flex w-full min-w-0 items-center gap-2">
        {account.isLoggedIn ? (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                {
                  key: "profile",
                  label: (
                    <div className="max-w-[220px] py-1">
                      <div className="truncate font-semibold text-ink" title={account.nickname}>{account.nickname}</div>
                      <div className="truncate text-xs text-ink-soft" title={account.maskedPhone || "手机号未绑定"}>{account.maskedPhone || "手机号未绑定"}</div>
                    </div>
                  ),
                  disabled: true
                },
                { key: "account", label: "账户信息", onClick: onOpenAccount },
                { key: "agreements", label: "相关协议", onClick: onOpenAgreements },
                { key: "contact", label: "联系我们", onClick: onOpenContact },
                {
                  key: "clientUpdate",
                  label: (
                    <a href={LOCAL_AGENT_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                      下载插件
                    </a>
                  )
                },
                {
                  key: "logout",
                  label: "退出登录",
                  onClick: async () => {
                    try {
                      await logoutConsumer();
                    } catch (error) {
                      if (isGlobalAuthError(error)) return;
                    } finally {
                      logout();
                      queryClient.removeQueries({ queryKey: ["sprix-agent"] });
                      navigate("/");
                      message.success("已退出登录");
                    }
                  }
                }
              ]
            }}
          >
            <button className="sprix-sidebar-user-button" title={account.nickname}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e7f7f2] text-accent">
                {account.avatarUrl ? (
                  <img src={account.avatarUrl} alt="" className="size-full rounded-full object-cover" />
                ) : (
                  <UserRound size={17} />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{account.nickname}</span>
            </button>
          </Dropdown>
        ) : (
          <ActionButton className="w-full justify-center" onClick={onOpenLogin}>登录 / 注册</ActionButton>
        )}
      </div>
    </div>
  );
}

export function UserShell({
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
      <Sidebar
        onOpenLogin={onOpenLogin}
        onOpenAccount={onOpenAccount}
        onOpenAgreements={onOpenAgreements}
        onOpenContact={onOpenContact}
      />
      <main className="sprix-main">
        <div className="sprix-container">
          {children}
        </div>
      </main>
    </div>
  );
}
