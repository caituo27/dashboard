import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Progress } from "antd";
import { BrainCircuit, Info, UserRoundCheck } from "lucide-react";
import type { Agent, AgentEvaluation } from "../types";
import { SoftTag, StatusTag, Surface } from "../components/Primitives";
import {
  evaluationDimensionLabels,
  getAgentAbilityResult,
  getAgentAdmissionSummary,
  getAgentEvaluationStatusLabel,
  hasPendingAgentEvaluation
} from "./agentResult";

function evaluationDimensions(result: AgentEvaluation["result"]) {
  return Object.entries(evaluationDimensionLabels).map(([key, label]) => ({
    key,
    label,
    score: Number(result.dimensions[key]?.score) || 0,
    comment: result.dimensions[key]?.comment
  }));
}

type AgentAbilityProfileProps = {
  agent?: Agent;
  embedded?: boolean;
  showScore?: boolean;
  resultPresentation?: boolean;
  compactDetails?: boolean;
  dimensionInteraction?: AbilityDimensionInteraction;
};

type HoverCopyProps = {
  text: string;
  className: string;
  enabled: boolean;
};

function HoverCopy({ text, className, enabled }: HoverCopyProps) {
  const detailId = useId();
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    if (!enabled) return;
    const content = contentRef.current;
    if (!content) return;

    const measureOverflow = () => {
      setOverflowing(content.scrollHeight > content.clientHeight + 1);
    };

    measureOverflow();
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(content);
    return () => observer.disconnect();
  }, [enabled, text]);

  if (!enabled) return <p className={className}>{text}</p>;

  return (
    <div
      className={`sprix-hover-copy ${overflowing ? "has-overflow" : ""}`}
      tabIndex={overflowing ? 0 : undefined}
      aria-describedby={overflowing ? detailId : undefined}
    >
      <p ref={contentRef} className={className}>
        {text}
      </p>
      {overflowing && (
        <div id={detailId} className="sprix-hover-copy-detail" role="tooltip">
          {text}
        </div>
      )}
    </div>
  );
}

type EvaluationDimension = ReturnType<typeof evaluationDimensions>[number];

export type AbilityDimensionInteraction = {
  enabled: boolean;
  activeDimensionKey: string | null;
  setHoveredDimensionKey: (dimensionKey: string | null) => void;
  clearSelection: () => void;
};

export function useAbilityDimensionInteraction(enabled: boolean): AbilityDimensionInteraction {
  const [hoveredDimensionKey, setHoveredDimensionKey] = useState<string | null>(null);

  return {
    enabled,
    activeDimensionKey: enabled ? hoveredDimensionKey : null,
    setHoveredDimensionKey: (dimensionKey) => {
      setHoveredDimensionKey(enabled ? dimensionKey : null);
    },
    clearSelection: () => {
      setHoveredDimensionKey(null);
    }
  };
}

type EvaluationRadarProps = {
  result: AgentEvaluation["result"];
  interaction?: AbilityDimensionInteraction;
};

export function EvaluationRadar({ result, interaction }: EvaluationRadarProps) {
  const dimensions = evaluationDimensions(result);
  const size = 220;
  const center = size / 2;
  const radius = 76;
  const rings = [20, 40, 60, 80, 100];
  const interactive = interaction?.enabled ?? false;
  const pointFor = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
    const nextRadius = radius * (value / 100);
    return {
      x: center + Math.cos(angle) * nextRadius,
      y: center + Math.sin(angle) * nextRadius
    };
  };
  const pointsForValue = (value: number) =>
    dimensions
      .map((_, index) => {
        const point = pointFor(index, value);
        return `${point.x},${point.y}`;
      })
      .join(" ");
  const polygon = dimensions
    .map((item, index) => {
      const point = pointFor(index, item.score);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  const handleDimensionKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (!interactive || event.key !== "Escape") return;
    event.preventDefault();
    interaction?.clearSelection();
  };

  return (
    <svg
      className={`sprix-evaluation-radar ${interactive ? "is-interactive" : ""}`}
      viewBox={`0 0 ${size} ${size}`}
      role="group"
      aria-label="六维能力雷达图，可悬停能力维度查看详情"
    >
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={pointsForValue(ring)}
          className="sprix-evaluation-radar-ring"
        />
      ))}
      {dimensions.map((item, index) => {
        const axisEnd = pointFor(index, 100);
        const labelX = center + (axisEnd.x - center) * 1.18;
        const labelY = center + (axisEnd.y - center) * 1.18;
        const hitStartX = center + (axisEnd.x - center) * 0.36;
        const hitStartY = center + (axisEnd.y - center) * 0.36;
        const active = interaction?.activeDimensionKey === item.key;
        return (
          <g
            key={item.key}
            className={`sprix-evaluation-radar-dimension ${active ? "is-active" : ""}`}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `${item.label} ${item.score} 分` : undefined}
            onMouseEnter={() => interaction?.setHoveredDimensionKey(item.key)}
            onMouseLeave={() => interaction?.setHoveredDimensionKey(null)}
            onFocus={() => interaction?.setHoveredDimensionKey(item.key)}
            onBlur={() => interaction?.setHoveredDimensionKey(null)}
            onKeyDown={handleDimensionKeyDown}
          >
            <line
              x1={center}
              y1={center}
              x2={axisEnd.x}
              y2={axisEnd.y}
              className="sprix-evaluation-radar-axis"
            />
            {interactive && (
              <line
                x1={hitStartX}
                y1={hitStartY}
                x2={labelX}
                y2={labelY}
                className="sprix-evaluation-radar-hit-area"
              />
            )}
            <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="sprix-evaluation-radar-label">
              {item.label}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} className="sprix-evaluation-radar-area" />
      <polyline points={`${polygon} ${polygon.split(" ")[0]}`} className="sprix-evaluation-radar-line" />
      {dimensions.map((item, index) => {
        const point = pointFor(index, item.score);
        const active = interaction?.activeDimensionKey === item.key;
        return (
          <circle
            key={item.key}
            cx={point.x}
            cy={point.y}
            r={active ? 5.2 : 3.8}
            className={`sprix-evaluation-radar-dot ${active ? "is-active" : ""}`}
          />
        );
      })}
      <circle cx={center} cy={center} r="24" className="sprix-evaluation-radar-score-backdrop" />
      <text x={center} y={center - 2} textAnchor="middle" className="sprix-evaluation-radar-score">
        {result.overallScore ?? "-"}
      </text>
      <text x={center} y={center + 12} textAnchor="middle" className="sprix-evaluation-radar-score-label">
        综合评分
      </text>
    </svg>
  );
}

export function AgentAbilityProfile({
  agent,
  embedded = false,
  showScore = false,
  resultPresentation = false,
  compactDetails = false,
  dimensionInteraction
}: AgentAbilityProfileProps) {
  const contentId = useId();
  const localDimensionInteraction = useAbilityDimensionInteraction(compactDetails);
  const resolvedDimensionInteraction = dimensionInteraction ?? localDimensionInteraction;
  const ability = getAgentAbilityResult(agent);
  const summary = agent ? getAgentAdmissionSummary(agent) : undefined;
  const evaluationResult = agent?.evaluation?.result?.status === "completed" ? agent.evaluation.result : undefined;
  const evaluationStatusLabel = agent?.evaluation ? getAgentEvaluationStatusLabel(agent.evaluation) : "";
  const dimensions = evaluationResult ? evaluationDimensions(evaluationResult) : [];
  const careerRoleName = evaluationResult?.careerProfile?.roleName?.trim();
  const careerSummary = careerRoleName ? evaluationResult?.summary?.trim() : "";
  const isAbilityPending = !evaluationResult && hasPendingAgentEvaluation(agent);

  const content = (
    <>
      {careerRoleName && (
        <div className="sprix-ability-career-block">
          <div className="sprix-ability-career-panel">
            <span>职位定位：</span>
            <strong>{careerRoleName}</strong>
          </div>
          {careerSummary && (
            <HoverCopy
              text={careerSummary}
              className="sprix-ability-career-summary"
              enabled={compactDetails}
            />
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">能力画像</h3>
        {agent?.evaluation &&
          (resultPresentation && evaluationStatusLabel === "能力画像已生成" ? (
            <span className="sprix-ability-generated-status">
              <UserRoundCheck size={14} strokeWidth={1.8} aria-hidden="true" />
              {evaluationStatusLabel}
            </span>
          ) : (
            <StatusTag status={evaluationStatusLabel} />
          ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-soft">最近评测：{summary?.lastEvaluatedAt ?? "-"}</p>
      {evaluationResult ? (
        <div className={`sprix-ability-profile mt-5 ${showScore ? "" : "is-bars-only"}`}>
          {showScore && (
            <div className="sprix-ability-score">
              <EvaluationRadar
                result={evaluationResult}
                interaction={resolvedDimensionInteraction}
              />
            </div>
          )}
          <div className="sprix-ability-detail">
            <div className="sprix-ability-bars">
              {dimensions.map((dimension, index) => {
                const detailId = `${contentId}-${dimension.key}-detail`;
                const detailOpen = resolvedDimensionInteraction.activeDimensionKey === dimension.key;
                return (
                  <div key={dimension.key} className={`sprix-ability-dimension ${detailOpen ? "is-detail-open" : ""}`}>
                    <div
                      className="sprix-ability-dimension-row"
                      aria-describedby={dimension.comment ? detailId : undefined}
                      tabIndex={dimension.comment && compactDetails ? 0 : undefined}
                      onMouseEnter={() => resolvedDimensionInteraction.setHoveredDimensionKey(dimension.key)}
                      onMouseLeave={() => resolvedDimensionInteraction.setHoveredDimensionKey(null)}
                      onFocus={() => resolvedDimensionInteraction.setHoveredDimensionKey(dimension.key)}
                      onBlur={() => resolvedDimensionInteraction.setHoveredDimensionKey(null)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") resolvedDimensionInteraction.clearSelection();
                      }}
                    >
                      <span>{dimension.label}</span>
                      <div>
                        <span style={{ width: `${dimension.score}%`, transitionDelay: `${index * 60}ms` }} />
                      </div>
                      <strong>{dimension.score}</strong>
                      {dimension.comment && compactDetails && (
                        <Info className="sprix-ability-dimension-info" size={14} aria-hidden="true" />
                      )}
                    </div>
                    {dimension.comment && !compactDetails && <p className="sprix-ability-dimension-copy">{dimension.comment}</p>}
                    {dimension.comment && compactDetails && (
                      <div id={detailId} className="sprix-ability-dimension-detail" role="tooltip">
                        <strong>{dimension.label}</strong>
                        <p>{dimension.comment}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {evaluationResult.summary && !careerRoleName && <p className="sprix-ability-summary">{evaluationResult.summary}</p>}
            {!resultPresentation && evaluationResult.improvements.length > 0 && (
              <div className="sprix-ability-improvements">
                {evaluationResult.improvements.map((item) => (
                  <SoftTag key={item} tone="amber">
                    {item}
                  </SoftTag>
                ))}
              </div>
            )}
          </div>
          {resultPresentation && evaluationResult.improvements.length > 0 && (
            <section className="sprix-ability-result-improvements" aria-labelledby={`${contentId}-improvements`}>
              <div className="sprix-ability-improvements-heading">
                <h4 id={`${contentId}-improvements`}>改进建议</h4>
                <span>{evaluationResult.improvements.length} 条</span>
              </div>
              <ul>
                {evaluationResult.improvements.map((item, index) => (
                  <li key={`${index}-${item}`} className="sprix-ability-result-improvement">
                    <HoverCopy
                      text={item}
                      className="sprix-ability-improvement-copy"
                      enabled={compactDetails}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : isAbilityPending ? (
        <div className="sprix-ability-pending mt-5">
          <div className="sprix-ability-pending-head">
            <span>能力画像生成中</span>
          </div>
          <div className="sprix-ability-pending-bars">
            {Object.values(evaluationDimensionLabels).map((label, index) => (
              <div key={label} className="sprix-ability-pending-row">
                <span>{label}</span>
                <div>
                  <i style={{ animationDelay: `${index * 90}ms` }} />
                </div>
                <em>待生成</em>
              </div>
            ))}
          </div>
        </div>
      ) : ability.kind === "profile" ? (
        <div className="mt-5 space-y-4">
          {ability.rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-ink-soft">{row.label}</span>
                <span className="font-semibold text-ink">{row.value}</span>
              </div>
              <Progress percent={row.value} showInfo={false} strokeColor="#0f766e" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-line p-7 text-center">
          <BrainCircuit className="mx-auto text-ink-soft" />
          <h4 className="mt-3 text-lg font-semibold">{ability.title}</h4>
          <p className="mt-2 text-sm text-ink-soft">{ability.description}</p>
        </div>
      )}
    </>
  );

  return embedded ? <div className="sprix-embedded-ability-profile">{content}</div> : <Surface className="p-6">{content}</Surface>;
}
