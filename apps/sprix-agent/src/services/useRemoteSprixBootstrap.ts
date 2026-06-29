import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readAgentSnapshot } from "./sprixApi";
import { useSprixStore } from "../store/sprixStore";
import { getConnectedAgent } from "../user/admission";

export function useRemoteSprixBootstrap() {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const shouldPollForLocalAgent = account.isLoggedIn && !getConnectedAgent(agents);
  const snapshotQuery = useQuery({
    queryKey: ["sprix-agent", "snapshot"],
    queryFn: readAgentSnapshot,
    retry: 1,
    staleTime: shouldPollForLocalAgent ? 0 : 10_000,
    refetchInterval: shouldPollForLocalAgent ? 3_000 : false,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always"
  });

  useEffect(() => {
    if (snapshotQuery.data) {
      mergeRemoteState(snapshotQuery.data);
    }
  }, [mergeRemoteState, snapshotQuery.data]);

  return snapshotQuery;
}
