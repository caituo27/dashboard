import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readAdminSnapshot } from "./sprixApi";
import { useSprixStore } from "../store/sprixStore";

export function useRemoteSprixBootstrap() {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const snapshotQuery = useQuery({
    queryKey: ["sprix-admin", "snapshot"],
    queryFn: readAdminSnapshot,
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
