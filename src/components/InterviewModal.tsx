import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { askQuestion, getQuestions, judge } from "../lib/api";
import type { EvaluateResponse, TranscriptItem } from "../types";

type Status = "pending" | "asking" | "done" | "failed";
interface Item {
  question: string;
  answer: string;
  status: Status;
}

interface Props {
  agent: string;
  agentLabel: string;
  dir?: string;
  onClose: () => void;
  onDone: (resp: EvaluateResponse) => void;
}

export function InterviewModal({ agent, agentLabel, dir, onClose, onDone }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<"asking" | "judging" | "error">("asking");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    const set = (fn: (prev: Item[]) => Item[]) => !cancelled && setItems(fn);

    (async () => {
      try {
        const qs = await getQuestions();
        if (cancelled) return;
        setItems(qs.map((q) => ({ question: q, answer: "", status: "pending" })));

        const transcript: TranscriptItem[] = [];
        for (let i = 0; i < qs.length; i++) {
          if (cancelled) return;
          set((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: "asking" } : it))
          );
          try {
            const answer = await askQuestion({ agent, question: qs[i], dir });
            if (cancelled) return;
            transcript.push({ question: qs[i], answer });
            set((prev) =>
              prev.map((it, idx) =>
                idx === i ? { ...it, answer, status: "done" } : it
              )
            );
          } catch (e) {
            if (cancelled) return;
            const msg = e instanceof Error ? e.message : String(e);
            const answer = `（获取回答失败：${msg}）`;
            transcript.push({ question: qs[i], answer });
            set((prev) =>
              prev.map((it, idx) =>
                idx === i ? { ...it, answer, status: "failed" } : it
              )
            );
          }
        }
        if (cancelled) return;
        if (transcript.every((t) => t.answer.startsWith("（获取回答失败"))) {
          throw new Error(`所有问题都没能从 ${agentLabel} 获取到回答。`);
        }

        setPhase("judging");
        const resp = await judge({ agent, transcript });
        if (cancelled) return;
        onDone(resp);
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(e instanceof Error ? e.message : "面试失败");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = items.length;
  const done = items.filter((it) => it.status === "done" || it.status === "failed").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-h-[82vh] w-full max-w-[640px] flex-col overflow-hidden rounded-card border border-line bg-card shadow-soft"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-base font-semibold">
            面试 {agentLabel}
            {total > 0 && phase === "asking" && (
              <span className="ml-2 text-[13px] font-normal text-ink-soft">
                {done}/{total}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full px-2 text-xl leading-none text-ink-soft transition-colors hover:text-ink"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">
            {items.map((it, i) => (
              <div key={i} className="rounded-2xl border border-line bg-[#fcfcfc] p-4">
                <p className="mb-1.5 flex items-start gap-2 text-sm font-semibold">
                  <span className="text-ink-soft">Q{i + 1}.</span>
                  <span>{it.question}</span>
                </p>
                {it.status === "pending" && (
                  <p className="text-[13px] text-ink-soft">待提问…</p>
                )}
                {it.status === "asking" && (
                  <p className="flex items-center gap-2 text-[13px] text-ink-soft">
                    <Spinner /> 提问中…
                  </p>
                )}
                {(it.status === "done" || it.status === "failed") && (
                  <p
                    className={
                      "whitespace-pre-wrap text-sm leading-[1.7] " +
                      (it.status === "failed" ? "text-[#b42318]" : "text-[#333]")
                    }
                  >
                    {it.answer}
                  </p>
                )}
              </div>
            ))}
            {items.length === 0 && phase === "asking" && (
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <Spinner /> 准备题目…
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-line px-6 py-4">
          {phase === "asking" && (
            <p className="text-[13px] text-ink-soft">
              逐题向 {agentLabel} 提问中，请稍候…
            </p>
          )}
          {phase === "judging" && (
            <p className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Spinner /> 问答完成，Codex 正在评分…
            </p>
          )}
          {phase === "error" && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-[#b42318]">⚠ {errorMsg}</span>
              <button
                onClick={onClose}
                className="rounded-full bg-pill px-5 py-2 text-[13px] text-white"
              >
                关闭
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-2 border-ink-soft/30 border-t-ink-soft align-[-2px]" />
  );
}
