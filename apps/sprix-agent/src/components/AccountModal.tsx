import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal, message } from "antd";
import {
  ChevronRight,
  CreditCard,
  ImagePlus,
  PencilLine,
  ShieldCheck,
  Smartphone,
  UserRound
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSprixStore } from "../store/sprixStore";
import { cancelRemoteAccount, readRemoteWithdrawalAccountState } from "../services/sprixApi";
import { hasBoundPayoutAccount } from "../user/accountView";
import { SecondaryButton, StatusTag } from "./Primitives";
import { showRequestError } from "./requestErrors";
import { AccountPhoneChangeModal } from "./AccountPhoneChangeModal";
import { AccountProfileEditModal, type AccountProfileEditMode } from "./AccountProfileEditModal";

const maxAlipayAccountTextLength = 15;

type AccountModalProps = {
  open: boolean;
  onClose: () => void;
  onBindAlipay: () => void;
  onOpenQualification: () => void;
};

export function AccountModal({
  open,
  onClose,
  onBindAlipay,
  onOpenQualification
}: AccountModalProps) {
  const account = useSprixStore((state) => state.account);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const logout = useSprixStore((state) => state.logout);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [profileMode, setProfileMode] = useState<AccountProfileEditMode | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const payoutAccountBound = hasBoundPayoutAccount(account);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    readRemoteWithdrawalAccountState()
      .then((accountPatch) => {
        if (!cancelled) mergeRemoteState({ account: accountPatch });
      })
      .catch(() => {
        // Account details remain usable when the payout account endpoint is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [mergeRemoteState, open]);

  const cancelAccount = () => {
    confirmCancelAccount(logout, queryClient, navigate, onClose);
  };

  const openQualification = () => {
    onClose();
    onOpenQualification();
  };

  const viewQualificationRecords = () => {
    onClose();
    navigate("/agent/qualification");
  };

  const handleQualificationAction = () => {
    if (account.qualificationStatus === "已开通") {
      viewQualificationRecords();
      return;
    }
    openQualification();
  };

  return (
    <>
      <Modal
        title="账户信息"
        open={open}
        onCancel={onClose}
        footer={null}
        width={640}
      >
        <div className="text-sm">
          <div className="grid gap-3">
            <AccountSettingRow
              icon={<ImagePlus aria-hidden="true" />}
              label="修改头像"
              value={
                account.avatarUrl ? (
                  <img
                    src={account.avatarUrl}
                    alt=""
                    className="size-11 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-11 place-items-center rounded-full bg-[#f5f5f3] text-ink-soft">
                    <UserRound aria-hidden="true" size={20} strokeWidth={1.7} />
                  </span>
                )
              }
              onClick={() => setProfileMode("avatar")}
            />
            <AccountSettingRow
              icon={<PencilLine aria-hidden="true" />}
              label="修改昵称"
              value={account.nickname || "未设置"}
              onClick={() => setProfileMode("nickname")}
            />
            <AccountSettingRow
              icon={<Smartphone aria-hidden="true" />}
              label="绑定手机号"
              value={account.maskedPhone || "未绑定"}
              onClick={() => setPhoneOpen(true)}
            />
            <AccountSettingRow
              icon={<ShieldCheck aria-hidden="true" />}
              label="接单资格"
              description="查看认证状态和历史记录"
              value={<StatusTag status={account.qualificationStatus} />}
              onClick={handleQualificationAction}
            />
            <AccountSettingRow
              icon={<CreditCard aria-hidden="true" />}
              label="收款支付宝"
              description={payoutAccountBound ? "当前收款账户" : "绑定后用于任务结算收款"}
              value={
                payoutAccountBound ? (
                  <span title={account.alipayAccountMasked || undefined}>
                    {formatAlipayAccountText(account.alipayAccountMasked)}
                  </span>
                ) : (
                  "未绑定"
                )
              }
              onClick={payoutAccountBound ? undefined : onBindAlipay}
            />
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-ink">注销账户</div>
              <div className="mt-1 text-xs text-ink-soft">
                注销后将退出登录，且无法恢复账户数据
              </div>
            </div>
            <SecondaryButton size="small" danger onClick={cancelAccount}>
              注销账户
            </SecondaryButton>
          </div>
        </div>
      </Modal>
      <AccountProfileEditModal
        open={profileMode !== null}
        mode={profileMode}
        onClose={() => setProfileMode(null)}
      />
      <AccountPhoneChangeModal
        open={phoneOpen}
        onClose={() => setPhoneOpen(false)}
      />
    </>
  );
}

function formatAlipayAccountText(value?: string) {
  if (!value) return "已绑定";
  return Array.from(value).slice(0, maxAlipayAccountTextLength).join("");
}

function AccountSettingRow({
  icon,
  label,
  description,
  value,
  onClick
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  value?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className="group grid min-h-[76px] w-full grid-cols-[40px_minmax(0,1fr)_auto_18px] items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left text-inherit transition-[border-color,background-color,box-shadow] enabled:cursor-pointer enabled:hover:border-[#d8dad9] enabled:hover:bg-[#fcfcfb] enabled:hover:shadow-[0_8px_24px_rgba(20,24,25,0.05)] disabled:cursor-default"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-[#f5f5f3] text-ink-soft [&>svg]:size-[19px] [&>svg]:stroke-[1.8]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs text-ink-soft">{description}</span>
        ) : null}
      </span>
      {value ? (
        <span className="flex max-w-[190px] items-center justify-end truncate text-right text-xs font-medium text-ink-soft sm:text-sm">
          {value}
        </span>
      ) : null}
      <ChevronRight
        aria-hidden="true"
        className={onClick ? "text-[#a7aaa9]" : "invisible"}
        size={18}
        strokeWidth={1.8}
      />
    </button>
  );
}

function confirmCancelAccount(
  logout: () => void,
  queryClient: ReturnType<typeof useQueryClient>,
  navigate: ReturnType<typeof useNavigate>,
  onClose: () => void
) {
  Modal.confirm({
    title: "注销账户",
    content: "注销后将退出登录，并清除当前账号的登录身份和收款账户绑定。该操作不可撤销。",
    okText: "确认注销",
    cancelText: "取消",
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await cancelRemoteAccount();
        logout();
        queryClient.removeQueries({ queryKey: ["sprix-agent"] });
        onClose();
        navigate("/");
        message.success("账户已注销");
      } catch (error) {
        if (error instanceof Error) {
          showRequestError(error, "账户注销失败", "账户注销失败：");
          return;
        }
        showRequestError(new Error("账户注销失败"), "账户注销失败", "账户注销失败：");
      }
    }
  });
}
