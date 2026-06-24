import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  acceptTask,
  approveWithdrawal,
  bindAlipay,
  completeQualification,
  connectAgent,
  createInitialSprixState,
  disconnectAgent,
  logIn,
  logOut,
  markPayoutSuccess,
  passAppeal,
  rejectAppeal,
  setCurrentAgent,
  startAppeal,
  submitAppeal,
  submitWithdrawal,
  terminateTask
} from "./domain";
import type { SprixState } from "../types";

type SprixActions = {
  resetDemo: () => void;
  login: () => void;
  logout: () => void;
  completeQualification: () => void;
  bindAlipay: (account?: string) => void;
  connectAgent: (agentId: string) => void;
  disconnectAgent: (agentId: string) => void;
  setCurrentAgent: (agentId: string) => void;
  acceptTask: (taskId: string) => void;
  terminateTask: (executionId: string) => void;
  submitAppeal: (executionId: string, reason: string) => void;
  startAppeal: (appealNo: string) => void;
  passAppeal: (appealNo: string) => void;
  rejectAppeal: (appealNo: string) => void;
  submitWithdrawal: (amount: number) => void;
  approveWithdrawal: (withdrawalNo: string) => void;
  markPayoutSuccess: (withdrawalNo: string) => void;
};

export const useSprixStore = create<SprixState & SprixActions>()(
  persist(
    (set) => ({
      ...createInitialSprixState(),
      resetDemo: () => set(createInitialSprixState()),
      login: () => set((state) => logIn(state)),
      logout: () => set((state) => logOut(state)),
      completeQualification: () => set((state) => completeQualification(state)),
      bindAlipay: (account) => set((state) => bindAlipay(state, account)),
      connectAgent: (agentId) => set((state) => connectAgent(state, agentId)),
      disconnectAgent: (agentId) => set((state) => disconnectAgent(state, agentId)),
      setCurrentAgent: (agentId) => set((state) => setCurrentAgent(state, agentId)),
      acceptTask: (taskId) => set((state) => acceptTask(state, taskId)),
      terminateTask: (executionId) => set((state) => terminateTask(state, executionId)),
      submitAppeal: (executionId, reason) => set((state) => submitAppeal(state, executionId, reason)),
      startAppeal: (appealNo) => set((state) => startAppeal(state, appealNo)),
      passAppeal: (appealNo) => set((state) => passAppeal(state, appealNo)),
      rejectAppeal: (appealNo) => set((state) => rejectAppeal(state, appealNo)),
      submitWithdrawal: (amount) => set((state) => submitWithdrawal(state, amount)),
      approveWithdrawal: (withdrawalNo) => set((state) => approveWithdrawal(state, withdrawalNo)),
      markPayoutSuccess: (withdrawalNo) => set((state) => markPayoutSuccess(state, withdrawalNo))
    }),
    {
      name: "sprix-ai-state-v1",
      version: 1
    }
  )
);
