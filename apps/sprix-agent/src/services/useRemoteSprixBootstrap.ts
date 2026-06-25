import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readAgentSnapshot } from "./sprixApi";
import { useSprixStore } from "../store/sprixStore";

export function useRemoteSprixBootstrap() {
  const isLoggedIn = useSprixStore((state) => state.account.isLoggedIn);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const snapshotQuery = useQuery({
    queryKey: ["sprix-agent", "snapshot", isLoggedIn],
    queryFn: readAgentSnapshot,
    retry: 1,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (snapshotQuery.data) {
      mergeRemoteState(snapshotQuery.data);
    }
  }, [mergeRemoteState, snapshotQuery.data]);

  return snapshotQuery;
}
