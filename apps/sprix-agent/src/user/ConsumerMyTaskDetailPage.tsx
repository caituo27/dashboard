import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Steps } from "antd";
import { consumerMockEnabled, isMockTask, readConsumerTask } from "../services/consumerMock";
import { useSprixStore } from "../store/sprixStore";
import { ActionButton, EmptyState, SecondaryButton, SoftTag, StatusTag, Surface } from "../components/Primitives";
import { currency } from "../utils/format";
import { getMyTaskActions } from "./userFlowRules";
import { useRerunTask } from "./useRerunTask";
import { getExecutionArtifactsState, getExecutionBackendPendingSections, getExecutionRequirementText, getExecutionReviewState } from "./consumerExecutionDetailView";
export function ConsumerMyTaskDetailPage({ openAppeal }: { openAppeal: (id: string) => void }) {
  const { id } = useParams();
  const task = useSprixStore((state) => state.myTasks.find((item) => item.id === id));
  const storedBase = useSprixStore((state) => state.tasks.find((item) => item.id === task?.taskId));
  const baseQuery=useQuery({queryKey:['sprix-agent','consumer-task',task?.taskId],queryFn:()=>readConsumerTask(task!.taskId),enabled:consumerMockEnabled && !!task && isMockTask(task.taskId),refetchInterval:10000,refetchIntervalInBackground:false});
  const base=task && isMockTask(task.taskId) ? baseQuery.data : storedBase;
  const rerunTask = useRerunTask();
  if(consumerMockEnabled && task && isMockTask(task.taskId) && baseQuery.isPending) return <p>执行详情加载中…</p>;
  if(consumerMockEnabled && task && isMockTask(task.taskId) && baseQuery.isError) return <Alert type="error" message="执行详情读取失败" action={<SecondaryButton onClick={()=>baseQuery.refetch()}>重试</SecondaryButton>}/>;
  if (!task || !base) return <EmptyState title="执行记录不存在" description="该任务记录暂不可访问" action={<SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>} />;
  const requirementText = getExecutionRequirementText(base);
  const review = getExecutionReviewState(task, base);
  const artifacts = getExecutionArtifactsState(base);
  const pendingSections = getExecutionBackendPendingSections();
  const actions = getMyTaskActions(task);
  const taskActions = (
    <div className="flex flex-wrap gap-2">
      {actions.appealLabel && (
        <ActionButton disabled={!actions.appealEnabled} onClick={() => actions.appealEnabled && openAppeal(task.id)}>
          {actions.appealLabel}
        </ActionButton>
      )}
      {actions.rerun && <SecondaryButton onClick={() => rerunTask(task.id)}>重新执行</SecondaryButton>}
    </div>
  );
  return (
    <div className="sprix-task-detail-page">
      <div className="sprix-detail-toolbar">
        <SecondaryButton href="/agent/my-tasks">返回我的任务</SecondaryButton>
      </div>
      <Surface className="sprix-execution-hero p-6">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusTag status={task.status} />
            {task.appealStatus && <StatusTag status={task.appealStatus} />}
            <SoftTag>{task.currentNode}</SoftTag>
          </div>
          <h1 className="text-3xl font-semibold leading-tight text-ink">{task.title}</h1>
          <p className="mt-3 text-sm leading-7 text-ink-soft">
            {task.category} · {task.agentName} · {task.startedAt} · {currency(task.reward)}
          </p>
        </div>
        <div className="sprix-execution-hero-progress">
          <span>执行进度</span>
          <strong>{task.progress || "-"}</strong>
        </div>
      </Surface>
      <Surface className="sprix-execution-progress-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">执行流转</h2>
            <p className="mt-1 text-sm text-ink-soft">平台按节点推进执行、质检、验收和入账。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SoftTag>{task.currentNode}</SoftTag>
            <SoftTag tone="neutral">{task.progress}</SoftTag>
            {(actions.appealLabel || actions.rerun) && taskActions}
          </div>
        </div>
        <Steps
          className="sprix-execution-steps mt-5"
          current={task.status === "执行中" ? 2 : 5}
          items={["已接单", "解析任务", "生成结果", "质量检查", "平台验收", "报酬入账"].map((title) => ({ title }))}
        />
      </Surface>
      <div className="sprix-execution-content-grid">
        <Surface className="p-6">
          <h3 className="text-lg font-semibold text-ink">交付与验收</h3>
          {review.kind === "content" ? (
            <p className="mt-3 whitespace-pre-line text-[15px] leading-8 text-ink-soft">{review.body}</p>
          ) : (
            <InlineEmpty title={review.title} description={review.description} />
          )}
        </Surface>
        <Surface className="p-6">
          <h3 className="text-lg font-semibold text-ink">任务要求</h3>
          {requirementText ? (
            <p className="mt-3 whitespace-pre-line text-[15px] leading-8 text-ink-soft">{requirementText}</p>
          ) : (
            <InlineEmpty title="任务要求待后端返回" description="后端尚未返回任务描述、交付标准或验收标准。" />
          )}
        </Surface>
        <Surface className="p-6">
          <h3 className="text-lg font-semibold text-ink">执行文件</h3>
          {artifacts.kind === "records" ? (
            <div className="mt-4 space-y-2">
              {artifacts.files.map((file) => (
                <div key={file} className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
                  {file}
                </div>
              ))}
            </div>
          ) : (
            <InlineEmpty title={artifacts.title} description={artifacts.description} />
          )}
        </Surface>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {pendingSections.map((section) => (
          <Surface key={section.title} className="p-6">
            <InlineEmpty title={section.title} description={section.description} />
          </Surface>
        ))}
      </div>
    </div>
  );
}

function InlineEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">
      <b className="block text-ink">{title}</b>
      <span>{description}</span>
    </div>
  );
}
