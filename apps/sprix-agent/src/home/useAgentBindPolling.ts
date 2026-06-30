import { useCallback, useEffect, useRef, useState } from "react";
import { readRemoteAgents } from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";
import { showRequestError } from "../components/requestErrors";
import type { LocalAgentDiagnostic } from "../types";
import { shouldPollLocalAgentInventory } from "./localAgentInventory";

type UseAgentBindPollingOptions = {
  open: boolean;
  localAgent?: LocalAgentDiagnostic;
};

export function useAgentBindPolling({ open, localAgent }: UseAgentBindPollingOptions) {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const [recognizing, setRecognizing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<number>();

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    setRecognizing(false);
    setElapsedMs(0);
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
      stop();
    }
  }, [refreshOnce, stop]);

  const start = useCallback(() => {
    stop();
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

  useEffect(() => {
    if (!open || recognizing || !shouldPollLocalAgentInventory(localAgent?.inventoryStatus)) return;
    start();
  }, [localAgent?.inventoryStatus, open, recognizing, start]);

  return { recognizing, elapsedMs, recognize, start, stop };
}
