import { useState } from "react";
import { message } from "antd";
import { Copy, Eye, EyeOff } from "lucide-react";
import { maskPhone } from "../utils/displayText";

type PhoneNumberProps = {
  value?: string | null;
  copyable?: boolean;
};

async function copyPhoneNumber(value: string) {
  await navigator.clipboard.writeText(value);
  message.success("手机号已复制");
}

export function PhoneNumber({ value, copyable = false }: PhoneNumberProps) {
  const [revealed, setRevealed] = useState(false);
  const source = value?.trim() ?? "";
  const masked = maskPhone(source);
  const canReveal = Boolean(source && !source.includes("*") && masked !== source);
  const canCopy = Boolean(copyable && source);

  if (!canReveal && !canCopy) return <span className="tabular-nums">{masked}</span>;

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
      {canReveal ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-inherit transition-colors hover:text-brand"
          aria-expanded={revealed}
          aria-label={revealed ? "隐藏完整手机号" : "查看完整手机号"}
          title={revealed ? "点击隐藏手机号" : "点击查看完整手机号"}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setRevealed((current) => !current);
          }}
        >
          <span>{revealed ? source : masked}</span>
          {revealed ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
        </button>
      ) : (
        <span>{masked}</span>
      )}
      {canCopy && (
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded text-ink-soft transition-colors hover:bg-black/[0.05] hover:text-ink"
          aria-label="复制手机号"
          title="复制手机号"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void copyPhoneNumber(source).catch(() => message.error("手机号复制失败"));
          }}
        >
          <Copy size={13} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
