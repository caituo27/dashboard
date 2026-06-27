import { QRCode } from "antd";

export const qrBoxClassName = [
  "mx-auto flex h-48 w-48 items-center justify-center rounded-[22px]",
  "border border-line bg-white p-3 text-center text-sm text-ink-soft"
].join(" ");

type QrPayloadBoxProps = {
  readonly value?: string;
  readonly placeholder: string;
};

export function QrPayloadBox({ value, placeholder }: QrPayloadBoxProps) {
  return (
    <div className={qrBoxClassName}>
      {value ? <QRCode type="svg" value={value} size={168} bordered={false} /> : <span>{placeholder}</span>}
    </div>
  );
}

export function formatRemainingSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
