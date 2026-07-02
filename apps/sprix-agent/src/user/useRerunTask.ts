import { useCallback } from "react";
import { Modal, message } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { rerunRemoteTask } from "../services/sprixApi";
import { isGlobalAuthError } from "../utils/http";

export function useRerunTask() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useCallback(
    (executionId: string) => {
      Modal.confirm({
        title: "确认重新执行",
        content: "重新执行会基于当前执行 Agent 创建新的执行记录，原执行记录会保留。",
        okText: "确认重新执行",
        cancelText: "取消",
        onOk: async () => {
          try {
            const execution = await rerunRemoteTask(executionId);
            await queryClient.invalidateQueries({ queryKey: ["sprix-agent"] });
            message.success("已重新生成执行记录");
            if (execution.id) {
              navigate(`/agent/my-tasks/${execution.id}`);
            }
          } catch (error) {
            if (isGlobalAuthError(error)) return;
            message.error(error instanceof Error ? `重新执行失败：${error.message}` : "重新执行失败");
          }
        }
      });
    },
    [navigate, queryClient]
  );
}
