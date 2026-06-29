import { Modal } from "antd";
import { Sparkles } from "lucide-react";
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

const evaluationSignals = ["安全边界", "任务理解", "执行稳定性", "交付质量", "工具协作", "验证习惯"];

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

        <div className={`sprix-evaluation-loader ${isActive ? "is-active" : ""} ${status === "failed" ? "is-error" : ""}`}>
          <div className="sprix-evaluation-loader-ring">
            <span />
            <span />
            <i />
            <Sparkles size={22} />
          </div>
          <div className="sprix-evaluation-loader-copy">
            <span className="sprix-evaluation-loader-kicker">Sprix AI Portrait</span>
            <strong>{getStatusCopy(status, agentName)}</strong>
            <p>{status === "completed" ? `${agentName} 已完成能力画像生成。` : status === "failed" ? "测评没有完成，请稍后重新发起。" : "正在调用本地 Agent 生成能力画像，请稍候。"}</p>
          </div>
        </div>

        <div className={`sprix-evaluation-signal-board ${isActive ? "is-active" : ""}`}>
          {evaluationSignals.map((label, index) => (
            <div key={label} style={{ animationDelay: `${index * 80}ms` }}>
              <span>{label}</span>
              <i />
            </div>
          ))}
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
