import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readAgentSnapshot } from "../services/sprixApi";
import { useSprixStore } from "../store/sprixStore";

export function useHomeBootstrap() {
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const setEvaluationFlow = useSprixStore((state) => state.setEvaluationFlow);
  const query = useQuery({
    queryKey: ["sprix-agent", "home-bootstrap"],
    queryFn: readAgentSnapshot,
    retry: 1,
    staleTime: 30_000,
    refetchInterval: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (query.data) {
      mergeRemoteState(query.data);
      if (query.data.activeEvaluationFlow) {
        setEvaluationFlow(query.data.activeEvaluationFlow);
      }
    }
  }, [mergeRemoteState, query.data, setEvaluationFlow]);

  return query;
}
