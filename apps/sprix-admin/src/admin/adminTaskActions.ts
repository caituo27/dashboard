export type AdminTaskWriteAction = {
  label: string;
  disabled: true;
  reason: string;
  danger?: true;
};

type AdminTaskWriteActionKind = "publish" | "edit" | "offline" | "republish" | "delete";

export function getAdminTaskWriteAction(kind: AdminTaskWriteActionKind | string): AdminTaskWriteAction {
  if (kind === "publish") {
    return {
      label: "发布任务（待接口）",
      disabled: true,
      reason: "后台任务发布接口待正式接入，当前 Swagger 仅提供任务查询接口"
    };
  }

  if (kind === "edit") {
    return {
      label: "保存修改（待接口）",
      disabled: true,
      reason: "后台任务编辑接口待正式接入，前端不调用未确认写入路径"
    };
  }

  if (kind === "offline") {
    return {
      label: "下线（待接口）",
      disabled: true,
      reason: "后台任务下线接口待正式接入，前端不调用未确认写入路径"
    };
  }

  if (kind === "republish") {
    return {
      label: "重新发布（待接口）",
      disabled: true,
      reason: "后台任务重新发布接口待正式接入，前端不调用未确认写入路径"
    };
  }

  return {
    label: "删除（待接口）",
    disabled: true,
    reason: "后台任务删除接口待正式接入，前端不调用未确认写入路径",
    danger: true
  };
}
