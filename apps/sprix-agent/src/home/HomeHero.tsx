import { HomeAgentEntry } from "./HomeAgentEntry";
import type { HomeAgentStateResult } from "./homeTypes";

type HomeHeroProps = {
  state: HomeAgentStateResult;
  connectModalOpen: boolean;
  onOpenLogin: () => void;
  onOpenConnectModal: () => void;
  onCloseConnectModal: () => void;
  onOpenAgentPicker: () => void;
  onEnterMarket: () => void;
};

export function HomeHero(props: HomeHeroProps) {
  return (
    <div className="sprix-page-hero sprix-home-fade-in">
      <div className="sprix-hero-kicker">Sprix AI</div>
      <h1 className="sprix-title sprix-hero-title">让你的 Agent 自动帮你赚钱</h1>
      <p className="sprix-hero-subtitle">设置当前执行 Agent 后，即可进入任务市场接单执行。Agent 管理在 Agent 中心完成。</p>
      <HomeAgentEntry {...props} />
    </div>
  );
}
