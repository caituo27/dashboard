import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useSprixStore } from "../store/sprixStore";
import { cancelRemoteAccount, readRemoteWithdrawalAccountState } from "../services/sprixApi";
import { getAccountEditActions, getAccountProfileRows, hasBoundPayoutAccount, type AccountEditAction } from "../user/accountView";
import { ActionButton, SecondaryButton, StatusTag } from "./Primitives";
import { showRequestError } from "./requestErrors";
import { AccountPhoneChangeModal } from "./AccountPhoneChangeModal";
import { AccountProfileEditModal, type AccountProfileEditMode } from "./AccountProfileEditModal";

const maxAlipayAccountTextLength = 15;

const accountActionRowClassName = [
  "flex flex-col gap-2 rounded-2xl border border-line bg-white px-3 py-3",
  "sm:flex-row sm:items-center sm:justify-between"
].join(" ");

const accountInfoRowClassName = [
  "grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-[#fafafa] px-4 py-3",
  "sm:grid-cols-[112px_minmax(0,1fr)]"
].join(" ");

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
  const profileRows = getAccountProfileRows(account);
  const editActions = getAccountEditActions();
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

  const runAction = (action: AccountEditAction) => {
    if (action.key === "avatar" || action.key === "nickname") {
      setProfileMode(action.key);
      return;
    }
    if (action.key === "phone") {
      setPhoneOpen(true);
      return;
    }
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
        footer={<ActionButton onClick={onClose}>关闭</ActionButton>}
        width={620}
      >
        <div className="grid gap-3 text-sm">
          <InfoRow
            label="头像"
            value={
              account.avatarUrl ? (
                <img
                  src={account.avatarUrl}
                  alt=""
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                "-"
              )
            }
          />
          {profileRows.map((row) => (
            <InfoRow
              key={row.label}
              label={row.label}
              value={
                row.label === "接单资格" ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {account.qualificationStatus === "已开通" ? (
                      <StatusTag status={row.value} />
                    ) : (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer border-0 bg-transparent p-0"
                        onClick={openQualification}
                        aria-label={`${row.value}，开通接单资格`}
                      >
                        <StatusTag status={row.value} />
                      </button>
                    )}
                    <SecondaryButton
                      size="small"
                      onClick={handleQualificationAction}
                    >
                      {row.value === "已开通" ? "查看记录" : "去开通"}
                    </SecondaryButton>
                  </div>
                ) : (
                  row.value
                )
              }
            />
          ))}
          <InfoRow
            label="收款支付宝"
            value={
              payoutAccountBound ? (
                <span title={account.alipayAccountMasked || undefined}>
                  {formatAlipayAccountText(account.alipayAccountMasked)}
                </span>
              ) : (
                <SecondaryButton size="small" onClick={onBindAlipay}>
                  绑定支付宝
                </SecondaryButton>
              )
            }
          />
          <div className="mt-2 grid gap-2 rounded-2xl bg-[#fafafa] p-3">
            {editActions.map((action) => (
              <div
                key={action.key}
                className={accountActionRowClassName}
              >
                <div>
                  <div className="font-medium text-ink">{action.label}</div>
                  <div className="mt-1 text-xs text-ink-soft">{action.description}</div>
                </div>
                <SecondaryButton
                  size="small"
                  danger={action.danger}
                  onClick={() => runAction(action)}
                >
                  {action.buttonLabel}
                </SecondaryButton>
              </div>
            ))}
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={accountInfoRowClassName}>
      <span className="text-ink-soft">{label}</span>
      <div className="min-w-0 justify-self-end break-words text-right font-medium text-ink [overflow-wrap:anywhere]">{value}</div>
    </div>
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
