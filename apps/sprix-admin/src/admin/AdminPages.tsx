import { useEffect, useRef, useState } from "react";
import type { Key, ReactNode } from "react";
import { Button, Form, Input, InputNumber, Modal, Select, Table, Tabs, Tooltip, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Inbox,
  RefreshCw,
  Route,
  ShieldCheck
} from "lucide-react";
import type { AdminAppeal, AdminOperationLog, CompletedExecution, Payout, ReviewingExecution, RunningExecution, Settlement, Task, TerminatedExecution, Withdrawal } from "../types";
import {
  approveRemoteAcceptanceReview,
  approveRemoteAppeal,
  createRemoteAdminTask,
  deleteRemoteAdminTask,
  estimateRemoteTaskPricing,
  offlineRemoteAdminTask,
  readRemoteAppeals,
  readRemoteAppealDetail,
  readRemoteAcceptanceReviews,
  readRemoteFunds,
  readRemoteTaskCenterSnapshot,
  readRemoteTaskDetail,
  rejectRemoteAcceptanceReview,
  rejectRemoteAppeal,
  republishRemoteAdminTask,
  updateRemoteAdminTask,
  type TaskPricingEstimate,
  type TaskPricingEstimateRequest,
  type UpsertAdminTaskPayload
} from "../services/sprixApi";
import { ActionButton, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface, primitiveIcons } from "../components/Primitives";
import { currency } from "../utils/format";
import { isGlobalAuthError } from "../utils/http";
import {
  getAdminPayoutBatchActions,
  getAdminWithdrawalBatchActions,
  type AdminPendingFundAction
} from "./adminFundView";
import { getAdminTaskWriteAction, type AdminTaskWriteAction } from "./adminTaskActions";

function getAppealBackendId(record: AdminAppeal) {
  return record.backendId ?? record.appealNo;
}

function showRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${error.message}` : fallback);
}

const taskDetailNoAppealStatuses = new Set(["无申诉", "未申诉"]);

function hasTaskDetailAppealRecord(status?: string) {
  const normalizedStatus = status?.trim();
  return Boolean(normalizedStatus && !taskDetailNoAppealStatuses.has(normalizedStatus));
}

function isAppealDone(status: AdminAppeal["appealStatus"]) {
  return ["申诉通过", "申诉不通过"].includes(status);
}

function AdminDetailPage({ children }: { children: ReactNode }) {
  return <div className="sprix-detail-page">{children}</div>;
}

function getAdminDetailDisplayTitle(title: string) {
  let displayTitle = title.trim();
  let match = displayTitle.match(/^\[([^\]]{1,48})\]/);
  while (match) {
    displayTitle = displayTitle.slice(match[0].length).trim();
    match = displayTitle.match(/^\[([^\]]{1,48})\]/);
  }
  return displayTitle || title;
}

function AdminDetailHeading({
  title,
  onBack
}: {
  title: string;
  onBack: () => void;
}) {
  const displayTitle = getAdminDetailDisplayTitle(title);
  return (
    <div className="sprix-detail-heading">
      <button className="sprix-detail-back" type="button" onClick={onBack} aria-label="返回">
        <ArrowLeft size={16} />
        <span>返回</span>
      </button>
      <div className="min-w-0">
        <h1 className="sprix-detail-title">{displayTitle}</h1>
      </div>
    </div>
  );
}

function showAdminRecordDetail(title: string, rows: Array<[string, ReactNode]>) {
  Modal.info({
    title,
    width: 680,
    okText: "关闭",
    content: (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-[#fafafa] px-3 py-2">
            <p className="text-xs text-ink-soft">{label}</p>
            <div className="mt-1 break-words text-sm font-medium text-ink">{value || "-"}</div>
          </div>
        ))}
      </div>
    )
  });
}

function readStoredTablePage(storageKey?: string) {
  if (!storageKey || typeof window === "undefined") return 1;
  try {
    const page = Number(window.sessionStorage.getItem(storageKey));
    return Number.isInteger(page) && page > 0 ? page : 1;
  } catch {
    return 1;
  }
}

function writeStoredTablePage(storageKey: string | undefined, page: number) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey, String(page));
  } catch {
    // Ignore storage failures; pagination still works for the current mount.
  }
}

function useStableTablePagination(total: number, pageSize: number, options?: string | { resetKey?: string; storageKey?: string }) {
  const resetKey = typeof options === "string" ? options : options?.resetKey;
  const storageKey = typeof options === "string" ? undefined : options?.storageKey;
  const resetKeyRef = useRef(resetKey);
  const [current, setCurrent] = useState(() => readStoredTablePage(storageKey));

  useEffect(() => {
    if (resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    setCurrent(1);
  }, [resetKey]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    setCurrent((page) => Math.min(page, maxPage));
  }, [pageSize, total]);

  useEffect(() => {
    writeStoredTablePage(storageKey, current);
  }, [current, storageKey]);

  return {
    current,
    pageSize,
    showSizeChanger: false,
    onChange: (page: number) => setCurrent(page)
  };
}

const taskCategoryOptions = ["等待产品输入"].map((value) => ({ value, label: value }));
const taskFormFields = ["title", "category", "sourceType", "description", "deliverables", "acceptanceCriteria", "totalSlots"] as const;
const taskTextLimits = {
  title: 30,
  category: 100,
  sourceType: 30,
  description: 1000,
  deliverables: 1000,
  acceptanceCriteria: 1000
} as const;

const requiredTrimmedTextRules = (label: string, max: number) => [
  {
    required: true,
    transform: (value?: string) => value?.trim(),
    message: `请输入${label}`
  },
  {
    max,
    transform: (value?: string) => value?.trim(),
    message: `${label}不能超过 ${max} 个字符`
  }
];

const integerFieldRules = (label: string, max: number) => [
  { required: true, message: `请输入${label}` },
  {
    validator: (_: unknown, value?: number | string | null) => {
      if (value == null) return Promise.resolve();
      const numericValue = Number(value);
      if (!Number.isInteger(numericValue)) return Promise.reject(new Error(`${label}必须是整数`));
      if (numericValue < 1) return Promise.reject(new Error(`${label}不能小于 1`));
      if (numericValue > max) return Promise.reject(new Error(`${label}不能超过 ${max}`));
      return Promise.resolve();
    }
  }
];

function buildTaskFormInitialValues(task?: Task): Partial<UpsertAdminTaskPayload> {
  if (!task) return {};
  return {
    title: task.title,
    category: task.category,
    sourceType: task.sourceType,
    description: task.description,
    deliverables: task.deliverables,
    acceptanceCriteria: task.acceptanceCriteria,
    totalSlots: task.totalSlots
  };
}

function normalizeTaskFormValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : value;
}

function normalizeTaskPricingRequest(values: UpsertAdminTaskPayload): TaskPricingEstimateRequest {
  return {
    title: values.title.trim(),
    category: values.category.trim(),
    sourceType: values.sourceType.trim(),
    description: values.description.trim(),
    deliverables: values.deliverables.trim(),
    acceptanceCriteria: values.acceptanceCriteria.trim(),
    totalSlots: values.totalSlots
  };
}

function normalizeTaskPayload(values: UpsertAdminTaskPayload, pricingEstimate: TaskPricingEstimate | null): UpsertAdminTaskPayload {
  const payload = normalizeTaskPricingRequest(values);
  return pricingEstimate ? { ...payload, pricingQuoteId: pricingEstimate.quoteId } : payload;
}

function hasTaskFormChanges(currentValues: Partial<UpsertAdminTaskPayload>, initialValues: Partial<UpsertAdminTaskPayload>) {
  return taskFormFields.some((field) => normalizeTaskFormValue(currentValues[field]) !== normalizeTaskFormValue(initialValues[field]));
}

function isFormValidationError(error: unknown) {
  return typeof error === "object" && error !== null && "errorFields" in error;
}

function formatTokenCount(value?: number | null) {
  return value && value > 0 ? value.toLocaleString("zh-CN") : "--";
}

function formatPricingAmount(value?: number | null) {
  return value && value > 0 ? currency(value) : "--";
}

function PricingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-[#fafafa] px-4 py-3">
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

export function getPublishTaskConfirmOptions(onConfirm: () => void | Promise<void>) {
  return {
    content: "确认发布后，该任务将在任务市场展示，用户可查看任务详情并接单。",
    okText: "确认发布",
    cancelText: "取消",
    onOk: onConfirm
  };
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
  const taskPagination = useStableTablePagination(visibleTasks.length, 8, {
    resetKey: `${tab}:${keyword.trim()}`,
    storageKey: "sprix-admin:tasks:page"
  });
  if (taskCenterQuery.isLoading) return <Surface className="p-8">任务数据加载中</Surface>;
  if (taskCenterQuery.isError) {
    const messageText = taskCenterQuery.error instanceof Error ? taskCenterQuery.error.message : "任务数据加载失败";
    return <Surface className="p-8">任务数据加载失败：{messageText}</Surface>;
  }
  const executionCount = tasks.reduce((sum, task) => sum + (task.executionTotal ?? 0), 0);
  const reviewCount = acceptanceReviews.length;
  const selectTaskTab = (nextTab: string) => {
    setTab(nextTab);
    setKeyword("");
  };
  const refreshTasks = () => queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
  const editTaskFromListAction = getAdminTaskWriteAction("edit");
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
        onOk: () => runTaskAction(() => offlineRemoteAdminTask(task.id, "手动操作下线"), "已下线任务")
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
      content: "删除后，该任务将不再展示在任务列表默认视图中。若任务已有执行、验收、结算或申诉记录，相关记录将继续保留用于追溯。",
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => runTaskAction(() => deleteRemoteAdminTask(task.id, "Admin deleted task"), "已删除任务")
    });
  };
  const taskColumns: ColumnsType<Task> = [
    {
      title: "任务名称",
      dataIndex: "title",
      width: 360,
      render: (value) => (
        <span className="block max-w-[340px] whitespace-normal text-sm font-semibold leading-6 text-ink">
          {value}
        </span>
      )
    },
    { title: "状态", dataIndex: "taskStatus", width: 110, render: (value) => <StatusTag status={value} /> },
    {
      title: "分类与来源",
      width: 220,
      render: (_, task) => (
        <div className="grid gap-1 text-sm">
          <span className="text-ink">{task.category}</span>
          <span className="text-xs text-ink-soft">{task.sourceType}</span>
        </div>
      )
    },
    { title: "人均金额", dataIndex: "reward", width: 110, render: currency },
    { title: "总金额", dataIndex: "totalAmount", width: 110, render: formatPricingAmount },
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
      width: 190,
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
        <Tabs
          activeKey={tab}
          onChange={(value) => selectTaskTab(String(value))}
          tabBarExtraContent={<Input.Search className="sprix-table-tab-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索任务名称或分类" />}
          items={["全部", "已发布", "已下线"].map((key) => ({
            key,
            label: key,
            children: (
              <Table
                rowKey="id"
                columns={taskColumns}
                dataSource={visibleTasks}
                pagination={taskPagination}
                scroll={{ x: 1650 }}
                rowClassName="cursor-pointer"
                locale={{ emptyText: "暂无任务" }}
                onRow={(task) => ({ onClick: () => navigate(`/tasks/${task.id}`) })}
              />
            )
          }))}
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
      <AdminDetailPage>
        <AdminDetailHeading title="验收详情" onBack={() => navigate("/acceptance")} />
        <Surface className="p-8 text-sm text-ink-soft">没有找到对应的待验收记录。</Surface>
      </AdminDetailPage>
    );
  }

  return (
    <AcceptanceResultDetail
      record={record}
      onBack={() => navigate("/acceptance")}
      reviewActions={(
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
      )}
    />
  );
}

export function AdminTaskExecutionResultDetail() {
  const { taskId, executionId } = useParams();
  const navigate = useNavigate();
  const taskDetailQuery = useQuery({
    queryKey: ["sprix-admin", "task-detail", taskId],
    queryFn: () => readRemoteTaskDetail(taskId as string),
    enabled: Boolean(taskId),
    retry: 1
  });

  const backToTaskDetail = () => {
    navigate(taskId ? `/tasks/${encodeURIComponent(taskId)}` : "/tasks");
  };

  if (!taskId || !executionId) return <Surface className="p-8">结果详情参数缺失</Surface>;
  if (taskDetailQuery.isLoading) return <Surface className="p-8">结果详情加载中</Surface>;
  if (taskDetailQuery.isError) {
    const messageText = taskDetailQuery.error instanceof Error ? taskDetailQuery.error.message : "结果详情加载失败";
    return <Surface className="p-8">结果详情加载失败：{messageText}</Surface>;
  }

  const task = taskDetailQuery.data?.task;
  const record = taskDetailQuery.data?.records.completed.find((item) => item.executionId === executionId);
  if (!task || !record) {
    return (
      <AdminDetailPage>
        <AdminDetailHeading title="查看结果" onBack={backToTaskDetail} />
        <Surface className="p-8 text-sm text-ink-soft">没有找到对应的已完成执行记录。</Surface>
      </AdminDetailPage>
    );
  }

  const resultRecord: ReviewingExecution = {
    executionId: record.executionId ?? executionId,
    executionIndex: record.executionIndex,
    taskId,
    taskTitle: task.title,
    taskCategory: task.category,
    userName: record.userName,
    phone: record.phone,
    agentName: record.agentName,
    agentScore: record.score,
    acceptanceStatus: record.acceptanceStatus,
    acceptanceScore: record.acceptanceScore,
    acceptanceSummary: record.acceptanceSummary,
    acceptanceIssues: record.acceptanceIssues,
    currentNode: record.currentNode,
    progress: record.progress,
    submittedAt: record.completedAt
  };

  return <AcceptanceResultDetail record={resultRecord} onBack={backToTaskDetail} />;
}

function AcceptanceResultDetail({
  record,
  onBack,
  reviewActions
}: {
  record: ReviewingExecution;
  onBack: () => void;
  reviewActions?: ReactNode;
}) {
  return (
    <AdminDetailPage>
      <AdminDetailHeading title={record.taskTitle || "验收详情"} onBack={onBack} />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard title="验收状态" value={<StatusTag status={record.acceptanceStatus} />} icon={<ShieldCheck size={19} />} />
        <MetricCard title="验收评分" value={record.acceptanceScore} icon={<Gauge size={19} />} />
        <MetricCard title="Agent 本次任务评分" value={record.agentScore} icon={<Bot size={19} />} />
        <MetricCard title="当前节点" value={<span className="text-lg">{record.currentNode}</span>} icon={<Route size={19} />} />
      </div>
      {reviewActions}
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Surface className="p-4">
          <h3 className="sprix-section-title">执行信息</h3>
          <InfoGrid
            rows={[
              ["执行记录ID", record.executionId],
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
    </AdminDetailPage>
  );
}

function useAcceptanceReviewActions(afterAction: () => Promise<unknown>) {
  const approveAcceptanceReview = (record: ReviewingExecution) => {
    Modal.confirm({
      title: "确认平台审核通过",
      content: "审核通过后将生成结算记录、自动入账，并直接发起平台支付宝打款。请确认用户已绑定可出款的支付宝账户。",
      okText: "审核通过",
      cancelText: "取消",
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
      cancelText: "取消",
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
      {rows.map(([label, value]) => {
        const text = value == null || value === "" ? "-" : String(value);
        return (
          <div key={label} className="grid gap-1 sm:grid-cols-[120px_1fr]">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="min-w-0 break-all leading-6 text-ink">{text}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function LongTextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 first:mt-3">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <p className="sprix-detail-prose mt-2 rounded-lg border border-line bg-[#fafafa] p-3">{body || "-"}</p>
    </div>
  );
}

function TaskWriteButton({ action, primary = false, onClick }: { action: AdminTaskWriteAction; primary?: boolean; onClick?: () => void }) {
  const label = action.kind === "edit" ? "编辑" : action.label;
  const button = primary ? (
    <ActionButton danger={action.danger} disabled={action.disabled} onClick={onClick}>
      {label}
    </ActionButton>
  ) : (
    <Button className="sprix-table-action-button" size="small" type="link" danger={action.danger} disabled={action.disabled} onClick={onClick}>
      {label}
    </Button>
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
  const pagination = useStableTablePagination(data.length, 6, { storageKey: showTask ? "sprix-admin:acceptance:page" : "sprix-admin:executions:reviewing:page" });
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
    { title: "Agent 本次任务评分", dataIndex: "agentScore", width: 150 },
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
          {onOpenDetail && <Button size="small" type="link" onClick={() => onOpenDetail(record)}>查看详情</Button>}
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
      pagination={pagination}
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
  const [pricingEstimate, setPricingEstimate] = useState<TaskPricingEstimate | null>(null);
  const [pricingDirty, setPricingDirty] = useState(!editTaskId);
  const editTaskQuery = useQuery({
    queryKey: ["sprix-admin", "task-detail", editTaskId],
    queryFn: () => readRemoteTaskDetail(editTaskId as string),
    enabled: Boolean(editTaskId),
    retry: 1
  });
  const pricingMutation = useMutation({ mutationFn: estimateRemoteTaskPricing });
  const editTask = editTaskQuery.data?.task;
  const isEdit = Boolean(editTaskId);

  const initialValues = buildTaskFormInitialValues(editTask);

  useEffect(() => {
    if (!editTask) return;
    form.setFieldsValue(buildTaskFormInitialValues(editTask));
    setPricingEstimate(null);
    setPricingDirty(false);
  }, [editTask, form]);

  const writeAction = getAdminTaskWriteAction(isEdit ? "edit" : "publish");
  const editTaskRecords = editTaskQuery.data?.records;
  const hasExistingExecutions = Boolean(
    editTaskRecords &&
      (editTaskRecords.running.length > 0 ||
        editTaskRecords.reviewing.length > 0 ||
        editTaskRecords.terminated.length > 0 ||
        editTaskRecords.completed.length > 0)
  );
  const pricingRequired = !isEdit || pricingDirty;
  const displayedTotalAmount = pricingEstimate?.totalAmount ?? (!pricingDirty ? editTask?.totalAmount : undefined);
  const displayedPerParticipantAmount = pricingEstimate?.perParticipantAmount ?? (!pricingDirty ? editTask?.reward : undefined);
  const displayedEstimatedTokens = pricingEstimate?.estimatedTokens ?? (!pricingDirty ? editTask?.estimatedTokens : undefined);
  const estimateTaskPricing = async () => {
    try {
      const values = await form.validateFields([...taskFormFields]);
      const estimate = await pricingMutation.mutateAsync(normalizeTaskPricingRequest(values));
      setPricingEstimate(estimate);
      setPricingDirty(false);
      message.success("智能定价已生成");
    } catch (error) {
      if (isFormValidationError(error)) return;
      showRequestError(error, "智能定价失败", "智能定价失败：");
    }
  };
  const submitTask = async (values: UpsertAdminTaskPayload) => {
    const payload = normalizeTaskPayload(values, pricingEstimate);
    try {
      if (isEdit && editTaskId) {
        await updateRemoteAdminTask(editTaskId, payload);
        message.success("任务已保存");
      } else {
        await createRemoteAdminTask(payload);
        message.success("任务已发布");
      }
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      navigate("/tasks");
    } catch (error) {
      showRequestError(error, "任务保存失败");
    }
  };
  const confirmAndSubmitTask = (values: UpsertAdminTaskPayload) => {
    if (pricingRequired && !pricingEstimate) {
      message.warning("请先完成智能定价");
      return;
    }
    if (isEdit) {
      if (hasExistingExecutions) {
        Modal.confirm({
          title: "任务已更新",
          content: "该任务已有执行记录，修改任务要求可能影响后续验收口径，请确认是否保存。",
          okText: "确认保存",
          cancelText: "取消",
          onOk: () => submitTask(values)
        });
        return;
      }
      void submitTask(values);
      return;
    }
    Modal.confirm(getPublishTaskConfirmOptions(() => submitTask(values)));
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
      <PageHeader title={isEdit ? "编辑任务" : "发布新任务"} subtitle="维护任务基础信息、交付要求、验收口径和智能定价结果。" />
      <Surface className="p-4">
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={confirmAndSubmitTask}
          onValuesChange={(changedValues) => {
            if (!taskFormFields.some((field) => Object.prototype.hasOwnProperty.call(changedValues, field))) return;
            const currentValues = form.getFieldsValue([...taskFormFields]);
            setPricingEstimate(null);
            setPricingDirty(isEdit ? hasTaskFormChanges(currentValues, initialValues) : true);
          }}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <Form.Item label="任务名称" name="title" rules={requiredTrimmedTextRules("任务名称", taskTextLimits.title)}>
              <Input maxLength={taskTextLimits.title} showCount />
            </Form.Item>
            <Form.Item label="任务类型" name="category" rules={requiredTrimmedTextRules("任务类型", taskTextLimits.category)}>
              <Select placeholder="等待产品输入" options={taskCategoryOptions} />
            </Form.Item>
            <Form.Item label="任务来源类型" name="sourceType" rules={requiredTrimmedTextRules("任务来源类型", taskTextLimits.sourceType)}>
              <Input maxLength={taskTextLimits.sourceType} showCount />
            </Form.Item>
          </div>
          <Form.Item label="详细任务描述" name="description" rules={requiredTrimmedTextRules("详细任务描述", taskTextLimits.description)}>
            <Input.TextArea rows={4} maxLength={taskTextLimits.description} showCount />
          </Form.Item>
          <div className="grid gap-4 lg:grid-cols-2">
            <Form.Item label="交付标准" name="deliverables" rules={requiredTrimmedTextRules("交付标准", taskTextLimits.deliverables)}>
              <Input.TextArea rows={4} maxLength={taskTextLimits.deliverables} showCount />
            </Form.Item>
            <Form.Item label="验收标准" name="acceptanceCriteria" rules={requiredTrimmedTextRules("验收标准", taskTextLimits.acceptanceCriteria)}>
              <Input.TextArea rows={4} maxLength={taskTextLimits.acceptanceCriteria} showCount />
            </Form.Item>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Form.Item label="总名额" name="totalSlots" rules={integerFieldRules("总名额", 9999)}>
              <InputNumber min={1} max={9999} step={1} precision={0} className="w-full" />
            </Form.Item>
          </div>
          <div className="mb-4 border-t border-line pt-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-base font-semibold text-ink">
                  <CircleDollarSign size={18} />
                  <span>智能定价</span>
                  {pricingRequired && !pricingEstimate ? (
                    <SoftTag tone="amber">需重新定价</SoftTag>
                  ) : (
                    <SoftTag tone="teal">{pricingEstimate ? "报价有效" : "沿用已有报价"}</SoftTag>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-soft">根据任务内容预测单人执行 Token，并按总名额计算任务总金额。</p>
              </div>
              <ActionButton
                icon={<RefreshCw size={16} />}
                loading={pricingMutation.isPending}
                disabled={writeAction.disabled}
                onClick={estimateTaskPricing}
              >
                智能定价
              </ActionButton>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <PricingMetric label="任务总金额" value={formatPricingAmount(displayedTotalAmount)} />
              <PricingMetric label="人均金额" value={formatPricingAmount(displayedPerParticipantAmount)} />
              <PricingMetric label="预计消耗 Token" value={formatTokenCount(displayedEstimatedTokens)} />
            </div>
            {pricingEstimate?.summary && <p className="mt-3 text-sm text-ink-soft">{pricingEstimate.summary}</p>}
          </div>
          <div className="flex gap-2">
            <ActionButton htmlType="submit" disabled={writeAction.disabled || (pricingRequired && !pricingEstimate)}>{writeAction.label}</ActionButton>
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
  const navigate = useNavigate();
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
  const taskOverviewStats = [
    ["执行中", records?.running.length ?? 0],
    ["待平台审核", records?.reviewing.length ?? 0],
    ["已终止", records?.terminated.length ?? 0],
    ["已完成", records?.completed.length ?? 0],
    ["申诉记录", records?.completed.filter((item) => hasTaskDetailAppealRecord(item.appealStatus)).length ?? 0]
  ];
  return (
    <AdminDetailPage>
      <AdminDetailHeading title={task.title} onBack={() => navigate("/tasks")} />
      <Surface className="sprix-task-detail-summary mb-4 p-5">
        <div className="sprix-task-summary-head">
          <div className="sprix-task-status-line">
            <StatusTag status={task.taskStatus} />
            {task.offlineReason && <SoftTag tone="amber">下线原因：{task.offlineReason}</SoftTag>}
          </div>
          <div className="sprix-task-overview" aria-label="结算概况">
            <dl className="sprix-task-overview-list">
              {taskOverviewStats.map(([label, value]) => (
                <div key={label} className="sprix-task-overview-item">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="sprix-task-detail-meta">
          <span><strong>任务分类</strong>{task.category}</span>
          <span><strong>任务来源名称</strong>{task.sourceName}</span>
          <span><strong>任务来源类型</strong>{task.sourceType}</span>
          <span><strong>人均金额</strong>{currency(task.reward)}</span>
          <span><strong>任务总金额</strong>{formatPricingAmount(task.totalAmount)}</span>
          <span><strong>总名额</strong>{task.totalSlots}</span>
          <span><strong>剩余名额</strong>{task.remainingSlots}</span>
          <span><strong>预计消耗 Token</strong>{formatTokenCount(task.estimatedTokens)}</span>
        </div>
      </Surface>
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <DetailBlock title="详细任务描述" body={task.description} />
        <DetailBlock title="交付标准" body={task.deliverables} />
        <DetailBlock title="验收标准" body={task.acceptanceCriteria} />
      </div>
      <AdminExecutionRecords taskId={task.id} records={records} />
      <AdminOperationLogs logs={operationLogs} />
    </AdminDetailPage>
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
          { title: "操作人", dataIndex: "operator" },
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
      <p className="sprix-detail-prose mt-3">{body}</p>
    </Surface>
  );
}

function AdminExecutionRecords({
  taskId,
  records
}: {
  taskId: string;
  records?: {
    running: RunningExecution[];
    reviewing: ReviewingExecution[];
    terminated: TerminatedExecution[];
    completed: CompletedExecution[];
  };
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const approveAcceptanceReview = (record: ReviewingExecution) => {
    Modal.confirm({
      title: "确认平台审核通过",
      content: "审核通过后将生成结算记录、自动入账，并直接发起平台支付宝打款。请确认用户已绑定可出款的支付宝账户。",
      okText: "审核通过",
      cancelText: "取消",
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
      cancelText: "取消",
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
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone" },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "执行状态", dataIndex: "status", render: (value) => <StatusTag status={value} /> },
    { title: "时间", dataIndex: "time" }
  ];
  const runningColumns: ColumnsType<RunningExecution> = [
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone" },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "Agent 本次任务评分", dataIndex: "agentScore" },
    { title: "当前节点", dataIndex: "currentNode", width: 120, render: (value) => <span className="whitespace-nowrap">{value}</span> },
    { title: "当前进度", dataIndex: "progress" },
    { title: "开始时间", dataIndex: "startedAt" }
  ];
  const terminatedColumns: ColumnsType<TerminatedExecution> = [
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone" },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "终止原因", dataIndex: "terminationReason" },
    { title: "终止节点", dataIndex: "terminatedNode", width: 120, render: (value) => <span className="whitespace-nowrap">{value}</span> },
    { title: "终止时间", dataIndex: "terminatedAt" }
  ];
  const completedColumns: ColumnsType<CompletedExecution> = [
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
      width: 120,
      render: (_, record) => (
        <AdminExecutionActionButtons
          actions={[
            {
              label: "查看结果",
              onClick: () => {
                if (!record.executionId) {
                  message.warning("执行记录缺少 ID，无法查看结果");
                  return;
                }
                navigate(`/tasks/${encodeURIComponent(taskId)}/results/${encodeURIComponent(record.executionId)}`);
              }
            }
          ]}
        />
      )
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
            children: <Table rowKey={(record) => record.executionId ?? `${record.userName}-${record.time}`} columns={allColumns} dataSource={allRecords} pagination={false} locale={{ emptyText: "暂无执行记录" }} scroll={{ x: 900 }} />
          },
          {
            key: "running",
            label: "执行中",
            children: <Table rowKey={(record) => record.executionId ?? record.startedAt} columns={runningColumns} dataSource={records?.running ?? []} pagination={false} locale={{ emptyText: "暂无执行中记录" }} scroll={{ x: 680 }} />
          },
          {
            key: "reviewing",
            label: "待平台审核",
            children: (
              <AcceptanceReviewTable
                data={records?.reviewing ?? []}
                onOpenDetail={(record) => navigate(`/acceptance/${encodeURIComponent(record.executionId)}`)}
                onApprove={approveAcceptanceReview}
                onReject={rejectAcceptanceReview}
              />
            )
          },
          {
            key: "terminated",
            label: "已终止",
            children: <Table rowKey={(record) => record.executionId ?? record.terminatedAt} columns={terminatedColumns} dataSource={records?.terminated ?? []} pagination={false} locale={{ emptyText: "暂无已终止记录" }} scroll={{ x: 600 }} />
          },
          {
            key: "completed",
            label: "已完成",
            children: <Table rowKey={(record) => record.executionId ?? record.completedAt} columns={completedColumns} dataSource={records?.completed ?? []} pagination={false} locale={{ emptyText: "暂无已完成记录" }} scroll={{ x: 960 }} />
          }
        ]}
      />
    </Surface>
  );
}

type AdminExecutionTableAction = {
  label: string;
  onClick: () => void;
};

type ExecutionUserRecord = {
  userName: string;
  phone: string;
  executionId?: string;
};

type ExecutionAgentRecord = {
  agentName: string;
  executionId?: string;
  agentScore?: string;
};

function showRunningExecutionDetail(record: RunningExecution) {
  showAdminRecordDetail("执行详情", [
    ["执行状态", "执行中"],
    ["执行记录ID", record.executionId ?? "-"],
    ["执行用户", record.userName],
    ["手机号", record.phone],
    ["执行 Agent", record.agentName],
    ["Agent 本次任务评分", record.agentScore],
    ["当前节点", record.currentNode],
    ["当前进度", record.progress],
    ["开始时间", record.startedAt]
  ]);
}

function showTerminatedExecutionDetail(record: TerminatedExecution) {
  showAdminRecordDetail("执行记录", [
    ["执行状态", "已终止"],
    ["执行记录ID", record.executionId ?? "-"],
    ["执行用户", record.userName],
    ["手机号", record.phone],
    ["执行 Agent", record.agentName],
    ["终止原因", record.terminationReason],
    ["终止节点", record.terminatedNode],
    ["终止时间", record.terminatedAt]
  ]);
}

function showExecutionUserInfo(record: ExecutionUserRecord) {
  showAdminRecordDetail("用户信息", [
    ["用户昵称", record.userName],
    ["手机号", record.phone],
    ["关联执行记录ID", record.executionId ?? "-"]
  ]);
}

function showExecutionAgentInfo(record: ExecutionAgentRecord) {
  showAdminRecordDetail("Agent 信息", [
    ["执行 Agent", record.agentName],
    ["Agent 本次任务评分", record.agentScore ?? "-"],
    ["关联执行记录ID", record.executionId ?? "-"]
  ]);
}

function AdminExecutionActionButtons({ actions }: { actions: AdminExecutionTableAction[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((action) => (
        <Button key={action.label} size="small" type="link" onClick={action.onClick}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function AdminAppealCenter() {
  const navigate = useNavigate();
  const appealsQuery = useQuery({
    queryKey: ["sprix-admin", "appeals"],
    queryFn: readRemoteAppeals,
    retry: 1
  });
  const [tab, setTab] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [quickFilter, setQuickFilter] = useState<"none" | "done">("none");
  const appeals = appealsQuery.data ?? [];
  const selectAppealTab = (nextTab: string) => {
    setTab(nextTab);
    setQuickFilter("none");
  };
  const visible = appeals.filter((appeal) => {
    if (quickFilter === "done" && !isAppealDone(appeal.appealStatus)) return false;
    if (quickFilter === "none" && tab !== "全部" && appeal.appealStatus !== tab) return false;
    const query = keyword.trim();
    if (!query) return true;
    return `${appeal.appealNo}${appeal.taskTitle}${appeal.userName}${appeal.userPhone}${appeal.agentName}`.includes(query);
  });
  const appealPagination = useStableTablePagination(visible.length, 6, {
    resetKey: `${tab}:${quickFilter}:${keyword.trim()}`,
    storageKey: "sprix-admin:appeals:page"
  });
  if (appealsQuery.isLoading) return <Surface className="p-8">申诉数据加载中</Surface>;
  if (appealsQuery.isError) {
    const messageText = appealsQuery.error instanceof Error ? appealsQuery.error.message : "申诉数据加载失败";
    return <Surface className="p-8">申诉数据加载失败：{messageText}</Surface>;
  }
  const stats = {
    pending: appeals.filter((item) => item.appealStatus === "待处理").length,
    done: appeals.filter((item) => isAppealDone(item.appealStatus)).length
  };
  return (
    <>
      <PageHeader title="申诉处理中心" subtitle="复核验收争议并同步任务状态、结算状态和用户资金记录。" />
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <MetricCard
          title="待处理申诉"
          value={stats.pending}
          icon={<Inbox size={19} />}
          active={quickFilter === "none" && tab === "待处理"}
          onClick={() => selectAppealTab("待处理")}
        />
        <MetricCard title="已处理" value={stats.done} active={quickFilter === "done"} onClick={() => {
          setTab("全部");
          setQuickFilter("done");
        }} icon={<CheckCircle2 size={19} />} />
      </div>
      <Surface className="sprix-table-card p-4">
        <Tabs
          activeKey={tab}
          onChange={(value) => selectAppealTab(String(value))}
          tabBarExtraContent={<Input.Search className="sprix-table-tab-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索任务名称、用户手机号、Agent、申诉编号" />}
          items={["全部", "待处理", "申诉通过", "申诉不通过"].map((key) => ({
            key,
            label: key,
            children: (
              <Table
                rowKey="appealNo"
                dataSource={visible}
                pagination={appealPagination}
                tableLayout="fixed"
                scroll={{ x: 1380 }}
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
                    width: 110,
                    render: (_, record: AdminAppeal) => (
                      <div className="flex flex-nowrap items-center gap-1 whitespace-nowrap">
                        <Button type="link" onClick={() => navigate(`/appeals/${getAppealBackendId(record)}`)}>查看详情</Button>
                      </div>
                    )
                  }
                ]}
              />
            )
          }))}
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
    appeal.executionId ? `执行记录ID：${appeal.executionId}` : ""
  ].filter(Boolean).join("。");
  const acceptanceInfo = [
    appeal.deliverables ? `交付标准：${appeal.deliverables}` : "",
    appeal.acceptanceCriteria ? `验收标准：${appeal.acceptanceCriteria}` : ""
  ].filter(Boolean).join("。");
  return (
    <AdminDetailPage>
      <AdminDetailHeading title={appeal.appealNo} onBack={() => navigate("/appeals")} />
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
    </AdminDetailPage>
  );
}

export function AdminFundCenter() {
  const fundsQuery = useQuery({
    queryKey: ["sprix-admin", "funds"],
    queryFn: readRemoteFunds,
    retry: 1
  });
  const settlements = fundsQuery.data?.settlements ?? [];
  const withdrawals = fundsQuery.data?.withdrawals ?? [];
  const settlementPagination = useStableTablePagination(settlements.length, 10, { storageKey: "sprix-admin:funds:settlements:page" });
  if (fundsQuery.isLoading) return <Surface className="p-8">资金数据加载中</Surface>;
  if (fundsQuery.isError) {
    const messageText = fundsQuery.error instanceof Error ? fundsQuery.error.message : "资金数据加载失败";
    return <Surface className="p-8">资金数据加载失败：{messageText}</Surface>;
  }
  const sumBy = <T,>(records: T[], pickAmount: (record: T) => number) => records.reduce((sum, record) => sum + pickAmount(record), 0);
  const stats = [
    ["结算中金额", sumBy(settlements.filter((item) => item.settlementStatus === "结算中"), (item) => item.netIncome)],
    ["已打款金额", sumBy(withdrawals.filter((item) => item.withdrawStatus === "已提现"), (item) => item.applyAmount)]
  ];
  return (
    <>
      <PageHeader title="资金管理中心" subtitle="管理结算记录、提现审核、待打款、打款异常和资金流水。" />
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {stats.map(([label, value]) => (
          <MetricCard key={label} title={String(label)} value={currency(Number(value))} icon={<CircleDollarSign size={19} />} />
        ))}
      </div>
      <Surface className="sprix-table-card p-4">
        <Table
          rowKey="settlementNo"
          tableLayout="fixed"
          dataSource={settlements}
          pagination={settlementPagination}
          scroll={{ x: 1320 }}
          columns={[
            { title: "结算单号", dataIndex: "settlementNo", width: 150, render: (value) => <EllipsisCell value={value} /> },
            { title: "关联任务", dataIndex: "taskTitle", width: 260, render: (value) => <EllipsisCell value={value} /> },
            { title: "用户昵称", dataIndex: "userName", width: 120, render: (value) => <EllipsisCell value={value} /> },
            { title: "手机号", dataIndex: "userPhone", width: 130, render: (value) => <EllipsisCell value={value} /> },
            { title: "执行 Agent", dataIndex: "agentName", width: 140, render: (value) => <EllipsisCell value={value} /> },
            { title: "任务收入", dataIndex: "taskIncome", width: 96, render: currency },
            { title: "平台服务费", dataIndex: "platformFee", width: 112, render: currency },
            { title: "实际入账", dataIndex: "netIncome", width: 112, render: currency },
            { title: "结算状态", dataIndex: "settlementStatus", width: 120, render: (value) => <StatusTag status={value} /> },
            { title: "生成时间", dataIndex: "createdAt", width: 150, render: (value) => <EllipsisCell value={value} /> },
            { title: "入账时间", dataIndex: "paidAt", width: 150, render: (value) => <EllipsisCell value={value} /> }
          ]}
        />
      </Surface>
    </>
  );
}

function PendingFundActionButton({ action }: { action: AdminPendingFundAction }) {
  return (
    <Tooltip title={action.reason}>
      <Button type="link" disabled={action.disabled} onClick={action.onClick}>
        {action.label}
      </Button>
    </Tooltip>
  );
}

function WithdrawalTable({
  data,
  onApproveWithdrawal,
  onApproveWithdrawals,
  onRejectWithdrawal,
  onRejectWithdrawals,
  onViewWithdrawal
}: {
  data: Withdrawal[];
  onApproveWithdrawal: (withdrawal: Withdrawal) => Promise<void>;
  onApproveWithdrawals: (withdrawals: Withdrawal[]) => Promise<void>;
  onRejectWithdrawal: (withdrawal: Withdrawal) => Promise<void>;
  onRejectWithdrawals: (withdrawals: Withdrawal[]) => Promise<void>;
  onViewWithdrawal: (withdrawal: Withdrawal) => void;
}) {
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const selectedRecords = data.filter((item) => selectedKeys.includes(item.withdrawalNo));
  const pagination = useStableTablePagination(data.length, 10, { storageKey: "sprix-admin:funds:withdrawals:page" });
  const batchActions = getAdminWithdrawalBatchActions({
    approve: async () => {
      await onApproveWithdrawals(selectedRecords);
      setSelectedKeys([]);
    },
    reject: async () => {
      await onRejectWithdrawals(selectedRecords);
      setSelectedKeys([]);
    }
  });
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
        tableLayout="fixed"
        dataSource={data}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        pagination={pagination}
        scroll={{ x: 1560 }}
        columns={[
          { title: "提现单号", dataIndex: "withdrawalNo", width: 220, render: (value) => <EllipsisCell value={value} /> },
          { title: "用户昵称", dataIndex: "userName", width: 120, render: (value) => <EllipsisCell value={value} /> },
          { title: "手机号", dataIndex: "userPhone", width: 130, render: (value) => <EllipsisCell value={value} /> },
          { title: "实人认证主体", dataIndex: "verifiedName", width: 140, render: (value) => <EllipsisCell value={value} /> },
          { title: "支付宝账户", dataIndex: "alipayAccount", width: 260, render: (value) => <EllipsisCell value={value} /> },
          { title: "收款账户状态", dataIndex: "realNameMatchStatus", width: 140, render: (value) => <StatusTag status={value} /> },
          { title: "可提现余额", dataIndex: "withdrawableBalance", width: 110, render: currency },
          { title: "申请提现金额", dataIndex: "applyAmount", width: 120, render: currency },
          { title: "预计到账时间", dataIndex: "estimatedArrivalTime", width: 150, render: (value) => <EllipsisCell value={value} /> },
          { title: "提现申请时间", dataIndex: "appliedAt", width: 150, render: (value) => <EllipsisCell value={value} /> },
          { title: "当前状态", dataIndex: "withdrawStatus", width: 120, render: (value) => <StatusTag status={value} /> },
          { title: "审核人", dataIndex: "reviewer", width: 120, render: (value) => <EllipsisCell value={value} /> },
          {
            title: "操作",
            width: 220,
            fixed: "right",
            render: (_, record) => (
              <div className="flex flex-wrap gap-1">
                <Button type="link" onClick={() => onViewWithdrawal(record)}>
                  查看详情
                </Button>
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
  onMarkFailed,
  onMarkPaidBatch,
  onMarkFailedBatch,
  onViewPayout
}: {
  data: Payout[];
  onPay: (payout: Payout) => void;
  onQuery: (payout: Payout) => Promise<void>;
  onReturnReview: (payout: Payout) => Promise<void>;
  onMarkFailed: (payout: Payout) => Promise<void>;
  onMarkPaidBatch: (payouts: Payout[]) => Promise<void>;
  onMarkFailedBatch: (payouts: Payout[]) => Promise<void>;
  onViewPayout: (payout: Payout) => void;
}) {
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const selectedRecords = data.filter((item) => selectedKeys.includes(item.withdrawalNo));
  const pagination = useStableTablePagination(data.length, 10, { storageKey: "sprix-admin:funds:payouts:page" });
  const batchActions = getAdminPayoutBatchActions({
    markPaid: async () => {
      await onMarkPaidBatch(selectedRecords);
      setSelectedKeys([]);
    },
    markFailed: async () => {
      await onMarkFailedBatch(selectedRecords);
      setSelectedKeys([]);
    }
  });
  return (
    <>
      {selectedRecords.length > 0 && (
        <BatchActionBar
          label={`已选择 ${selectedRecords.length} 条待打款记录`}
          actions={batchActions}
        />
      )}
      <Table
        rowKey="withdrawalNo"
        tableLayout="fixed"
        dataSource={data}
        rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
        pagination={pagination}
        scroll={{ x: 2100 }}
        columns={[
          { title: "提现单号", dataIndex: "withdrawalNo", width: 240, render: (value) => <EllipsisCell value={value} /> },
          { title: "用户昵称", dataIndex: "userName", width: 120, render: (value) => <EllipsisCell value={value} /> },
          { title: "手机号", dataIndex: "userPhone", width: 130, render: (value) => <EllipsisCell value={value} /> },
          { title: "支付宝账户", dataIndex: "alipayAccount", width: 300, render: (value) => <EllipsisCell value={value} /> },
          { title: "打款金额", dataIndex: "payoutAmount", width: 100, render: currency },
          { title: "预计到账时间", dataIndex: "estimatedArrivalTime", width: 150, render: (value) => <EllipsisCell value={value} /> },
          { title: "审核通过时间", dataIndex: "approvedAt", width: 150, render: (value) => <EllipsisCell value={value} /> },
          { title: "打款渠道", dataIndex: "payoutProvider", width: 120, render: (value) => <EllipsisCell value={value || "-"} /> },
          { title: "商户单号", dataIndex: "payoutOutBizNo", width: 220, render: (value) => <EllipsisCell value={value || "-"} /> },
          { title: "支付宝订单号", dataIndex: "payoutOrderId", width: 220, render: (value) => <EllipsisCell value={value || "-"} /> },
          { title: "支付宝状态", dataIndex: "payoutStatus", width: 130, render: (value) => <EllipsisCell value={value || "-"} /> },
          { title: "发起时间", dataIndex: "payoutRequestedAt", width: 150, render: (value) => <EllipsisCell value={value || "-"} /> },
          { title: "完成时间", dataIndex: "payoutCompletedAt", width: 150, render: (value) => <EllipsisCell value={value || "-"} /> },
          { title: "最近查询", dataIndex: "payoutLastQueriedAt", width: 150, render: (value) => <EllipsisCell value={value || "-"} /> },
          { title: "当前状态", dataIndex: "withdrawStatus", width: 120, render: (value) => <StatusTag status={value} /> },
          {
            title: "操作",
            width: 360,
            fixed: "right",
            render: (_, record) => (
              <div className="flex flex-wrap gap-1">
                <Button type="link" onClick={() => onViewPayout(record)}>查看详情</Button>
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
