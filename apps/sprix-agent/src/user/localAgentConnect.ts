export type LocalAgentHealthResult =
  | {
      kind: "running";
      version: string;
    }
  | {
      kind: "unavailable";
    };

export const LOCAL_AGENT_HEALTH_URL = import.meta.env.VITE_LOCAL_AGENT_HEALTH_URL ?? "http://127.0.0.1:38765/health";

export async function checkLocalAgentHealth(fetcher: typeof fetch = fetch, healthUrl = LOCAL_AGENT_HEALTH_URL): Promise<LocalAgentHealthResult> {
  try {
    const response = await fetcher(healthUrl, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) return { kind: "unavailable" };

    const payload = (await response.json()) as { status?: string; version?: string };
    if (payload.status === "ok") {
      return {
        kind: "running",
        version: payload.version ?? ""
      };
    }
  } catch {
    return { kind: "unavailable" };
  }

  return { kind: "unavailable" };
}
