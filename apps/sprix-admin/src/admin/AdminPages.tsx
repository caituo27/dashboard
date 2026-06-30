import { useEffect, useState } from "react";
import type { Key } from "react";
import { Button, Form, Input, InputNumber, Modal, Segmented, Select, Table, Tabs, Tooltip, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CircleDollarSign, ClipboardList, ShieldCheck } from "lucide-react";
import type { AdminAppeal, AdminOperationLog, CompletedExecution, FundException, Payout, ReviewingExecution, RunningExecution, Settlement, Task, TerminatedExecution, Withdrawal } from "../types";
import {
  approveRemoteAcceptanceReview,
  approveRemoteAppeal,
  approveRemoteWithdrawal,
  createRemoteAdminTask,
  deleteRemoteAdminTask,
  markRemotePayoutExceptionHandled,
  markRemoteWithdrawalPayoutFailed,
  offlineRemoteAdminTask,
  payRemoteWithdrawal,
  postRemoteSettlement,
  queryRemoteWithdrawalPayout,
  readRemoteAppeals,
  readRemoteAppealDetail,
  readRemoteAcceptanceReviews,
  readRemoteFunds,
  readRemoteTaskCenterSnapshot,
  readRemoteTaskDetail,
  rejectRemoteAcceptanceReview,
  rejectRemoteAppeal,
  rejectRemoteWithdrawal,
  republishRemoteAdminTask,
  returnRemoteWithdrawalForReview,
  startRemoteAppeal,
  updateRemoteAdminTask,
  type UpsertAdminTaskPayload
} from "../services/sprixApi";
import { ActionButton, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface, primitiveIcons } from "../components/Primitives";
import { currency } from "../utils/format";
import { isGlobalAuthError } from "../utils/http";
import { getAdminExecutionRecordActions, type AdminExecutionRecordAction } from "./adminExecutionView";
import {
  getAdminPayoutBatchActions,
  getAdminPayoutExportAction,
  getAdminSettlementDetailAction,
  getAdminWithdrawalBatchActions,
  type AdminPendingFundAction
} from "./adminFundView";
import { getAdminTaskWriteAction, type AdminTaskWriteAction } from "./adminTaskActions";
import { getAdminEstimatedTokenField } from "./tokenEstimateView";

function getAppealBackendId(record: AdminAppeal) {
  return record.backendId ?? record.appealNo;
}

function getSettlementBackendId(record: Pick<Settlement, "backendId" | "settlementNo">) {
  return record.backendId ?? record.settlementNo;
}

function getWithdrawalBackendId(record: Pick<Withdrawal | Payout, "backendId" | "withdrawalNo">) {
  return record.backendId ?? record.withdrawalNo;
}

function getFundExceptionBackendId(record: Pick<FundException, "backendId" | "withdrawalNo">) {
  return record.backendId ?? record.withdrawalNo;
}

function showRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${error.message}` : fallback);
}

const taskCategoryOptions = ["等待产品输入"].map((value) => ({ value, label: value }));
const taskFormFields = ["title", "category", "sourceType", "description", "deliverables", "acceptanceCriteria", "reward", "totalSlots"] as const;

function buildTaskFormInitialValues(task?: Task): Partial<UpsertAdminTaskPayload> {
  if (!task) return {};
  return {
    title: task.title,
    category: task.category,
    sourceType: task.sourceType,
    description: task.description,
    deliverables: task.deliverables,
    acceptanceCriteria: task.acceptanceCriteria,
    reward: task.reward,
    totalSlots: task.totalSlots
  };
}

function normalizeTaskFormValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : value;
}

function hasTaskFormChanges(currentValues: Partial<UpsertAdminTaskPayload>, initialValues: Partial<UpsertAdminTaskPayload>) {
  return taskFormFields.some((field) => normalizeTaskFormValue(currentValues[field]) !== normalizeTaskFormValue(initialValues[field]));
}

export function AdminTaskCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const taskCenterQuery = useQuery({
    queryKey: ["sprix-admin", "task-center"],
    queryFn: readRemoteTaskCenterSnapshot,
    retry: 1
  });
  const [tab, setTab] = useState("全部");
  const [keyword, setKeyword] = useState("");
  if (taskCenterQuery.isLoading) return <Surface className="p-8">任务数据加载中</Surface>;
  if (taskCenterQuery.isError) {
    const messageText = taskCenterQuery.error instanceof Error ? taskCenterQuery.error.message : "任务数据加载失败";
    return <Surface className="p-8">任务数据加载失败：{messageText}</Surface>;
  }
  const tasks = taskCenterQuery.data?.tasks ?? [];
  const acceptanceReviews = taskCenterQuery.data?.acceptanceReviews ?? [];
  const appealCount = taskCenterQuery.data?.appealCount ?? 0;
  const visibleTasks = tasks.filter((task) => {
    if (task.taskStatus === "已删除") return false;
    if (tab !== "全部" && task.taskStatus !== tab) return false;
    const query = keyword.trim();
    if (!query) return true;
    return `${task.title}${task.category}${task.sourceType}`.includes(query);
  });
  const executionCount = tasks.reduce((sum, task) => sum + (task.executionTotal ?? 0), 0);
  const reviewCount = acceptanceReviews.length;
  const selectTaskTab = (nextTab: string) => {
    setTab(nextTab);
    setKeyword("");
  };
  const refreshTasks = () => queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
  const editTaskFromListAction = { ...getAdminTaskWriteAction("edit"), label: "编辑" };
  const runTaskAction = async (action: () => Promise<unknown>, successText: string) => {
    try {
      await action();
      await refreshTasks();
      message.success(successText);
    } catch (error) {
      showRequestError(error, successText.replace("已", "") + "失败");
    }
  };
  const confirmTaskAction = (task: Task, action: AdminTaskWriteAction) => {
    if (action.kind === "edit") {
      navigate(`/tasks/${task.id}/edit`);
      return;
    }
    if (action.kind === "offline") {
      Modal.confirm({
        title: "确认下线该任务？",
        content: task.title,
        okText: "确认下线",
        cancelText: "取消",
        onOk: () => runTaskAction(() => offlineRemoteAdminTask(task.id, "Admin offlined task"), "已下线任务")
      });
      return;
    }
    if (action.kind === "republish") {
      Modal.confirm({
        title: "确认重新发布该任务？",
        content: task.title,
        okText: "重新发布",
        cancelText: "取消",
        onOk: () => runTaskAction(() => republishRemoteAdminTask(task.id), "已重新发布任务")
      });
      return;
    }
    Modal.confirm({
      title: "确认删除该任务？",
      content: "删除后任务会被标记为已删除。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => runTaskAction(() => deleteRemoteAdminTask(task.id, "Admin deleted task"), "已删除任务")
    });
  };
  const taskColumns: ColumnsType<Task> = [
    {
      title: "任务",
      dataIndex: "title",
      width: 320,
      render: (_, task) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{task.title}</span>
            <StatusTag status={task.taskStatus} />
          </div>
          <div className="mt-1 text-xs text-ink-soft">
            {task.category} · {task.sourceType}
          </div>
        </div>
      )
    },
    { title: "奖励", dataIndex: "reward", width: 110, render: currency },
    {
      title: "名额",
      width: 110,
      render: (_, task) => `${task.remainingSlots}/${task.totalSlots}`
    },
    { title: "执行记录", dataIndex: "executionTotal", width: 110, render: (value) => value ?? 0 },
    { title: "待审核", dataIndex: "reviewingExecutionCount", width: 100, render: (value) => value ?? 0 },
    { title: "发布时间", dataIndex: "publishedAt", width: 160 },
    {
      title: "备注",
      dataIndex: "offlineReason",
      width: 180,
      render: (value) => (value ? <SoftTag tone="amber">下线原因：{value}</SoftTag> : <span className="text-ink-soft">-</span>)
    },
    {
      title: "操作",
      fixed: "right",
      width: 280,
      render: (_, task) => (
        <div className="sprix-task-action-group" onClick={(event) => event.stopPropagation()}>
          <TaskWriteButton action={editTaskFromListAction} onClick={() => confirmTaskAction(task, editTaskFromListAction)} />
          {task.taskStatus === "已发布" ? (
            <>
              <TaskWriteButton action={getAdminTaskWriteAction("offline")} onClick={() => confirmTaskAction(task, getAdminTaskWriteAction("offline"))} />
              <TaskWriteButton action={getAdminTaskWriteAction("delete")} onClick={() => confirmTaskAction(task, getAdminTaskWriteAction("delete"))} />
            </>
          ) : (
            <>
              <TaskWriteButton action={getAdminTaskWriteAction("republish")} onClick={() => confirmTaskAction(task, getAdminTaskWriteAction("republish"))} />
              <TaskWriteButton action={getAdminTaskWriteAction("delete")} onClick={() => confirmTaskAction(task, getAdminTaskWriteAction("delete"))} />
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="Sprix 管理后台"
        title="任务管理中心"
        subtitle="集中查看任务发布状态、执行记录、申诉数量和任务操作。"
        actions={<TaskWriteButton action={getAdminTaskWriteAction("publish")} primary onClick={() => navigate("/tasks/new")} />}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="全部任务" value={tasks.filter((task) => task.taskStatus !== "已删除").length} icon={<ClipboardList size={19} />} active={tab === "全部"} onClick={() => selectTaskTab("全部")} />
        <MetricCard title="已发布任务" value={tasks.filter((task) => task.taskStatus === "已发布").length} active={tab === "已发布"} onClick={() => selectTaskTab("已发布")} />
        <MetricCard title="已下线任务" value={tasks.filter((task) => task.taskStatus === "已下线").length} active={tab === "已下线"} onClick={() => selectTaskTab("已下线")} />
        <MetricCard title="执行记录" value={executionCount} icon={primitiveIcons.clock} onClick={() => selectTaskTab("全部")} />
        <MetricCard title="待平台审核" value={reviewCount} icon={<ShieldCheck size={19} />} onClick={() => navigate("/acceptance")} />
        <MetricCard title="申诉记录" value={appealCount} icon={<ShieldCheck size={19} />} onClick={() => navigate("/appeals")} />
      </div>
      <Surface className="sprix-table-card p-4">
        <div className="sprix-toolbar">
          <div className="sprix-toolbar-row flex-col items-start lg:flex-row lg:items-center">
            <h3 className="sprix-section-title">任务列表</h3>
            <Input.Search className="max-w-[360px]" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索任务名称或分类" />
          </div>
          <Segmented options={["全部", "已发布", "已下线"]} value={tab} onChange={(value) => setTab(String(value))} />
        </div>
        <Table
          rowKey="id"
          columns={taskColumns}
          dataSource={visibleTasks}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1180 }}
          rowClassName="cursor-pointer"
          locale={{ emptyText: "暂无任务" }}
          onRow={(task) => ({ onClick: () => navigate(`/tasks/${task.id}`) })}
        />
      </Surface>
    </>
  );
}

export function AdminAcceptanceCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const acceptanceQuery = useQuery({
    queryKey: ["sprix-admin", "acceptance-reviews"],
    queryFn: readRemoteAcceptanceReviews,
    retry: 1
  });
  const refreshAcceptance = () => queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
  const { approveAcceptanceReview, rejectAcceptanceReview } = useAcceptanceReviewActions(refreshAcceptance);

  if (acceptanceQuery.isLoading) return <Surface className="p-8">平台验收中心数据加载中</Surface>;
  if (acceptanceQuery.isError) {
    const messageText = acceptanceQuery.error instanceof Error ? acceptanceQuery.error.message : "平台验收中心数据加载失败";
    return <Surface className="p-8">平台验收中心数据加载失败：{messageText}</Surface>;
  }

  const acceptanceReviews = acceptanceQuery.data ?? [];
  const taskCount = new Set(acceptanceReviews.map((record) => record.taskTitle).filter(Boolean)).size;
  const userCount = new Set(acceptanceReviews.map((record) => record.userName).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        eyebrow="Sprix 管理后台"
        title="平台验收中心"
        subtitle="集中审核 Agent 提交的任务验收结果，确认通过后进入结算和打款流程。"
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard title="待审核记录" value={acceptanceReviews.length} icon={<ShieldCheck size={19} />} />
        <MetricCard title="涉及任务" value={taskCount} icon={<ClipboardList size={19} />} />
        <MetricCard title="执行用户" value={userCount} />
      </div>
      <Surface className="sprix-table-card p-4">
        <div className="sprix-toolbar">
          <div className="sprix-toolbar-row flex-col items-start lg:flex-row lg:items-center">
            <h3 className="sprix-section-title">验收审核列表</h3>
          </div>
        </div>
        <AcceptanceReviewTable
          data={acceptanceReviews}
          showTask
          onOpenDetail={(record) => navigate(`/acceptance/${encodeURIComponent(record.executionId)}`)}
          onApprove={approveAcceptanceReview}
          onReject={rejectAcceptanceReview}
        />
      </Surface>
    </>
  );
}

export function AdminAcceptanceDetail() {
  const navigate = useNavigate();
  const { executionId } = useParams();
  const queryClient = useQueryClient();
  const acceptanceQuery = useQuery({
    queryKey: ["sprix-admin", "acceptance-reviews"],
    queryFn: readRemoteAcceptanceReviews,
    retry: 1
  });
  const returnToList = async () => {
    await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
    navigate("/acceptance", { replace: true });
  };
  const { approveAcceptanceReview, rejectAcceptanceReview } = useAcceptanceReviewActions(returnToList);

  if (!executionId) return <Surface className="p-8">验收详情参数缺失</Surface>;
  if (acceptanceQuery.isLoading) return <Surface className="p-8">验收详情加载中</Surface>;
  if (acceptanceQuery.isError) {
    const messageText = acceptanceQuery.error instanceof Error ? acceptanceQuery.error.message : "验收详情加载失败";
    return <Surface className="p-8">验收详情加载失败：{messageText}</Surface>;
  }

  const record = (acceptanceQuery.data ?? []).find((item) => item.executionId === executionId);
  if (!record) {
    return (
      <>
        <PageHeader title="验收详情" subtitle="当前执行记录已处理或不存在。" actions={<SecondaryButton href="/acceptance">返回平台验收中心</SecondaryButton>} />
        <Surface className="p-8 text-sm text-ink-soft">没有找到对应的待验收记录。</Surface>
      </>
    );
  }

  return (
    <>
      <div className="sprix-detail-heading">
        <button className="sprix-detail-back" type="button" onClick={() => navigate("/acceptance")} aria-label="返回平台验收中心">
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0">
          <div className="sprix-page-kicker">平台验收中心</div>
          <h1 className="sprix-detail-title">{record.taskTitle || "验收详情"}</h1>
        </div>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard title="验收状态" value={<StatusTag status={record.acceptanceStatus} />} icon={<ShieldCheck size={19} />} />
        <MetricCard title="验收评分" value={record.acceptanceScore} />
        <MetricCard title="Agent 评分" value={record.agentScore} />
        <MetricCard title="当前节点" value={<span className="text-lg">{record.currentNode}</span>} />
      </div>
      <Surface className="mb-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="sprix-section-title">审核操作</h3>
            <p className="mt-1 text-sm text-ink-soft">确认该执行结果是否满足任务交付和验收要求。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => approveAcceptanceReview(record)}>通过</ActionButton>
            <SecondaryButton danger onClick={() => rejectAcceptanceReview(record)}>不通过</SecondaryButton>
          </div>
        </div>
      </Surface>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Surface className="p-4">
          <h3 className="sprix-section-title">执行信息</h3>
          <InfoGrid
            rows={[
              ["executionId", record.executionId],
              ["关联任务", record.taskTitle || "-"],
              ["任务分类", record.taskCategory || "-"],
              ["执行用户", record.userName],
              ["手机号", record.phone],
              ["执行 Agent", record.agentName],
              ["提交时间", record.submittedAt],
              ["当前进度", record.progress]
            ]}
          />
        </Surface>
        <Surface className="p-4">
          <h3 className="sprix-section-title">验收结果</h3>
          <LongTextBlock title="验收摘要" body={record.acceptanceSummary} />
          <LongTextBlock title="问题记录" body={record.acceptanceIssues} />
        </Surface>
      </div>
    </>
  );
}

function useAcceptanceReviewActions(afterAction: () => Promise<unknown>) {
  const approveAcceptanceReview = (record: ReviewingExecution) => {
    Modal.confirm({
      title: "确认平台审核通过",
      content: "审核通过后将生成结算记录、自动入账，并直接发起平台支付宝打款。请确认用户已绑定可出款的支付宝账户。",
      okText: "审核通过",
      onOk: async () => {
        try {
          await approveRemoteAcceptanceReview(record.executionId);
          await afterAction();
          message.success("平台审核已通过，已发起直接打款");
        } catch (error) {
          message.error(error instanceof Error ? `审核通过失败：${error.message}` : "审核通过失败");
        }
      }
    });
  };
  const rejectAcceptanceReview = (record: ReviewingExecution) => {
    Modal.confirm({
      title: "确认平台审核不通过",
      content: "审核不通过后，用户任务将变为验收未通过，并可按现有规则发起申诉。",
      okText: "审核不通过",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await rejectRemoteAcceptanceReview(record.executionId, "平台人工复核不通过");
          await afterAction();
          message.success("已处理为平台审核不通过");
        } catch (error) {
          message.error(error instanceof Error ? `审核驳回失败：${error.message}` : "审核驳回失败");
        }
      }
    });
  };
  return { approveAcceptanceReview, rejectAcceptanceReview };
}

function InfoGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mt-4 grid gap-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 sm:grid-cols-[120px_1fr]">
          <dt className="text-ink-soft">{label}</dt>
          <dd className="min-w-0 text-ink">
            <EllipsisCell value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LongTextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 first:mt-3">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <p className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-[#fafafa] p-3 text-sm leading-7 text-ink-soft">{body || "-"}</p>
    </div>
  );
}

function TaskWriteButton({ action, primary = false, onClick }: { action: AdminTaskWriteAction; primary?: boolean; onClick?: () => void }) {
  const ButtonComponent = primary ? ActionButton : SecondaryButton;
  const button = (
    <ButtonComponent className={primary ? undefined : "sprix-task-action-button"} size={primary ? undefined : "small"} danger={action.danger} disabled={action.disabled} onClick={onClick}>
      {action.label}
    </ButtonComponent>
  );
  if (!action.reason) return button;
  return (
    <Tooltip title={action.reason}>
      {button}
    </Tooltip>
  );
}

function EllipsisCell({ value }: { value?: string | number | null }) {
  const text = value == null || value === "" ? "-" : String(value);
  return (
    <Tooltip title={text === "-" ? undefined : text}>
      <span className="sprix-table-ellipsis-cell">{text}</span>
    </Tooltip>
  );
}

function AcceptanceReviewTable({
  data,
  showTask = false,
  onOpenDetail,
  onApprove,
  onReject
}: {
  data: ReviewingExecution[];
  showTask?: boolean;
  onOpenDetail?: (record: ReviewingExecution) => void;
  onApprove: (record: ReviewingExecution) => void;
  onReject: (record: ReviewingExecution) => void;
}) {
  const columns: ColumnsType<ReviewingExecution> = [
    ...(showTask
      ? [
          { title: "关联任务", dataIndex: "taskTitle", width: 260, render: (value) => <EllipsisCell value={value} /> },
          { title: "任务分类", dataIndex: "taskCategory", width: 130, render: (value) => <EllipsisCell value={value} /> }
        ] satisfies ColumnsType<ReviewingExecution>
      : []),
    { title: "执行用户", dataIndex: "userName", width: 130, render: (value) => <EllipsisCell value={value} /> },
    { title: "手机号", dataIndex: "phone", width: 140, render: (value) => <EllipsisCell value={value} /> },
    { title: "执行 Agent", dataIndex: "agentName", width: 160, render: (value) => <EllipsisCell value={value} /> },
    { title: "Agent 综合评分", dataIndex: "agentScore", width: 130 },
    { title: "验收状态", dataIndex: "acceptanceStatus", width: 140, render: (value) => <StatusTag status={value} /> },
    { title: "验收评分", dataIndex: "acceptanceScore", width: 110 },
    { title: "验收摘要", dataIndex: "acceptanceSummary", width: 260, render: (value) => <EllipsisCell value={value} /> },
    { title: "问题记录", dataIndex: "acceptanceIssues", width: 280, render: (value) => <EllipsisCell value={value} /> },
    { title: "当前节点", dataIndex: "currentNode", width: 130, render: (value) => <EllipsisCell value={value} /> },
    { title: "提交时间", dataIndex: "submittedAt", width: 160 },
    {
      title: "操作",
      fixed: "right",
      width: 240,
      render: (_, record) => (
        <div className="flex flex-nowrap items-center gap-1 whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
          {onOpenDetail && <Button size="small" type="link" onClick={() => onOpenDetail(record)}>查看</Button>}
          <Button size="small" type="link" onClick={() => onApprove(record)}>通过</Button>
          <Button size="small" type="link" danger onClick={() => onReject(record)}>不通过</Button>
        </div>
      )
    }
  ];
  return (
    <Table
      className="mt-4"
      rowKey="executionId"
      dataSource={data}
      columns={columns}
      pagination={{ pageSize: 6 }}
      locale={{ emptyText: "暂无待平台审核记录" }}
      scroll={{ x: showTask ? 1860 : 1460 }}
      rowClassName={onOpenDetail ? "cursor-pointer" : undefined}
      onRow={onOpenDetail ? (record) => ({ onClick: () => onOpenDetail(record) }) : undefined}
    />
  );
}

export function AdminTaskForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: editTaskId } = useParams();
  const [form] = Form.useForm<UpsertAdminTaskPayload>();
  const editTaskQuery = useQuery({
    queryKey: ["sprix-admin", "task-detail", editTaskId],
    queryFn: () => readRemoteTaskDetail(editTaskId as string),
    enabled: Boolean(editTaskId),
    retry: 1
  });
  const editTask = editTaskQuery.data?.task;
  const isEdit = Boolean(editTaskId);
  const estimatedToken = getAdminEstimatedTokenField();

  const initialValues = buildTaskFormInitialValues(editTask);

  useEffect(() => {
    if (!editTask) return;
    form.setFieldsValue(buildTaskFormInitialValues(editTask));
  }, [editTask, form]);

  const writeAction = getAdminTaskWriteAction(isEdit ? "edit" : "publish");
  const submitTask = async (values: UpsertAdminTaskPayload) => {
    try {
      if (isEdit && editTaskId) {
        await updateRemoteAdminTask(editTaskId, values);
        message.success("任务已保存");
      } else {
        await createRemoteAdminTask(values);
        message.success("任务已发布");
      }
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      navigate("/tasks");
    } catch (error) {
      showRequestError(error, "任务保存失败");
    }
  };
  const returnToTaskCenter = () => navigate("/tasks");
  const cancelTaskForm = () => {
    const currentValues = form.getFieldsValue([...taskFormFields]);
    if (!hasTaskFormChanges(currentValues, initialValues)) {
      returnToTaskCenter();
      return;
    }
    Modal.confirm({
      title: "当前填写内容尚未发布，取消后将不会保存。确认取消吗？",
      okText: "确认取消",
      cancelText: "继续编辑",
      onOk: returnToTaskCenter
    });
  };

  if (editTaskId && editTaskQuery.isLoading) return <Surface className="p-8">任务详情加载中</Surface>;
  if (editTaskQuery.isError) {
    const messageText = editTaskQuery.error instanceof Error ? editTaskQuery.error.message : "任务详情加载失败";
    return <Surface className="p-8">任务详情加载失败：{messageText}</Surface>;
  }
  if (editTaskId && !editTask) return <Surface className="p-8">任务不存在</Surface>;

  return (
    <>
      <PageHeader title={isEdit ? "编辑任务" : "发布新任务"} subtitle="维护任务基础信息、交付要求、验收口径和接单奖励。" />
      <Surface className="p-4">
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={submitTask}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <Form.Item label="任务名称" name="title" rules={[{ required: true, message: "请输入任务名称" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="任务类型" name="category" rules={[{ required: true, message: "请选择任务类型" }]}>
              <Select placeholder="等待产品输入" options={taskCategoryOptions} />
            </Form.Item>
            <Form.Item label="任务来源类型" name="sourceType" rules={[{ required: true, message: "请输入任务来源类型" }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item label="详细任务描述" name="description" rules={[{ required: true, message: "请输入详细任务描述" }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <div className="grid gap-4 lg:grid-cols-2">
            <Form.Item label="交付标准" name="deliverables" rules={[{ required: true, message: "请输入交付标准" }]}>
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item label="验收标准" name="acceptanceCriteria" rules={[{ required: true, message: "请输入验收标准" }]}>
              <Input.TextArea rows={4} />
            </Form.Item>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Form.Item label="任务奖励" name="reward" rules={[{ required: true, message: "请输入任务奖励" }]}>
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item label="总名额" name="totalSlots" rules={[{ required: true, message: "请输入总名额" }]}>
              <InputNumber min={1} className="w-full" />
            </Form.Item>
          </div>
          <div className="mb-4 rounded-2xl bg-[#fafafa] p-4 text-sm leading-7 text-ink-soft">
            <b className="mr-2 text-ink">{estimatedToken.label}：</b>
            <span>{estimatedToken.value}</span>
            <p className="mt-1">{estimatedToken.helper}</p>
          </div>
          <div className="flex gap-2">
            <ActionButton htmlType="submit" disabled={writeAction.disabled}>{writeAction.label}</ActionButton>
            <SecondaryButton onClick={cancelTaskForm}>
              取消
            </SecondaryButton>
          </div>
        </Form>
      </Surface>
    </>
  );
}

export function AdminTaskDetail() {
  const { id } = useParams();
  const taskDetailQuery = useQuery({
    queryKey: ["sprix-admin", "task-detail", id],
    queryFn: () => readRemoteTaskDetail(id as string),
    enabled: Boolean(id),
    retry: 1
  });
  if (!id) return <Surface className="p-8">任务详情参数缺失</Surface>;
  if (taskDetailQuery.isLoading) return <Surface className="p-8">任务详情加载中</Surface>;
  if (taskDetailQuery.isError) {
    const messageText = taskDetailQuery.error instanceof Error ? taskDetailQuery.error.message : "任务详情加载失败";
    return <Surface className="p-8">任务详情加载失败：{messageText}</Surface>;
  }
  const task = taskDetailQuery.data?.task;
  const records = taskDetailQuery.data?.records;
  const operationLogs = taskDetailQuery.data?.operationLogs ?? [];
  if (!task) return <Surface className="p-8">任务不存在</Surface>;
  return (
    <>
      <PageHeader title={task.title} subtitle="查看任务配置、执行用户、Agent 记录和结算概览。" actions={<SecondaryButton href="/tasks">返回任务管理中心</SecondaryButton>} />
      <Surface className="mb-4 p-4">
        <div className="flex flex-wrap gap-2">
          <StatusTag status={task.taskStatus} />
          {task.offlineReason && <SoftTag tone="amber">下线原因：{task.offlineReason}</SoftTag>}
        </div>
        <div className="mt-4 grid gap-2 text-sm text-ink-soft md:grid-cols-3">
          <span>任务分类：{task.category}</span>
          <span>任务来源名称：{task.sourceName}</span>
          <span>任务来源类型：{task.sourceType}</span>
          <span>任务奖励：{currency(task.reward)}</span>
          <span>总名额：{task.totalSlots}</span>
          <span>剩余名额：{task.remainingSlots}</span>
        </div>
      </Surface>
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <DetailBlock title="详细任务描述" body={task.description} />
        <DetailBlock title="交付标准" body={task.deliverables} />
        <DetailBlock title="验收标准" body={task.acceptanceCriteria} />
      </div>
      <AdminExecutionRecords records={records} />
      <AdminOperationLogs logs={operationLogs} />
      <Surface className="mt-4 p-4">
        <h3 className="sprix-section-title">结果与结算概览</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {[
            ["执行中", records?.running.length ?? 0],
            ["待平台审核", records?.reviewing.length ?? 0],
            ["已终止", records?.terminated.length ?? 0],
            ["已完成", records?.completed.length ?? 0],
            ["申诉记录", records?.completed.filter((item) => item.appealStatus !== "无申诉").length ?? 0]
          ].map(([label, value]) => (
            <div key={label} className="sprix-inline-stat">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Surface>
    </>
  );
}

function AdminOperationLogs({ logs }: { logs: AdminOperationLog[] }) {
  return (
    <Surface className="sprix-table-card mt-4 p-4">
      <h3 className="sprix-section-title">操作记录</h3>
      <p className="mt-1 text-sm text-ink-soft">展示后端返回的任务创建、编辑、上下线、删除等操作追溯记录。</p>
      <Table
        className="mt-4"
        rowKey="id"
        dataSource={logs}
        pagination={false}
        locale={{ emptyText: "暂无操作记录" }}
        scroll={{ x: 860 }}
        columns={[
          { title: "操作", dataIndex: "action" },
          { title: "变更前", dataIndex: "beforeStatus" },
          { title: "变更后", dataIndex: "afterStatus" },
          { title: "原因/备注", dataIndex: "reason" },
          { title: "时间", dataIndex: "occurredAt" }
        ]}
      />
    </Surface>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <Surface className="p-4">
      <h3 className="sprix-section-title">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-ink-soft">{body}</p>
    </Surface>
  );
}

function AdminExecutionRecords({
  records
}: {
  records?: {
    running: RunningExecution[];
    reviewing: ReviewingExecution[];
    terminated: TerminatedExecution[];
    completed: CompletedExecution[];
  };
}) {
  const queryClient = useQueryClient();
  const approveAcceptanceReview = (record: ReviewingExecution) => {
    Modal.confirm({
      title: "确认平台审核通过",
      content: "审核通过后将生成结算记录、自动入账，并直接发起平台支付宝打款。请确认用户已绑定可出款的支付宝账户。",
      okText: "审核通过",
      onOk: async () => {
        try {
          await approveRemoteAcceptanceReview(record.executionId);
          await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
          message.success("平台审核已通过，已发起直接打款");
        } catch (error) {
          message.error(error instanceof Error ? `审核通过失败：${error.message}` : "审核通过失败");
        }
      }
    });
  };
  const rejectAcceptanceReview = (record: ReviewingExecution) => {
    Modal.confirm({
      title: "确认平台审核不通过",
      content: "审核不通过后，用户任务将变为验收未通过，并可按现有规则发起申诉。",
      okText: "审核不通过",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await rejectRemoteAcceptanceReview(record.executionId, "平台人工复核不通过");
          await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
          message.success("已处理为平台审核不通过");
        } catch (error) {
          message.error(error instanceof Error ? `审核驳回失败：${error.message}` : "审核驳回失败");
        }
      }
    });
  };
  const allRecords = [
    ...(records?.running ?? []).map((item) => ({ ...item, status: "执行中", time: item.startedAt })),
    ...(records?.reviewing ?? []).map((item) => ({ ...item, status: "待平台审核", time: item.submittedAt })),
    ...(records?.terminated ?? []).map((item) => ({ ...item, status: "已终止", time: item.terminatedAt })),
    ...(records?.completed ?? []).map((item) => ({ ...item, status: item.acceptanceStatus, time: item.completedAt }))
  ];
  const allColumns: ColumnsType<(typeof allRecords)[number]> = [
    { title: "第几次执行", dataIndex: "executionIndex", render: (value) => (value ? `第 ${value} 次` : "-") },
    { title: "executionId", dataIndex: "executionId", render: (value) => value ?? "-" },
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone" },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "执行状态", dataIndex: "status", render: (value) => <StatusTag status={value} /> },
    { title: "时间", dataIndex: "time" }
  ];
  const runningColumns: ColumnsType<RunningExecution> = [
    { title: "第几次执行", dataIndex: "executionIndex", render: (value) => (value ? `第 ${value} 次` : "-") },
    { title: "executionId", dataIndex: "executionId", render: (value) => value ?? "-" },
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone" },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "Agent 综合评分", dataIndex: "agentScore" },
    { title: "当前节点", dataIndex: "currentNode" },
    { title: "当前进度", dataIndex: "progress" },
    { title: "开始时间", dataIndex: "startedAt" },
    { title: "操作", render: () => <PendingAdminActionButtons actions={getAdminExecutionRecordActions("running")} /> }
  ];
  const terminatedColumns: ColumnsType<TerminatedExecution> = [
    { title: "第几次执行", dataIndex: "executionIndex", render: (value) => (value ? `第 ${value} 次` : "-") },
    { title: "executionId", dataIndex: "executionId", render: (value) => value ?? "-" },
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone" },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "终止原因", dataIndex: "terminationReason" },
    { title: "终止节点", dataIndex: "terminatedNode" },
    { title: "终止时间", dataIndex: "terminatedAt" },
    { title: "操作", render: () => <PendingAdminActionButtons actions={getAdminExecutionRecordActions("terminated")} /> }
  ];
  const completedColumns: ColumnsType<CompletedExecution> = [
    { title: "第几次执行", dataIndex: "executionIndex", render: (value) => (value ? `第 ${value} 次` : "-") },
    { title: "executionId", dataIndex: "executionId", render: (value) => value ?? "-" },
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone" },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "验收状态", dataIndex: "acceptanceStatus", render: (value) => <StatusTag status={value} /> },
    { title: "综合评分", dataIndex: "score" },
    { title: "申诉状态", dataIndex: "appealStatus", render: (value) => <StatusTag status={value} /> },
    { title: "结算状态", dataIndex: "settlementStatus" },
    { title: "完成时间", dataIndex: "completedAt" },
    {
      title: "操作",
      render: (_, record) => <PendingAdminActionButtons actions={getAdminExecutionRecordActions("completed", record)} />
    }
  ];
  return (
    <Surface className="sprix-table-card p-4">
      <h3 className="sprix-section-title">执行用户与 Agent</h3>
      <p className="mt-1 text-sm text-ink-soft">查看当前任务下不同执行状态的用户与 Agent 记录。</p>
      <Tabs
        className="mt-4"
        items={[
          {
            key: "all",
            label: "全部",
            children: <Table rowKey={(record) => record.executionId ?? `${record.userName}-${record.time}`} columns={allColumns} dataSource={allRecords} pagination={false} locale={{ emptyText: "暂无执行记录" }} scroll={{ x: 1220 }} />
          },
          {
            key: "running",
            label: "执行中",
            children: <Table rowKey={(record) => record.executionId ?? record.startedAt} columns={runningColumns} dataSource={records?.running ?? []} pagination={false} locale={{ emptyText: "暂无执行中记录" }} scroll={{ x: 1160 }} />
          },
          {
            key: "reviewing",
            label: "待平台审核",
            children: (
              <AcceptanceReviewTable
                data={records?.reviewing ?? []}
                onApprove={approveAcceptanceReview}
                onReject={rejectAcceptanceReview}
              />
            )
          },
          {
            key: "terminated",
            label: "已终止",
            children: <Table rowKey={(record) => record.executionId ?? record.terminatedAt} columns={terminatedColumns} dataSource={records?.terminated ?? []} pagination={false} locale={{ emptyText: "暂无已终止记录" }} scroll={{ x: 1160 }} />
          },
          {
            key: "completed",
            label: "已完成",
            children: <Table rowKey={(record) => record.executionId ?? record.completedAt} columns={completedColumns} dataSource={records?.completed ?? []} pagination={false} locale={{ emptyText: "暂无已完成记录" }} scroll={{ x: 1280 }} />
          }
        ]}
      />
    </Surface>
  );
}

function PendingAdminActionButtons({ actions }: { actions: AdminExecutionRecordAction[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((action) => (
        <Tooltip key={action.label} title={action.reason}>
          <Button type="link" disabled>
            {action.label}
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}

export function AdminAppealCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appealsQuery = useQuery({
    queryKey: ["sprix-admin", "appeals"],
    queryFn: readRemoteAppeals,
    retry: 1
  });
  const [tab, setTab] = useState("全部");
  const [quickFilter, setQuickFilter] = useState<"none" | "today" | "done">("none");
  if (appealsQuery.isLoading) return <Surface className="p-8">申诉数据加载中</Surface>;
  if (appealsQuery.isError) {
    const messageText = appealsQuery.error instanceof Error ? appealsQuery.error.message : "申诉数据加载失败";
    return <Surface className="p-8">申诉数据加载失败：{messageText}</Surface>;
  }
  const appeals = appealsQuery.data ?? [];
  const today = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const selectAppealTab = (nextTab: string) => {
    setTab(nextTab);
    setQuickFilter("none");
  };
  const visible = appeals.filter((appeal) => {
    if (quickFilter === "today") return appeal.submittedAt.includes(today);
    if (quickFilter === "done") return ["申诉通过", "申诉不通过"].includes(appeal.appealStatus);
    return tab === "全部" || appeal.appealStatus === tab;
  });
  const stats = {
    pending: appeals.filter((item) => item.appealStatus === "待处理").length,
    processing: appeals.filter((item) => item.appealStatus === "处理中").length,
    today: appeals.filter((item) => item.submittedAt.includes(today)).length,
    done: appeals.filter((item) => ["申诉通过", "申诉不通过"].includes(item.appealStatus)).length
  };
  return (
    <>
      <PageHeader title="申诉处理中心" subtitle="复核验收争议并同步任务状态、结算状态和用户资金记录。" />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="待处理申诉" value={stats.pending} active={quickFilter === "none" && tab === "待处理"} onClick={() => selectAppealTab("待处理")} />
        <MetricCard title="处理中申诉" value={stats.processing} active={quickFilter === "none" && tab === "处理中"} onClick={() => selectAppealTab("处理中")} />
        <MetricCard title="今日新增" value={stats.today} active={quickFilter === "today"} onClick={() => {
          setTab("全部");
          setQuickFilter("today");
        }} />
        <MetricCard title="已处理" value={stats.done} active={quickFilter === "done"} onClick={() => {
          setTab("全部");
          setQuickFilter("done");
        }} />
        <MetricCard title="平均处理时长" value="-" />
      </div>
      <Surface className="sprix-table-card p-4">
        <div className="sprix-toolbar-row mb-3 flex-col items-start lg:flex-row lg:items-center">
          <Segmented options={["全部", "待处理", "处理中", "申诉通过", "申诉不通过"]} value={tab} onChange={(value) => selectAppealTab(String(value))} />
          <Input.Search className="max-w-[420px]" placeholder="搜索任务名称、用户手机号、Agent、申诉编号" />
        </div>
        <Table
          rowKey="appealNo"
          dataSource={visible}
          pagination={{ pageSize: 6 }}
          tableLayout="fixed"
          scroll={{ x: 1320 }}
          columns={[
            { title: "申诉编号", dataIndex: "appealNo", width: 130, render: (value) => <EllipsisCell value={value} /> },
            { title: "关联任务", dataIndex: "taskTitle", width: 190, render: (value) => <EllipsisCell value={value} /> },
            { title: "提交用户", dataIndex: "userName", width: 120, render: (value) => <EllipsisCell value={value} /> },
            { title: "用户手机号", dataIndex: "userPhone", width: 130, render: (value) => <EllipsisCell value={value} /> },
            { title: "执行 Agent", dataIndex: "agentName", width: 140, render: (value) => <EllipsisCell value={value} /> },
            { title: "问题摘要", dataIndex: "issueSummary", width: 220, render: (value) => <EllipsisCell value={value} /> },
            { title: "当前状态", dataIndex: "appealStatus", width: 120, render: (value) => <StatusTag status={value} /> },
            { title: "优先级", dataIndex: "priority", width: 100, render: (value) => <EllipsisCell value={value} /> },
            { title: "提交时间", dataIndex: "submittedAt", width: 150, render: (value) => <EllipsisCell value={value} /> },
            { title: "处理人", dataIndex: "handler", width: 130, render: (value) => <EllipsisCell value={value} /> },
            {
              title: "操作",
              fixed: "right",
              width: 150,
              render: (_, record: AdminAppeal) => (
                <div className="flex flex-nowrap items-center gap-1 whitespace-nowrap">
                  <Button type="link" onClick={() => navigate(`/appeals/${getAppealBackendId(record)}`)}>查看详情</Button>
                  {record.appealStatus === "待处理" && (
                    <Button
                      type="link"
                      onClick={async () => {
                        try {
                          await startRemoteAppeal(getAppealBackendId(record));
                          await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
                          message.success("已开始处理");
                        } catch (error) {
                          showRequestError(error, "开始处理失败", "开始处理失败：");
                        }
                      }}
                    >
                      开始处理
                    </Button>
                  )}
                </div>
              )
            }
          ]}
        />
      </Surface>
    </>
  );
}

export function AdminAppealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appealDetailQuery = useQuery({
    queryKey: ["sprix-admin", "appeal-detail", id],
    queryFn: () => readRemoteAppealDetail(id as string),
    enabled: Boolean(id),
    retry: 1
  });
  if (!id) return <Surface className="p-8">申诉详情参数缺失</Surface>;
  if (appealDetailQuery.isLoading) return <Surface className="p-8">申诉详情加载中</Surface>;
  if (appealDetailQuery.isError) {
    const messageText = appealDetailQuery.error instanceof Error ? appealDetailQuery.error.message : "申诉详情加载失败";
    return <Surface className="p-8">申诉详情加载失败：{messageText}</Surface>;
  }
  const appeal = appealDetailQuery.data;
  if (!appeal) return <Surface className="p-8">申诉不存在</Surface>;
  const subtitle = [appeal.taskTitle, appeal.userName, appeal.expectedProcessTime].filter(Boolean).join(" · ");
  const baseInfo = [
    `当前状态：${appeal.appealStatus}`,
    `提交时间：${appeal.submittedAt}`,
    `提交用户：${appeal.userName}`,
    `手机号：${appeal.userPhone}`,
    appeal.handler ? `处理人：${appeal.handler}` : ""
  ].filter(Boolean).join("。");
  const taskInfo = [
    `${appeal.taskTitle} · ${appeal.taskCategory}`,
    appeal.executionIndex ? `第 ${appeal.executionIndex} 次执行` : "",
    appeal.executionId ? `executionId：${appeal.executionId}` : ""
  ].filter(Boolean).join("。");
  const acceptanceInfo = [
    appeal.deliverables ? `交付标准：${appeal.deliverables}` : "",
    appeal.acceptanceCriteria ? `验收标准：${appeal.acceptanceCriteria}` : ""
  ].filter(Boolean).join("。");
  return (
    <>
      <PageHeader title={appeal.appealNo} subtitle={subtitle} actions={<SecondaryButton href="/appeals">返回申诉处理中心</SecondaryButton>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <DetailBlock title="基本信息" body={baseInfo} />
          <DetailBlock title="关联任务信息" body={taskInfo} />
          {acceptanceInfo && <DetailBlock title="验收口径" body={acceptanceInfo} />}
          <DetailBlock title="申诉信息" body={`${appeal.issueSummary}。${appeal.appealReason} ${appeal.userSupplement ?? ""}`} />
        </div>
        <Surface className="p-4">
          <h3 className="sprix-section-title">平台复核区</h3>
          <Input.TextArea rows={5} className="mt-4" placeholder="填写处理说明" />
          <div className="mt-5 flex flex-wrap gap-2">
            <ActionButton
              onClick={() =>
                Modal.confirm({
                  title: "确认申诉通过",
                  content: "确认申诉通过后，该任务将从验收未通过转为结算中，并生成结算记录。",
                  okText: "申诉通过",
                  onOk: async () => {
                    try {
                      await approveRemoteAppeal(getAppealBackendId(appeal));
                      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
                      message.success("申诉已通过，任务已进入结算中");
                      navigate("/appeals");
                    } catch (error) {
                      showRequestError(error, "申诉通过失败", "申诉通过失败：");
                    }
                  }
                })
              }
            >
              申诉通过
            </ActionButton>
            <SecondaryButton
              onClick={() =>
                Modal.confirm({
                  title: "确认申诉不通过",
                  content: "确认申诉不通过后，该任务将保持验收未通过状态，用户不可再次申诉。",
                  okText: "申诉不通过",
                  onOk: async () => {
                    try {
                      await rejectRemoteAppeal(getAppealBackendId(appeal));
                      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
                      message.success("已处理为申诉不通过");
                      navigate("/appeals");
                    } catch (error) {
                      showRequestError(error, "申诉驳回失败", "申诉驳回失败：");
                    }
                  }
                })
              }
            >
              申诉不通过
            </SecondaryButton>
          </div>
        </Surface>
      </div>
    </>
  );
}

export function AdminFundCenter() {
  const queryClient = useQueryClient();
  const fundsQuery = useQuery({
    queryKey: ["sprix-admin", "funds"],
    queryFn: readRemoteFunds,
    retry: 1
  });
  if (fundsQuery.isLoading) return <Surface className="p-8">资金数据加载中</Surface>;
  if (fundsQuery.isError) {
    const messageText = fundsQuery.error instanceof Error ? fundsQuery.error.message : "资金数据加载失败";
    return <Surface className="p-8">资金数据加载失败：{messageText}</Surface>;
  }
  const settlements = fundsQuery.data?.settlements ?? [];
  const withdrawals = fundsQuery.data?.withdrawals ?? [];
  const payouts = fundsQuery.data?.payouts ?? [];
  const exceptions = fundsQuery.data?.fundExceptions ?? [];
  const flows = fundsQuery.data?.fundFlows ?? [];
  const sumBy = <T,>(records: T[], pickAmount: (record: T) => number) => records.reduce((sum, record) => sum + pickAmount(record), 0);
  const stats = [
    ["可提现余额总额", sumBy(withdrawals, (item) => item.withdrawableBalance)],
    ["结算中金额", sumBy(settlements.filter((item) => item.settlementStatus === "结算中"), (item) => item.netIncome)],
    ["提现审核中金额", sumBy(withdrawals.filter((item) => item.withdrawStatus === "提现审核中"), (item) => item.applyAmount)],
    ["待打款金额", sumBy(payouts.filter((item) => item.withdrawStatus === "待打款"), (item) => item.payoutAmount)],
    ["已提现金额", sumBy(withdrawals.filter((item) => item.withdrawStatus === "已提现"), (item) => item.applyAmount)],
    ["打款失败金额", sumBy(exceptions, (item) => item.exceptionAmount)]
  ];
  const approveWithdrawal = async (record: Withdrawal) => {
    try {
      await approveRemoteWithdrawal(getWithdrawalBackendId(record));
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已通过审核，进入待打款");
    } catch (error) {
      showRequestError(error, "提现审核失败", "提现审核失败：");
    }
  };
  const rejectWithdrawal = async (record: Withdrawal) => {
    try {
      await rejectRemoteWithdrawal(getWithdrawalBackendId(record), "后台审核不通过");
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已驳回提现申请");
    } catch (error) {
      showRequestError(error, "提现驳回失败", "提现驳回失败：");
    }
  };
  const postSettlement = (record: Settlement) => {
    Modal.confirm({
      title: "确认补录结算入账",
      content: "新审核通过记录会自动入账并发起打款。此操作仅用于处理历史结算中记录或异常补录。",
      okText: "确认入账",
      onOk: async () => {
        try {
          await postRemoteSettlement(getSettlementBackendId(record));
          await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
          message.success("结算已入账");
        } catch (error) {
          showRequestError(error, "结算入账失败", "结算入账失败：");
        }
      }
    });
  };
  const payPayout = (record: Payout) => {
    Modal.confirm({
      title: "确认发起支付宝打款",
      content: `将通过支付宝向 ${record.alipayAccount} 打款 ${currency(record.payoutAmount)}。确认后会调用后端真实出款接口。`,
      okText: "发起打款",
      onOk: async () => {
        try {
          await payRemoteWithdrawal(getWithdrawalBackendId(record));
          await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
          message.success("支付宝打款已发起，状态以后端返回为准");
        } catch (error) {
          showRequestError(error, "支付宝打款失败", "支付宝打款失败：");
        }
      }
    });
  };
  const queryPayout = async (record: Payout) => {
    try {
      await queryRemoteWithdrawalPayout(getWithdrawalBackendId(record));
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已查询支付宝打款结果");
    } catch (error) {
      showRequestError(error, "打款结果查询失败", "打款结果查询失败：");
    }
  };
  const returnPayoutForReview = async (record: Payout) => {
    try {
      await returnRemoteWithdrawalForReview(getWithdrawalBackendId(record), "待打款退回重新审核");
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已退回提现审核");
    } catch (error) {
      showRequestError(error, "退回审核失败", "退回审核失败：");
    }
  };
  const markPayoutFailed = async (record: Payout) => {
    try {
      await markRemoteWithdrawalPayoutFailed(getWithdrawalBackendId(record));
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已标记打款失败");
    } catch (error) {
      showRequestError(error, "打款失败标记提交失败", "打款失败标记提交失败：");
    }
  };
  const markExceptionHandled = async (record: FundException) => {
    try {
      await markRemotePayoutExceptionHandled(getFundExceptionBackendId(record), "异常已处理，用户需更换收款账户");
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("异常已标记处理");
    } catch (error) {
      showRequestError(error, "异常处理失败", "异常处理失败：");
    }
  };
  return (
    <>
      <PageHeader title="资金管理中心" subtitle="管理结算记录、提现审核、待打款、打款异常和资金流水。" />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {stats.map(([label, value]) => (
          <MetricCard key={label} title={String(label)} value={currency(Number(value))} icon={<CircleDollarSign size={19} />} />
        ))}
      </div>
      <Surface className="sprix-table-card p-4">
        <Tabs
          items={[
            {
              key: "settlements",
              label: "结算记录",
              children: (
                <Table
                  rowKey="settlementNo"
                  dataSource={settlements}
                  scroll={{ x: 1410 }}
                  columns={[
                    { title: "结算单号", dataIndex: "settlementNo", width: 128 },
                    { title: "关联任务", dataIndex: "taskTitle", width: 220 },
                    { title: "用户昵称", dataIndex: "userName", width: 112 },
                    { title: "手机号", dataIndex: "userPhone", width: 112 },
                    { title: "执行 Agent", dataIndex: "agentName", width: 120 },
                    { title: "任务收入", dataIndex: "taskIncome", width: 96, render: currency },
                    { title: "平台服务费", dataIndex: "platformFee", width: 112, render: currency },
                    { title: "实际入账", dataIndex: "netIncome", width: 112, render: currency },
                    { title: "结算状态", dataIndex: "settlementStatus", width: 112, render: (value) => <StatusTag status={value} /> },
                    { title: "生成时间", dataIndex: "createdAt", width: 136 },
                    { title: "入账时间", dataIndex: "paidAt", width: 128 },
                    {
                      title: "操作",
                      width: 112,
                      fixed: "right",
                      render: (_, record) => (
                        record.settlementStatus === "结算中" ? (
                          <Button className="whitespace-nowrap" type="link" onClick={() => postSettlement(record)}>补录入账</Button>
                        ) : (
                          <PendingFundActionButton action={getAdminSettlementDetailAction()} />
                        )
                      )
                    }
                  ]}
                />
              )
            },
            {
              key: "withdrawals",
              label: "提现审核",
              children: <WithdrawalTable data={withdrawals} onApproveWithdrawal={approveWithdrawal} onRejectWithdrawal={rejectWithdrawal} />
            },
            {
              key: "payouts",
              label: "待打款",
              children: <PendingPayoutTable data={payouts} onPay={payPayout} onQuery={queryPayout} onReturnReview={returnPayoutForReview} onMarkFailed={markPayoutFailed} />
            },
            {
              key: "exceptions",
              label: "打款异常",
              children: (
                <Table
                  rowKey="exceptionNo"
                  dataSource={exceptions}
                  scroll={{ x: 980 }}
                  columns={[
                    { title: "异常编号", dataIndex: "exceptionNo" },
                    { title: "提现单号", dataIndex: "withdrawalNo" },
                    { title: "用户昵称", dataIndex: "userName" },
                    { title: "手机号", dataIndex: "userPhone" },
                    { title: "支付宝账户", dataIndex: "alipayAccount" },
                    { title: "异常类型", dataIndex: "exceptionType" },
                    { title: "异常金额", dataIndex: "exceptionAmount", render: currency },
                    { title: "当前状态", dataIndex: "currentStatus" },
                    { title: "发生时间", dataIndex: "occurredAt" },
                    {
                      title: "操作",
                      render: (_, record) => (
                        <Button type="link" disabled={record.currentStatus === "已处理"} onClick={() => markExceptionHandled(record)}>
                          标记已处理
                        </Button>
                      )
                    }
                  ]}
                />
              )
            },
            {
              key: "flows",
              label: "资金流水",
              children: (
                <Table
                  rowKey="flowNo"
                  dataSource={flows}
                  scroll={{ x: 1180 }}
                  columns={[
                    { title: "流水编号", dataIndex: "flowNo" },
                    { title: "流水类型", dataIndex: "flowType" },
                    { title: "关联用户", dataIndex: "userName" },
                    { title: "关联任务", dataIndex: "taskTitle" },
                    { title: "关联提现单", dataIndex: "withdrawalNo" },
                    { title: "金额", dataIndex: "amount", render: currency },
                    { title: "前状态", dataIndex: "beforeStatus" },
                    { title: "后状态", dataIndex: "afterStatus" },
                    { title: "操作人", dataIndex: "operator" },
                    { title: "发生时间", dataIndex: "occurredAt" },
                    { title: "备注", dataIndex: "remark" }
                  ]}
                />
              )
            }
          ]}
        />
      </Surface>
    </>
  );
}

function PendingFundActionButton({ action }: { action: AdminPendingFundAction }) {
  return (
    <Tooltip title={action.reason}>
      <Button type="link" disabled>
        {action.label}
      </Button>
    </Tooltip>
  );
}

function WithdrawalTable({
  data,
  onApproveWithdrawal,
  onRejectWithdrawal
}: {
  data: Withdrawal[];
  onApproveWithdrawal: (withdrawal: Withdrawal) => Promise<void>;
  onRejectWithdrawal: (withdrawal: Withdrawal) => Promise<void>;
}) {
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const selectedRecords = data.filter((item) => selectedKeys.includes(item.withdrawalNo));
  const batchActions = getAdminWithdrawalBatchActions();
  return (
    <>
      {selectedRecords.length > 0 && (
        <BatchActionBar
          label={`已选择 ${selectedRecords.length} 条提现申请`}
          actions={batchActions}
        />
      )}
      <Table
        rowKey="withdrawalNo"
        dataSource={data}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        scroll={{ x: 1180 }}
        columns={[
          { title: "提现单号", dataIndex: "withdrawalNo" },
          { title: "用户昵称", dataIndex: "userName" },
          { title: "手机号", dataIndex: "userPhone" },
          { title: "实人认证主体", dataIndex: "verifiedName" },
          { title: "支付宝账户", dataIndex: "alipayAccount" },
          { title: "实名一致性状态", dataIndex: "realNameMatchStatus", render: (value) => <StatusTag status={value} /> },
          { title: "可提现余额", dataIndex: "withdrawableBalance", render: currency },
          { title: "申请提现金额", dataIndex: "applyAmount", render: currency },
          { title: "预计到账时间", dataIndex: "estimatedArrivalTime" },
          { title: "提现申请时间", dataIndex: "appliedAt" },
          { title: "当前状态", dataIndex: "withdrawStatus", render: (value) => <StatusTag status={value} /> },
          { title: "审核人", dataIndex: "reviewer" },
          {
            title: "操作",
            fixed: "right",
            render: (_, record) => (
              <div className="flex flex-wrap gap-1">
                <Button type="link" onClick={() => onApproveWithdrawal(record)}>
                  通过审核
                </Button>
                <Button type="link" danger onClick={() => onRejectWithdrawal(record)}>驳回审核</Button>
              </div>
            )
          }
        ]}
      />
    </>
  );
}

function PendingPayoutTable({
  data,
  onPay,
  onQuery,
  onReturnReview,
  onMarkFailed
}: {
  data: Payout[];
  onPay: (payout: Payout) => void;
  onQuery: (payout: Payout) => Promise<void>;
  onReturnReview: (payout: Payout) => Promise<void>;
  onMarkFailed: (payout: Payout) => Promise<void>;
}) {
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const selectedRecords = data.filter((item) => selectedKeys.includes(item.withdrawalNo));
  const exportAction = getAdminPayoutExportAction();
  const batchActions = getAdminPayoutBatchActions();
  return (
    <>
      <div className="mb-3 flex flex-col items-end gap-2">
        <SecondaryButton disabled={exportAction.disabled}>{exportAction.label}</SecondaryButton>
        <span className="text-xs text-ink-soft">{exportAction.reason}</span>
      </div>
      {selectedRecords.length > 0 && (
        <BatchActionBar
          label={`已选择 ${selectedRecords.length} 条待打款记录`}
          actions={batchActions}
        />
      )}
      <Table
        rowKey="withdrawalNo"
        dataSource={data}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        scroll={{ x: 1480 }}
        columns={[
          { title: "提现单号", dataIndex: "withdrawalNo" },
          { title: "用户昵称", dataIndex: "userName" },
          { title: "手机号", dataIndex: "userPhone" },
          { title: "支付宝账户", dataIndex: "alipayAccount" },
          { title: "打款金额", dataIndex: "payoutAmount", render: currency },
          { title: "预计到账时间", dataIndex: "estimatedArrivalTime" },
          { title: "审核通过时间", dataIndex: "approvedAt" },
          { title: "打款渠道", dataIndex: "payoutProvider", render: (value) => value || "-" },
          { title: "商户单号", dataIndex: "payoutOutBizNo", render: (value) => value || "-" },
          { title: "支付宝订单号", dataIndex: "payoutOrderId", render: (value) => value || "-" },
          { title: "支付宝状态", dataIndex: "payoutStatus", render: (value) => value || "-" },
          { title: "发起时间", dataIndex: "payoutRequestedAt", render: (value) => value || "-" },
          { title: "完成时间", dataIndex: "payoutCompletedAt", render: (value) => value || "-" },
          { title: "最近查询", dataIndex: "payoutLastQueriedAt", render: (value) => value || "-" },
          { title: "当前状态", dataIndex: "withdrawStatus", render: (value) => <StatusTag status={value} /> },
          {
            title: "操作",
            fixed: "right",
            render: (_, record) => (
              <div className="flex flex-wrap gap-1">
                <Button type="link" disabled={record.withdrawStatus !== "待打款"} onClick={() => onPay(record)}>发起支付宝打款</Button>
                <Button type="link" onClick={() => onQuery(record)}>查询打款结果</Button>
                <Button type="link" onClick={() => onReturnReview(record)}>退回审核</Button>
                <Button type="link" onClick={() => onMarkFailed(record)}>标记打款失败</Button>
              </div>
            )
          }
        ]}
      />
    </>
  );
}

function BatchActionBar({
  label,
  actions
}: {
  label: string;
  actions: Array<{ label: string; danger?: boolean; disabled?: boolean; reason?: string; onClick?: () => Promise<void> }>;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-line bg-[#fafafa] px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Tooltip key={action.label} title={action.reason}>
            <Button danger={action.danger} disabled={action.disabled} onClick={action.onClick}>
              {action.label}
            </Button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
