import { useState } from "react";
import { Button, Modal, message } from "antd";
import { Copy, Eye, EyeOff } from "lucide-react";
import { maskPhone } from "../utils/displayText";

type PhoneNumberProps = {
  value?: string | null;
  virtualValue?: string | null;
  copyable?: boolean;
};

async function copyPhoneNumber(value: string) {
  await navigator.clipboard.writeText(value);
  message.success("手机号已复制");
}

export function PhoneNumber({ value, virtualValue, copyable = false }: PhoneNumberProps) {
  const [revealed, setRevealed] = useState(false);
  const source = value?.trim() ?? "";
  const virtualPhone = virtualValue?.trim() ?? "";
  const masked = maskPhone(source);
  const canRevealVirtual = Boolean(virtualPhone && source && !source.includes("*"));
  const canReveal = Boolean(source && !source.includes("*") && masked !== source);
  const canCopy = Boolean(copyable && source && !canRevealVirtual);

  if (canRevealVirtual) {
    return (
      <>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-left text-inherit tabular-nums transition-colors hover:text-brand"
          aria-label="查看真实手机号"
          title="点击查看真实手机号"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setRevealed(true);
          }}
        >
          <span>{virtualPhone}</span>
          <Eye size={14} aria-hidden="true" />
        </button>
        <Modal
          title="查看真实手机号"
          open={revealed}
          onCancel={(event) => {
            event.stopPropagation();
            setRevealed(false);
          }}
          footer={null}
          centered
          width={420}
          modalRender={(node) => <div onClick={(event) => event.stopPropagation()}>{node}</div>}
        >
          <div className="py-2">
            <p className="text-sm text-ink-soft">真实手机号</p>
            <div className="mt-2 flex items-center justify-between gap-4 rounded-md border border-line bg-black/[0.02] px-4 py-3">
              <span className="text-base font-medium tabular-nums text-ink">{source}</span>
              <Button
                size="small"
                icon={<Copy size={13} aria-hidden="true" />}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void copyPhoneNumber(source).catch(() => message.error("手机号复制失败"));
                }}
              >
                复制
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

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
