const fields={tasks:'publishedAt',acceptance:'submittedAt',appeals:'submittedAt',settlements:'createdAt',withdrawals:'appliedAt',payouts:'approvedAt',fundExceptions:'occurredAt',fundFlows:'occurredAt',orders:'time'};
export function recordId(row) {return String(row.id ?? row.backendId ?? row.executionId ?? row.settlementNo ?? row.withdrawalNo ?? row.appealNo ?? row.flowNo ?? '');}
export function timestamp(value) {
  if(!value) return -Infinity;
  const text=String(value).trim().replace(' ','T');
  const time=Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(text)?text:`${text}+08:00`);
  return Number.isFinite(time)?time:-Infinity;
}
export function compareRecords(kind,a,b) {
 const x=timestamp(a[fields[kind]]),y=timestamp(b[fields[kind]]);
 if(x!==y) return x>y?-1:1;
 if(kind==='orders' && a.taskId!==b.taskId) return String(a.taskId).localeCompare(String(b.taskId));
 return recordId(a).localeCompare(recordId(b));
}
export function filterRecords(kind,rows,options) {
 const status=options.status,search=(options.search ?? '').trim().toLowerCase(),date=options.date;
 return rows.filter(row=>{
   if(kind==='tasks' && row.taskStatus==='已删除') return false;
   if(kind==='tasks' && options.availableOnly && (row.taskStatus!=='已发布' || !(row.remainingSlots>0))) return false;
   const value=kind==='tasks'?row.taskStatus:kind==='orders'?row.status:kind==='appeals'?row.appealStatus:kind==='settlements'?row.settlementStatus:row.withdrawStatus;
   if(status && !['all','全部'].includes(status) && value!==status) return false;
   if(date && String(row[fields[kind]]).slice(0,10)!==date) return false;
   if(options.done==='true' && !['申诉通过','申诉不通过'].includes(row.appealStatus)) return false;
   return !search || [row.id,row.title,row.category,row.sourceType,row.taskTitle,row.taskId,row.executionId,row.userName,row.userPhone,row.agentName,row.appealNo].some(v=>String(v ?? '').toLowerCase().includes(search));
 });
}
