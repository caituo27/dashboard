import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { maskPhone } from "../utils/displayText";

export function PhoneNumber({ value }: { value?: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const source = value?.trim() ?? "";
  const masked = maskPhone(source);
  const canReveal = Boolean(source && !source.includes("*") && masked !== source);

  if (!canReveal) return <span className="tabular-nums">{masked}</span>;

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-left tabular-nums text-inherit transition-colors hover:text-brand"
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
  );
}
