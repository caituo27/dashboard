import {useState} from 'react';
import {Alert,Button,Skeleton} from 'antd';
import {PageHeader,Surface} from '../components/Primitives';
import {useDashboardAnalytics} from './useDashboardAnalytics';
import {DashboardAnalytics} from './DashboardAnalytics';
import type {AnalyticsSelection} from './AnalyticsDetails';

export function AdminBehaviorAnalytics(){
 const query=useDashboardAnalytics({days:30});
 const [selection,setSelection]=useState<AnalyticsSelection|null>(null);
 if(query.isPending)return <Surface className="p-6"><Skeleton active paragraph={{rows:12}}/></Surface>;
 if(query.isError)return <Alert type="error" showIcon message="行为数据加载失败" action={<Button onClick={()=>void query.refetch()}>重试</Button>}/>;
 return <div className="dashboard-page"><PageHeader title="行为数据分析" subtitle="用户访问、PV/UV、关键行为与事件明细" actions={<Button size="small" loading={query.isFetching} onClick={()=>void query.refetch()}>刷新数据</Button>}/><DashboardAnalytics data={query.data} selection={selection} onSelectionChange={setSelection}/></div>;
}
