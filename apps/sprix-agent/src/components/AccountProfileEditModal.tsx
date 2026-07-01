import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, Upload, message } from "antd";
import type { UploadFile, UploadProps } from "antd";
import { ImagePlus } from "lucide-react";
import { useSprixStore } from "../store/sprixStore";
import { uploadRemoteAccountAvatar } from "../services/accountAvatarApi";
import { updateRemoteAccountProfile } from "../services/sprixApi";
import type { Account } from "../types";
import { ActionButton } from "./Primitives";
import { showRequestError } from "./requestErrors";

export type AccountProfileEditMode = "avatar" | "nickname";

type ProfileFormValues = {
  nickname?: string;
};

type AccountProfileEditModalProps = {
  open: boolean;
  mode: AccountProfileEditMode | null;
  onClose: () => void;
};

const AVATAR_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function AccountProfileEditModal({ open, mode, onClose }: AccountProfileEditModalProps) {
  const [form] = Form.useForm<ProfileFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [avatarFiles, setAvatarFiles] = useState<UploadFile[]>([]);
  const avatarObjectUrlRef = useRef<string | null>(null);
  const account = useSprixStore((state) => state.account);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const queryClient = useQueryClient();

  const clearAvatarObjectUrl = useCallback(() => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    clearAvatarObjectUrl();
    form.setFieldsValue({
      nickname: account.nickname
    });
    setAvatarFiles(account.avatarUrl ? [{ uid: "current-avatar", name: "当前头像", status: "done", url: account.avatarUrl }] : []);
  }, [account.avatarUrl, account.nickname, clearAvatarObjectUrl, form, open]);

  useEffect(() => clearAvatarObjectUrl, [clearAvatarObjectUrl]);

  const handleAvatarBeforeUpload: UploadProps["beforeUpload"] = (file) => {
    if (!AVATAR_IMAGE_TYPES.has(file.type)) {
      message.error("请选择 JPG、PNG、WebP 或 GIF 图片");
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      message.error("头像图片不能超过 5MB");
      return Upload.LIST_IGNORE;
    }
    clearAvatarObjectUrl();
    const previewUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = previewUrl;
    setAvatarFiles([{ uid: file.uid, name: file.name, status: "done", url: previewUrl, originFileObj: file }]);
    return false;
  };

  const handleAvatarRemove: UploadProps["onRemove"] = () => {
    clearAvatarObjectUrl();
    setAvatarFiles([]);
    return true;
  };

  const submit = async (values: ProfileFormValues) => {
    if (!mode) return;
    setSubmitting(true);
    try {
      const patch = mode === "avatar"
        ? await uploadSelectedAvatar(avatarFiles)
        : await updateRemoteAccountProfile({ nickname: values.nickname?.trim() ?? "" });
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
          <Form.Item label="头像图片" required>
            <Upload
              accept="image/jpeg,image/png,image/webp,image/gif"
              beforeUpload={handleAvatarBeforeUpload}
              fileList={avatarFiles}
              listType="picture-card"
              maxCount={1}
              onRemove={handleAvatarRemove}
              showUploadList={{ showPreviewIcon: false }}
            >
              {avatarFiles.length >= 1 ? null : (
                <button className="flex flex-col items-center gap-2 text-ink-soft" type="button">
                  <ImagePlus size={22} />
                  <span>上传图片</span>
                </button>
              )}
            </Upload>
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

async function uploadSelectedAvatar(fileList: readonly UploadFile[]): Promise<Partial<Account>> {
  const file = fileList.find((item) => item.originFileObj)?.originFileObj ?? null;
  if (!file) {
    throw new Error("请先上传头像图片");
  }
  return uploadRemoteAccountAvatar(file);
}
