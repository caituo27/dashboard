import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "./ui/Card";
import { PillButton } from "./ui/PillButton";
import { ModeTabs } from "./ui/ModeTabs";
import { getAgents } from "../lib/api";
import { InterviewModal } from "./InterviewModal";
import type { AgentInfo, EvaluateResponse, SubmitRequest } from "../types";

type Mode = "dir" | "text" | "interview";

interface Props {
  loading: boolean;
  onSubmit: (req: SubmitRequest) => void;
  onResult: (resp: EvaluateResponse) => void;
}

export function Evaluator({ loading, onSubmit, onResult }: Props) {
  const [mode, setMode] = useState<Mode>("dir");
  const [dir, setDir] = useState("");
  const [config, setConfig] = useState("");
  const [hint, setHint] = useState("");
  const [localError, setLocalError] = useState("");

  // interview state
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agent, setAgent] = useState<string>("");
  const [interviewDir, setInterviewDir] = useState("");
  const [agentsError, setAgentsError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    getAgents()
      .then((list) => {
        if (!list.length) throw new Error("empty");
        setAgents(list);
        const first = list.find((a) => a.available);
        if (first) setAgent(first.id);
      })
      .catch(() => {
        // /api/agents missing (old backend not restarted?) — fall back to a
        // usable default list and warn instead of spinning forever.
        setAgents([
          { id: "codex", label: "Codex", available: true },
          { id: "claude", label: "Claude Code", available: true },
        ]);
        setAgent("codex");
        setAgentsError(true);
      });
  }, []);

  function submit() {
    setLocalError("");
    if (mode === "dir") {
      if (!dir.trim()) return setLocalError("请输入要扫描的目录或文件的绝对路径。");
      onSubmit({ kind: "evaluate", body: { dir: dir.trim() } });
    } else if (mode === "text") {
      if (!config.trim()) return setLocalError("请先粘贴或上传配置内容。");
      onSubmit({ kind: "evaluate", body: { config: config.trim() } });
    } else {
      if (!agent) return setLocalError("请选择要面试的 AI。");
      setModalOpen(true);
    }
  }

  const agentLabel = agents.find((a) => a.id === agent)?.label || agent;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setConfig(text);
    setHint(`已载入 ${file.name}（${text.length} 字）`);
  }

  const inputClass =
    "w-full rounded-2xl border border-line bg-[#fcfcfc] px-4 py-[15px] font-mono text-sm outline-none transition-colors focus:border-[#d4d4d2]";

  return (
    <motion.div
      id="evaluator"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6 }}
    >
      <Card className="mt-2 p-7">
        <div className="mb-4 flex items-center justify-between">
          <ModeTabs<Mode>
            tabs={[
              { value: "dir", label: "扫描目录" },
              { value: "text", label: "粘贴文本" },
              { value: "interview", label: "对话评估" },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setHint("");
              setLocalError("");
            }}
          />
          {mode === "text" && (
            <label className="cursor-pointer rounded-full border border-line bg-[#fafafa] px-3.5 py-[7px] text-[13px] transition-colors hover:bg-[#f0f0ef]">
              上传文件
              <input
                type="file"
                accept=".toml,.md,.json,.txt,.yaml,.yml"
                hidden
                onChange={onFile}
              />
            </label>
          )}
        </div>

        {mode === "dir" && (
          <div>
            <input
              id="dir-input"
              type="text"
              value={dir}
              onChange={(e) => setDir(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="目录或文件的绝对路径，例如 /Users/yyx/.codex 或 /Users/yyx/.codex/AGENTS.md"
              className={inputClass}
            />
            <p className="mx-0.5 mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
              填<strong>目录</strong>：Codex 会进入该目录自动找出并通读相关配置文件
              （AGENTS.md、CLAUDE.md、.codex/config.toml、.cursorrules 等）。填
              <strong>单个文件</strong>：只评估该文件。
            </p>
          </div>
        )}

        {mode === "text" && (
          <textarea
            value={config}
            onChange={(e) => {
              setConfig(e.target.value);
              setHint(e.target.value.trim() ? `${e.target.value.length} 字` : "");
            }}
            placeholder="在此粘贴你的配置内容，例如 ~/.codex/config.toml、CLAUDE.md、AGENTS.md ..."
            className="min-h-[220px] w-full resize-y rounded-2xl border border-line bg-[#fcfcfc] p-4 font-mono text-[13px] leading-relaxed outline-none transition-colors focus:border-[#d4d4d2]"
          />
        )}

        {mode === "interview" && (
          <div>
            <p className="mb-2 text-[13px] text-ink-soft">选择要面试的 AI</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {agents.map((a) => {
                const active = a.id === agent;
                return (
                  <button
                    key={a.id}
                    disabled={!a.available}
                    onClick={() => setAgent(a.id)}
                    className={
                      "rounded-full border px-4 py-2 text-[13px] transition-all " +
                      (active
                        ? "border-pill bg-pill text-white"
                        : a.available
                          ? "border-line bg-[#fafafa] text-ink hover:bg-[#f0f0ef]"
                          : "cursor-not-allowed border-line bg-[#fafafa] text-ink-soft opacity-50")
                    }
                  >
                    {a.label}
                    {!a.available && "（未安装）"}
                  </button>
                );
              })}
              {agents.length === 0 && (
                <span className="text-[13px] text-ink-soft">正在检测可用的 AI…</span>
              )}
            </div>
            {agentsError && (
              <p className="mb-3 text-[12.5px] leading-relaxed text-[#b42318]">
                ⚠ 自动检测失败（后端可能未重启）。已用默认列表；若开始面试报错，请在终端
                Ctrl+C 后重新 <code>npm start</code>。
              </p>
            )}
            <input
              type="text"
              value={interviewDir}
              onChange={(e) => setInterviewDir(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="（可选）项目目录绝对路径，让你的配置在该 AI 上生效"
              className={inputClass}
            />
            <p className="mx-0.5 mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
              评估器会向所选 AI 提一组固定问题，根据它的真实回答打分（裁判固定用
              Codex，保证标准统一）。填了项目目录就评「你的配置下该 AI 的真实表现」。约需 1~2 分钟。
            </p>
          </div>
        )}

        <div className="mt-[18px] flex items-center justify-between gap-4">
          <span className="text-[13px] text-ink-soft">
            {localError ? (
              <span className="text-[#b42318]">⚠ {localError}</span>
            ) : (
              hint
            )}
          </span>
          <PillButton id="evaluate-btn" onClick={submit} disabled={loading}>
            {loading ? (
              <>
                <span className="inline-block h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]" />
                {mode === "interview" ? "面试中…" : "评估中…"}
              </>
            ) : mode === "interview" ? (
              "✦ 开始面试"
            ) : (
              "✦ Evaluate"
            )}
          </PillButton>
        </div>
      </Card>

      {modalOpen && (
        <InterviewModal
          agent={agent}
          agentLabel={agentLabel}
          dir={interviewDir.trim() || undefined}
          onClose={() => setModalOpen(false)}
          onDone={(resp) => {
            setModalOpen(false);
            onResult(resp);
          }}
        />
      )}
    </motion.div>
  );
}
