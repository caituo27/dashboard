import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readAgentSnapshot } from "./sprixApi";
import { useSprixStore } from "../store/sprixStore";

export function useRemoteSprixBootstrap(enabled = true) {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const setEvaluationFlow = useSprixStore((state) => state.setEvaluationFlow);
  const setRemoteSnapshotReady = useSprixStore((state) => state.setRemoteSnapshotReady);
  const snapshotQuery = useQuery({
    queryKey: ["sprix-agent", "snapshot"],
    queryFn: readAgentSnapshot,
    enabled,
    retry: 1,
    staleTime: 10_000,
    refetchInterval: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    setRemoteSnapshotReady(enabled && snapshotQuery.isFetched && !snapshotQuery.isFetching);
  }, [enabled, setRemoteSnapshotReady, snapshotQuery.isFetched, snapshotQuery.isFetching]);

  useEffect(() => {
    if (enabled && snapshotQuery.data) {
      mergeRemoteState(snapshotQuery.data);
      if (snapshotQuery.data.activeEvaluationFlow) {
        setEvaluationFlow(snapshotQuery.data.activeEvaluationFlow);
      }
    }
  }, [enabled, mergeRemoteState, setEvaluationFlow, snapshotQuery.data]);

  return snapshotQuery;
}
