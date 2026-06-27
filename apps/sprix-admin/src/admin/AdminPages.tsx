import { useEffect, useState } from "react";
import type { Key } from "react";
import { Button, Form, Input, InputNumber, Modal, Segmented, Select, Table, Tabs, Tooltip, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { CircleDollarSign, ClipboardList, ShieldCheck } from "lucide-react";
import type { AdminAppeal, AdminOperationLog, CompletedExecution, FundException, Payout, RunningExecution, Task, TerminatedExecution, Withdrawal } from "../types";
import {
  approveRemoteAppeal,
  approveRemoteWithdrawal,
  markRemotePayoutExceptionHandled,
  markRemoteWithdrawalPaid,
  markRemoteWithdrawalPayoutFailed,
  readRemoteAppeals,
  readRemoteAppealDetail,
  readRemoteFunds,
  readRemoteTaskCenterSnapshot,
  readRemoteTaskDetail,
  rejectRemoteAppeal,
  rejectRemoteWithdrawal,
  returnRemoteWithdrawalForReview,
  startRemoteAppeal,
  type UpsertAdminTaskPayload
} from "../services/sprixApi";
import { ActionButton, MetricCard, PageHeader, SecondaryButton, SoftTag, StatusTag, Surface, primitiveIcons } from "../components/Primitives";
import { currency } from "../utils/format";
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

function getWithdrawalBackendId(record: Pick<Withdrawal | Payout, "backendId" | "withdrawalNo">) {
  return record.backendId ?? record.withdrawalNo;
}

function getFundExceptionBackendId(record: Pick<FundException, "backendId" | "withdrawalNo">) {
  return record.backendId ?? record.withdrawalNo;
}

export function AdminTaskCenter() {
  const navigate = useNavigate();
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
  const appealCount = taskCenterQuery.data?.appealCount ?? 0;
  const visibleTasks = tasks.filter((task) => {
    if (task.taskStatus === "已删除") return false;
    if (tab !== "全部" && task.taskStatus !== tab) return false;
    const query = keyword.trim();
    if (!query) return true;
    return `${task.title}${task.category}${task.sourceType}`.includes(query);
  });
  const executionCount = tasks.reduce((sum, task) => sum + (task.executionTotal ?? 0), 0);
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
      width: 230,
      render: (_, task) => (
        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <PendingTaskWriteButton action={getAdminTaskWriteAction("edit")} />
          {task.taskStatus === "已发布" ? (
            <>
              <PendingTaskWriteButton action={getAdminTaskWriteAction("offline")} />
              <PendingTaskWriteButton action={getAdminTaskWriteAction("delete")} />
            </>
          ) : (
            <>
              <PendingTaskWriteButton action={getAdminTaskWriteAction("republish")} />
              <PendingTaskWriteButton action={getAdminTaskWriteAction("delete")} />
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
        actions={<PendingTaskWriteButton action={getAdminTaskWriteAction("publish")} primary />}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="全部任务" value={tasks.filter((task) => task.taskStatus !== "已删除").length} icon={<ClipboardList size={19} />} />
        <MetricCard title="已发布任务" value={tasks.filter((task) => task.taskStatus === "已发布").length} />
        <MetricCard title="已下线任务" value={tasks.filter((task) => task.taskStatus === "已下线").length} />
        <MetricCard title="执行记录" value={executionCount} icon={primitiveIcons.clock} />
        <MetricCard title="申诉记录" value={appealCount} icon={<ShieldCheck size={19} />} />
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

function PendingTaskWriteButton({ action, primary = false }: { action: AdminTaskWriteAction; primary?: boolean }) {
  const ButtonComponent = primary ? ActionButton : SecondaryButton;
  return (
    <Tooltip title={action.reason}>
      <ButtonComponent size={primary ? undefined : "small"} danger={action.danger} disabled={action.disabled}>
        {action.label}
      </ButtonComponent>
    </Tooltip>
  );
}

export function AdminTaskForm() {
  const navigate = useNavigate();
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
          onFinish={() => message.warning(writeAction.reason)}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <Form.Item label="任务名称" name="title" rules={[{ required: true, message: "请输入任务名称" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="任务分类" name="category" rules={[{ required: true, message: "请选择任务分类" }]}>
              <Select options={["数据处理", "市场研究", "HR 招聘", "金融资讯"].map((value) => ({ value, label: value }))} />
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
            <Tooltip title={writeAction.reason}>
              <ActionButton htmlType="submit" disabled={writeAction.disabled}>{writeAction.label}</ActionButton>
            </Tooltip>
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
    terminated: TerminatedExecution[];
    completed: CompletedExecution[];
  };
}) {
  const allRecords = [
    ...(records?.running ?? []).map((item) => ({ ...item, status: "执行中", time: item.startedAt })),
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
  if (appealsQuery.isLoading) return <Surface className="p-8">申诉数据加载中</Surface>;
  if (appealsQuery.isError) {
    const messageText = appealsQuery.error instanceof Error ? appealsQuery.error.message : "申诉数据加载失败";
    return <Surface className="p-8">申诉数据加载失败：{messageText}</Surface>;
  }
  const appeals = appealsQuery.data ?? [];
  const visible = appeals.filter((appeal) => tab === "全部" || appeal.appealStatus === tab);
  const today = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
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
        <MetricCard title="待处理申诉" value={stats.pending} />
        <MetricCard title="处理中申诉" value={stats.processing} />
        <MetricCard title="今日新增" value={stats.today} />
        <MetricCard title="已处理" value={stats.done} />
        <MetricCard title="平均处理时长" value="-" />
      </div>
      <Surface className="sprix-table-card p-4">
        <div className="sprix-toolbar-row mb-3 flex-col items-start lg:flex-row lg:items-center">
          <Segmented options={["全部", "待处理", "处理中", "申诉通过", "申诉不通过"]} value={tab} onChange={(value) => setTab(String(value))} />
          <Input.Search className="max-w-[420px]" placeholder="搜索任务名称、用户手机号、Agent、申诉编号" />
        </div>
        <Table
          rowKey="appealNo"
          dataSource={visible}
          pagination={{ pageSize: 6 }}
          scroll={{ x: 1180 }}
          columns={[
            { title: "申诉编号", dataIndex: "appealNo" },
            { title: "关联任务", dataIndex: "taskTitle" },
            { title: "提交用户", dataIndex: "userName" },
            { title: "用户手机号", dataIndex: "userPhone" },
            { title: "执行 Agent", dataIndex: "agentName" },
            { title: "问题摘要", dataIndex: "issueSummary" },
            { title: "当前状态", dataIndex: "appealStatus", render: (value) => <StatusTag status={value} /> },
            { title: "优先级", dataIndex: "priority" },
            { title: "提交时间", dataIndex: "submittedAt" },
            { title: "处理人", dataIndex: "handler" },
            {
              title: "操作",
              fixed: "right",
              render: (_, record: AdminAppeal) => (
                <div className="flex flex-wrap gap-1">
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
                          message.error(error instanceof Error ? `开始处理失败：${error.message}` : "开始处理失败");
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
                      message.error(error instanceof Error ? `申诉通过失败：${error.message}` : "申诉通过失败");
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
                      message.error(error instanceof Error ? `申诉驳回失败：${error.message}` : "申诉驳回失败");
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
      message.error(error instanceof Error ? `提现审核失败：${error.message}` : "提现审核失败");
    }
  };
  const rejectWithdrawal = async (record: Withdrawal) => {
    try {
      await rejectRemoteWithdrawal(getWithdrawalBackendId(record), "后台审核不通过");
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已驳回提现申请");
    } catch (error) {
      message.error(error instanceof Error ? `提现驳回失败：${error.message}` : "提现驳回失败");
    }
  };
  const markPayoutPaid = async (record: Payout) => {
    try {
      await markRemoteWithdrawalPaid(getWithdrawalBackendId(record));
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已标记打款完成");
    } catch (error) {
      message.error(error instanceof Error ? `标记打款失败：${error.message}` : "标记打款失败");
    }
  };
  const returnPayoutForReview = async (record: Payout) => {
    try {
      await returnRemoteWithdrawalForReview(getWithdrawalBackendId(record), "待打款退回重新审核");
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已退回提现审核");
    } catch (error) {
      message.error(error instanceof Error ? `退回审核失败：${error.message}` : "退回审核失败");
    }
  };
  const markPayoutFailed = async (record: Payout) => {
    try {
      await markRemoteWithdrawalPayoutFailed(getWithdrawalBackendId(record));
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("已标记打款失败");
    } catch (error) {
      message.error(error instanceof Error ? `打款失败标记提交失败：${error.message}` : "打款失败标记提交失败");
    }
  };
  const markExceptionHandled = async (record: FundException) => {
    try {
      await markRemotePayoutExceptionHandled(getFundExceptionBackendId(record), "异常已处理，用户需更换收款账户");
      await queryClient.invalidateQueries({ queryKey: ["sprix-admin"] });
      message.success("异常已标记处理");
    } catch (error) {
      message.error(error instanceof Error ? `异常处理失败：${error.message}` : "异常处理失败");
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
                  scroll={{ x: 1040 }}
                  columns={[
                    { title: "结算单号", dataIndex: "settlementNo" },
                    { title: "关联任务", dataIndex: "taskTitle" },
                    { title: "用户昵称", dataIndex: "userName" },
                    { title: "手机号", dataIndex: "userPhone" },
                    { title: "执行 Agent", dataIndex: "agentName" },
                    { title: "任务收入", dataIndex: "taskIncome", render: currency },
                    { title: "平台服务费", dataIndex: "platformFee", render: currency },
                    { title: "实际入账", dataIndex: "netIncome", render: currency },
                    { title: "结算状态", dataIndex: "settlementStatus", render: (value) => <StatusTag status={value} /> },
                    { title: "生成时间", dataIndex: "createdAt" },
                    { title: "入账时间", dataIndex: "paidAt" },
                    { title: "操作", render: () => <PendingFundActionButton action={getAdminSettlementDetailAction()} /> }
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
              children: <PendingPayoutTable data={payouts} onMarkPaid={markPayoutPaid} onReturnReview={returnPayoutForReview} onMarkFailed={markPayoutFailed} />
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
  onMarkPaid,
  onReturnReview,
  onMarkFailed
}: {
  data: Payout[];
  onMarkPaid: (payout: Payout) => Promise<void>;
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
        scroll={{ x: 980 }}
        columns={[
          { title: "提现单号", dataIndex: "withdrawalNo" },
          { title: "用户昵称", dataIndex: "userName" },
          { title: "手机号", dataIndex: "userPhone" },
          { title: "支付宝账户", dataIndex: "alipayAccount" },
          { title: "打款金额", dataIndex: "payoutAmount", render: currency },
          { title: "预计到账时间", dataIndex: "estimatedArrivalTime" },
          { title: "审核通过时间", dataIndex: "approvedAt" },
          { title: "当前状态", dataIndex: "withdrawStatus", render: (value) => <StatusTag status={value} /> },
          {
            title: "操作",
            fixed: "right",
            render: (_, record) => (
              <div className="flex gap-1">
                <Button type="link" onClick={() => onMarkPaid(record)}>标记已打款</Button>
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
