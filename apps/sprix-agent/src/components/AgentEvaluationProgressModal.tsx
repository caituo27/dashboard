import { Modal } from "antd";
import { AlertTriangle, Check, CircleAlert, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Agent, AgentEvaluation } from "../types";
import { ActionButton } from "./Primitives";
import { scoreText } from "../utils/format";

type AgentEvaluationProgressModalProps = {
  open: boolean;
  agent: Agent | null;
  evaluation?: AgentEvaluation;
  loading: boolean;
  error?: string;
  onClose: () => void;
};

function isEvaluationActive(status: AgentEvaluation["status"]) {
  return status === "running" || status === "judging";
}

function getStatusCopy(status: AgentEvaluation["status"], agentName: string) {
  if (status === "not_started") return "尚未开始测评";
  if (status === "completed") return "能力画像已生成";
  if (status === "failed") return "生成失败了";
  if (status === "judging") return "正在生成能力画像";
  return `正在测评 ${agentName}`;
}

const evaluationSteps = [
  { label: "安全边界", description: "识别约束、风险和不可执行范围。" },
  { label: "任务理解", description: "评估目标拆解、输入识别和执行路径。" },
  { label: "执行稳定性", description: "观察任务推进中的一致性和恢复能力。" },
  { label: "交付质量", description: "检查输出完整度、可读性和验收匹配度。" },
  { label: "工具协作", description: "评估本地工具调用和上下文使用方式。" },
  { label: "验证习惯", description: "归纳测试、检查和结果确认习惯。" }
];

const lastEvaluationStepIndex = evaluationSteps.length - 1;
const fakeEvaluationStepIntervalMs = 1_650;
// Keep the visual progress across Agent switches while this app instance is alive.
// The evaluationId makes a deliberate "重新测评" start from a fresh session.
const displayStepCache = new Map<string, number>();

export function clearAgentEvaluationProgressCache() {
  displayStepCache.clear();
}

function completedEvaluationStepCount(evaluation: AgentEvaluation | undefined) {
  const steps = evaluation?.steps?.length ? evaluation.steps : evaluation?.result?.steps ?? [];
  return steps.filter((step) => step.status.toLowerCase() === "completed").length;
}

function activeEvaluationStepIndex(evaluation: AgentEvaluation | undefined, status: AgentEvaluation["status"]) {
  if (status === "completed" || status === "judging") return lastEvaluationStepIndex;
  if (status === "failed") return Math.max(0, completedEvaluationStepCount(evaluation));
  return Math.min(lastEvaluationStepIndex, Math.max(0, completedEvaluationStepCount(evaluation)));
}

function evaluationStepClass(index: number, activeIndex: number, status: AgentEvaluation["status"]) {
  if (status === "completed") return "is-done";
  if (status === "failed" && index === activeIndex) return "is-error";
  if (index < activeIndex) return "is-done";
  if (index === activeIndex) return "is-active";
  return "is-waiting";
}

function evaluationStepState(index: number, activeIndex: number, status: AgentEvaluation["status"]) {
  if (status === "completed" || index < activeIndex) return "已完成";
  if (status === "failed" && index === activeIndex) return "异常";
  if (index === activeIndex) return "评测中";
  return "准备中";
}

function AgentEvaluationFailureState() {
  return (
    <div className="sprix-evaluation-failure">
      <div className="sprix-evaluation-failure-status">
        <CircleAlert size={20} />
        <span>评测未完成</span>
      </div>

      <div className="sprix-evaluation-failure-card">
        <div className="sprix-evaluation-failure-icon">
          <AlertTriangle size={38} />
        </div>
        <strong>本次评测暂未完成</strong>
        <p>可能与网络连接、Agent CLI 登录状态、账号额度或本机连接状态有关。请检查后稍后重试。</p>
      </div>
    </div>
  );
}

export function AgentEvaluationProgressModal({
  open,
  agent,
  evaluation,
  loading,
  error,
  onClose
}: AgentEvaluationProgressModalProps) {
  const status = evaluation?.status ?? "running";
  const result = evaluation?.result;
  const completedResult = result?.status === "completed" ? result : undefined;
  const agentName = agent?.name ?? "Agent";
  const isFailed = status === "failed" || result?.status === "failed" || Boolean(error);
  const isActive = !isFailed && (loading || isEvaluationActive(status));
  const isCompleted = !isFailed && status === "completed";
  const hasResultDetails = Boolean(completedResult?.summary) || Boolean(completedResult?.improvements.length);
  const serverActiveStepIndex = activeEvaluationStepIndex(evaluation, status);
  const [displayStepIndex, setDisplayStepIndex] = useState(0);
  const displayedEvaluationKeyRef = useRef<string>();
  const shouldUseFakeProgress = isActive && !isCompleted && !isFailed;
  const activeStepIndex = shouldUseFakeProgress ? Math.max(displayStepIndex, serverActiveStepIndex) : serverActiveStepIndex;
  const activeStep = evaluationSteps[activeStepIndex];
  const heroClassName = [
    "sprix-evaluation-step-hero",
    isActive ? "is-active" : "",
    isCompleted ? "is-completed" : "",
    isFailed ? "is-error" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const footer = isFailed ? (
    <div className="sprix-evaluation-footer is-failed">
      <ActionButton onClick={onClose}>稍后再试</ActionButton>
    </div>
  ) : (
    <div className="sprix-evaluation-footer">
      <span className={isActive ? "is-active" : ""}>
        {isActive ? "处理中，预计等待1-2分钟" : isCompleted ? "测评完成" : "尚未开始"}
      </span>
      <ActionButton onClick={onClose}>关闭</ActionButton>
    </div>
  );

  useEffect(() => {
    if (!agent) {
      displayedEvaluationKeyRef.current = undefined;
      setDisplayStepIndex(0);
      return;
    }

    const evaluationKey = `${agent.id}:${evaluation?.evaluationId ?? "pending"}`;
    if (displayedEvaluationKeyRef.current !== evaluationKey) {
      const continuesPendingEvaluation = displayedEvaluationKeyRef.current === `${agent.id}:pending` && Boolean(evaluation?.evaluationId);
      displayedEvaluationKeyRef.current = evaluationKey;
      const cachedStepIndex = evaluation?.evaluationId ? displayStepCache.get(evaluationKey) ?? 0 : 0;
      setDisplayStepIndex((currentStepIndex) =>
        continuesPendingEvaluation
          ? Math.max(currentStepIndex, cachedStepIndex, serverActiveStepIndex)
          : Math.max(cachedStepIndex, serverActiveStepIndex)
      );
      return;
    }

    setDisplayStepIndex((currentStepIndex) => {
      if (status === "completed" || status === "judging") return lastEvaluationStepIndex;
      if (status === "failed") return serverActiveStepIndex;
      return Math.max(currentStepIndex, serverActiveStepIndex);
    });
  }, [agent, evaluation?.evaluationId, serverActiveStepIndex, status]);

  useEffect(() => {
    if (!agent || !evaluation?.evaluationId) return;
    const evaluationKey = `${agent.id}:${evaluation.evaluationId}`;
    if (status === "completed" || status === "failed") {
      displayStepCache.delete(evaluationKey);
      return;
    }
    displayStepCache.set(evaluationKey, displayStepIndex);
  }, [agent, displayStepIndex, evaluation?.evaluationId, status]);

  useEffect(() => {
    if (!open || !agent || !shouldUseFakeProgress) return undefined;

    const timer = window.setInterval(() => {
      setDisplayStepIndex((currentStepIndex) => Math.min(lastEvaluationStepIndex, currentStepIndex + 1));
    }, fakeEvaluationStepIntervalMs);

    return () => window.clearInterval(timer);
  }, [agent?.id, open, shouldUseFakeProgress]);

  return (
    <Modal
      title={<div className="sprix-evaluation-title">生成 Agent 能力画像</div>}
      open={open && Boolean(agent)}
      onCancel={onClose}
      width={640}
      className="sprix-evaluation-modal sprix-evaluation-progress-modal"
      footer={footer}
    >
      <div className="sprix-evaluation-progress">
        {isFailed ? (
          <AgentEvaluationFailureState />
        ) : (
          <>
            <div className={heroClassName}>
              <div className="sprix-evaluation-step-core">
                <span />
                {isCompleted ? <Check size={18} /> : <Sparkles size={18} />}
              </div>
              <div className="sprix-evaluation-step-copy">
                <strong>{isActive ? `正在分析${activeStep.label}` : getStatusCopy(status, agentName)}</strong>
                <p>{isCompleted ? `${agentName} 已完成 6 项能力测评。` : "Sprix 正在逐项完成 Agent 能力画像，完成后会自动生成综合评分和改进建议。"}</p>
              </div>
              {isCompleted && completedResult && (
                <div className="sprix-evaluation-step-score">
                  <span>综合评分</span>
                  <strong>{scoreText(completedResult.overallScore)}</strong>
                </div>
              )}
              {!isCompleted && <div className="sprix-evaluation-step-count\">{`${activeStepIndex + 1}/6`}</div>}
            </div>

            {isCompleted ? (
              <div className="sprix-evaluation-complete-list">
                {evaluationSteps.map((step) => (
                  <div className="sprix-evaluation-complete-item" data-testid="evaluation-complete-item" key={step.label}>
                    <span>
                      <Check size={14} />
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sprix-evaluation-step-track">
                {evaluationSteps.map((step, index) => {
                  const stepClass = evaluationStepClass(index, activeStepIndex, status);
                  const isDone = stepClass === "is-done";
                  return (
                    <div className={`sprix-evaluation-step ${stepClass}`} data-testid="evaluation-step" key={step.label}>
                      <div className="sprix-evaluation-step-dot">{isDone ? <Check size={14} /> : index + 1}</div>
                      <div className="sprix-evaluation-step-text">
                        <span>{step.label}</span>
                        <p>{index === activeStepIndex || isDone ? step.description : ""}</p>
                      </div>
                      <div className="sprix-evaluation-step-state">{evaluationStepState(index, activeStepIndex, status)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {hasResultDetails && (
              <div className="sprix-evaluation-result is-compact">
                <div>
                  {completedResult?.summary && <p>{completedResult.summary}</p>}
                  {completedResult?.improvements.length ? (
                    <ul className="sprix-ability-result-improvements" aria-label="改进建议">
                      {completedResult.improvements.slice(0, 4).map((item, index) => (
                        <li key={`${index}-${item}`} className="sprix-ability-result-improvement">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
