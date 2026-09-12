import { displayText, maskPhone } from "../utils/displayText";
import { AdminTable as Table, EllipsisCell, EllipsisText } from "../components/AdminTable";
import {readTaskPage,readAcceptancePage,readAcceptanceDetail,readAppealPage,readFundPage} from "../services/pagedAdminData";
import type { TablePaginationConfig } from "antd";
import { useEffect, useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Segmented, Select, Tabs, Tooltip, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, ShieldCheck } from "lucide-react";
import type { AdminAppeal, AdminOperationLog, CompletedExecution, ReviewingExecution, RunningExecution, Settlement, Task, TerminatedExecution } from "../types";
import {
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
  startRemoteAppeal,
  updateRemoteAdminTask,
  type UpsertAdminTaskPayload
} from "../services/adminDataSource";
import { ActionButton, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface, primitiveIcons } from "../components/Primitives";
import { currency } from "../utils/format";
import { isGlobalAuthError } from "../utils/http";
import { getAdminTaskWriteAction, type AdminTaskWriteAction } from "./adminTaskActions";
import { getAdminEstimatedTokenField } from "./tokenEstimateView";

function getAppealBackendId(record: AdminAppeal) {
  return record.backendId ?? record.appealNo;
}

function showRequestError(error: unknown, fallback: string, prefix = "") {
  if (isGlobalAuthError(error)) return;
  message.error(error instanceof Error ? `${prefix}${error.message}` : fallback);
}

const taskCategoryOptions = ["等待产品输入"].map((value) => ({ value, label: value }));

export function AdminTaskCenter() {
  const [taskSearch,setTaskSearch] = useSearchParams();
  const publishedDate = /^\d{4}-\d{2}-\d{2}$/.test(taskSearch.get("publishedDate") ?? "") ? taskSearch.get("publishedDate") : null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab,setTab] = useState("全部");
  const [keyword,setKeyword] = useState("");
  const [taskPage,setTaskPage] = useState(1);
  const taskCenterQuery = useQuery({
    queryKey: ["sprix-admin", "task-center",tab,keyword,publishedDate,taskPage,20],
    placeholderData:keepPreviousData,
    queryFn: ()=>readTaskPage({page:taskPage,pageSize:20,status:tab,search:keyword,date:publishedDate ?? undefined}),
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
    { title: "奖励", dataIndex: "reward", width: 90, render: currency },
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
            <Input.Search className="max-w-[360px]" value={keyword} onChange={(event) => {setKeyword(event.target.value);setTaskPage(1);}} placeholder="搜索任务名称或分类" />
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
        subtitle="集中审核 Agent 提交的任务验收结果，确认通过后进入结算和打款流程。"
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <MetricCard title="待审核记录" value={acceptanceQuery.data?.total ?? 0} icon={<ShieldCheck size={19} />} />
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
              ["手机号", maskPhone(record.phone)],
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
          { title: "关联任务", dataIndex: "taskTitle", width: 260, render: (value) => <EllipsisCell value={value} /> },
          { title: "任务分类", dataIndex: "taskCategory", width: 130, render: (value) => <EllipsisCell value={value} /> }
        ] satisfies ColumnsType<ReviewingExecution>
      : []),
    { title: "执行用户", dataIndex: "userName", width: 130, render: (value) => <EllipsisCell value={value} /> },
    { title: "手机号", dataIndex: "phone", width: 140, render: (value) => <EllipsisCell value={maskPhone(value)} /> },
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
  const editTaskQuery = useQuery({
    queryKey: ["sprix-admin", "task-detail", editTaskId],
    refetchInterval: false,
    refetchOnWindowFocus: false,
    queryFn: () => readRemoteTaskDetail(editTaskId as string),
    enabled: Boolean(editTaskId),
    retry: 1
  });
  const editTask = editTaskQuery.data?.task;
  const isEdit = Boolean(editTaskId);
  const estimatedToken = getAdminEstimatedTokenField();

  const initialValues: Partial<UpsertAdminTaskPayload> | undefined = editTask
    ? {
        title: editTask.title,
        category: editTask.category,
        sourceType: editTask.sourceType,
        description: editTask.description,
        deliverables: editTask.deliverables,
        acceptanceCriteria: editTask.acceptanceCriteria,
        reward: editTask.reward,
        totalSlots: editTask.totalSlots
      }
    : undefined;

  useEffect(() => {
    if (!editTask) return;
    form.setFieldsValue({
      title: editTask.title,
      category: editTask.category,
      sourceType: editTask.sourceType,
      description: editTask.description,
      deliverables: editTask.deliverables,
      acceptanceCriteria: editTask.acceptanceCriteria,
      reward: editTask.reward,
      totalSlots: editTask.totalSlots
    });
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
            <SecondaryButton
              onClick={() =>
                Modal.confirm({
                  title: "当前填写内容尚未发布，取消后将不会保存。确认取消吗？",
                  okText: "确认取消",
                  cancelText: "继续编辑",
                  onOk: () => navigate("/tasks")
                })
              }
            >
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
      <p className="mt-3 text-sm leading-7 text-ink-soft">{displayText(body)}</p>
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
  const [executionSearch,setExecutionSearch] = useSearchParams();
  const selectedExecution = executionSearch.get('executionId');
  const activeStatus = executionSearch.get('executionStatus') ?? 'all';
  if (records && selectedExecution) records = {
    running:records.running.filter(row=>row.executionId===selectedExecution),
    reviewing:records.reviewing.filter(row=>row.executionId===selectedExecution),
    completed:records.completed.filter(row=>row.executionId===selectedExecution),
    terminated:records.terminated.filter(row=>row.executionId===selectedExecution)
  };
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
    { title: "手机号", dataIndex: "phone", render: maskPhone },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "执行状态", dataIndex: "status", render: (value) => <StatusTag status={value} /> },
    { title: "时间", dataIndex: "time" }
  ];
  const runningColumns: ColumnsType<RunningExecution> = [
    { title: "第几次执行", dataIndex: "executionIndex", render: (value) => (value ? `第 ${value} 次` : "-") },
    { title: "executionId", dataIndex: "executionId", render: (value) => value ?? "-" },
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone", render: maskPhone },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "Agent 综合评分", dataIndex: "agentScore" },
    { title: "当前节点", dataIndex: "currentNode" },
    { title: "当前进度", dataIndex: "progress" },
    { title: "开始时间", dataIndex: "startedAt" },
  ];
  const terminatedColumns: ColumnsType<TerminatedExecution> = [
    { title: "第几次执行", dataIndex: "executionIndex", render: (value) => (value ? `第 ${value} 次` : "-") },
    { title: "executionId", dataIndex: "executionId", render: (value) => value ?? "-" },
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone", render: maskPhone },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "终止原因", dataIndex: "terminationReason" },
    { title: "终止节点", dataIndex: "terminatedNode" },
    { title: "终止时间", dataIndex: "terminatedAt" },
  ];
  const completedColumns: ColumnsType<CompletedExecution> = [
    { title: "第几次执行", dataIndex: "executionIndex", render: (value) => (value ? `第 ${value} 次` : "-") },
    { title: "executionId", dataIndex: "executionId", render: (value) => value ?? "-" },
    { title: "执行用户", dataIndex: "userName" },
    { title: "手机号", dataIndex: "phone", render: maskPhone },
    { title: "执行 Agent", dataIndex: "agentName" },
    { title: "验收状态", dataIndex: "acceptanceStatus", render: (value) => <StatusTag status={value} /> },
    { title: "综合评分", dataIndex: "score" },
    { title: "申诉状态", dataIndex: "appealStatus", render: (value) => <StatusTag status={value} /> },
    { title: "结算状态", dataIndex: "settlementStatus" },
    { title: "完成时间", dataIndex: "completedAt" },
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

export function AdminAppealCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab,setTab]=useState("全部");
  const [quickFilter,setQuickFilter]=useState<"none"|"today"|"done">("none");
  const [page,setPage]=useState(1),[search,setSearch]=useState('');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const appealsQuery=useQuery({queryKey:['sprix-admin','appeals',tab,quickFilter,page,search,today,20],placeholderData:keepPreviousData,queryFn:()=>readAppealPage({page,pageSize:20,status:tab,search,date:quickFilter==='today'?today:undefined,done:quickFilter==='done'?'true':undefined}),retry:1});
  if (appealsQuery.isLoading) return <Surface className="p-8">申诉数据加载中</Surface>;
  if (appealsQuery.isError) {
    const messageText = appealsQuery.error instanceof Error ? appealsQuery.error.message : "申诉数据加载失败";
    return <Surface className="p-8">申诉数据加载失败：{messageText}</Surface>;
  }
  const visible=appealsQuery.data?.rows ?? [];
  const stats=appealsQuery.data!.stats;
  const selectAppealTab=(nextTab:string)=>{setTab(nextTab);setQuickFilter('none');setPage(1);};
  return (
    <>
      <PageHeader title="申诉处理中心" subtitle="复核验收争议并同步任务状态、结算状态和用户资金记录。" />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="待处理申诉" value={stats.pending} active={quickFilter === "none" && tab === "待处理"} onClick={() => selectAppealTab("待处理")} />
        <MetricCard title="处理中申诉" value={stats.processing} active={quickFilter === "none" && tab === "处理中"} onClick={() => selectAppealTab("处理中")} />
        <MetricCard title="今日新增" value={stats.today} active={quickFilter === "today"} onClick={() => {
          setTab("全部");
          setQuickFilter("today");setPage(1);
        }} />
        <MetricCard title="已处理" value={stats.done} active={quickFilter === "done"} onClick={() => {
          setTab("全部");
          setQuickFilter("done");setPage(1);
        }} />
        <MetricCard title="平均处理时长" value="-" />
      </div>
      <Surface className="sprix-table-card p-4">
        <div className="sprix-toolbar-row mb-3 flex-col items-start lg:flex-row lg:items-center">
          <Segmented options={["全部", "待处理", "处理中", "申诉通过", "申诉不通过"]} value={tab} onChange={(value) => selectAppealTab(String(value))} />
          <Input.Search onSearch={value=>{setSearch(value);setPage(1);}} allowClear className="max-w-[420px]" placeholder="搜索任务名称、用户手机号、Agent、申诉编号" />
        </div>
        <Table
          rowKey="appealNo"
          dataSource={visible}
          loading={appealsQuery.isPlaceholderData}
          pagination={{current:appealsQuery.data?.page ?? page,pageSize:20,total:appealsQuery.data?.total,onChange:setPage,showSizeChanger:false}}
          tableLayout="fixed"
          scroll={{ x: 1320 }}
          columns={[
            { title: "申诉编号", dataIndex: "appealNo", width: 130, render: (value) => <EllipsisCell value={value} /> },
            { title: "关联任务", dataIndex: "taskTitle", width: 190, render: (value) => <EllipsisCell value={value} /> },
            { title: "提交用户", dataIndex: "userName", width: 120, render: (value) => <EllipsisCell value={value} /> },
            { title: "用户手机号", dataIndex: "userPhone", width: 130, render: (value) => <EllipsisCell value={maskPhone(value)} /> },
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
  const [processReason, setProcessReason] = useState("");
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
    `手机号：${maskPhone(appeal.userPhone)}`,
    appeal.handler ? `处理人：${appeal.handler}` : ""
  ].filter(Boolean).join("。");
  const taskInfo = [
    `${appeal.taskTitle} · ${appeal.taskCategory}`,
    appeal.executionIndex ? `第 ${appeal.executionIndex} 次执行` : "",
    appeal.executionId ? `执行编号：${appeal.executionId}` : ""
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
          {!!appeal.processLogs?.length && <DetailBlock title="处理记录" body={appeal.processLogs.join("。 ")} />}
        </div>
        <Surface className="p-4">
          <h3 className="sprix-section-title">平台复核区</h3>
          <Input.TextArea rows={5} className="mt-4" disabled={["申诉通过", "申诉不通过"].includes(appeal.appealStatus)} placeholder="填写处理说明" value={processReason} onChange={event=>setProcessReason(event.target.value)} />
          <div className="mt-5 flex flex-wrap gap-2">
            <ActionButton
              disabled={["申诉通过", "申诉不通过"].includes(appeal.appealStatus)}
              onClick={() =>
                Modal.confirm({
                  title: "确认申诉通过",
                  content: "确认申诉通过后，该任务将从验收未通过转为结算中，并生成结算记录。",
                  okText: "申诉通过",
                  onOk: async () => {
                    try {
                      await approveRemoteAppeal(getAppealBackendId(appeal), processReason.trim());
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
              disabled={["申诉通过", "申诉不通过"].includes(appeal.appealStatus)}
              onClick={() =>
                Modal.confirm({
                  title: "确认申诉不通过",
                  content: "确认申诉不通过后，该任务将保持验收未通过状态，用户不可再次申诉。",
                  okText: "申诉不通过",
                  onOk: async () => {
                    try {
                      await rejectRemoteAppeal(getAppealBackendId(appeal), processReason.trim());
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
    <PageHeader title="资金管理中心" subtitle="管理结算记录" actions={
      <div className="text-right"><p className="text-xs text-ink-soft">已打款金额</p>
        <strong className="text-2xl tabular-nums">{currency(fundsQuery.data?.stats.paid ?? 0)}</strong></div>
    } />
    <Surface className="sprix-table-card p-4">
      <Table<Settlement> rowKey="settlementNo" dataSource={fundsQuery.data?.settlements ?? []}
        loading={fundsQuery.isPlaceholderData}
        pagination={{current:fundsQuery.data?.page ?? page,pageSize:20,total:fundsQuery.data?.total,onChange:setPage,showSizeChanger:false}}
        scroll={{x:1400}} columns={[
          {title:"结算单号",dataIndex:"settlementNo",width:180},
          {title:"关联任务",dataIndex:"taskTitle",width:260},
          {title:"用户昵称",dataIndex:"userName",width:160},
          {title:"手机号",dataIndex:"userPhone",width:150,render:maskPhone},
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
