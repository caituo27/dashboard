import { Modal } from "antd";
import { Check, Sparkles } from "lucide-react";
import type { Agent, AgentEvaluation } from "../types";
import { ActionButton, SoftTag } from "./Primitives";
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
  if (status === "completed") return "能力画像已生成";
  if (status === "failed") return "测评失败";
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

function completedEvaluationStepCount(evaluation: AgentEvaluation | undefined) {
  const steps = evaluation?.steps?.length ? evaluation.steps : evaluation?.result?.steps ?? [];
  return steps.filter((step) => step.status.toLowerCase() === "completed").length;
}

function activeEvaluationStepIndex(evaluation: AgentEvaluation | undefined, status: AgentEvaluation["status"]) {
  if (status === "completed" || status === "judging") return evaluationSteps.length - 1;
  if (status === "failed") return Math.max(0, completedEvaluationStepCount(evaluation));
  return Math.min(evaluationSteps.length - 1, Math.max(1, completedEvaluationStepCount(evaluation)));
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
  const isActive = loading || isEvaluationActive(status);
  const agentName = agent?.name ?? "Agent";
  const activeStepIndex = activeEvaluationStepIndex(evaluation, status);
  const activeStep = evaluationSteps[activeStepIndex];

  return (
    <Modal
      title={<div className="sprix-evaluation-title">生成 Agent 能力画像</div>}
      open={open && Boolean(agent)}
      onCancel={onClose}
      width={640}
      className="sprix-evaluation-modal sprix-evaluation-progress-modal"
      footer={
        <div className="sprix-evaluation-footer">
          <span className={isActive ? "is-active" : ""}>
            {isActive ? "处理中，关闭弹框不会取消后端任务" : status === "completed" ? "测评完成" : "测评失败"}
          </span>
          <ActionButton onClick={onClose}>关闭</ActionButton>
        </div>
      }
    >
      <div className="sprix-evaluation-progress">
        {error && <p className="sprix-evaluation-error">{error}</p>}

        <div className={`sprix-evaluation-step-hero ${isActive ? "is-active" : ""} ${status === "failed" ? "is-error" : ""}`}>
          <div className="sprix-evaluation-step-core">
            <span />
            <Sparkles size={18} />
          </div>
          <div className="sprix-evaluation-step-copy">
            <strong>{isActive ? `正在分析${activeStep.label}` : getStatusCopy(status, agentName)}</strong>
            <p>{status === "completed" ? `${agentName} 已完成能力画像生成。` : status === "failed" ? "测评没有完成，请稍后重新发起。" : "Sprix 正在逐项完成 Agent 能力画像，完成后会自动生成综合评分和改进建议。"}</p>
          </div>
          <div className="sprix-evaluation-step-count">
            {status === "completed" ? "6/6" : `${activeStepIndex + 1}/6`}
          </div>
        </div>

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

        {result?.status === "completed" && (
          <div className="sprix-evaluation-result">
            <div>
              <span>综合评分</span>
              <strong>{scoreText(result.overallScore)}</strong>
            </div>
            <div>
              {result.summary && <p>{result.summary}</p>}
              {result.improvements.length > 0 && (
                <div className="sprix-evaluation-result-tags">
                  {result.improvements.slice(0, 4).map((item) => (
                    <SoftTag key={item} tone="amber">
                      {item}
                    </SoftTag>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {result?.status === "failed" && <p className="sprix-evaluation-error">{result.error ?? "评测失败"}</p>}
      </div>
    </Modal>
  );
}
