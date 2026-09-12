import { RefreshCw } from "lucide-react";
import { QrPayloadBox } from "../components/QrSession";
import { getQrLoginStatusText, isSessionExpired, type QrLoginProvider } from "./authTypes";
import { PhoneBindPanel } from "./PhoneBindPanel";
import { useQrLoginSession } from "./useQrLoginSession";

type QrLoginPanelProps = {
  provider: QrLoginProvider;
  active: boolean;
  onAuthenticated: () => Promise<void>;
};

export function QrLoginPanel({ provider, active, onAuthenticated }: QrLoginPanelProps) {
  const { loading, session, status, expiresInSeconds, bindTicket, refresh } = useQrLoginSession({ provider, active, onAuthenticated });
  const statusText = getQrLoginStatusText(provider, status, expiresInSeconds, Boolean(session));
  const showRefresh = Boolean(session) || loading || status === "ERROR" || isSessionExpired(status, expiresInSeconds);

  if (bindTicket) {
    return <PhoneBindPanel provider={provider} bindTicket={bindTicket} onAuthenticated={onAuthenticated} />;
  }

  return (
    <div className="grid justify-items-center gap-5 pb-4 pt-8">
      <QrPayloadBox value={session?.qrPayload} placeholder={loading ? "二维码生成中" : "二维码加载失败"} />
      <div className="grid justify-items-center gap-2 text-center text-sm leading-6 text-ink-soft">
        {showRefresh && (
          <button
            type="button"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium leading-5 text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "刷新中" : "刷新二维码"}
          </button>
        )}
        <p className="m-0">{statusText}</p>
      </div>
    </div>
  );
}
