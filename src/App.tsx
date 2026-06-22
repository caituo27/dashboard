import { useState } from "react";
import { Aurora } from "./components/Aurora";
import { NavBar } from "./components/NavBar";
import { Hero } from "./components/Hero";
import { Evaluator } from "./components/Evaluator";
import { Results } from "./components/Results";
import { evaluate, interview } from "./lib/api";
import type { EvaluateResponse, SubmitRequest } from "./types";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<EvaluateResponse | null>(null);

  async function handleSubmit(req: SubmitRequest) {
    setError("");
    setLoading(true);
    try {
      const res =
        req.kind === "interview"
          ? await interview(req.body)
          : await evaluate(req.body);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "评估失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Aurora />
      <NavBar />

      <main className="relative z-10 mx-auto max-w-[980px] px-7 pb-20">
        <Hero />
        <Evaluator
          loading={loading}
          onSubmit={handleSubmit}
          onResult={(resp) => {
            setError("");
            setData(resp);
          }}
        />

        {error && (
          <div className="mt-5 rounded-2xl border border-[#ffd9d9] bg-[#fff4f4] px-[18px] py-4 text-sm text-[#b42318]">
            ⚠ {error}
          </div>
        )}

        {data && <Results data={data} />}
      </main>

      <footer className="relative z-10 px-7 pb-12 pt-8 text-center text-[13px] text-ink-soft">
        本地运行 · 调用你本机的 Codex CLI · 不上传任何数据到第三方
      </footer>
    </div>
  );
}
