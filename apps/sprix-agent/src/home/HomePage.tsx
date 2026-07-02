import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import type { Agent, AgentEvaluation } from "../types";
import { useSprixStore } from "../store/sprixStore";
import {
  markRemoteCurrentAgent,
  readCurrentRemoteAgent,
  readLatestRemoteAgentEvaluation,
  readRemoteAgentEvaluation,
  readRemoteAgents,
  startRemoteAgentEvaluation
} from "../services/sprixApi";
import { isGlobalAuthError, localizeApiMessage } from "../utils/http";
import { AgentEvaluationProgressModal } from "../components/AgentEvaluationProgressModal";
import { useHomeBootstrap } from "./useHomeBootstrap";
import { useHomeAgentState } from "./useHomeAgentState";
import { HomeAgentCard } from "./HomeAgentCard";
import { HomeAgentPickerModal } from "./HomeAgentPickerModal";
import { HomeHero } from "./HomeHero";
import { HomeStats } from "./HomeStats";
import { HomeTopAccount } from "./HomeTopAccount";

type HomePageProps = {
  openLogin: () => void;
  onLogout?: () => void;
};

function isEvaluationTerminal(status: AgentEvaluation["status"]) {
  return status === "completed" || status === "failed";
}

function isCompletedAgentEvaluation(evaluation: AgentEvaluation) {
  return evaluation.status === "completed" || evaluation.result?.status === "completed";
}

function showHomeRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${localizeApiMessage(error.message, fallback)}` : fallback);
}

function requestErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? localizeApiMessage(error.message, fallback) : fallback;
}

function isAgentEvaluationNotFound(error: unknown) {
  return error instanceof Error && localizeApiMessage(error.message) === "Agent 测评记录不存在";
}

export function HomePage({ openLogin, onLogout }: HomePageProps) {
  useHomeBootstrap();
  const navigate = useNavigate();
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const localAgent = useSprixStore((state) => state.localAgent);
  const currentAgent = useSprixStore((state) => state.currentAgent);
  const platformOverview = useSprixStore((state) => state.platformOverview);
  const mergeRemoteState = useSprixStore((state) => state.mergeRemoteState);
  const homeState = useHomeAgentState(account, agents, currentAgent, localAgent);
  const autoSetCurrentAgentIdRef = useRef<string>();
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [evaluationAgent, setEvaluationAgent] = useState<Agent | null>(null);
  const [evaluation, setEvaluation] = useState<AgentEvaluation | undefined>();
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string>();

  const availableAgents = useMemo(() => agents.filter((agent) => agent.status !== "离线"), [agents]);

  const refreshAgents = useCallback(async (preferredCurrentAgent?: Agent) => {
    const [remoteAgents, refreshedCurrentAgent] = await Promise.all([
      readRemoteAgents(),
      readCurrentRemoteAgent().catch(() => undefined)
    ]);
    const currentAgentFromList = remoteAgents.currentAgentId ? remoteAgents.agents.find((agent) => agent.id === remoteAgents.currentAgentId) : undefined;
    mergeRemoteState({
      agents: remoteAgents.agents,
      localAgent: remoteAgents.localAgent,
      currentAgentId: remoteAgents.currentAgentId,
      currentAgent: refreshedCurrentAgent ?? preferredCurrentAgent ?? currentAgentFromList
    });
  }, [mergeRemoteState]);

  const markCurrentAfterCompletedEvaluation = useCallback(
    async (agent: Agent, nextEvaluation: AgentEvaluation) => {
      if (autoSetCurrentAgentIdRef.current !== agent.id || !isCompletedAgentEvaluation(nextEvaluation)) return;
      try {
        const updatedCurrentAgent = await markRemoteCurrentAgent(agent.id);
        const preferredCurrentAgent = updatedCurrentAgent ?? { ...agent, role: "当前执行 Agent" as const };
        mergeRemoteState({ currentAgent: preferredCurrentAgent });
        autoSetCurrentAgentIdRef.current = undefined;
        await refreshAgents(preferredCurrentAgent);
        message.success("测评完成，已设置当前执行 Agent");
      } catch (error) {
        showHomeRequestError(error, "设置当前执行 Agent 失败", "设置当前执行 Agent 失败：");
      }
    },
    [mergeRemoteState, refreshAgents]
  );

  const selectAgentForEvaluation = async (agent: Agent) => {
    if (!account.isLoggedIn) {
      openLogin();
      return;
    }
    setAgentPickerOpen(false);
    autoSetCurrentAgentIdRef.current = agent.id;
    setEvaluationAgent(agent);
    setEvaluation(undefined);
    setEvaluationError(undefined);
    setEvaluationModalOpen(true);
    setEvaluationLoading(true);
    try {
      let nextEvaluation: AgentEvaluation;
      if (agent.evaluation && agent.evaluation.status !== "failed") {
        try {
          nextEvaluation = await readLatestRemoteAgentEvaluation(agent.id);
        } catch (error) {
          if (!isAgentEvaluationNotFound(error)) {
            throw error;
          }
          nextEvaluation = await startRemoteAgentEvaluation(agent.id);
        }
      } else {
        nextEvaluation = await startRemoteAgentEvaluation(agent.id);
      }
      setEvaluation(nextEvaluation);
      await refreshAgents();
      await markCurrentAfterCompletedEvaluation(agent, nextEvaluation);
      if (!agent.evaluation || agent.evaluation.status === "failed" || nextEvaluation.status === "running") {
        message.success("测评已开始");
      }
    } catch (error) {
      autoSetCurrentAgentIdRef.current = undefined;
      setEvaluationError(requestErrorMessage(error, "评测操作失败"));
      showHomeRequestError(error, "评测操作失败", "评测操作失败：");
    } finally {
      setEvaluationLoading(false);
    }
  };

  useEffect(() => {
    if (!evaluationAgent || !evaluation || isEvaluationTerminal(evaluation.status)) return;

    let cancelled = false;
    const poll = window.setInterval(async () => {
      try {
        const next = await readRemoteAgentEvaluation(evaluationAgent.id, evaluation.evaluationId);
        if (cancelled) return;
        setEvaluation(next);
        if (isEvaluationTerminal(next.status)) {
          window.clearInterval(poll);
          if (next.status === "failed") {
            autoSetCurrentAgentIdRef.current = undefined;
          }
          if (next.status === "completed") {
            await markCurrentAfterCompletedEvaluation(evaluationAgent, next);
          }
          void refreshAgents();
        }
      } catch (error) {
        if (cancelled) return;
        setEvaluationError(requestErrorMessage(error, "评测状态获取失败"));
        window.clearInterval(poll);
      }
    }, 1_500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [evaluation, evaluationAgent, markCurrentAfterCompletedEvaluation, refreshAgents]);

  const closeEvaluation = () => {
    setEvaluationModalOpen(false);
    if (!evaluation || isEvaluationTerminal(evaluation.status)) {
      setEvaluationAgent(null);
      setEvaluation(undefined);
    }
    setEvaluationError(undefined);
    setEvaluationLoading(false);
  };

  useEffect(() => {
    if (account.isLoggedIn && currentAgent) {
      navigate("/agent/market", { replace: true });
    }
  }, [account.isLoggedIn, currentAgent, navigate]);

  if (account.isLoggedIn && currentAgent) {
    return null;
  }

  return (
    <main className="sprix-landing">
      <section className="sprix-landing-inner">
        <HomeTopAccount account={account} onLogout={onLogout} />
        <HomeHero
          state={homeState}
          connectModalOpen={connectModalOpen}
          onOpenLogin={openLogin}
          onOpenConnectModal={() => setConnectModalOpen(true)}
          onCloseConnectModal={() => setConnectModalOpen(false)}
          onOpenAgentPicker={() => setAgentPickerOpen(true)}
          onEnterMarket={() => navigate("/agent/market")}
        />
        <HomeAgentCard agent={currentAgent} onEnterMarket={() => navigate("/agent/market")} onManageAgent={() => navigate("/agent/center")} />
        <HomeStats overview={platformOverview} />
      </section>
      <HomeAgentPickerModal
        open={agentPickerOpen}
        agents={availableAgents}
        onSelect={selectAgentForEvaluation}
        onClose={() => setAgentPickerOpen(false)}
      />
      <AgentEvaluationProgressModal
        open={evaluationModalOpen}
        agent={evaluationAgent}
        evaluation={evaluation}
        loading={evaluationLoading}
        error={evaluationError}
        onClose={closeEvaluation}
      />
    </main>
  );
}
