import {useState} from 'react';
import {useQuery,keepPreviousData} from '@tanstack/react-query';
import {Alert,Button,Modal} from 'antd';
import {AdminTable} from '../components/AdminTable';
import {readFundPage} from '../services/pagedAdminData';
import {currency} from '../utils/format';

export const financeLabels={completedAmount:'已完成订单金额',platformFee:'平台服务费',settlementNet:'实际入账',paidAmount:'累计已提现',remainingNet:'未提现金额'};
export type FinanceMetric=keyof typeof financeLabels;
export function DashboardFinance({metric,amount,onClose}:{metric:FinanceMetric;amount:number;onClose:()=>void}) {
 const [page,setPage]=useState(1);
 const withdrawal=metric==='paidAmount'||metric==='remainingNet';
 const status=metric==='remainingNet'?'未提现':withdrawal?'已提现':'已入账';
 const query=useQuery({queryKey:['sprix-admin','finance-detail',metric,page],queryFn:()=>readFundPage(withdrawal?'withdrawals':'settlements',{page,pageSize:20,status}),placeholderData:keepPreviousData,refetchInterval:5000,refetchIntervalInBackground:false});
 const valueField=metric==='completedAmount'?'taskIncome':metric==='platformFee'?'platformFee':metric==='settlementNet'?'netIncome':'applyAmount';
 return <Modal title={financeLabels[metric]} open onCancel={onClose} footer={null} width={1100}>
   <p className="mb-4">{financeLabels[metric]}：{currency(amount)}</p>
   {metric==='remainingNet'&&<p className="dashboard-note">未提现金额为实际入账减去累计已提现金额。下表展示尚未完成的提现记录，未申请提现的余额不在表内。</p>}
   {query.isError?<Alert type="error" message="资金记录读取失败" action={<Button onClick={()=>query.refetch()}>重试</Button>}/>:<AdminTable<Record<string,unknown>>
     rowKey={withdrawal?'withdrawalNo':'settlementNo'} loading={query.isPending||query.isPlaceholderData}
     dataSource={(query.data?.rows??[]) as Record<string,unknown>[]}
     pagination={{current:query.data?.page??page,pageSize:20,total:query.data?.total,onChange:setPage,showSizeChanger:false}}
     scroll={{x:1000}} columns={[
       {title:withdrawal?'提现单号':'结算单号',dataIndex:withdrawal?'withdrawalNo':'settlementNo',width:180},
       ...(!withdrawal?[{title:'关联任务',dataIndex:'taskTitle',width:240}]:[]),
       {title:'用户昵称',dataIndex:'userName',width:150},
       {title:metric==='remainingNet'?'申请金额':financeLabels[metric],dataIndex:valueField,width:150,render:value=>currency(Number(value))},
       {title:'状态',dataIndex:withdrawal?'withdrawStatus':'settlementStatus',width:120},
       {title:withdrawal?'申请时间':'生成时间',dataIndex:withdrawal?'appliedAt':'createdAt',width:180},
       {title:withdrawal?'打款时间':'入账时间',dataIndex:'paidAt',width:180,render:value=>value||'—'}
     ]}/>}
 </Modal>;
}
