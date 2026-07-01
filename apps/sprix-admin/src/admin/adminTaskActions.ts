export type AdminTaskWriteAction = {
  kind: AdminTaskWriteActionKind;
  label: string;
  disabled?: boolean;
  reason?: string;
  danger?: true;
};

export type AdminTaskWriteActionKind = "publish" | "edit" | "offline" | "republish" | "delete";

export function getAdminTaskWriteAction(kind: AdminTaskWriteActionKind | string): AdminTaskWriteAction {
  if (kind === "publish") {
    return {
      kind: "publish",
      label: "发布任务"
    };
  }

  if (kind === "edit") {
    return {
      kind: "edit",
      label: "保存"
    };
  }

  if (kind === "offline") {
    return {
      kind: "offline",
      label: "下线"
    };
  }

  if (kind === "republish") {
    return {
      kind: "republish",
      label: "重新发布"
    };
  }

  return {
    kind: "delete",
    label: "删除",
    danger: true
  };
}
