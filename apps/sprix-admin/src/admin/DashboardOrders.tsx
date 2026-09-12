import { AdminTable as Table } from "../components/AdminTable";
import {readRemoteTaskCenterSnapshot,readRemoteTaskDetail} from "../services/sprixApi";
import {useState} from 'react';
import {useQuery,useQueryClient,keepPreviousData} from '@tanstack/react-query';
import {Alert,Button,Drawer,Input,Select,Space } from 'antd';
import {Link} from 'react-router-dom';
import {executionLabels,readOrderPage,type ExecutionFilter,type OrderRow} from '../services/dashboardRecords';
import {StatusTag} from '../components/Primitives';
import {currency} from '../utils/format';
export function DashboardOrders({initialStatus,onClose}:{initialStatus:ExecutionFilter;onClose:()=>void}) {
 const client=useQueryClient();
 const [status,setStatus]=useState(initialStatus),[page,setPage]=useState(1),[search,setSearch]=useState('');
 const query=useQuery({queryKey:['sprix-admin','dashboard-orders',status,page,search],queryFn:()=>readOrderPage({status,page,search},{center:readRemoteTaskCenterSnapshot,detail:task=>client.fetchQuery({queryKey:['sprix-admin','order-task-detail',task.id,task.executionTotal,task.runningExecutionCount,task.reviewingExecutionCount,task.completedExecutionCount,task.terminatedExecutionCount],queryFn:()=>readRemoteTaskDetail(task.id),staleTime:30000,gcTime:60000})}),placeholderData:keepPreviousData,refetchInterval:5000,refetchIntervalInBackground:false,retry:1});
 return <Drawer title="订单记录" width={1180} open onClose={onClose}>
   <p className="dashboard-note">点击任务查看执行详情并处理待验收记录。订单数按执行记录统计，按对应状态时间倒序展示。</p>
   <Space wrap style={{marginBottom:16}}>
    <Select aria-label="订单状态" value={status} style={{width:150}} options={Object.entries(executionLabels).map(([value,label])=>({value,label}))} onChange={v=>{setStatus(v);setPage(1);}}/>
    <Input.Search placeholder="搜索任务名称或任务 ID" aria-label="搜索订单关联任务" allowClear style={{width:300}} onSearch={v=>{setSearch(v);setPage(1);}}/>
    <Button onClick={()=>query.refetch()} loading={query.isFetching}>刷新列表</Button>
   </Space>
   {query.isError ? <Alert type="error" message="订单读取失败" description={query.error.message} action={<Button onClick={()=>query.refetch()}>重试</Button>}/> : <Table<OrderRow> rowKey="id" loading={query.isPending || query.isPlaceholderData} size="small" dataSource={query.data?.rows ?? []} scroll={{x:1100}} pagination={{current:query.data?.page ?? page,pageSize:20,total:query.data?.total ?? 0,showSizeChanger:false,onChange:setPage,showTotal:total=>`共 ${total.toLocaleString()} 条订单`}} columns={[
    {title:'执行 ID',dataIndex:'executionId',width:210},
    {title:'关联任务',dataIndex:'taskTitle',width:220,render:(title,row)=><Link to={`/tasks/${encodeURIComponent(row.taskId)}?executionStatus=${row.status}&executionId=${encodeURIComponent(row.executionId)}`}>{title}</Link>},
    {title:'状态',dataIndex:'status',width:100,render:(value:ExecutionFilter)=><StatusTag status={executionLabels[value]}/>},
    {title:'执行用户',dataIndex:'userName',width:130},{title:'Agent',dataIndex:'agentName',width:130},
    {title:'订单奖励',dataIndex:'reward',width:110,render:currency},{title:'状态时间',dataIndex:'time',width:170},
    {title:'操作',fixed:'right',width:100,render:(_,row)=><Link to={`/tasks/${encodeURIComponent(row.taskId)}?executionStatus=${row.status}&executionId=${encodeURIComponent(row.executionId)}`}>{row.status==='reviewing'?'查看并处理':'查看详情'}</Link>}
   ]}/>}
 </Drawer>;
}
