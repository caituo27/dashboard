import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readAgentSnapshot } from "./sprixApi";
import { useSprixStore } from "../store/sprixStore";

export function useRemoteSprixBootstrap() {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const snapshotQuery = useQuery({
    queryKey: ["sprix-agent", "snapshot"],
    queryFn: readAgentSnapshot,
    retry: 1,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (snapshotQuery.data) {
      mergeRemoteState(snapshotQuery.data);
    }
  }, [mergeRemoteState, snapshotQuery.data]);

  return snapshotQuery;
}
