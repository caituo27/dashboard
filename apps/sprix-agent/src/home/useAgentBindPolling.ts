import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "antd";
import { readRemoteAgents } from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";
import { showRequestError } from "../components/requestErrors";
import type { LocalAgentDiagnostic } from "../types";

type UseAgentBindPollingOptions = {
  open: boolean;
  localAgent?: LocalAgentDiagnostic;
};

type AgentBindPollingStartOptions = {
  announceCompletion?: boolean;
  minimumVisibleMs?: number;
};

const FAST_POLLING_INTERVAL_MS = 5000;
const SLOW_POLLING_INTERVAL_MS = 15_000;
const SLOW_POLLING_AFTER_MS = 60_000;

export function useAgentBindPolling({ open }: UseAgentBindPollingOptions) {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const [recognizing, setRecognizing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedMsRef = useRef(0);
  const timerRef = useRef<number>();
  const delayedStopRef = useRef<number>();
  const pollingActiveRef = useRef(false);
  const announceCompletionRef = useRef(false);
  const minimumVisibleUntilRef = useRef(0);

  const stop = useCallback((announceCompletion = false) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (delayedStopRef.current) {
      window.clearTimeout(delayedStopRef.current);
      delayedStopRef.current = undefined;
    }
    pollingActiveRef.current = false;
    setRecognizing(false);
    elapsedMsRef.current = 0;
    setElapsedMs(0);
    minimumVisibleUntilRef.current = 0;
    if (announceCompletion && announceCompletionRef.current) {
      announceCompletionRef.current = false;
      message.success("检测完成，本地 Agent 可用");
      return;
    }
    announceCompletionRef.current = false;
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
      stop(false);
      return undefined;
    }
  }, [mergeRemoteState, stop]);

  const recognize = useCallback(async () => {
    const result = await refreshOnce();
    if (!result) return;
    const hasDetectedAgents = result.agents.length > 0;
    if (hasDetectedAgents) {
      const remainingMs = minimumVisibleUntilRef.current - Date.now();
      if (remainingMs > 0) {
        delayedStopRef.current = window.setTimeout(() => stop(true), remainingMs);
        return;
      }
      stop(true);
    }
  }, [refreshOnce, stop]);

  const start = useCallback((options?: AgentBindPollingStartOptions) => {
    stop();
    announceCompletionRef.current = options?.announceCompletion === true;
    minimumVisibleUntilRef.current = options?.minimumVisibleMs ? Date.now() + options.minimumVisibleMs : 0;
    elapsedMsRef.current = 0;
    pollingActiveRef.current = true;
    setRecognizing(true);
    const scheduleNextPoll = (intervalMs: number) => {
      if (!pollingActiveRef.current) return;
      timerRef.current = window.setTimeout(async () => {
        timerRef.current = undefined;
        await recognize();
        if (!pollingActiveRef.current) return;
        elapsedMsRef.current += intervalMs;
        setElapsedMs(elapsedMsRef.current);
        const nextIntervalMs = elapsedMsRef.current >= SLOW_POLLING_AFTER_MS ? SLOW_POLLING_INTERVAL_MS : FAST_POLLING_INTERVAL_MS;
        scheduleNextPoll(nextIntervalMs);
      }, intervalMs);
    };
    void (async () => {
      await recognize();
      scheduleNextPoll(FAST_POLLING_INTERVAL_MS);
    })();
  }, [recognize, stop]);

  useEffect(() => {
    if (!open) {
      stop();
    }
    return stop;
  }, [open, stop]);

  return { recognizing, elapsedMs, recognize, start, stop };
}
