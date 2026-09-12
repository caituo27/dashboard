import {consumerMockEnabled} from "./consumerMock";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readAgentSnapshot } from "./sprixApi";
import { useSprixStore } from "../store/sprixStore";
import { isCurrentAgentExecutionAvailable } from "../user/admission";

export function useRemoteSprixBootstrap(enabled = true) {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const setEvaluationFlow = useSprixStore((state) => state.setEvaluationFlow);
  const evaluationFlow = useSprixStore((state) => state.evaluationFlow);
  const clearEvaluationFlow = useSprixStore((state) => state.clearEvaluationFlow);
  const setRemoteSnapshotReady = useSprixStore((state) => state.setRemoteSnapshotReady);
  const snapshotQuery = useQuery({
    queryKey: ["sprix-agent", "snapshot"],
    queryFn: readAgentSnapshot,
    enabled,
    retry: 1,
    staleTime: 10_000,
    refetchInterval: consumerMockEnabled ? 5_000 : false,
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    setRemoteSnapshotReady(enabled && snapshotQuery.isFetched);
  }, [enabled, setRemoteSnapshotReady, snapshotQuery.isFetched]);

  useEffect(() => {
    if (enabled && snapshotQuery.data) {
      mergeRemoteState(snapshotQuery.data);
      if (snapshotQuery.data.activeEvaluationFlow) {
        setEvaluationFlow(snapshotQuery.data.activeEvaluationFlow);
      }
    }
  }, [enabled, mergeRemoteState, setEvaluationFlow, snapshotQuery.data]);

  useEffect(() => {
    const remoteCurrentAgent = snapshotQuery.data?.currentAgent;
    const remoteEvaluationId = remoteCurrentAgent?.evaluation?.evaluationId;
    if (
      evaluationFlow?.status === "failed" &&
      evaluationFlow.agentId === remoteCurrentAgent?.id &&
      evaluationFlow.evaluationId === remoteEvaluationId &&
      isCurrentAgentExecutionAvailable(remoteCurrentAgent)
    ) {
      clearEvaluationFlow();
    }
  }, [clearEvaluationFlow, evaluationFlow, snapshotQuery.data?.currentAgent]);

  return snapshotQuery;
}
