import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createInitialSprixState, logOut } from "./domain";
import type { EvaluationFlowState, SprixState } from "../types";

export type SprixRemoteStatePatch = Omit<Partial<SprixState>, "account" | "evaluationFlow"> & {
  account?: Partial<SprixState["account"]>;
  activeEvaluationFlow?: EvaluationFlowState;
};

function migratePersistedState(persistedState: unknown) {
  if (!persistedState || typeof persistedState !== "object") return persistedState;

  const state = persistedState as SprixState;
  const evaluationStatus = state.currentAgent?.evaluation?.status ?? state.currentAgent?.evaluation?.result?.status;
  if (evaluationStatus === "failed") {
    return {
      ...state,
      currentAgentId: null,
      currentAgent: undefined
    };
  }

  return state;
}

type SprixActions = {
  mergeRemoteState: (remoteState: SprixRemoteStatePatch) => void;
  setEvaluationFlow: (evaluationFlow: NonNullable<SprixState["evaluationFlow"]>) => void;
  clearEvaluationFlow: () => void;
  setRemoteSnapshotReady: (ready: boolean) => void;
  setSmartAcceptEnabled: (enabled: boolean) => void;
  logout: () => void;
};

export const useSprixStore = create<SprixState & SprixActions>()(
  persist(
    (set) => ({
      ...createInitialSprixState(),
      mergeRemoteState: (remoteState) =>
        set((state) => {
          const { activeEvaluationFlow: _activeEvaluationFlow, ...statePatch } = remoteState;
          const preserveLoggedInAccount = state.account.isLoggedIn && remoteState.account?.isLoggedIn === false;
          return {
            ...state,
            ...statePatch,
            account:
              preserveLoggedInAccount || !remoteState.account
                ? state.account
                : { ...state.account, ...remoteState.account }
          };
        }),
      setEvaluationFlow: (evaluationFlow) => set({ evaluationFlow }),
      clearEvaluationFlow: () => set({ evaluationFlow: undefined }),
      setRemoteSnapshotReady: (ready) => set({ remoteSnapshotReady: ready }),
      setSmartAcceptEnabled: (enabled) => set({ smartAcceptEnabled: enabled }),
      logout: () => set((state) => logOut(state))
    }),
    {
      name: "sprix-ai-state-v1",
      version: 3,
      migrate: migratePersistedState,
      partialize: (state) => {
        const { remoteSnapshotReady: _remoteSnapshotReady, ...persistedState } = state;
        return persistedState;
      }
    }
  )
);
