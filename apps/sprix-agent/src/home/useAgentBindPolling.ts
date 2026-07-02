import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "antd";
import { readRemoteAgents } from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";
import { showRequestError } from "../components/requestErrors";
import type { LocalAgentDiagnostic } from "../types";
import { shouldPollLocalAgentInventory } from "./localAgentInventory";

type UseAgentBindPollingOptions = {
  open: boolean;
  localAgent?: LocalAgentDiagnostic;
};

type AgentBindPollingStartOptions = {
  announceCompletion?: boolean;
  minimumVisibleMs?: number;
};

export function useAgentBindPolling({ open }: UseAgentBindPollingOptions) {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const [recognizing, setRecognizing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<number>();
  const announceCompletionRef = useRef(false);
  const minimumVisibleUntilRef = useRef(0);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    setRecognizing(false);
    setElapsedMs(0);
    minimumVisibleUntilRef.current = 0;
    if (announceCompletionRef.current) {
      announceCompletionRef.current = false;
      message.success("检测完成，本地 Agent 可用");
    }
  }, []);

  const refreshOnce = useCallback(async () => {
    try {
      const result = await readRemoteAgents();
      mergeRemoteState({
        agents: result.agents,
        localAgent: result.localAgent,
        currentAgentId: result.currentAgentId
      });
      return result;
    } catch (error) {
      showRequestError(error, "Agent 识别失败", "Agent 识别失败：");
      return { agents: [], localAgent: undefined, currentAgentId: null };
    }
  }, [mergeRemoteState]);

  const recognize = useCallback(async () => {
    const result = await refreshOnce();
    if (result.agents.length > 0 || !shouldPollLocalAgentInventory(result.localAgent?.inventoryStatus)) {
      const remainingMs = minimumVisibleUntilRef.current - Date.now();
      if (remainingMs > 0) {
        window.setTimeout(stop, remainingMs);
        return;
      }
      stop();
    }
  }, [refreshOnce, stop]);

  const start = useCallback((options?: AgentBindPollingStartOptions) => {
    stop();
    announceCompletionRef.current = options?.announceCompletion === true;
    minimumVisibleUntilRef.current = options?.minimumVisibleMs ? Date.now() + options.minimumVisibleMs : 0;
    setRecognizing(true);
    void recognize();
    timerRef.current = window.setInterval(() => {
      setElapsedMs((value) => {
        const nextValue = value + 3000;
        if (nextValue >= 60_000) {
          stop();
          return 60_000;
        }
        void recognize();
        return nextValue;
      });
    }, 3000);
  }, [recognize, stop]);

  useEffect(() => {
    if (!open) {
      stop();
    }
    return stop;
  }, [open, stop]);

  return { recognizing, elapsedMs, recognize, start, stop };
}
