import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal, message } from "antd";
import { readAgentSnapshot } from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";
import { AuthTabs } from "./AuthTabs";
import type { AuthTabKey } from "./authTypes";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onLoginSuccess?: () => void;
};

export function AuthModal({ open, onClose, onLoginSuccess }: AuthModalProps) {
  const queryClient = useQueryClient();
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const [activeTab, setActiveTab] = useState<AuthTabKey>("alipay");
  const [authSessionKey, setAuthSessionKey] = useState(0);

  const completeLogin = useCallback(async () => {
    const remoteState = await readAgentSnapshot();
    if (remoteState.account?.isLoggedIn !== true) {
      throw new Error("登录未完成，请重新登录");
    }
    await Promise.all([
      queryClient.cancelQueries({ queryKey: ["sprix-agent", "home-bootstrap"] }),
      queryClient.cancelQueries({ queryKey: ["sprix-agent", "snapshot"] })
    ]);
    queryClient.setQueryData(["sprix-agent", "home-bootstrap"], remoteState);
    queryClient.setQueryData(["sprix-agent", "snapshot"], remoteState);
    mergeRemoteState(remoteState);
    message.success("成功");
    onClose();
    try {
      onLoginSuccess?.();
    } catch {
      // 登录已经成功，后续跳转失败不影响登录态。
    }
  }, [mergeRemoteState, onClose, onLoginSuccess, queryClient]);

  useEffect(() => {
    if (open) {
      setAuthSessionKey((value) => value + 1);
    }
    if (!open) {
      setActiveTab("alipay");
    }
  }, [open]);

  return (
    <Modal title="登录 / 注册" open={open} onCancel={onClose} footer={null} width={520}>
      {open && <AuthTabs key={authSessionKey} activeKey={activeTab} onChange={setActiveTab} onAuthenticated={completeLogin} />}
    </Modal>
  );
}
