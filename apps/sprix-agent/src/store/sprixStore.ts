import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createInitialSprixState, logOut } from "./domain";
import type { SprixState } from "../types";

export type SprixRemoteStatePatch = Omit<Partial<SprixState>, "account"> & {
  account?: Partial<SprixState["account"]>;
};

type SprixActions = {
  mergeRemoteState: (remoteState: SprixRemoteStatePatch) => void;
  setSmartAcceptEnabled: (enabled: boolean) => void;
  logout: () => void;
};

export const useSprixStore = create<SprixState & SprixActions>()(
  persist(
    (set) => ({
      ...createInitialSprixState(),
      mergeRemoteState: (remoteState) =>
        set((state) => ({
          ...state,
          ...remoteState,
          account: remoteState.account ? { ...state.account, ...remoteState.account } : state.account
        })),
      setSmartAcceptEnabled: (enabled) => set({ smartAcceptEnabled: enabled }),
      logout: () => set((state) => logOut(state))
    }),
    {
      name: "sprix-ai-state-v1",
      version: 2
    }
  )
);
