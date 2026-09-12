import { isDemoId } from "../../mock/demo-ledger.mjs";
import { downloadRemoteAdminFile, estimateRemoteTaskPricing, type TaskPricingEstimate, type TaskPricingEstimateRequest, type AdminExecutionResult, type TaskAttachment } from "../services/sprixApi";
import { displayText } from "../utils/displayText";
import { AdminTable as Table, EllipsisCell, EllipsisText } from "../components/AdminTable";
import { PhoneNumber } from "../components/PhoneNumber";
import {readTaskPage,readAcceptancePage,readAcceptanceDetail,readAppealPage,readFundPage} from "../services/pagedAdminData";
import type { TablePaginationConfig } from "antd";
import { useEffect, useRef, useState } from "react";
import type { Key, ReactNode } from "react";
import { Button, Form, Input, InputNumber, Modal, Select, Segmented, Tabs, Tooltip, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArchiveX,
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  Inbox,
  Download,
  MessageSquareWarning,
  Paperclip,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import type { AdminAppeal, AdminOperationLog, CompletedExecution, Payout, ReviewingExecution, RunningExecution, Settlement, Task, TerminatedExecution, Withdrawal } from "../types";
import {
  downloadAdminExecutionFile,
  readRemoteAdminExecutionResult,
  approveRemoteAcceptanceReview,
  approveRemoteAppeal,
  createRemoteAdminTask,
  deleteRemoteAdminTask,
  offlineRemoteAdminTask,
  readRemoteAppealDetail,
  readRemoteTaskDetail,
  rejectRemoteAcceptanceReview,
  rejectRemoteAppeal,
  republishRemoteAdminTask,

  updateRemoteAdminTask,
  type UpsertAdminTaskPayload
} from "../services/adminDataSource";
import { ActionButton, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface, primitiveIcons } from "../components/Primitives";
import { currency } from "../utils/format";
import { isGlobalAuthError } from "../utils/http";
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

export function isTaskSlotFull(task: Pick<Task, "offlineReason" | "remainingSlots" | "totalSlots">) {
  if (task.totalSlots > 0) {
    return task.remainingSlots <= 0;
  }
  return task.offlineReason === "名额已满";
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
  return displayText(displayTitle || title);
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
            <div className="mt-1 break-words text-sm font-medium text-ink">{typeof value === "string" ? displayText(value) : value || "-"}</div>
          </div>
        ))}
      </div>
    )
  });
}

function AdminTableViewport({ children }: { children: () => ReactNode }) {
  return <div>{children()}</div>;
}

const taskCategoryOptions = [
  "企业经营 / 投融资咨询",
  "数据标注",
  "工具类",
  "AI 内容创作",
  "办公文档",
  "市场调研",
  "网站开发",
  "UI 设计",
  "AI 营销",
  "Agent 自动化 / Python 开发",
  "翻译 / 本地化"
].map((value) => ({ value, label: value }));
const taskFormFields = ["title", "category", "sourceType", "description", "deliverables", "acceptanceCriteria", "totalSlots"] as const;
const taskTextLimits = {
  title: 30,
  category: 100,
  sourceType: 30,
  description: 1000,
  deliverables: 1000,
  acceptanceCriteria: 1000
} as const;
const taskAttachmentMaxCount = 10;
const taskAttachmentMaxSizeBytes = 50 * 1024 * 1024;
const taskAttachmentExtensions = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "md", "zip", "rar", "7z"
]);

function formatFileSize(sizeBytes?: number | null) {
  const size = Math.max(0, sizeBytes ?? 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
}

function manualSubmissionStatusLabel(status: "PENDING_REVIEW" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "人工审核通过";
  if (status === "REJECTED") return "人工审核不通过";
  return "待人工审核";
}

function formatManualSubmissionTime(value: string) {
  const normalizedValue = value.replace(/(\.\d{3})\d+(?=Z$|[+-]\d{2}:?\d{2}$)/, "$1");
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return value;

  const padTimePart = (part: number) => String(part).padStart(2, "0");
  const datePart = [date.getFullYear(), padTimePart(date.getMonth() + 1), padTimePart(date.getDate())].join("-");
  const timePart = [padTimePart(date.getHours()), padTimePart(date.getMinutes())].join(":");
  return `${datePart} ${timePart}`;
}

function validateTaskAttachment(file: File) {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  if (!taskAttachmentExtensions.has(extension)) return "仅支持图片、文档、表格、文本和常用压缩包格式";
  if (file.size > taskAttachmentMaxSizeBytes) return "单个附件不能超过 50 MiB";
  return null;
}

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

function formatResultReceivedAt(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
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
  const [taskSearch,setTaskSearch] = useSearchParams();
  const publishedDate = /^\d{4}-\d{2}-\d{2}$/.test(taskSearch.get("publishedDate") ?? "") ? taskSearch.get("publishedDate") : null;
  const category = taskSearch.get("category")?.trim() || null;
  const initialStatus = ["已发布", "已下线"].includes(taskSearch.get("status") ?? "") ? taskSearch.get("status")! : "全部";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab,setTab] = useState(initialStatus);
  const [keyword,setKeyword] = useState("");
  const [taskPage,setTaskPage] = useState(1);
  const taskCenterQuery = useQuery({
    queryKey: ["sprix-admin", "task-center",tab,keyword,publishedDate,category,taskPage,20],
    placeholderData:keepPreviousData,
    queryFn: ()=>readTaskPage({page:taskPage,pageSize:20,status:tab,search:keyword,date:publishedDate ?? undefined,category:category ?? undefined}),
    retry: 1
  });

  if (taskCenterQuery.isLoading) return <Surface className="p-8">任务数据加载中</Surface>;
  if (taskCenterQuery.isError) {
    const messageText = taskCenterQuery.error instanceof Error ? taskCenterQuery.error.message : "任务数据加载失败";
    return <Surface className="p-8">任务数据加载失败：{messageText}</Surface>;
  }
  const visibleTasks = taskCenterQuery.data?.rows ?? [];
  const taskStats = taskCenterQuery.data!.stats;
  const executionCount = taskStats.executions;
  const reviewCount = taskStats.reviews;
  const appealCount = taskStats.appeals;
  const selectTaskTab = (nextTab: string) => {
    setTab(nextTab);
    setTaskPage(1);
    setKeyword("");
    const nextSearch = new URLSearchParams(taskSearch);
    if (nextTab === "全部") nextSearch.delete("status");
    else nextSearch.set("status", nextTab);
    setTaskSearch(nextSearch);
  };
  const selectTaskCategory = (nextCategory?: string) => {
    const nextSearch = new URLSearchParams(taskSearch);
    if (nextCategory) nextSearch.set("category", nextCategory);
    else nextSearch.delete("category");
    setTaskPage(1);
    setTaskSearch(nextSearch);
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
      if (isTaskSlotFull(task)) {
        Modal.confirm({
          title: "名额已满，无法重新发布",
          content: "该任务名额已满，不能重新发布。如需继续投放，请新建任务。",
          okText: "去新建",
          cancelText: "取消",
          onOk: () => navigate("/tasks/new")
        });
        return;
      }

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
      width: 300,
      ellipsis: false,
      render: (_, task) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <EllipsisText className="min-w-0 flex-1 font-semibold text-ink">{task.title}</EllipsisText>
            <span className="shrink-0"><StatusTag status={task.taskStatus} /></span>
          </div>
          <div className="mt-1 text-xs text-ink-soft">
            <EllipsisText>{task.category} · {task.sourceType}</EllipsisText>
          </div>
        </div>
      )
    },
    { title: "人均金额", dataIndex: "reward", width: 90, render: currency },
    { title: "总金额", dataIndex: "totalAmount", width: 110, render: formatPricingAmount },
    {
      title: "名额",
      width: 90,
      render: (_, task) => `${task.remainingSlots}/${task.totalSlots}`
    },
    { title: "执行记录", dataIndex: "executionTotal", width: 90, render: (value) => value ?? 0 },
    { title: "待审核", dataIndex: "reviewingExecutionCount", width: 90, render: (value) => value ?? 0 },
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
        title="任务管理中心"
        subtitle="集中查看任务发布状态、执行记录、申诉数量和任务操作。"
        actions={<TaskWriteButton action={getAdminTaskWriteAction("publish")} primary onClick={() => navigate("/tasks/new")} />}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="全部任务" value={taskStats.total} icon={<ClipboardList size={19} />} active={tab === "全部"} onClick={() => selectTaskTab("全部")} />
        <MetricCard title="已发布任务" value={taskStats.published} active={tab === "已发布"} onClick={() => selectTaskTab("已发布")} />
        <MetricCard title="已下线任务" value={taskStats.offline} active={tab === "已下线"} onClick={() => selectTaskTab("已下线")} />
        <MetricCard title="执行记录" value={executionCount} icon={primitiveIcons.clock} onClick={() => selectTaskTab("全部")} />
        <MetricCard title="待平台审核" value={reviewCount} icon={<ShieldCheck size={19} />} onClick={() => navigate("/acceptance")} />
        <MetricCard title="申诉记录" value={appealCount} icon={<ShieldCheck size={19} />} onClick={() => navigate("/appeals")} />
      </div>
      <Surface className="sprix-table-card p-4">
        <div className="sprix-toolbar">
          <div className="sprix-toolbar-row flex-col items-start lg:flex-row lg:items-center">
            <h3 className="sprix-section-title">任务列表</h3>
            {publishedDate && <span>{publishedDate} 发布 · {taskCenterQuery.data?.total} 条 <Button type="link" onClick={()=>{setTaskPage(1);setTaskSearch({});}}>清除日期筛选</Button></span>}
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:ml-auto lg:w-auto">
              <Select className="w-full sm:w-[220px]" value={category ?? undefined} allowClear showSearch optionFilterProp="label" placeholder="全部任务分类" options={taskCategoryOptions} onChange={selectTaskCategory} />
              <Input.Search className="w-full sm:w-[360px]" value={keyword} onChange={(event) => {setKeyword(event.target.value);setTaskPage(1);}} placeholder="搜索任务名称" />
            </div>
          </div>
          <Segmented options={["全部", "已发布", "已下线"]} value={tab} onChange={(value) => selectTaskTab(String(value))} />
        </div>
        <Table
          rowKey="id"
          loading={taskCenterQuery.isPlaceholderData}
          columns={taskColumns}
          dataSource={visibleTasks}
          pagination={{ current:taskCenterQuery.data?.page ?? taskPage,pageSize:20,total:taskCenterQuery.data?.total,onChange:setTaskPage,showSizeChanger:false }}
          scroll={{ x: 1280 }}
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
  const [page,setPage]=useState(1);
  const acceptanceQuery = useQuery({
    queryKey: ["sprix-admin", "acceptance-reviews",page,20],
    placeholderData:keepPreviousData,
    queryFn: ()=>readAcceptancePage({page,pageSize:20}),
    retry: 1
  });
  const refreshAcceptance = () => queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
  const { approveAcceptanceReview, rejectAcceptanceReview } = useAcceptanceReviewActions(refreshAcceptance);

  if (acceptanceQuery.isLoading) return <Surface className="p-8">平台验收中心数据加载中</Surface>;
  if (acceptanceQuery.isError) {
    const messageText = acceptanceQuery.error instanceof Error ? acceptanceQuery.error.message : "平台验收中心数据加载失败";
    return <Surface className="p-8">平台验收中心数据加载失败：{messageText}</Surface>;
  }

  const acceptanceReviews = acceptanceQuery.data?.rows ?? [];
  const taskCount = acceptanceQuery.data?.taskCount ?? 0;
  const userCount = acceptanceQuery.data?.userCount ?? 0;

  return (
    <>
      <PageHeader
        title="平台验收中心"
        subtitle="集中审核 Agent 自动交付和用户人工补交，确认通过后进入结算和打款流程。"
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard title="待审核记录" value={acceptanceQuery.data?.total ?? 0} icon={<ShieldCheck size={19} />} />
        <MetricCard title="涉及任务" value={taskCount} icon={<ClipboardList size={19} />} />
        <MetricCard title="执行用户" value={userCount} />
      </div>
      <Surface className="sprix-table-card p-4">
        <AcceptanceReviewTable
          loading={acceptanceQuery.isPlaceholderData}
          pagination={{current:acceptanceQuery.data?.page ?? page,pageSize:20,total:acceptanceQuery.data?.total,onChange:setPage,showSizeChanger:false}}
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
    queryKey: ["sprix-admin", "acceptance-reviews",executionId],
    queryFn: ()=>readAcceptanceDetail(executionId as string),
    enabled:!!executionId,
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

  const record = acceptanceQuery.data;
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
              <p className="mt-1 text-sm text-ink-soft">
                {record.reviewSource === "USER_MANUAL" ? "本次为用户人工补交，不执行自动验收或 Agent 评估。" : "确认该执行结果是否满足任务交付和验收要求。"}
              </p>
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
  const completedRecord = taskDetailQuery.data?.records.completed.find((item) => item.executionId === executionId);
  const reviewingRecord = taskDetailQuery.data?.records.reviewing.find((item) => item.executionId === executionId);
  if (!task || (!completedRecord && !reviewingRecord)) {
    return (
      <AdminDetailPage>
        <AdminDetailHeading title="查看结果" onBack={backToTaskDetail} />
        <Surface className="p-8 text-sm text-ink-soft">没有找到对应的执行结果记录。</Surface>
      </AdminDetailPage>
    );
  }

  const record = completedRecord;
  const resultRecord: ReviewingExecution = reviewingRecord ?? {
    executionId: record?.executionId ?? executionId,
    executionIndex: record?.executionIndex ?? 0,
    taskId,
    taskTitle: task.title,
    taskCategory: task.category,
    userName: record?.userName ?? "-",
    phone: record?.phone ?? "-",
    agentName: record?.agentName ?? "-",
    agentScore: record?.score ?? "-",
    acceptanceStatus: record?.acceptanceStatus ?? "-",
    acceptanceScore: record?.acceptanceScore ?? "-",
    acceptanceSummary: record?.acceptanceSummary ?? "-",
    acceptanceIssues: record?.acceptanceIssues ?? "-",
    currentNode: record?.currentNode ?? "-",
    progress: record?.progress ?? "-",
    submittedAt: record?.submittedAt ?? "-"
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
  const executionResultQuery = useQuery({
    queryKey: ["sprix-admin", "execution-result", record.executionId],
    queryFn: () => readRemoteAdminExecutionResult(record.executionId),
    enabled: Boolean(record.executionId),
    retry: 1
  });
  const executionResult = executionResultQuery.data;
  const acceptance = executionResult?.acceptance;
  const issueItems = acceptanceDetailItems(acceptance?.issues);
  const failureReasonItems = acceptanceDetailItems(
    acceptance?.failureReasons,
    record.acceptanceFailureReasons
  );
  const unmetGoalItems = issueItems.length > 0
    ? issueItems
    : failureReasonItems.length > 0
      ? failureReasonItems
      : acceptanceDetailItems(record.acceptanceIssues);
  const improvementItems = acceptanceDetailItems(
    acceptance?.improvementSuggestions,
    record.acceptanceImprovementSuggestions
  );
  const manualSubmissions = executionResult?.manualSubmissions ?? [];
  const downloadArtifact = async (artifact: AdminExecutionResult["artifacts"][number]) => {
    try {
      await downloadAdminExecutionFile(artifact.downloadUrl, artifact.name);
    } catch (error) {
      showRequestError(error, "提交产物下载失败");
    }
  };
  return (
    <AdminDetailPage>
      <AdminDetailHeading title={record.taskTitle || "验收详情"} onBack={onBack} />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard title="审核状态" value={<StatusTag status={record.reviewSource === "USER_MANUAL" ? "待人工审核" : record.acceptanceStatus} />} icon={<ShieldCheck size={19} />} />
        <MetricCard title="审核来源" value={<span className="text-lg">{record.reviewSource === "USER_MANUAL" ? "用户人工补交" : "Agent 自动交付"}</span>} icon={<Gauge size={19} />} />
        <MetricCard title="执行 Agent" value={<span className="text-lg">{record.agentName}</span>} icon={<Bot size={19} />} />
        <MetricCard title="当前节点" value={<span className="text-lg">{record.currentNode}</span>} icon={<Route size={19} />} />
      </div>
      {reviewActions}
      {manualSubmissions.length > 0 && (
        <Surface className="mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="sprix-section-title">用户人工补交</h3>
            <SoftTag tone="amber">不触发自动验收与 Agent 评估</SoftTag>
          </div>
          <div className="mt-4 space-y-3">
            {manualSubmissions.map((submission) => (
              <div key={submission.submissionId} className="rounded-xl border border-line bg-[#fafafa] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-ink">第 {submission.submissionNo} 次人工补交</strong>
                    <StatusTag status={manualSubmissionStatusLabel(submission.status)} />
                  </div>
                  <span className="text-xs text-ink-soft">{formatManualSubmissionTime(submission.submittedAt)}</span>
                </div>
                {submission.description && <p className="mt-2 text-sm leading-6 text-ink-soft">{submission.description}</p>}
                {submission.reviewReason && <p className="mt-2 text-sm leading-6 text-red-600">审核说明：{submission.reviewReason}</p>}
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {submission.files.map((file) => (
                    <div key={file.id ?? file.fileId} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink" title={file.filename}>{file.filename}</div>
                        <div className="text-xs text-ink-soft">人工上传 · {formatFileSize(file.sizeBytes)}</div>
                      </div>
                      <Button size="small" type="link" icon={<Download size={15} />} onClick={() => void downloadRemoteAdminFile(file.downloadUrl, file.filename)}>下载</Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Surface>
      )}
      <Surface className="mb-4 overflow-hidden p-0">
        <div className="border-b border-line px-5 py-4">
          <h3 className="sprix-section-title">Agent 提交结果</h3>
          <p className="mt-1 text-sm text-ink-soft">查看 Agent 的 Token 用量、最终说明和交付文件。</p>
        </div>
        {executionResultQuery.isLoading ? (
          <p className="px-5 py-6 text-sm text-ink-soft">提交结果加载中</p>
        ) : executionResultQuery.isError ? (
          <p className="px-5 py-6 text-sm text-red-600">{executionResultQuery.error instanceof Error ? executionResultQuery.error.message : "提交结果加载失败"}</p>
        ) : (
          <div className="p-5">
            <dl className="grid gap-3 md:grid-cols-3">
              {[
                ["输入 Token", formatTokenCount(executionResult?.output?.inputTokens)],
                ["输出 Token", formatTokenCount(executionResult?.output?.outputTokens)],
                ["结果接收时间", formatResultReceivedAt(executionResult?.output?.receivedAt)]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-[#fafafa] px-4 py-3">
                  <dt className="text-xs font-medium text-ink-soft">{label}</dt>
                  <dd className="mt-1 text-base font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <LongTextBlock title="最终提交说明" body={executionResult?.output?.finalMessage || "-"} plain />
            <div className="mt-5 border-t border-line pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-ink">提交产物</div>
                <SoftTag tone="neutral">{executionResult?.artifacts.length ?? 0} 个文件</SoftTag>
              </div>
              {executionResult?.artifacts.length ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {executionResult.artifacts.map((artifact) => (
                    <div key={artifact.artifactId} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[#fafafa] p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
                          <Paperclip size={17} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink" title={artifact.name}>{artifact.name}</div>
                          <div className="mt-0.5 text-xs text-ink-soft">{artifact.role} · {formatFileSize(artifact.sizeBytes)}</div>
                        </div>
                      </div>
                      <Button size="small" type="link" icon={<Download size={15} />} onClick={() => void downloadArtifact(artifact)}>下载</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">暂无提交产物</p>
              )}
            </div>
          </div>
        )}
      </Surface>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Surface className="p-4">
          <h3 className="sprix-section-title">执行信息</h3>
          <InfoGrid
            rows={[
              ["执行记录ID", record.executionId],
              ["关联任务", record.taskTitle || "-"],
              ["任务分类", record.taskCategory || "-"],
              ["执行用户", record.userName],
              ["手机号", <PhoneNumber value={record.phone} />],
              ["执行 Agent", record.agentName],
              ["提交时间", record.submittedAt],
              ["当前进度", record.progress]
            ]}
          />
        </Surface>
        <Surface className="p-4">
          <h3 className="sprix-section-title">{manualSubmissions.length > 0 ? "历史自动验收结果" : "验收结果"}</h3>
          {manualSubmissions.length > 0 && <p className="mt-2 text-sm text-ink-soft">以下结果来自 Agent 原始交付，仅用于历史追溯，不代表本次人工补交的验收结果。</p>}
          <LongTextBlock title="验收摘要" body={acceptance?.summary || record.acceptanceSummary} />
          <AcceptanceListBlock
            title="未满足交付目标"
            items={unmetGoalItems}
            countLabel="项问题"
            emptyText="未发现未满足的交付目标"
            tone="danger"
          />
          <AcceptanceListBlock
            title="改进建议"
            items={improvementItems}
            countLabel="项建议"
            emptyText="暂无改进建议"
            tone="success"
          />
        </Surface>
      </div>
    </AdminDetailPage>
  );
}

function useAcceptanceReviewActions(afterAction: () => Promise<unknown>) {
  const approveAcceptanceReview = (record: ReviewingExecution) => {
    Modal.confirm({
      title: record.reviewSource === "USER_MANUAL" ? "确认人工补交审核通过" : "确认平台审核通过",
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
      title: record.reviewSource === "USER_MANUAL" ? "确认人工补交审核不通过" : "确认平台审核不通过",
      content: record.reviewSource === "USER_MANUAL"
        ? "审核不通过后，用户任务将恢复为验收未通过，并可以再次人工补交。"
        : "审核不通过后，用户任务将变为验收未通过，并可按现有规则发起申诉。",
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

function InfoGrid({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="mt-4 grid gap-3 text-sm">
      {rows.map(([label, value]) => {
        const content = typeof value === "string" ? displayText(value || "-") : value ?? "-";
        return (
          <div key={label} className="grid gap-1 sm:grid-cols-[120px_1fr]">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="min-w-0 break-all leading-6 text-ink">{content}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function LongTextBlock({ title, body, plain = false }: { title: string; body: string; plain?: boolean }) {
  return (
    <div className="mt-4 first:mt-3">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <p className={`sprix-detail-prose mt-2 ${plain ? "" : "rounded-lg border border-line bg-[#fafafa] p-3"}`}>{body || "-"}</p>
    </div>
  );
}

function AcceptanceListBlock({
  title,
  items,
  countLabel,
  emptyText,
  tone
}: {
  title: string;
  items: string[];
  countLabel: string;
  emptyText: string;
  tone: "danger" | "success";
}) {
  const toneClasses = tone === "danger"
    ? {
        container: "border-[#f4d7d7] bg-[#fff8f8]",
        title: "text-[#a83c3c]",
        marker: "marker:text-[#c84b4b]"
      }
    : {
        container: "border-[#cfe9df] bg-[#f6fbf9]",
        title: "text-[#287866]",
        marker: "marker:text-[#3b9b82]"
      };

  return (
    <section className={`mt-4 rounded-xl border px-4 py-3.5 ${toneClasses.container}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className={`text-sm font-semibold ${toneClasses.title}`}>{title}</h4>
        <SoftTag tone={tone === "danger" ? "red" : "teal"}>{items.length} {countLabel}</SoftTag>
      </div>
      {items.length > 0 ? (
        <ul className={`mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-soft ${toneClasses.marker}`}>
          {items.map((item) => <li key={item} className="pl-1">{item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-ink-soft">{emptyText}</p>
      )}
    </section>
  );
}

function acceptanceDetailItems(...values: unknown[]): string[] {
  const items = values.flatMap(parseAcceptanceDetailValue)
    .map((item) => item.replace(/^(?:[-*•]\s+|\d+[.)、]\s*)/, "").trim())
    .filter((item) => item && item !== "-");
  return [...new Set(items)];
}

function parseAcceptanceDetailValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(parseAcceptanceDetailValue);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      const nested = parseAcceptanceDetailValue(item);
      return nested.length > 0 ? nested.map((text) => `${key}：${text}`) : [];
    });
  }
  if (value == null) return [];

  const text = String(value).trim();
  if (!text) return [];
  if (["[", "{"].includes(text.charAt(0))) {
    try {
      return parseAcceptanceDetailValue(JSON.parse(text) as unknown);
    } catch {
      // 非法 JSON 仍按普通文本展示，避免丢失验收信息。
    }
  }
  return text.split(/\r?\n+|；/).map((item) => item.trim()).filter(Boolean);
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

function AcceptanceReviewTable({
  loading,
  data,
  pagination,
  showTask = false,
  onOpenDetail,
  onApprove,
  onReject
}: {
  data: ReviewingExecution[];
  loading?: boolean;
  pagination?:TablePaginationConfig;
  showTask?: boolean;
  onOpenDetail?: (record: ReviewingExecution) => void;
  onApprove: (record: ReviewingExecution) => void;
  onReject: (record: ReviewingExecution) => void;
}) {
  const columns: ColumnsType<ReviewingExecution> = [
    ...(showTask
      ? [
          { title: "关联任务", dataIndex: "taskTitle", width: 300, render: (value) => <EllipsisCell value={value} /> },
          { title: "任务分类", dataIndex: "taskCategory", width: 180, render: (value) => <EllipsisCell value={value} /> }
        ] satisfies ColumnsType<ReviewingExecution>
      : []),
    { title: "执行用户", dataIndex: "userName", width: 150, render: (value) => <EllipsisCell value={value} /> },
    { title: "手机号", dataIndex: "phone", width: 150, render: (value) => <PhoneNumber value={value} /> },
    { title: "执行 Agent", dataIndex: "agentName", width: 180, render: (value) => <EllipsisCell value={value} /> },
    { title: "审核来源", dataIndex: "reviewSource", width: 165, render: (value) => <SoftTag tone={value === "USER_MANUAL" ? "amber" : "neutral"}>{value === "USER_MANUAL" ? "用户人工补交" : "Agent 自动交付"}</SoftTag> },
    { title: "验收状态", dataIndex: "acceptanceStatus", width: 155, render: (value) => <StatusTag status={value} /> },
    { title: "任务验收分", dataIndex: "acceptanceScore", width: 120 },
    { title: "验收摘要", dataIndex: "acceptanceSummary", width: 320, render: (value) => <EllipsisCell value={value} /> },
    { title: "问题记录", dataIndex: "acceptanceIssues", width: 320, render: (value) => <EllipsisCell value={value} /> },
    { title: "当前节点", dataIndex: "currentNode", width: 150, render: (value) => <EllipsisCell value={value} /> },
    { title: "提交时间", dataIndex: "submittedAt", width: 175 },
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
        loading={loading}
      className="mt-4"
      rowKey="executionId"
      dataSource={data}
      columns={columns}
      pagination={pagination ?? {pageSize:20}}
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
  const [newAttachmentFiles, setNewAttachmentFiles] = useState<UploadFile[]>([]);
  const [retainedAttachmentIds, setRetainedAttachmentIds] = useState<string[]>([]);
  const editTaskQuery = useQuery({
    queryKey: ["sprix-admin", "task-detail", editTaskId],
    refetchInterval: false,
    refetchOnWindowFocus: false,
    queryFn: () => readRemoteTaskDetail(editTaskId as string),
    enabled: Boolean(editTaskId),
    retry: 1
  });
  const pricingMutation = useMutation({ mutationFn: estimateRemoteTaskPricing });
  const editTask = editTaskQuery.data?.task;
  const editTaskAttachments = editTaskQuery.data?.attachments ?? [];
  const isEdit = Boolean(editTaskId);

  const initialValues = buildTaskFormInitialValues(editTask);

  useEffect(() => {
    if (!editTask) return;
    form.setFieldsValue(buildTaskFormInitialValues(editTask));
    setPricingEstimate(null);
    setPricingDirty(false);
    setNewAttachmentFiles([]);
    setRetainedAttachmentIds(editTaskAttachments.map((attachment) => attachment.attachmentId));
  }, [editTask, editTaskAttachments.length, form]);

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
    const payload = {
      ...normalizeTaskPayload(values, pricingEstimate),
      ...(editTaskId && isDemoId(editTaskId)
        ? { reward: pricingEstimate?.perParticipantAmount ?? editTask?.reward, estimatedTokens: pricingEstimate?.estimatedTokens ?? editTask?.estimatedTokens }
        : {})
    };
    const files = newAttachmentFiles.flatMap((file) => file.originFileObj ? [file.originFileObj as File] : []);
    const initialAttachmentIds = editTaskAttachments.map((attachment) => attachment.attachmentId);
    const attachmentsChanged = files.length > 0 || retainedAttachmentIds.join(",") !== initialAttachmentIds.join(",");
    try {
      if (isEdit && editTaskId) {
        await updateRemoteAdminTask(editTaskId, payload, files, attachmentsChanged ? retainedAttachmentIds : undefined);
        message.success("任务已保存");
      } else {
        await createRemoteAdminTask(payload, files);
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
    const initialAttachmentIds = editTaskAttachments.map((attachment) => attachment.attachmentId);
    const attachmentsChanged = newAttachmentFiles.length > 0 || retainedAttachmentIds.join(",") !== initialAttachmentIds.join(",");
    if (!hasTaskFormChanges(currentValues, initialValues) && !attachmentsChanged) {
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
          <div className="sprix-task-basic-grid grid gap-x-4 gap-y-6 lg:grid-cols-2">
            <Form.Item label="任务名称" name="title" rules={requiredTrimmedTextRules("任务名称", taskTextLimits.title)}>
              <Input maxLength={taskTextLimits.title} showCount />
            </Form.Item>
            <Form.Item label="任务类型" name="category" rules={requiredTrimmedTextRules("任务类型", taskTextLimits.category)}>
              <Select popupClassName="sprix-admin-task-category-popup" placeholder="请选择任务类型" options={taskCategoryOptions} />
            </Form.Item>
            <Form.Item label="任务来源类型" name="sourceType" rules={requiredTrimmedTextRules("任务来源类型", taskTextLimits.sourceType)}>
              <Input maxLength={taskTextLimits.sourceType} showCount />
            </Form.Item>
            <Form.Item label="总名额" name="totalSlots" rules={integerFieldRules("总名额", 9999)}>
              <InputNumber min={1} max={9999} step={1} precision={0} style={{ width: "100%" }} />
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
          <div className="mb-6 rounded-xl border border-line bg-[#fafafa] p-4">
            <div className="mb-3 flex items-start gap-2">
              <Paperclip className="mt-0.5 shrink-0 text-brand" size={18} />
              <div>
                <div className="font-semibold text-ink">任务附件</div>
                <p className="mt-1 text-sm text-ink-soft">
                  最多 {taskAttachmentMaxCount} 个，每个不超过 50 MiB。附件会在执行前下载到 LocalCLIAgent 的 input/ 目录。
                </p>
              </div>
            </div>
            {editTaskAttachments.length > 0 && (
              <div className="mb-3 grid gap-2">
                {editTaskAttachments.map((attachment) => {
                  const retained = retainedAttachmentIds.includes(attachment.attachmentId);
                  return (
                    <div key={attachment.attachmentId} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${retained ? "border-line bg-white" : "border-dashed border-red-200 bg-red-50 opacity-70"}`}>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">{attachment.filename}</div>
                        <div className="text-xs text-ink-soft">{formatFileSize(attachment.sizeBytes)}</div>
                      </div>
                      {!hasExistingExecutions && (
                        <Button
                          size="small"
                          type="link"
                          danger={retained}
                          onClick={() => setRetainedAttachmentIds((ids) => retained ? ids.filter((id) => id !== attachment.attachmentId) : [...ids, attachment.attachmentId])}
                        >
                          {retained ? "移除" : "保留"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {hasExistingExecutions ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                该任务已有执行记录，附件已冻结，不能新增或删除。
              </div>
            ) : (
              <Upload.Dragger
                className="sprix-task-attachment-upload"
                multiple
                maxCount={taskAttachmentMaxCount - retainedAttachmentIds.length}
                fileList={newAttachmentFiles}
                beforeUpload={(file, batchFiles) => {
                  const error = validateTaskAttachment(file);
                  if (error) {
                    message.error(`${file.name}：${error}`);
                    return Upload.LIST_IGNORE;
                  }

                  const availableSlots = taskAttachmentMaxCount - retainedAttachmentIds.length - newAttachmentFiles.length;
                  const validBatchFiles = batchFiles.filter((batchFile) => !validateTaskAttachment(batchFile));
                  const validFileIndex = validBatchFiles.indexOf(file);
                  if (validBatchFiles.length > availableSlots && validFileIndex === 0) {
                    message.error(`任务附件最多 ${taskAttachmentMaxCount} 个，已忽略超出数量的文件`);
                  }
                  if (validFileIndex >= availableSlots) {
                    return Upload.LIST_IGNORE;
                  }
                  return false;
                }}
                onChange={({ fileList }) => setNewAttachmentFiles(fileList.slice(0, taskAttachmentMaxCount - retainedAttachmentIds.length))}
              >
                <p className="text-sm font-medium text-ink">点击或拖放文件到这里</p>
                <p className="mt-1 text-xs text-ink-soft">支持图片、PDF、Office 文档、文本和 zip/rar/7z 压缩包</p>
              </Upload.Dragger>
            )}
          </div>
          <div className="mb-4 pt-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-base font-semibold text-ink">
                  <CircleDollarSign size={18} />
                  <span>智能定价</span>
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
          <div className="flex justify-end gap-2">
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
    refetchInterval: (query) => query.state.data?.records.running.length ? 5000 : false,
    refetchIntervalInBackground: false,
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
  const attachments = taskDetailQuery.data?.attachments ?? [];
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
      <TaskAttachmentPanel attachments={attachments} />
      <AdminExecutionRecords taskId={task.id} records={records} />
      <AdminOperationLogs logs={operationLogs} />
    </AdminDetailPage>
  );
}

function TaskAttachmentPanel({ attachments }: { attachments: TaskAttachment[] }) {
  const downloadAttachment = async (attachment: TaskAttachment) => {
    try {
      await downloadRemoteAdminFile(attachment.downloadUrl, attachment.filename);
    } catch (error) {
      showRequestError(error, "任务附件下载失败");
    }
  };
  return (
    <Surface className="sprix-table-card mb-4 p-4">
      <h3 className="sprix-section-title">任务附件</h3>
      <p className="mt-1 text-sm text-ink-soft">发布任务时提供给执行用户和 LocalCLIAgent 的输入文件。</p>
      {attachments.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">暂无任务附件</p>
      ) : (
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {attachments.map((attachment) => (
            <div key={attachment.attachmentId} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-[#fafafa] px-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="shrink-0 text-brand" size={17} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink" title={attachment.filename}>{attachment.filename}</div>
                  <div className="text-xs text-ink-soft">{formatFileSize(attachment.sizeBytes)}</div>
                </div>
              </div>
              <Button type="link" size="small" icon={<Download size={15} />} onClick={() => void downloadAttachment(attachment)}>下载</Button>
            </div>
          ))}
        </div>
      )}
    </Surface>
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
        pagination={{pageSize:20,hideOnSinglePage:true}}
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
      <p className="sprix-detail-prose mt-3">{displayText(body)}</p>
    </Surface>
  );
}

function DetailFieldBlock({
  title,
  fields
}: {
  title: string;
  fields: Array<{ label: string; value?: ReactNode }>;
}) {
  const visibleFields = fields.filter((field) => field.value !== undefined && field.value !== null && field.value !== "");
  if (visibleFields.length === 0) return null;
  return (
    <Surface className="p-4">
      <h3 className="sprix-section-title">{title}</h3>
      <dl className="mt-5 space-y-2">
        {visibleFields.map((field) => (
          <div key={field.label} className="grid gap-1 text-sm leading-6 md:grid-cols-[96px_minmax(0,1fr)]">
            <dt className="text-ink-soft">{field.label}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words text-ink-soft">{typeof field.value === "string" ? displayText(field.value) : field.value}</dd>
          </div>
        ))}
      </dl>
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
  const [executionSearch,setExecutionSearch] = useSearchParams();
  const selectedExecution = executionSearch.get('executionId');
  const activeStatus = executionSearch.get('executionStatus') ?? 'all';
  if (records && selectedExecution) records = {
    running:records.running.filter(row=>row.executionId===selectedExecution),
    reviewing:records.reviewing.filter(row=>row.executionId===selectedExecution),
    completed:records.completed.filter(row=>row.executionId===selectedExecution),
    terminated:records.terminated.filter(row=>row.executionId===selectedExecution)
  };
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
    { title: "执行用户", dataIndex: "userName", width: 160, render: (value) => <EllipsisCell value={value} /> },
    { title: "手机号", dataIndex: "phone", render: (value) => <PhoneNumber value={value} /> },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "执行状态", dataIndex: "status", render: (value) => <StatusTag status={value} /> },
    { title: "时间", dataIndex: "time" }
  ];
  const runningColumns: ColumnsType<RunningExecution> = [
    { title: "执行用户", dataIndex: "userName", width: 160, render: (value) => <EllipsisCell value={value} /> },
    { title: "手机号", dataIndex: "phone", render: (value) => <PhoneNumber value={value} /> },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "Agent 评分", dataIndex: "agentScore" },
    { title: "当前节点", dataIndex: "currentNode", width: 120, render: (value) => <span className="whitespace-nowrap">{value}</span> },
    { title: "当前进度", dataIndex: "progress" },
    { title: "开始时间", dataIndex: "startedAt" }
  ];
  const terminatedColumns: ColumnsType<TerminatedExecution> = [
    { title: "执行用户", dataIndex: "userName", width: 160, render: (value) => <EllipsisCell value={value} /> },
    { title: "手机号", dataIndex: "phone", render: (value) => <PhoneNumber value={value} /> },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "终止原因", dataIndex: "terminationReason" },
    { title: "终止节点", dataIndex: "terminatedNode", width: 120, render: (value) => <span className="whitespace-nowrap">{value}</span> },
    { title: "终止时间", dataIndex: "terminatedAt" }
  ];
  const completedColumns: ColumnsType<CompletedExecution> = [
    { title: "执行用户", dataIndex: "userName", width: 160, render: (value) => <EllipsisCell value={value} /> },
    { title: "手机号", dataIndex: "phone", render: (value) => <PhoneNumber value={value} /> },
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
      {selectedExecution && <p>当前执行：{displayText(selectedExecution)} <Button type="link" onClick={()=>{const next=new URLSearchParams(executionSearch);next.delete('executionId');setExecutionSearch(next);}}>查看任务全部执行记录</Button></p>}
      <Tabs
        activeKey={['all','running','reviewing','completed','terminated'].includes(activeStatus) ? activeStatus : 'all'}
        onChange={key=>{const next=new URLSearchParams(executionSearch);next.set('executionStatus',key);next.delete('executionId');setExecutionSearch(next);}}
        className="mt-4"
        items={[
          {
            key: "all",
            label: "全部",
            children: <Table rowKey={(record) => record.executionId ?? `${record.userName}-${record.time}`} columns={allColumns} dataSource={allRecords} pagination={{pageSize:20,hideOnSinglePage:true}} locale={{ emptyText: "暂无执行记录" }} scroll={{ x: 1220 }} />
          },
          {
            key: "running",
            label: "执行中",
            children: <Table rowKey={(record) => record.executionId ?? record.startedAt} columns={runningColumns} dataSource={records?.running ?? []} pagination={{pageSize:20,hideOnSinglePage:true}} locale={{ emptyText: "暂无执行中记录" }} scroll={{ x: 1160 }} />
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
            children: <Table rowKey={(record) => record.executionId ?? record.terminatedAt} columns={terminatedColumns} dataSource={records?.terminated ?? []} pagination={{pageSize:20,hideOnSinglePage:true}} locale={{ emptyText: "暂无已终止记录" }} scroll={{ x: 1160 }} />
          },
          {
            key: "completed",
            label: "已完成",
            children: <Table rowKey={(record) => record.executionId ?? record.completedAt} columns={completedColumns} dataSource={records?.completed ?? []} pagination={{pageSize:20,hideOnSinglePage:true}} locale={{ emptyText: "暂无已完成记录" }} scroll={{ x: 1280 }} />
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
    ["手机号", <PhoneNumber value={record.phone} />],
    ["执行 Agent", record.agentName],
    ["Agent 评分", record.agentScore],
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
    ["手机号", <PhoneNumber value={record.phone} />],
    ["执行 Agent", record.agentName],
    ["终止原因", record.terminationReason],
    ["终止节点", record.terminatedNode],
    ["终止时间", record.terminatedAt]
  ]);
}

function showExecutionUserInfo(record: ExecutionUserRecord) {
  showAdminRecordDetail("用户信息", [
    ["用户昵称", record.userName],
    ["手机号", <PhoneNumber value={record.phone} />],
    ["关联执行记录ID", record.executionId ?? "-"]
  ]);
}

function showExecutionAgentInfo(record: ExecutionAgentRecord) {
  showAdminRecordDetail("Agent 信息", [
    ["执行 Agent", record.agentName],
    ["Agent 评分", record.agentScore ?? "-"],
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
  const [tab, setTab] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [quickFilter, setQuickFilter] = useState<"none" | "done">("none");
  const [page, setPage] = useState(1);
  const appealsQuery = useQuery({
    queryKey: ["sprix-admin", "appeals", tab, quickFilter, page, keyword, 20],
    queryFn: () => readAppealPage({page, pageSize: 20, status: tab, search: keyword, done: quickFilter === "done" ? "true" : undefined}),
    placeholderData: keepPreviousData,
    retry: 1
  });
  const visible = appealsQuery.data?.rows ?? [];
  const selectAppealTab = (nextTab: string) => { setTab(nextTab); setQuickFilter("none"); setPage(1); };
  const appealPagination = {current: appealsQuery.data?.page ?? page, pageSize: 20, total: appealsQuery.data?.total, onChange: setPage, showSizeChanger: false};
  if (appealsQuery.isLoading) return <Surface className="p-8">申诉数据加载中</Surface>;
  if (appealsQuery.isError) {
    const messageText = appealsQuery.error instanceof Error ? appealsQuery.error.message : "申诉数据加载失败";
    return <Surface className="p-8">申诉数据加载失败：{messageText}</Surface>;
  }
  const stats = appealsQuery.data!.stats;
  return (
    <>
      <PageHeader title="申诉处理中心" subtitle="复核验收争议并同步任务状态、结算状态" />
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
          setQuickFilter("done"); setPage(1);
        }} icon={<CheckCircle2 size={19} />} />
      </div>
      <Surface className="sprix-table-card p-4">
        <Tabs
          activeKey={tab}
          onChange={(value) => selectAppealTab(String(value))}
          tabBarExtraContent={<Input.Search className="sprix-table-tab-search" value={keyword} onChange={(event) => {setKeyword(event.target.value); setPage(1);}} placeholder="搜索任务名称、用户手机号、Agent、申诉编号" />}
          items={["全部", "待处理", "申诉通过", "申诉不通过"].map((key) => ({
            key,
            label: key,
            children: (
              <AdminTableViewport>
                {() => (
                  <Table
                    rowKey="appealNo"
                    dataSource={visible}
                    pagination={appealPagination}
                    tableLayout="fixed"
                    scroll={{ x: 1540 }}
                    columns={[
                      {
                        title: "申诉编号",
                        dataIndex: "appealNo",
                        width: 130,
                        render: (value, record) => {
                          const text = value == null || value === "" ? "-" : String(value);
                          return (
                            <Tooltip title={text === "-" ? undefined : text}>
                              <span className="block min-w-0 overflow-hidden">
                                <button
                                  type="button"
                                  className="sprix-table-link-cell"
                                  onClick={() => navigate(`/appeals/${getAppealBackendId(record)}`)}
                                >
                                  {displayText(text)}
                                </button>
                              </span>
                            </Tooltip>
                          );
                        }
                      },
                      { title: "关联任务", dataIndex: "taskTitle", width: 190, render: (value) => <EllipsisCell value={value} /> },
                      { title: "提交用户", dataIndex: "userName", width: 120, render: (value) => <EllipsisCell value={value} /> },
                      { title: "用户手机号", dataIndex: "userPhone", width: 150, render: (value) => <PhoneNumber value={value} /> },
                      { title: "执行 Agent", dataIndex: "agentName", width: 140, render: (value) => <EllipsisCell value={value} /> },
                      { title: "申诉原因", dataIndex: "issueSummary", width: 220, render: (value) => <EllipsisCell value={value} /> },
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
                            <Button type="link" className="!px-0" onClick={() => navigate(`/appeals/${getAppealBackendId(record)}`)}>查看详情</Button>
                          </div>
                        )
                      }
                    ]}
                  />
                )}
              </AdminTableViewport>
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
  const [reviewReason, setReviewReason] = useState("");
  useEffect(() => {
    setReviewReason("");
  }, [id]);
  if (!id) return <Surface className="p-8">申诉详情参数缺失</Surface>;
  if (appealDetailQuery.isLoading) return <Surface className="p-8">申诉详情加载中</Surface>;
  if (appealDetailQuery.isError) {
    const messageText = appealDetailQuery.error instanceof Error ? appealDetailQuery.error.message : "申诉详情加载失败";
    return <Surface className="p-8">申诉详情加载失败：{messageText}</Surface>;
  }
  const appeal = appealDetailQuery.data;
  if (!appeal) return <Surface className="p-8">申诉不存在</Surface>;
  const baseInfoFields = [
    { label: "当前状态", value: appeal.appealStatus },
    { label: "提交时间", value: appeal.submittedAt },
    { label: "提交用户", value: appeal.userName },
    { label: "手机号", value: <PhoneNumber value={appeal.userPhone} /> },
    { label: "处理人", value: appeal.handler }
  ];
  const taskInfoFields = [
    { label: "关联任务", value: appeal.taskTitle },
    { label: "任务分类", value: appeal.taskCategory }
  ];
  const acceptanceInfoFields = [
    { label: "交付标准", value: appeal.deliverables },
    { label: "验收标准", value: appeal.acceptanceCriteria }
  ];
  const appealInfoFields = [
    { label: "申诉原因", value: appeal.appealReason },
    { label: "处理说明", value: appeal.resultDescription },
    { label: "补充说明", value: appeal.userSupplement }
  ];
  const canReviewAppeal = appeal.appealStatus === "待处理";
  return (
    <AdminDetailPage>
      <AdminDetailHeading title={appeal.appealNo} onBack={() => navigate("/appeals")} />
      <div className={canReviewAppeal ? "grid gap-4 xl:grid-cols-[1fr_380px]" : "grid gap-4"}>
        <div className="space-y-4">
          <DetailFieldBlock title="基本信息" fields={baseInfoFields} />
          <DetailFieldBlock title="关联任务信息" fields={taskInfoFields} />
          <DetailFieldBlock title="验收口径" fields={acceptanceInfoFields} />
          <DetailFieldBlock title="申诉信息" fields={appealInfoFields} />
        </div>
        {canReviewAppeal && (
          <Surface className="p-4">
            <h3 className="sprix-section-title">平台复核区</h3>
            <Input.TextArea
              rows={8}
              className="mt-4"
              value={reviewReason}
              onChange={(event) => setReviewReason(event.target.value)}
              placeholder="填写处理说明"
            />
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton
                onClick={() =>
                  Modal.confirm({
                    title: "确认申诉通过",
                    content: "确认申诉通过后，该任务将从验收未通过转为结算中，并生成结算记录。",
                    okText: "申诉通过",
                    onOk: async () => {
                      try {
                        await approveRemoteAppeal(getAppealBackendId(appeal), reviewReason);
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
                        await rejectRemoteAppeal(getAppealBackendId(appeal), reviewReason);
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
        )}
      </div>
    </AdminDetailPage>
  );
}

export function AdminFundCenter() {
  const [page, setPage] = useState(1);
  const fundsQuery = useQuery({
    queryKey: ["sprix-admin", "funds", "settlements", page,20],
    placeholderData: keepPreviousData,
    queryFn: () => readFundPage("settlements", { page, pageSize:20 }),
    retry: 1
  });
  if (fundsQuery.isLoading) return <Surface className="p-8">资金数据加载中</Surface>;
  if (fundsQuery.isError) return <Surface className="p-8">资金数据加载失败：{fundsQuery.error.message}</Surface>;
  return <>
    <PageHeader title="资金管理中心" subtitle="管理结算记录" />
    <Surface className="sprix-table-card p-4">
      <Table<Settlement> rowKey="settlementNo" dataSource={fundsQuery.data?.settlements ?? []}
        loading={fundsQuery.isPlaceholderData}
        pagination={{current:fundsQuery.data?.page ?? page,pageSize:20,total:fundsQuery.data?.total,onChange:setPage,showSizeChanger:false}}
        scroll={{x:1400}} columns={[
          {title:"结算单号",dataIndex:"settlementNo",width:180},
          {title:"关联任务",dataIndex:"taskTitle",width:260},
          {title:"用户昵称",dataIndex:"userName",width:160},
          {title:"手机号",dataIndex:"userPhone",width:160,render:(value)=><PhoneNumber value={value}/>},
          {title:"执行 Agent",dataIndex:"agentName",width:180},
          {title:"任务收入",dataIndex:"taskIncome",width:120,render:currency},
          {title:"平台服务费",dataIndex:"platformFee",width:120,render:currency},
          {title:"实际入账",dataIndex:"netIncome",width:120,render:currency},
          {title:"结算状态",dataIndex:"settlementStatus",width:120,render:value=><StatusTag status={value}/>},
          {title:"生成时间",dataIndex:"createdAt",width:180},
          {title:"入账时间",dataIndex:"paidAt",width:180}
        ]} />
    </Surface>
  </>;
}
