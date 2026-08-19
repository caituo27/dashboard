import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import { readRemoteAgents } from "../services/sprixApi";
import { useSprixStore, type SprixRemoteStatePatch } from "../store/sprixStore";
import { showRequestError } from "../components/requestErrors";
import { shouldPollLocalAgentInventory } from "./localAgentInventory";

type UseAgentBindPollingOptions = {
  open: boolean;
};

type AgentBindPollingStartOptions = {
  announceCompletion?: boolean;
  minimumVisibleMs?: number;
};

const FAST_POLLING_INTERVAL_MS = 5000;
const SLOW_POLLING_INTERVAL_MS = 15_000;
const SLOW_POLLING_AFTER_MS = 60_000;
const MAX_POLLING_DURATION_MS = 120_000;

export function useAgentBindPolling({ open }: UseAgentBindPollingOptions) {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const queryClient = useQueryClient();
  const [recognizing, setRecognizing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [recognitionComplete, setRecognitionComplete] = useState(false);
  const [recognitionFailed, setRecognitionFailed] = useState(false);
  const [recognitionTimedOut, setRecognitionTimedOut] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedMsRef = useRef(0);
  const timerRef = useRef<number>();
  const delayedStopRef = useRef<number>();
  const deadlineTimerRef = useRef<number>();
  const runIdRef = useRef(0);
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
    if (deadlineTimerRef.current) {
      window.clearTimeout(deadlineTimerRef.current);
      deadlineTimerRef.current = undefined;
    }
    runIdRef.current += 1;
    pollingActiveRef.current = false;
    setRecognizing(false);
    setSyncing(false);
    setRecognitionComplete(false);
    setRecognitionFailed(false);
    setRecognitionTimedOut(false);
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

  const refreshOnce = useCallback(async (runId: number) => {
    try {
      const result = await readRemoteAgents();
      if (runId !== runIdRef.current || !pollingActiveRef.current) return undefined;
      const currentAgent = result.currentAgentId ? result.agents.find((agent) => agent.id === result.currentAgentId) : undefined;
      mergeRemoteState({
        agents: result.agents,
        localAgent: result.localAgent,
        currentAgentId: result.currentAgentId,
        currentAgent
      });
      queryClient.setQueryData<SprixRemoteStatePatch>(["sprix-agent", "home-bootstrap"], (previous) =>
        previous
          ? {
              ...previous,
              agents: result.agents,
              localAgent: result.localAgent,
              currentAgentId: result.currentAgentId,
              currentAgent
            }
          : previous
      );
      return result;
    } catch (error) {
      if (runId === runIdRef.current && pollingActiveRef.current) {
        showRequestError(error, "Agent 识别失败", "Agent 识别失败：");
      }
      return undefined;
    }
  }, [mergeRemoteState, queryClient]);

  const recognize = useCallback(async (runId: number) => {
    if (runId !== runIdRef.current || !pollingActiveRef.current) return;
    const result = await refreshOnce(runId);
    if (runId !== runIdRef.current || !pollingActiveRef.current) return;
    if (!result) {
      stop(false);
      setRecognitionComplete(true);
      setRecognitionFailed(true);
      return;
    }
    const hasDetectedAgents = result.agents.some((agent) => agent.status !== "离线");
    const inventorySyncPending = shouldPollLocalAgentInventory(result.localAgent?.inventoryStatus);
    if (hasDetectedAgents) {
      setSyncing(false);
      const remainingMs = minimumVisibleUntilRef.current - Date.now();
      if (remainingMs > 0) {
        delayedStopRef.current = window.setTimeout(() => {
          stop(true);
          setRecognitionComplete(true);
        }, remainingMs);
        return;
      }
      stop(true);
      setRecognitionComplete(true);
      return;
    }
    if (!inventorySyncPending) {
      setSyncing(false);
      stop(false);
      setRecognitionComplete(true);
      setRecognitionFailed(true);
    }
  }, [refreshOnce, stop]);

  const start = useCallback((options?: AgentBindPollingStartOptions) => {
    stop();
    const runId = runIdRef.current;
    const startedAt = Date.now();
    setRecognitionComplete(false);
    setRecognitionFailed(false);
    setRecognitionTimedOut(false);
    setSyncing(true);
    announceCompletionRef.current = options?.announceCompletion === true;
    minimumVisibleUntilRef.current = options?.minimumVisibleMs ? Date.now() + options.minimumVisibleMs : 0;
    pollingActiveRef.current = true;
    setRecognizing(true);
    elapsedMsRef.current = 0;
    deadlineTimerRef.current = window.setTimeout(() => {
      if (runId !== runIdRef.current || !pollingActiveRef.current) return;
      stop(false);
      setRecognitionComplete(true);
      setRecognitionTimedOut(true);
    }, MAX_POLLING_DURATION_MS);
    const scheduleNextPoll = (intervalMs: number) => {
      if (!pollingActiveRef.current || runId !== runIdRef.current) return;
      const remainingMs = MAX_POLLING_DURATION_MS - (Date.now() - startedAt);
      if (remainingMs <= 0) return;
      timerRef.current = window.setTimeout(async () => {
        timerRef.current = undefined;
        await recognize(runId);
        if (!pollingActiveRef.current || runId !== runIdRef.current) return;
        elapsedMsRef.current = Math.min(Date.now() - startedAt, MAX_POLLING_DURATION_MS);
        setElapsedMs(elapsedMsRef.current);
        const nextIntervalMs = elapsedMsRef.current >= SLOW_POLLING_AFTER_MS ? SLOW_POLLING_INTERVAL_MS : FAST_POLLING_INTERVAL_MS;
        scheduleNextPoll(nextIntervalMs);
      }, Math.min(intervalMs, remainingMs));
    };
    void (async () => {
      await recognize(runId);
      scheduleNextPoll(FAST_POLLING_INTERVAL_MS);
    })();
  }, [recognize, stop]);

  useEffect(() => {
    if (!open) {
      stop();
    }
    return stop;
  }, [open, stop]);

  return { recognizing, elapsedMs, syncing, recognitionComplete, recognitionFailed, recognitionTimedOut, recognize, start, stop };
}
