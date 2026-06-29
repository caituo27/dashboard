import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Agent } from "../types";
import { useSprixStore } from "../store/sprixStore";
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

export function HomePage({ openLogin, onLogout }: HomePageProps) {
  useHomeBootstrap();
  const navigate = useNavigate();
  const account = useSprixStore((state) => state.account);
  const agents = useSprixStore((state) => state.agents);
  const currentAgent = useSprixStore((state) => state.currentAgent);
  const platformOverview = useSprixStore((state) => state.platformOverview);
  const homeState = useHomeAgentState(account, agents, currentAgent);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const availableAgents = useMemo(() => agents.filter((agent) => agent.status !== "离线"), [agents]);

  const selectAgentForEvaluation = (agent: Agent) => {
    setAgentPickerOpen(false);
    navigate("/agent/center", { state: { evaluateAgentId: agent.id } });
  };

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
    </main>
  );
}
