import { Dropdown } from "antd";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import type { Account } from "../types";

type HomeTopAccountProps = {
  account: Account;
  onLogout?: () => void;
};

export function HomeTopAccount({ account, onLogout }: HomeTopAccountProps) {
  if (!account.isLoggedIn || !onLogout) return null;

  return (
    <div className="sprix-landing-account">
      <Dropdown
        trigger={["click"]}
        placement="bottomRight"
        menu={{
          items: [
            {
              key: "account",
              label: (
                <div className="sprix-landing-account-summary">
                  <strong>{account.nickname || "我的账户"}</strong>
                  <span>{account.maskedPhone || "已登录"}</span>
                </div>
              ),
              disabled: true
            },
            { type: "divider" },
            {
              key: "logout",
              icon: <LogOut size={16} />,
              label: "退出登录",
              danger: true,
              onClick: onLogout
            }
          ]
        }}
      >
        <button
          className="sprix-landing-account-trigger"
          type="button"
          aria-label={`${account.nickname || "我的账户"}，打开账户菜单`}
        >
          <span className="sprix-landing-account-avatar" aria-hidden="true">
            {account.avatarUrl ? <img src={account.avatarUrl} alt="" width={30} height={30} /> : <UserRound size={16} />}
          </span>
          <span className="sprix-landing-account-label">{account.nickname || "我的账户"}</span>
          <ChevronDown className="sprix-landing-account-chevron" size={15} aria-hidden="true" />
        </button>
      </Dropdown>
    </div>
  );
}
