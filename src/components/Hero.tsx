import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const ROTATING = ["AI Config", "Codex 配置", "Claude 规则", "AGENTS.md"];

export function Hero() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ROTATING.length), 3400);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="px-7 pb-12 pt-14 text-center"
    >
      <p className="mb-3 font-serif text-[19px] text-ink-soft">
        AI Config Evaluator
      </p>
      <h1 className="whitespace-nowrap font-serif text-[clamp(28px,5.4vw,68px)] font-normal leading-[1.12] tracking-[-0.5px]">
        Rate Your
        {/* Fixed-width slot: all words stack in one grid cell, so the slot is
            as wide as the longest word and the line never shifts. Only opacity
            changes — a pure, slow cross-dissolve in place. */}
        <span className="relative mx-[0.32em] inline-grid align-baseline">
          {ROTATING.map((w, idx) => (
            <span
              key={w}
              aria-hidden={idx !== i}
              style={{ opacity: idx === i ? 1 : 0 }}
              className="col-start-1 row-start-1 whitespace-nowrap text-center italic transition-opacity duration-1000 ease-in-out"
            >
              {w}
            </span>
          ))}
        </span>
        Instantly
      </h1>
      <p className="mx-auto mt-5 max-w-[540px] text-base leading-relaxed text-ink-soft">
        粘贴或指定目录，本地 AI 从六个维度为你的配置打分，并生成雷达图。
      </p>
    </motion.section>
  );
}
