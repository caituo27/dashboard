import { motion } from "framer-motion";
import { Card } from "./ui/Card";
import { RadarChart } from "./RadarChart";
import type { EvaluateResponse } from "../types";

export function Results({ data }: { data: EvaluateResponse }) {
  const { dimensions, result, transcript, agent } = data;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mt-7 flex flex-col gap-[22px]"
    >
      {transcript && transcript.length > 0 && (
        <Card className="p-7">
          <h2 className="mb-1 text-base font-semibold">
            面试问答记录{agent ? `（${agent}）` : ""}
          </h2>
          <p className="mb-4 text-[12.5px] text-ink-soft">
            以下是该 AI 对固定题目的真实回答，评分依此而来。
          </p>
          <div className="flex flex-col gap-4">
            {transcript.map((t, i) => (
              <div key={i} className="rounded-2xl border border-line bg-[#fcfcfc] p-4">
                <p className="mb-1.5 text-sm font-semibold">
                  Q{i + 1}. {t.question}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-[1.7] text-[#333]">
                  {t.answer}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-[22px] md:grid-cols-2">
      {/* chart card */}
      <Card className="flex flex-col items-center p-7">
        <div className="mb-2 flex flex-col items-center">
          <span className="font-serif text-[60px] leading-none">
            {typeof result.overallScore === "number" ? result.overallScore : "–"}
          </span>
          <span className="mt-1 text-[13px] text-ink-soft">综合评分</span>
        </div>
        <div className="mt-2 w-full max-w-full">
          <RadarChart dimensions={dimensions} result={result} />
        </div>
      </Card>

      {/* detail card */}
      <Card className="p-7">
        <h2 className="mb-[18px] text-base font-semibold">各维度评分</h2>
        <div className="flex flex-col gap-3.5">
          {dimensions.map((d, idx) => {
            const dim = result.dimensions[d.key];
            const score = Number(dim?.score) || 0;
            return (
              <div key={d.key} className="grid grid-cols-[70px_1fr_34px] items-center gap-3">
                <span className="text-[13px]">{d.label}</span>
                <div className="h-[7px] overflow-hidden rounded-full bg-[#f0f0ef]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg,#f9a8d4,#a5b4fc,#7dd3fc)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.06 }}
                  />
                </div>
                <span className="text-right text-[13px] font-semibold">{score}</span>
                {dim?.comment && (
                  <p className="col-span-3 -mt-1 text-xs leading-relaxed text-ink-soft">
                    {dim.comment}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="my-[18px] h-px bg-line" />

        <h3 className="mb-2.5 text-sm font-semibold">总体评语</h3>
        <p className="text-sm leading-[1.7] text-[#333]">{result.summary}</p>

        {result.improvements?.length > 0 && (
          <>
            <h3 className="mb-2.5 mt-[22px] text-sm font-semibold">改进建议</h3>
            <ul className="list-disc pl-[18px]">
              {result.improvements.map((t, i) => (
                <li key={i} className="mb-1.5 text-sm leading-[1.7] text-[#333]">
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      </div>
    </motion.section>
  );
}
