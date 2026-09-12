import { displayText, internalSearch } from "../utils/displayText";
import { AdminTable as Table } from "../components/AdminTable";
import { AnalyticsUserProfile } from "./AnalyticsUserProfile";
import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { Alert, Button, Descriptions, Input, Modal, Select, Space } from 'antd';
import type { AnalyticsSelection } from './AnalyticsDetails';

type EventRow = {
  event_id: string; event_name: string; event_time: string; received_at: string;
  user_id: string; user_name: string; anonymous_id: string; session_id: string; page_id: string;
  button_id: string | null; button_name: string | null; channel: string;
  task_id: string; execution_id: string | null; agent_id: string; agent_role: string;
  result: string; error_code: string | null; duration_ms: number | null;
  event_source: string; app: string; env: string; release: string; schema_version: number;
  trace_id: string; action_id: string; referrer: string; journey_id: string;
  country?: string; province?: string; city?: string; device_type?: string; device_brand?: string; device_model?: string; os_name?: string; browser_name?: string;
};
const events = ['task_market_view','task_detail_view','button_click','task_accept_requested','task_accept_succeeded','delivery_submitted','acceptance_completed','task_action_failed'];
const eventNames: Record<string,string> = {
  task_market_view:'浏览任务市场',task_detail_view:'查看任务详情',button_click:'点击按钮',
  task_accept_requested:'发起接取',task_accept_succeeded:'接取成功',delivery_submitted:'提交成果',acceptance_completed:'验收任务',task_action_failed:'操作失败'
};
const pageNames: Record<string,string> = {task_market:'任务市场',task_detail:'任务详情',execution_detail:'执行详情'};
function eventDetailItems(row: EventRow) {
  const join = (values: (string | undefined)[]) => [...new Set(values.filter(Boolean))].join(' · ');
  const fields: [string, string | number | null | undefined][] = [
    ['事件',eventNames[row.event_name] ?? row.event_name],
    ['发生时间',new Date(row.event_time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})],
    ['用户',row.user_name || row.user_id],
    ['结果',row.result==='success'?'成功':row.result==='failure'?'失败':row.result],
    ['页面',pageNames[row.page_id] ?? row.page_id],
    ['按钮',row.button_name],
    ['任务编号',row.task_id],
    ['执行编号',row.execution_id],
    ['耗时',row.duration_ms == null ? null : `${row.duration_ms} ms`],
    ['错误码',row.result==='failure'?row.error_code:null],
    ['地区',join([row.country,row.province,row.city])],
    ['设备',join([row.device_type,row.device_brand,row.device_model])],
    ['运行环境',join([row.os_name,row.browser_name])]
  ];
  return fields.filter(([,value])=>value != null && value !== '').map(([label,value])=>({
    key:label,label,children:displayText(String(value))
  }));
}
export function AnalyticsEvents({period, startDate, endDate, selection}: {period: number; startDate: string; endDate: string; selection: AnalyticsSelection}) {
  const [filters,setFilters] = useState<Record<string,string>>({});
  const [page,setPage] = useState(1);
  const [profileUser,setProfileUser] = useState<string | null>(null);
  const [detail,setDetail] = useState<EventRow | null>(null);
  const change = (key:string,value:string) => {setFilters(old=>({...old,[key]:value}));setPage(1);};
  const params = {days:period,startDate,endDate,date:selection.date,event_name:selection.kind === 'behavior' ? selection.eventName : undefined,...filters,page};
  const query = useQuery({queryKey:['sprix-admin','analytics-events',params],queryFn:async ({signal})=>(await axios.get<{rows:EventRow[];total:number;generatedAt:string}>('/mock-api/dashboard/events',{params,signal,timeout:15000})).data,placeholderData:keepPreviousData,staleTime:Infinity,refetchOnWindowFocus:false,refetchOnReconnect:false});
  return <>
    <p className="dashboard-note">逐条事件 · 北京时间 · 每页 20 条。下方筛选仅作用于事件列表。</p>
    <Space wrap style={{marginBottom:16}}>
      <Select aria-label="事件名称" placeholder="全部事件" allowClear style={{width:230}} onChange={v=>change('event_name',v ?? '')} options={events.map(value=>({label:value,value}))}/>
      <Select aria-label="事件结果" placeholder="全部结果" allowClear style={{width:120}} onChange={v=>change('result',v ?? '')} options={[{label:'成功',value:'success'},{label:'失败',value:'failure'}]}/>
      <Select aria-label="事件渠道" placeholder="全部渠道" allowClear style={{width:120}} onChange={v=>change('channel',v ?? '')} options={['direct','search','campaign'].map(value=>({label:value,value}))}/>
      <Select aria-label="事件来源" placeholder="全部来源" allowClear style={{width:120}} onChange={v=>change('event_source',v ?? '')} options={['web','server','agent'].map(value=>({label:value,value}))}/>
      <Input.Search aria-label="搜索事件关联 ID" placeholder="用户 / 任务 / 执行 / 事件 / 链路 ID" allowClear onSearch={v=>change('search',internalSearch(v))} style={{width:330}}/>
    </Space>
    {query.isError ? <Alert type="error" message="事件读取失败" action={<Button onClick={()=>query.refetch()}>重试</Button>}/> : <Table<EventRow> rowKey="event_id" size="small" loading={query.isPending || query.isPlaceholderData} dataSource={query.data?.rows ?? []} scroll={{x:1100}} pagination={{current:page,pageSize:20,total:query.data?.total ?? 0,showSizeChanger:false,onChange:setPage,showTotal:total=>`共 ${total.toLocaleString()} 条事件`}} columns={[
      {title:'发生时间',dataIndex:'event_time',width:175,render:v=>new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})},
      {title:'事件',dataIndex:'event_name',width:240},{title:'用户',dataIndex:'user_name',width:130},{title:'页面',dataIndex:'page_id',width:140},
      {title:'结果',dataIndex:'result',render:v=>v==='success'?'成功':'失败'}, {title:'耗时 ms',dataIndex:'duration_ms',render:v=>v ?? '—'},
      {title:'操作',fixed:'right',width:180,render:(_,row)=><Space size={0}><Button type="link" onClick={()=>setDetail(row)}>查看详情</Button><Button type="link" onClick={()=>setProfileUser(row.user_id)}>用户画像</Button></Space>}
    ]}/>}
    <Modal title="事件详情" open={!!detail} onCancel={()=>setDetail(null)} footer={null} width={800} centered className="analytics-event-modal" styles={{body:{maxHeight:'min(560px, calc(100dvh - 160px))',overflowY:'auto'}}}>
      {detail && <Descriptions bordered size="small" column={{xs:1,sm:2}} items={eventDetailItems(detail)}/>}
    </Modal>
    {profileUser && <AnalyticsUserProfile userId={profileUser} onClose={()=>setProfileUser(null)}/>}
  </>;
}
