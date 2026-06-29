import { QrPayloadBox } from "../components/QrSession";
import { getQrLoginStatusText, type QrLoginProvider } from "./authTypes";
import { useQrLoginSession } from "./useQrLoginSession";

type QrLoginPanelProps = {
  provider: QrLoginProvider;
  active: boolean;
  onAuthenticated: () => Promise<void>;
};

export function QrLoginPanel({ provider, active, onAuthenticated }: QrLoginPanelProps) {
  const { loading, session, status, expiresInSeconds } = useQrLoginSession({ provider, active, onAuthenticated });
  const statusText = getQrLoginStatusText(provider, status, expiresInSeconds, Boolean(session));

  return (
    <div className="grid justify-items-center gap-5 pb-4 pt-8">
      <QrPayloadBox value={session?.qrPayload} placeholder={loading ? "二维码生成中" : "二维码加载失败"} />
      <p className="m-0 text-center text-sm leading-6 text-ink-soft">{statusText}</p>
    </div>
  );
}
