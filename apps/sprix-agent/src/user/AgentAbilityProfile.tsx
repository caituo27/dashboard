import { Progress } from "antd";
import { BrainCircuit, UserRoundCheck } from "lucide-react";
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
};

export function EvaluationRadar({ result }: { result: AgentEvaluation["result"] }) {
  const dimensions = evaluationDimensions(result);
  const size = 220;
  const center = size / 2;
  const radius = 76;
  const rings = [20, 40, 60, 80, 100];
  const pointFor = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
    const nextRadius = radius * (value / 100);
    return `${center + Math.cos(angle) * nextRadius},${center + Math.sin(angle) * nextRadius}`;
  };
  const polygon = dimensions.map((item, index) => pointFor(index, item.score)).join(" ");

  return (
    <svg className="sprix-evaluation-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="六维能力雷达图">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={dimensions.map((_, index) => pointFor(index, ring)).join(" ")}
          className="sprix-evaluation-radar-ring"
        />
      ))}
      {dimensions.map((item, index) => {
        const axisEnd = pointFor(index, 100);
        const [x, y] = axisEnd.split(",").map(Number);
        const labelX = center + (x - center) * 1.18;
        const labelY = center + (y - center) * 1.18;
        return (
          <g key={item.key}>
            <line x1={center} y1={center} x2={x} y2={y} className="sprix-evaluation-radar-axis" />
            <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="sprix-evaluation-radar-label">
              {item.label}
            </text>
          </g>
        );
      })}
      <polygon points={polygon} className="sprix-evaluation-radar-area" />
      <polyline points={`${polygon} ${polygon.split(" ")[0]}`} className="sprix-evaluation-radar-line" />
      {dimensions.map((item, index) => {
        const [x, y] = pointFor(index, item.score).split(",").map(Number);
        return <circle key={item.key} cx={x} cy={y} r="3.8" className="sprix-evaluation-radar-dot" />;
      })}
    </svg>
  );
}

export function AgentAbilityProfile({
  agent,
  embedded = false,
  showScore = true,
  resultPresentation = false
}: AgentAbilityProfileProps) {
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
          {careerSummary && <p className="sprix-ability-career-summary">{careerSummary}</p>}
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
              <strong>{evaluationResult.overallScore ?? "-"}</strong>
              <span>综合评分</span>
              <EvaluationRadar result={evaluationResult} />
            </div>
          )}
          <div className="sprix-ability-detail">
            <div className="sprix-ability-bars">
              {dimensions.map((dimension, index) => (
                <div key={dimension.key} className="sprix-ability-dimension">
                  <div className="sprix-ability-dimension-row">
                    <span>{dimension.label}</span>
                    <div>
                      <span style={{ width: `${dimension.score}%`, transitionDelay: `${index * 60}ms` }} />
                    </div>
                    <strong>{dimension.score}</strong>
                  </div>
                  {dimension.comment && <p>{dimension.comment}</p>}
                </div>
              ))}
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
            <ul className="sprix-ability-result-improvements" aria-label="改进建议">
              {evaluationResult.improvements.map((item, index) => (
                <li key={`${index}-${item}`} className="sprix-ability-result-improvement">
                  {item}
                </li>
              ))}
            </ul>
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
