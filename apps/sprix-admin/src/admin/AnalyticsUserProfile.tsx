import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Descriptions, Modal, Spin, Typography } from 'antd';
import {formatCount} from '../utils/format';

type Profile = {
  user_name?:string; user_id:string; anonymous_id:string; window_days:number; first_seen:string;last_seen:string;visitor_type:string;
  session_count:number;page_views:number;event_count:number;click_count:number;accepted_tasks:number;submitted_tasks:number;failure_count:number;average_session_span_seconds:number;
  top_pages:{page:string;views:number}[];latest_context:Record<string,string|null>;
};
const pageNames: Record<string,string> = {task_market:'任务市场',task_detail:'任务详情',execution_detail:'执行详情'};
const date = (value:string) => new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
export function AnalyticsUserProfile({userId,onClose}:{userId:string|null;onClose:()=>void}) {
  const query = useQuery({queryKey:['sprix-admin','analytics-profile',userId],enabled:!!userId,queryFn:async ({signal})=>(await axios.get<Profile>('/mock-api/dashboard/user-profile',{params:{user_id:userId},signal,timeout:15000})).data,staleTime:Infinity,refetchOnWindowFocus:false,refetchOnReconnect:false});
  const profile = query.data;
  return <Modal title="用户画像" open={!!userId} onCancel={onClose} footer={null} width={820}>
    {query.isError ? <Alert type="error" message="画像读取失败" action={<Button onClick={()=>query.refetch()}>重试</Button>}/> : query.isPending ? <Spin/> : profile && <>
      <p className="dashboard-note">近 {profile.window_days} 个完整自然日访问与任务行为 · 时间为北京时间</p>
      <Descriptions bordered size="small" column={2} items={[
        {key:'name',label:'用户昵称',children:profile.user_name ?? '—'},
        {key:'type',label:'回访情况',children:profile.visitor_type},
        {key:'first',label:'窗口内首次访问',children:date(profile.first_seen)},{key:'last',label:'最近访问',children:date(profile.last_seen)},

        {key:'pv',label:'页面浏览量',children:formatCount(profile.page_views)},{key:'clicks',label:'按钮点击次数',children:formatCount(profile.click_count)},
        {key:'accept',label:'成功接取任务',children:formatCount(profile.accepted_tasks)},{key:'submit',label:'提交交付任务',children:formatCount(profile.submitted_tasks)},
        {key:'sessions',label:'访问次数',children:formatCount(profile.session_count)},
        {key:'pages',label:'常用页面',children:profile.top_pages.map(row=>`${pageNames[row.page] ?? row.page}（${formatCount(row.views)} 次）`).join('、') || '—'}
      ]}/>
      <Typography.Title level={5}>地区与设备</Typography.Title>
      <Descriptions bordered size="small" column={2} items={[
        {key:'country',label:'国家',children:profile.latest_context.country ?? '—'},
        {key:'region',label:'省份 / 城市',children:[profile.latest_context.province,profile.latest_context.city].filter(Boolean).join(' · ') || '—'},
        {key:'device',label:'设备',children:[profile.latest_context.device_type,profile.latest_context.device_brand,profile.latest_context.device_model].filter(Boolean).join(' · ') || '—'},
        {key:'os',label:'操作系统',children:profile.latest_context.os_name ?? '—'},
        {key:'browser',label:'浏览器',children:profile.latest_context.browser_name ?? '—'},
        {key:'network',label:'网络',children:profile.latest_context.network_type ?? '—'}
      ]}/>
    </>}
  </Modal>;
}
