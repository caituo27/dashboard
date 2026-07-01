import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, message } from "antd";
import { useSprixStore } from "../store/sprixStore";
import { updateRemoteAccountProfile } from "../services/sprixApi";
import { ActionButton } from "./Primitives";
import { showRequestError } from "./requestErrors";

export type AccountProfileEditMode = "avatar" | "nickname";

type ProfileFormValues = {
  nickname?: string;
  avatarUrl?: string;
};

type AccountProfileEditModalProps = {
  open: boolean;
  mode: AccountProfileEditMode | null;
  onClose: () => void;
};

export function AccountProfileEditModal({ open, mode, onClose }: AccountProfileEditModalProps) {
  const [form] = Form.useForm<ProfileFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const account = useSprixStore((state) => state.account);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      nickname: account.nickname,
      avatarUrl: account.avatarUrl
    });
  }, [account.avatarUrl, account.nickname, form, open]);

  const submit = async (values: ProfileFormValues) => {
    if (!mode) return;
    setSubmitting(true);
    try {
      const patch = await updateRemoteAccountProfile(
        mode === "avatar"
          ? { avatarUrl: values.avatarUrl?.trim() ?? "" }
          : { nickname: values.nickname?.trim() ?? "" }
      );
      mergeRemoteState({ account: patch });
      await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
      message.success(mode === "avatar" ? "头像已更新" : "昵称已更新");
      onClose();
    } catch (error) {
      if (error instanceof Error) {
        showRequestError(error, "账户资料保存失败", "账户资料保存失败：");
        return;
      }
      showRequestError(new Error("账户资料保存失败"), "账户资料保存失败", "账户资料保存失败：");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={mode === "avatar" ? "修改头像" : "修改昵称"} open={open} onCancel={onClose} footer={null} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={submit}>
        {mode === "avatar" ? (
          <Form.Item label="头像图片 URL" name="avatarUrl" rules={[{ type: "url", message: "请输入有效的图片 URL" }]}>
            <Input placeholder="https://cdn.example.com/avatar.png" />
          </Form.Item>
        ) : (
          <Form.Item label="昵称" name="nickname" rules={[{ required: true, message: "请输入昵称" }]}>
            <Input maxLength={100} placeholder="请输入昵称" />
          </Form.Item>
        )}
        <ActionButton htmlType="submit" loading={submitting}>保存</ActionButton>
      </Form>
    </Modal>
  );
}
