import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, message } from "antd";
import { ArrowRight } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { Agent, AgentEvaluation } from "../types";
import { useSprixStore, type SprixRemoteStatePatch } from "../store/sprixStore";
import {
  markRemoteCurrentAgent,
  readCurrentRemoteAgent,
  readLatestRemoteAgentEvaluation,
  readRemoteAgentEvaluation,
  readRemoteAgents,
  requestRemoteAgentLogin,
  startRemoteAgentEvaluation,
  waitForRemoteAgentAuthentication
} from "../services/sprixApi";
import { isGlobalAuthError, isLocalAgentBindingInvalidError } from "../utils/http";
import { AgentEvaluationProgressModal } from "../components/AgentEvaluationProgressModal";
import { AgentBindingInvalidModal } from "../components/AgentBindingInvalidModal";
import { ActionButton } from "../components/Primitives";
import { AgentAbilityProfile } from "../user/AgentAbilityProfile";
import { isAgentLoginRequired } from "../utils/agentStatus";
import { useAgentBindPolling } from "./useAgentBindPolling";
import { useHomeBootstrap } from "./useHomeBootstrap";
import { useHomeAgentState } from "./useHomeAgentState";
import { HomeAgentCard } from "./HomeAgentCard";
import { HomeAgentEntry } from "./HomeAgentEntry";
import { HomeAgentPickerModal } from "./HomeAgentPickerModal";
import { HomeHero } from "./HomeHero";
import { HomeStats } from "./HomeStats";
import { HomeTopAccount } from "./HomeTopAccount";
import { checkLocalAgentHealth } from "../user/localAgentConnect";
import { isEvaluationModalDismissed, setEvaluationModalDismissed } from "../user/evaluationModalState";

type HomePageProps = {
  openLogin: () => void;
  openContact?: () => void;
  openAbout?: () => void;
  onLogout?: () => void;
};

const ICP_RECORD_NO = import.meta.env.VITE_ICP_RECORD_NO ?? "粤ICP备2025376732号-5";
const PUBLIC_SECURITY_RECORD_NO = "粤公网安备44030002015291号";
const PUBLIC_SECURITY_RECORD_URL = "https://beian.mps.gov.cn/#/query/webSearch?code=44030002015291";
const AGENT_SETUP_FLOW_STORAGE_KEY = "sprix-agent-setup-flow-active";
const CONNECT_MODAL_DISMISSED_STORAGE_KEY = "sprix-connect-agent-dismissed-account";
const AGENT_PICKER_DISMISSED_STORAGE_KEY = "sprix-agent-picker-dismissed-account";

function readAgentSetupFlowState() {
  try {
    return window.sessionStorage.getItem(AGENT_SETUP_FLOW_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAgentSetupFlowState(active: boolean) {
  try {
    if (active) {
      window.sessionStorage.setItem(AGENT_SETUP_FLOW_STORAGE_KEY, "1");
    } else {
      window.sessionStorage.removeItem(AGENT_SETUP_FLOW_STORAGE_KEY);
    }
  } catch {
    // sessionStorage may be unavailable in privacy-restricted browser contexts.
  }
}

function readAccountDismissed(storageKey: string, accountScope: string) {
  if (!accountScope) return false;
  try {
    return window.sessionStorage.getItem(storageKey) === accountScope;
  } catch {
    return false;
  }
}

function writeAccountDismissed(storageKey: string, accountScope: string, dismissed: boolean) {
  try {
    if (dismissed && accountScope) {
      window.sessionStorage.setItem(storageKey, accountScope);
    } else if (!dismissed) {
      window.sessionStorage.removeItem(storageKey);
    }
  } catch {
    // sessionStorage may be unavailable in privacy-restricted browser contexts.
  }
}

function isEvaluationTerminal(status: AgentEvaluation["status"]) {
  return status === "completed" || status === "failed";
}

function isEvaluationActive(status: AgentEvaluation["status"]) {
  return status === "running" || status === "judging";
}

function isCompletedAgentEvaluation(evaluation: AgentEvaluation) {
  return evaluation.status === "completed" || evaluation.result?.status === "completed";
}

function showHomeRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${error.message}` : fallback);
}

export function HomePage({ openLogin, openContact, openAbout, onLogout }: HomePageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const persistedEvaluationFlow = useSprixStore((state) => state.evaluationFlow);
  const localAgent = useSprixStore((state) => state.localAgent);
  const platformOverview = useSprixStore((state) => state.platformOverview);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const setEvaluationFlow = useSprixStore((state) => state.setEvaluationFlow);
  const clearEvaluationFlow = useSprixStore((state) => state.clearEvaluationFlow);
  const homeBootstrap = useHomeBootstrap();
  const localAgentHealth = useQuery({
    queryKey: ["sprix-agent", "local-agent-health"],
    queryFn: () => checkLocalAgentHealth(),
    enabled: account.isLoggedIn,
    retry: false,
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  });
  const autoSetCurrentAgentIdRef = useRef<string>();
  const completingEvaluationIdRef = useRef<string>();
  const completedEvaluationIdRef = useRef<string>();
  const connectModalDismissedRef = useRef(false);
  const agentPickerDismissedRef = useRef(false);
  const bindingInvalidModalDismissedRef = useRef(false);
  const dismissedAccountScopeRef = useRef("");
  const [agentSetupFlowActive, setAgentSetupFlowActive] = useState(readAgentSetupFlowState);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const setAgentSetupFlow = useCallback((active: boolean) => {
    setAgentSetupFlowActive(active);
    writeAgentSetupFlowState(active);
  }, []);
  const {
    recognizing: pickerRecognizing,
    syncing: pickerSyncing,
    recognitionFailed: pickerRecognitionFailed,
    recognitionTimedOut: pickerRecognitionTimedOut,
    start: startPickerPolling
  } = useAgentBindPolling({ open: agentPickerOpen });
  const bootstrapReady = homeBootstrap.isSuccess && !homeBootstrap.isFetching;
  const homeAccount = useMemo(() => {
    const bootstrapAccount = homeBootstrap.data?.account;
    if (account.isLoggedIn && bootstrapAccount?.isLoggedIn === true) {
      return { ...account, ...bootstrapAccount, isLoggedIn: true };
    }
    return account;
  }, [account, homeBootstrap.data?.account]);
  const freshCurrentAgent = bootstrapReady ? homeBootstrap.data?.currentAgent : undefined;
  const effectiveCurrentAgent = homeAccount.isLoggedIn && freshCurrentAgent?.status !== "离线" ? freshCurrentAgent : undefined;
  const bootstrapAgents = bootstrapReady ? homeBootstrap.data?.agents ?? [] : agents;
  const availableAgents = useMemo(() => bootstrapAgents.filter((agent) => agent.status !== "离线"), [bootstrapAgents]);
  const homeState = useHomeAgentState(homeAccount, availableAgents, effectiveCurrentAgent, localAgent, pickerSyncing);
  const localAgentHealthy = localAgentHealth.data?.kind === "running";
  const [evaluationAgent, setEvaluationAgent] = useState<Agent | null>(null);
  const [evaluation, setEvaluation] = useState<AgentEvaluation | undefined>();
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string>();
  const [bindingInvalidModalOpen, setBindingInvalidModalOpen] = useState(false);
  const [abilityResultAgent, setAbilityResultAgent] = useState<Agent | null>(null);
  const [abilityResultModalOpen, setAbilityResultModalOpen] = useState(false);
  const evaluationFlowClaimedRef = useRef(false);
  const abilityResultFlowRef = useRef(false);
  const evaluationPollInFlightRef = useRef(false);
  const evaluationRestoreInFlightRef = useRef(false);
  const currentAgentEvaluationFlowActive =
    persistedEvaluationFlow?.wasCurrentAgent === true &&
    (persistedEvaluationFlow.status === "running" || persistedEvaluationFlow.status === "judging");
  const evaluationFlowActive =
    evaluationLoading ||
    Boolean(evaluation && isEvaluationActive(evaluation.status)) ||
    currentAgentEvaluationFlowActive;
  const shouldOpenConnectModal = Boolean((location.state as { openConnectAgentModal?: boolean } | null)?.openConnectAgentModal);
  const shouldOpenAgentPicker = searchParams.get("modal") === "agent-picker";
  const accountScope = homeAccount.phone || homeAccount.maskedPhone || homeAccount.nickname;
  const evaluationAccountScope = accountScope || "logged-in";
  const currentAgentReady = Boolean(
    effectiveCurrentAgent &&
      !(effectiveCurrentAgent.evaluation && isEvaluationActive(effectiveCurrentAgent.evaluation.status))
  );
  const canAutoEnterMarket = Boolean(
    homeAccount.isLoggedIn &&
      bootstrapReady &&
      currentAgentReady &&
      !agentSetupFlowActive &&
      !evaluationFlowActive &&
      !connectModalOpen &&
      !shouldOpenConnectModal &&
      !agentPickerOpen &&
      !bindingInvalidModalOpen &&
      !shouldOpenAgentPicker &&
      !abilityResultModalOpen &&
      !evaluationFlowClaimedRef.current &&
      !abilityResultFlowRef.current
  );

  const openBindingInvalidModal = useCallback(() => {
    bindingInvalidModalDismissedRef.current = false;
    autoSetCurrentAgentIdRef.current = undefined;
    clearEvaluationFlow();
    setEvaluationModalOpen(false);
    setEvaluationLoading(false);
    setEvaluationAgent(null);
    setEvaluation(undefined);
    setEvaluationError(undefined);
    setAgentSetupFlow(false);
    setBindingInvalidModalOpen(true);
  }, [clearEvaluationFlow, setAgentSetupFlow]);

  const refreshAgents = useCallback(async (_preferredCurrentAgent?: Agent) => {
    const [remoteAgents, refreshedCurrentAgent] = await Promise.all([
      readRemoteAgents(),
      readCurrentRemoteAgent().catch(() => undefined)
    ]);
    const currentAgentFromList = remoteAgents.currentAgentId ? remoteAgents.agents.find((agent) => agent.id === remoteAgents.currentAgentId) : undefined;
    // Only treat the server-confirmed current Agent as executable. The local
    // preferred value is used for the completion modal, but must not override
    // the latest eligibility result returned by the backend.
    const nextCurrentAgent = refreshedCurrentAgent ?? currentAgentFromList;
    mergeRemoteState({
      agents: remoteAgents.agents,
      localAgent: remoteAgents.localAgent,
      currentAgentId: remoteAgents.currentAgentId,
      currentAgent: nextCurrentAgent
    });
    queryClient.setQueryData<SprixRemoteStatePatch>(["sprix-agent", "home-bootstrap"], (previous) =>
      previous
        ? {
            ...previous,
            agents: remoteAgents.agents,
            localAgent: remoteAgents.localAgent,
            currentAgentId: remoteAgents.currentAgentId,
            currentAgent: nextCurrentAgent
          }
        : previous
    );
  }, [mergeRemoteState, queryClient]);

  const promptClaudeLogin = useCallback((agent: Agent, onAuthenticated: (authenticatedAgent: Agent) => Promise<void>) => {
    Modal.confirm({
      title: "登录 Claude Code",
      content: "已检测到 Claude Code 尚未登录。点击“立即登录”后，本机会打开终端和 Claude 授权页面；完成后将自动继续生成能力画像。",
      okText: "立即登录",
      cancelText: "取消",
      onOk: async () => {
        try {
          await requestRemoteAgentLogin(agent.id);
          message.info("请在本机终端和浏览器中完成 Claude Code 登录");
          const authenticatedAgent = await waitForRemoteAgentAuthentication(agent.id);
          await refreshAgents();
          message.success("Claude Code 登录成功");
          await onAuthenticated(authenticatedAgent);
        } catch (error) {
          showHomeRequestError(error, "Claude Code 登录失败", "Claude Code 登录失败：");
          throw error;
        }
      }
    });
  }, [refreshAgents]);

  const markCurrentAfterCompletedEvaluation = useCallback(
    async (agent: Agent, nextEvaluation: AgentEvaluation) => {
      if (autoSetCurrentAgentIdRef.current !== agent.id || !isCompletedAgentEvaluation(nextEvaluation)) return true;
      if (completedEvaluationIdRef.current === nextEvaluation.evaluationId || completingEvaluationIdRef.current === nextEvaluation.evaluationId) return true;
      completingEvaluationIdRef.current = nextEvaluation.evaluationId;
      try {
        const updatedCurrentAgent = await markRemoteCurrentAgent(agent.id);
        const preferredCurrentAgent = updatedCurrentAgent ?? { ...agent, role: "当前执行 Agent" as const };
        const completedCurrentAgent = {
          ...preferredCurrentAgent,
          role: "当前执行 Agent" as const,
          score: nextEvaluation.result.overallScore ?? preferredCurrentAgent.score,
          evaluation: nextEvaluation
        };
        abilityResultFlowRef.current = true;
        setEvaluationModalOpen(false);
        setEvaluationAgent(null);
        setEvaluation(undefined);
        setEvaluationError(undefined);
        setEvaluationLoading(false);
        setAbilityResultAgent(completedCurrentAgent);
        setAbilityResultModalOpen(true);
        mergeRemoteState({ currentAgent: completedCurrentAgent });
        queryClient.setQueryData<SprixRemoteStatePatch>(["sprix-agent", "home-bootstrap"], (previous) =>
          previous
            ? {
                ...previous,
                agents: previous.agents?.map((item) => (item.id === completedCurrentAgent.id ? completedCurrentAgent : item)),
                currentAgentId: completedCurrentAgent.id,
                currentAgent: completedCurrentAgent
              }
            : previous
        );
        completedEvaluationIdRef.current = nextEvaluation.evaluationId;
        completingEvaluationIdRef.current = undefined;
        autoSetCurrentAgentIdRef.current = undefined;
        clearEvaluationFlow();
        message.success("测评完成，已设置当前执行 Agent");
        void refreshAgents(completedCurrentAgent).catch((error) => {
          showHomeRequestError(error, "刷新 Agent 状态失败", "刷新 Agent 状态失败：");
        });
        return true;
      } catch (error) {
        if (completingEvaluationIdRef.current === nextEvaluation.evaluationId) {
          completingEvaluationIdRef.current = undefined;
        }
        showHomeRequestError(error, "设置当前执行 Agent 失败", "设置当前执行 Agent 失败：");
        return false;
      }
    },
    [clearEvaluationFlow, mergeRemoteState, queryClient, refreshAgents]
  );

  const selectAgentForEvaluation = async (agent: Agent) => {
    if (!homeAccount.isLoggedIn) {
      openLogin();
      return;
    }
    evaluationFlowClaimedRef.current = true;
    agentPickerDismissedRef.current = true;
    writeAccountDismissed(AGENT_PICKER_DISMISSED_STORAGE_KEY, accountScope, true);
    if (isAgentLoginRequired(agent)) {
      setAgentPickerOpen(false);
      promptClaudeLogin(agent, selectAgentForEvaluation);
      return;
    }
    setAgentPickerOpen(false);
    autoSetCurrentAgentIdRef.current = agent.id;
    setEvaluationAgent(agent);
    setEvaluation(undefined);
    setEvaluationError(undefined);
    setEvaluationModalOpen(false);
    setEvaluationLoading(true);
    try {
      let nextEvaluation: AgentEvaluation | undefined;
      let startedEvaluation = false;
      if (agent.evaluation && isEvaluationActive(agent.evaluation.status)) {
        try {
          const latestEvaluation = await readLatestRemoteAgentEvaluation(agent.id);
          if (isEvaluationActive(latestEvaluation.status)) {
            nextEvaluation = latestEvaluation;
          }
        } catch (error) {
          if (!(error instanceof Error && error.message === "Agent evaluation not found")) {
            throw error;
          }
        }
      }
      if (!nextEvaluation) {
        startedEvaluation = true;
        nextEvaluation = await startRemoteAgentEvaluation(agent.id);
      }
      if (!nextEvaluation.evaluationId) {
        nextEvaluation = await readLatestRemoteAgentEvaluation(agent.id);
      }
      if (isEvaluationActive(nextEvaluation.status)) {
        setEvaluationModalDismissed(evaluationAccountScope, nextEvaluation.evaluationId, false);
        setEvaluationFlow({
          agentId: agent.id,
          evaluationId: nextEvaluation.evaluationId,
          status: nextEvaluation.status,
          // Home-page selection is always intended to become the current
          // execution Agent after the evaluation completes.
          wasCurrentAgent: true
        });
      }
      if (isCompletedAgentEvaluation(nextEvaluation)) {
        const currentAgentRestored = await markCurrentAfterCompletedEvaluation(agent, nextEvaluation);
        if (!currentAgentRestored) {
          // Keep the completed result visible when setting the current Agent fails.
          setEvaluation(nextEvaluation);
          setEvaluationModalOpen(true);
        }
      } else {
        if (nextEvaluation.status === "failed") {
          setEvaluationFlow({
            agentId: agent.id,
            evaluationId: nextEvaluation.evaluationId,
            status: "failed",
            wasCurrentAgent: true
          });
        }
        setEvaluation(nextEvaluation);
        if (!startedEvaluation || !isEvaluationActive(nextEvaluation.status)) {
          setEvaluationModalOpen(true);
        }
        await refreshAgents();
      }
      if (startedEvaluation && isEvaluationActive(nextEvaluation.status)) {
        message.success("测评已开始");
      }
    } catch (error) {
      if (isLocalAgentBindingInvalidError(error)) {
        openBindingInvalidModal();
        return;
      }
      autoSetCurrentAgentIdRef.current = undefined;
      setEvaluationError(error instanceof Error ? error.message : "评测操作失败");
      setEvaluationModalOpen(true);
      showHomeRequestError(error, "评测操作失败", "评测操作失败：");
    } finally {
      setEvaluationLoading(false);
    }
  };

  useEffect(() => {
    if (
      !evaluationAgent ||
      !evaluation ||
      !evaluation.evaluationId ||
      isEvaluationTerminal(evaluation.status)
    ) {
      return;
    }

    let cancelled = false;
    const poll = window.setInterval(async () => {
      if (evaluationPollInFlightRef.current) return;
      evaluationPollInFlightRef.current = true;
      try {
        const next = await readRemoteAgentEvaluation(evaluationAgent.id, evaluation.evaluationId);
        if (cancelled) return;
        if (isEvaluationTerminal(next.status)) {
          window.clearInterval(poll);
          if (next.status === "failed") {
            autoSetCurrentAgentIdRef.current = undefined;
            setEvaluationFlow({
              agentId: evaluationAgent.id,
              evaluationId: next.evaluationId,
              status: "failed",
              wasCurrentAgent: true
            });
            setEvaluation(next);
            setEvaluationModalOpen(true);
          }
          if (next.status === "completed") {
            const currentAgentRestored = await markCurrentAfterCompletedEvaluation(evaluationAgent, next);
            if (!currentAgentRestored) {
              // Keep the completed result visible when restoring the current Agent fails.
              setEvaluation(next);
              setEvaluationModalOpen(true);
            }
          }
          void refreshAgents();
          return;
        }
        if (next.status === "running" || next.status === "judging") {
          setEvaluationFlow({
            agentId: evaluationAgent.id,
            evaluationId: evaluation.evaluationId,
            status: next.status,
            wasCurrentAgent: true
          });
        }
        setEvaluation(next);
        setEvaluationModalOpen(true);
      } catch (error) {
        if (cancelled) return;
        if (isLocalAgentBindingInvalidError(error)) {
          window.clearInterval(poll);
          openBindingInvalidModal();
          return;
        }
        setEvaluationError(error instanceof Error ? error.message : "评测状态获取失败");
        setEvaluationModalOpen(true);
        window.clearInterval(poll);
      } finally {
        evaluationPollInFlightRef.current = false;
      }
    }, 1_500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [clearEvaluationFlow, evaluation, evaluationAgent, markCurrentAfterCompletedEvaluation, openBindingInvalidModal, refreshAgents, setEvaluationFlow]);

  const closeEvaluation = () => {
    setEvaluationModalOpen(false);
    const shouldKeepEvaluationContext = evaluationLoading || Boolean(evaluation && isEvaluationActive(evaluation.status));
    const activeEvaluationId = evaluation?.evaluationId ?? persistedEvaluationFlow?.evaluationId;
    if (shouldKeepEvaluationContext && activeEvaluationId) {
      setEvaluationModalDismissed(evaluationAccountScope, activeEvaluationId, true);
    }
    if (!shouldKeepEvaluationContext) {
      setAgentSetupFlow(false);
      setEvaluationAgent(null);
      setEvaluation(undefined);
    }
    setEvaluationError(undefined);
  };

  const openAgentPicker = useCallback(() => {
    agentPickerDismissedRef.current = false;
    writeAccountDismissed(AGENT_PICKER_DISMISSED_STORAGE_KEY, accountScope, false);
    setAgentSetupFlow(true);
    const shouldRestoreEvaluation =
      Boolean(evaluationAgent) && (evaluationLoading || Boolean(evaluation && isEvaluationActive(evaluation.status)));
    if (shouldRestoreEvaluation) {
      if (evaluation?.evaluationId) {
        setEvaluationModalDismissed(evaluationAccountScope, evaluation.evaluationId, false);
      }
      setEvaluationModalOpen(true);
      return;
    }
    setAgentPickerOpen(true);
  }, [accountScope, evaluation, evaluationAccountScope, evaluationAgent, evaluationLoading, setAgentSetupFlow]);

  const enterMarketFromAbilityResult = () => {
    evaluationFlowClaimedRef.current = false;
    abilityResultFlowRef.current = false;
    setAgentSetupFlow(false);
    navigate("/agent/market");
  };

  useEffect(() => {
    if (shouldOpenConnectModal && !shouldOpenAgentPicker) {
      setAgentSetupFlow(true);
      setConnectModalOpen(true);
      navigate(".", { replace: true, state: null });
    }
  }, [navigate, setAgentSetupFlow, shouldOpenAgentPicker, shouldOpenConnectModal]);

  useEffect(() => {
    if (shouldOpenAgentPicker) {
      setAgentSetupFlow(true);
      openAgentPicker();
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("modal");
      navigate(
        {
          pathname: location.pathname,
          search: nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : ""
        },
        { replace: true, state: null }
      );
    }
  }, [location.pathname, navigate, openAgentPicker, searchParams, setAgentSetupFlow, shouldOpenAgentPicker]);

  useEffect(() => {
    if (!agentPickerOpen) return;
    startPickerPolling();
  }, [agentPickerOpen, startPickerPolling]);

  useEffect(() => {
    if (!homeAccount.isLoggedIn) {
      dismissedAccountScopeRef.current = "";
      connectModalDismissedRef.current = false;
      agentPickerDismissedRef.current = false;
      bindingInvalidModalDismissedRef.current = false;
      return;
    }
    if (!accountScope || dismissedAccountScopeRef.current === accountScope) return;
    dismissedAccountScopeRef.current = accountScope;
    connectModalDismissedRef.current = readAccountDismissed(CONNECT_MODAL_DISMISSED_STORAGE_KEY, accountScope);
    agentPickerDismissedRef.current = readAccountDismissed(AGENT_PICKER_DISMISSED_STORAGE_KEY, accountScope);
    bindingInvalidModalDismissedRef.current = false;
  }, [accountScope, homeAccount.isLoggedIn]);

  useEffect(() => {
    completedEvaluationIdRef.current = undefined;
    completingEvaluationIdRef.current = undefined;
    evaluationFlowClaimedRef.current = false;
  }, [accountScope]);

  useEffect(() => {
    if (
      !homeAccount.isLoggedIn ||
      !bootstrapReady ||
      agentPickerOpen ||
      abilityResultModalOpen ||
      !effectiveCurrentAgent?.evaluation ||
      !isEvaluationActive(effectiveCurrentAgent.evaluation.status)
    ) {
      return;
    }
    const restoredEvaluation = effectiveCurrentAgent.evaluation;
    if (restoredEvaluation.evaluationId && isEvaluationModalDismissed(evaluationAccountScope, restoredEvaluation.evaluationId)) return;
    if (completedEvaluationIdRef.current === restoredEvaluation.evaluationId || completingEvaluationIdRef.current === restoredEvaluation.evaluationId) return;
    // Do not replace the evaluation the user is currently viewing with the
    // current Agent's restored evaluation.
    if (
      evaluationAgent &&
      (evaluationAgent.id !== effectiveCurrentAgent.id || evaluation?.evaluationId !== restoredEvaluation.evaluationId) &&
      (evaluationModalOpen || evaluationLoading || Boolean(evaluation && isEvaluationActive(evaluation.status)))
    ) {
      return;
    }
    if (
      evaluationAgent?.id === effectiveCurrentAgent.id &&
      (evaluationLoading || Boolean(evaluation && isEvaluationActive(evaluation.status)))
    ) {
      return;
    }

    if (!restoredEvaluation.evaluationId) {
      let cancelled = false;
      readLatestRemoteAgentEvaluation(effectiveCurrentAgent.id)
        .then((latestEvaluation) => {
          if (cancelled || !isEvaluationActive(latestEvaluation.status)) return;
          if (latestEvaluation.evaluationId && isEvaluationModalDismissed(evaluationAccountScope, latestEvaluation.evaluationId)) return;
          autoSetCurrentAgentIdRef.current = effectiveCurrentAgent.id;
          setEvaluationAgent(effectiveCurrentAgent);
          setEvaluation(latestEvaluation);
          setEvaluationError(undefined);
          setEvaluationLoading(false);
          setEvaluationModalOpen(true);
        })
        .catch(() => {
          // The summary may briefly be ahead of the detail endpoint after a refresh.
          // Leave the current page stable and let the next bootstrap refresh retry.
        });
      return () => {
        cancelled = true;
      };
    }

    autoSetCurrentAgentIdRef.current = effectiveCurrentAgent.id;
    setEvaluationAgent(effectiveCurrentAgent);
    setEvaluation(restoredEvaluation);
    setEvaluationError(undefined);
    setEvaluationLoading(false);
    setEvaluationModalOpen(true);
  }, [abilityResultModalOpen, agentPickerOpen, bootstrapReady, effectiveCurrentAgent, evaluation, evaluationAccountScope, evaluationAgent, evaluationLoading, evaluationModalOpen, homeAccount.isLoggedIn]);

  useEffect(() => {
    const flow = persistedEvaluationFlow;
    if (
      !homeAccount.isLoggedIn ||
      !bootstrapReady ||
      agentPickerOpen ||
      abilityResultModalOpen ||
      !flow?.wasCurrentAgent ||
      !flow.agentId ||
      !flow.evaluationId ||
      (evaluationAgent?.id === flow.agentId &&
        evaluation?.evaluationId === flow.evaluationId &&
        evaluation &&
        (isEvaluationActive(evaluation.status) || evaluation.status === "failed"))
    ) {
      return;
    }

    // The user is actively watching a different evaluation; never hijack or close that modal.
    if (
      evaluationAgent &&
      (evaluationAgent.id !== flow.agentId || evaluation?.evaluationId !== flow.evaluationId) &&
      (evaluationModalOpen || evaluationLoading || Boolean(evaluation && isEvaluationActive(evaluation.status)))
    ) {
      return;
    }

    if (effectiveCurrentAgent?.id === flow.agentId && flow.status !== "failed") {
      const currentEvaluationStatus = effectiveCurrentAgent.evaluation?.status ?? effectiveCurrentAgent.evaluation?.result?.status;
      if (
        effectiveCurrentAgent.evaluation?.evaluationId === flow.evaluationId &&
        currentEvaluationStatus !== "running" &&
        currentEvaluationStatus !== "judging"
      ) {
        clearEvaluationFlow();
      }
      return;
    }

    const flowAgent = bootstrapAgents.find((agent) => agent.id === flow.agentId);
    if (!flowAgent) return;
    if (evaluationRestoreInFlightRef.current) return;
    evaluationRestoreInFlightRef.current = true;

    let cancelled = false;
    let retryTimer: number | undefined;
    const restore = async () => {
      try {
        const latestEvaluation = await readRemoteAgentEvaluation(flow.agentId, flow.evaluationId);
        if (cancelled) return;
        const modalDismissed = isEvaluationModalDismissed(evaluationAccountScope, latestEvaluation.evaluationId);
        if (isEvaluationActive(latestEvaluation.status)) {
          autoSetCurrentAgentIdRef.current = flow.agentId;
          setEvaluationAgent(flowAgent);
          setEvaluation(latestEvaluation);
          setEvaluationError(undefined);
          setEvaluationLoading(false);
          setEvaluationModalOpen(!modalDismissed);
          return;
        }

        if (latestEvaluation.status === "failed") {
          autoSetCurrentAgentIdRef.current = undefined;
          setEvaluationAgent(flowAgent);
          setEvaluation(latestEvaluation);
          setEvaluationLoading(false);
          setEvaluationModalOpen(false);
          return;
        }

        if (latestEvaluation.status === "completed" && flow.wasCurrentAgent === true) {
          await markRemoteCurrentAgent(flow.agentId).catch(() => undefined);
        }
        clearEvaluationFlow();
        autoSetCurrentAgentIdRef.current = undefined;
        setEvaluationAgent(null);
        setEvaluation(latestEvaluation);
        setEvaluationLoading(false);
        setEvaluationModalOpen(false);
        void refreshAgents();
      } catch (error) {
        if (cancelled) return;
        if (isLocalAgentBindingInvalidError(error)) {
          openBindingInvalidModal();
          return;
        }
        if (error instanceof Error && error.message === "Agent evaluation not found") {
          clearEvaluationFlow();
          return;
        }
        retryTimer = window.setTimeout(restore, 1_500);
      } finally {
        evaluationRestoreInFlightRef.current = false;
      }
    };
    void restore();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [abilityResultModalOpen, agentPickerOpen, bootstrapAgents, bootstrapReady, clearEvaluationFlow, effectiveCurrentAgent, evaluation, evaluationAccountScope, evaluationAgent, evaluationLoading, evaluationModalOpen, homeAccount.isLoggedIn, openBindingInvalidModal, persistedEvaluationFlow, refreshAgents]);

  useEffect(() => {
    if (!evaluationFlowClaimedRef.current && canAutoEnterMarket) {
      navigate("/agent/market", { replace: true });
    }
  }, [canAutoEnterMarket, navigate]);

  useEffect(() => {
    if (
      !agentSetupFlowActive ||
      !bootstrapReady ||
      connectModalOpen ||
      agentPickerOpen ||
      bindingInvalidModalOpen ||
      bindingInvalidModalDismissedRef.current ||
      evaluationFlowActive ||
      abilityResultModalOpen ||
      connectModalDismissedRef.current ||
      agentPickerDismissedRef.current ||
      shouldOpenAgentPicker
    ) {
      return;
    }
    if (effectiveCurrentAgent) {
      if (currentAgentReady) setAgentSetupFlow(false);
      return;
    }
    if (localAgentHealth.isPending) return;
    if (localAgentHealthy) {
      openAgentPicker();
    } else {
      setConnectModalOpen(true);
    }
  }, [abilityResultModalOpen, agentPickerOpen, agentSetupFlowActive, bindingInvalidModalOpen, bootstrapReady, connectModalOpen, currentAgentReady, effectiveCurrentAgent, evaluationFlowActive, localAgentHealth.isPending, localAgentHealthy, openAgentPicker, setAgentSetupFlow, shouldOpenAgentPicker]);

  useEffect(() => {
    if (!homeAccount.isLoggedIn) {
      connectModalDismissedRef.current = false;
      setAgentSetupFlow(false);
      return;
    }
    if (effectiveCurrentAgent) {
      connectModalDismissedRef.current = false;
      return;
    }
    if (
      !homeBootstrap.isSuccess ||
      homeBootstrap.isFetching ||
      !accountScope ||
      shouldOpenAgentPicker ||
      (agentSetupFlowActive && availableAgents.length > 0) ||
      connectModalDismissedRef.current ||
      agentPickerDismissedRef.current ||
      evaluationFlowActive ||
      abilityResultModalOpen ||
      connectModalOpen ||
      agentPickerOpen ||
      bindingInvalidModalOpen ||
      bindingInvalidModalDismissedRef.current ||
      localAgentHealth.isPending
    ) {
      return;
    }
    setAgentSetupFlow(true);
    if (localAgentHealthy) {
      openAgentPicker();
    } else {
      setConnectModalOpen(true);
    }
  }, [abilityResultModalOpen, accountScope, agentPickerOpen, agentSetupFlowActive, bindingInvalidModalOpen, connectModalOpen, effectiveCurrentAgent, evaluationFlowActive, homeAccount.isLoggedIn, homeBootstrap.isFetching, homeBootstrap.isSuccess, localAgentHealth.isPending, localAgentHealthy, openAgentPicker, setAgentSetupFlow, shouldOpenAgentPicker]);

  if (canAutoEnterMarket) {
    return null;
  }

  return (
    <main className="sprix-landing">
      <section className="sprix-landing-inner">
        <HomeTopAccount account={homeAccount} onLogout={onLogout} />
        <HomeHero />
        <HomeAgentCard agent={effectiveCurrentAgent} />
        <HomeStats overview={platformOverview} />
        <HomeAgentEntry
          state={homeState}
          checking={homeAccount.isLoggedIn && (homeBootstrap.isFetching || localAgentHealth.isPending)}
          localAgentHealthy={localAgentHealthy}
          connectModalOpen={connectModalOpen}
          onOpenLogin={openLogin}
          onOpenConnectModal={() => {
            setAgentSetupFlow(true);
            setConnectModalOpen(true);
          }}
          onCloseConnectModal={() => {
            connectModalDismissedRef.current = true;
            writeAccountDismissed(CONNECT_MODAL_DISMISSED_STORAGE_KEY, accountScope, true);
            setAgentSetupFlow(false);
            setConnectModalOpen(false);
          }}
          onCompleteConnectModal={() => setConnectModalOpen(false)}
          onOpenAgentPicker={openAgentPicker}
          onEnterMarket={() => navigate("/agent/market")}
        />
        <footer className="sprix-landing-footer">
          <span>© Sprix AI</span>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
            {ICP_RECORD_NO}
          </a>
          <a className="sprix-public-security-record" href={PUBLIC_SECURITY_RECORD_URL} target="_blank" rel="noreferrer">
            <img src="/gongan.png" width="14" height="14" alt="" aria-hidden="true" />
            {PUBLIC_SECURITY_RECORD_NO}
          </a>
          {!homeAccount.isLoggedIn && (
            <>
              <button type="button" onClick={openContact}>联系我们</button>
              <button type="button" onClick={openAbout}>关于我们</button>
            </>
          )}
        </footer>
      </section>
      <HomeAgentPickerModal
        open={agentPickerOpen}
        agents={availableAgents}
        recognizing={pickerRecognizing}
        recognitionFailed={pickerRecognitionFailed}
        recognitionTimedOut={pickerRecognitionTimedOut}
        onRetry={() => startPickerPolling()}
        onSelect={selectAgentForEvaluation}
        onClose={() => {
          agentPickerDismissedRef.current = true;
          writeAccountDismissed(AGENT_PICKER_DISMISSED_STORAGE_KEY, accountScope, true);
          setAgentPickerOpen(false);
          setAgentSetupFlow(false);
        }}
      />
      <AgentEvaluationProgressModal
        open={evaluationModalOpen}
        agent={evaluationAgent}
        evaluation={evaluation}
        loading={evaluationLoading}
        error={evaluationError}
        onClose={closeEvaluation}
      />
      <AgentBindingInvalidModal
        open={bindingInvalidModalOpen}
        onClose={() => {
          bindingInvalidModalDismissedRef.current = true;
          setBindingInvalidModalOpen(false);
        }}
      />
      <Modal
        centered
        open={abilityResultModalOpen}
        title={null}
        width={1100}
        className="sprix-agent-ability-result-modal"
        closable={false}
        maskClosable={false}
        footer={
          <div className="sprix-agent-ability-result-footer">
            <ActionButton onClick={enterMarketFromAbilityResult}>
              去任务市场
              <ArrowRight size={16} strokeWidth={1.7} aria-hidden="true" />
            </ActionButton>
          </div>
        }
      >
        {abilityResultAgent && (
          <AgentAbilityProfile
            agent={abilityResultAgent}
            embedded
            resultPresentation
            onboardingResultPresentation
          />
        )}
      </Modal>
    </main>
  );
}
