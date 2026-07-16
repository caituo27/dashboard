import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, message } from "antd";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { isGlobalAuthError } from "../utils/http";
import { AgentEvaluationProgressModal } from "../components/AgentEvaluationProgressModal";
import { ActionButton, SoftTag } from "../components/Primitives";
import { AgentAbilityProfile } from "../user/AgentAbilityProfile";
import { useAgentBindPolling } from "./useAgentBindPolling";
import { useHomeBootstrap } from "./useHomeBootstrap";
import { useHomeAgentState } from "./useHomeAgentState";
import { HomeAgentCard } from "./HomeAgentCard";
import { HomeAgentPickerModal } from "./HomeAgentPickerModal";
import { HomeHero } from "./HomeHero";
import { HomeStats } from "./HomeStats";
import { HomeTopAccount } from "./HomeTopAccount";

type HomePageProps = {
  openLogin: () => void;
  openContact?: () => void;
  openAbout?: () => void;
  onLogout?: () => void;
};

const ICP_RECORD_NO = import.meta.env.VITE_ICP_RECORD_NO ?? "粤ICP备2025376732号-5";

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
  useHomeBootstrap();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const {
    recognizing: pickerRecognizing,
    start: startPickerPolling
  } = useAgentBindPolling({ open: agentPickerOpen });
  const [evaluationAgent, setEvaluationAgent] = useState<Agent | null>(null);
  const [evaluation, setEvaluation] = useState<AgentEvaluation | undefined>();
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string>();
  const [abilityResultAgent, setAbilityResultAgent] = useState<Agent | null>(null);
  const [abilityResultModalOpen, setAbilityResultModalOpen] = useState(false);
  const abilityResultFlowRef = useRef(false);
  const shouldOpenConnectModal = Boolean((location.state as { openConnectAgentModal?: boolean } | null)?.openConnectAgentModal);
  const shouldOpenAgentPicker = searchParams.get("modal") === "agent-picker";

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
        const completedCurrentAgent = {
          ...preferredCurrentAgent,
          role: "当前执行 Agent" as const,
          score: nextEvaluation.result.overallScore ?? preferredCurrentAgent.score,
          evaluation: nextEvaluation
        };
        abilityResultFlowRef.current = true;
        setAbilityResultAgent(completedCurrentAgent);
        setAbilityResultModalOpen(true);
        mergeRemoteState({ currentAgent: completedCurrentAgent });
        autoSetCurrentAgentIdRef.current = undefined;
        await refreshAgents(completedCurrentAgent);
        setEvaluationModalOpen(false);
        setEvaluationAgent(null);
        setEvaluation(undefined);
        setEvaluationError(undefined);
        setEvaluationLoading(false);
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
      setEvaluation(nextEvaluation);
      await refreshAgents();
      await markCurrentAfterCompletedEvaluation(agent, nextEvaluation);
      if (startedEvaluation && isEvaluationActive(nextEvaluation.status)) {
        message.success("测评已开始");
      }
    } catch (error) {
      autoSetCurrentAgentIdRef.current = undefined;
      setEvaluationError(error instanceof Error ? error.message : "评测操作失败");
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
        setEvaluationError(error instanceof Error ? error.message : "评测状态获取失败");
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

  const enterMarketFromAbilityResult = () => {
    abilityResultFlowRef.current = false;
    navigate("/agent/market");
  };

  useEffect(() => {
    if (shouldOpenConnectModal) {
      setConnectModalOpen(true);
      navigate(".", { replace: true, state: null });
    }
  }, [navigate, shouldOpenConnectModal]);

  useEffect(() => {
    if (shouldOpenAgentPicker) {
      setAgentPickerOpen(true);
      navigate(".", { replace: true });
    }
  }, [navigate, shouldOpenAgentPicker]);

  useEffect(() => {
    if (!agentPickerOpen) return;
    startPickerPolling();
  }, [agentPickerOpen, startPickerPolling]);

  useEffect(() => {
    if (account.isLoggedIn && currentAgent && !connectModalOpen && !shouldOpenConnectModal && !abilityResultModalOpen && !abilityResultFlowRef.current) {
      navigate("/agent/market", { replace: true });
    }
  }, [abilityResultModalOpen, account.isLoggedIn, connectModalOpen, currentAgent, navigate, shouldOpenConnectModal]);

  if (account.isLoggedIn && currentAgent && !connectModalOpen && !shouldOpenConnectModal && !abilityResultModalOpen && !abilityResultFlowRef.current) {
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
        <footer className="sprix-landing-footer">
          <span>© Sprix AI</span>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
            {ICP_RECORD_NO}
          </a>
          {!account.isLoggedIn && (
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
      <Modal
        centered
        open={abilityResultModalOpen}
        title={null}
        width={960}
        className="sprix-agent-ability-result-modal"
        closable={false}
        maskClosable={false}
        footer={
          <div className="sprix-agent-ability-result-footer">
            <ActionButton onClick={enterMarketFromAbilityResult}>去任务市场</ActionButton>
          </div>
        }
      >
        {abilityResultAgent && (
          <div className="sprix-agent-ability-result">
            <div className="sprix-agent-ability-result-head">
              <span className="sprix-agent-current-label">当前执行 Agent</span>
              <h2>{abilityResultAgent.name}</h2>
              {abilityResultAgent.tags.length > 0 && (
                <div>
                  {abilityResultAgent.tags.map((tag) => (
                    <SoftTag key={tag}>{tag}</SoftTag>
                  ))}
                </div>
              )}
            </div>
            <AgentAbilityProfile agent={abilityResultAgent} embedded />
          </div>
        )}
      </Modal>
    </main>
  );
}
