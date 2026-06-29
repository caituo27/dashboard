import { SecondaryButton } from "../components/Primitives";
import type { Account } from "../types";

type HomeTopAccountProps = {
  account: Account;
  onLogout?: () => void;
};

export function HomeTopAccount({ account, onLogout }: HomeTopAccountProps) {
  if (!account.isLoggedIn || !onLogout) return null;

  return (
    <div className="sprix-landing-account">
      <SecondaryButton onClick={onLogout}>退出登录</SecondaryButton>
    </div>
  );
}
