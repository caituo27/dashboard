const money = cents => cents / 100;
const time = at => new Date(at).toISOString();
// Completed executions settle and automatically pay out at the same instant.
// Keep compact task aggregates here; individual payout rows are paginated from executions.
export function createFinanceLedger() {
  const settlements=new Map();
  let paidCents=0;
  return {
    add(task,index,user,reward,completedAt) {
      const gross=Math.round(reward*100),fee=Math.floor(gross*.10),net=gross-fee;
      let total=settlements.get(task.id);
      if(!total) {
        total={backendId:`demo:settlement:${task.id.split(':')[2]}`,settlementNo:`demo:settlement:${task.id.split(':')[2]}`,taskTitle:task.title,taskIncome:0,platformFee:0,netIncome:0,settlementStatus:'已入账',createdAt:completedAt};
        settlements.set(task.id,total);
      }
      total.taskIncome+=gross;total.platformFee+=fee;total.netIncome+=net;paidCents+=net;
      if(completedAt>total.createdAt)total.createdAt=completedAt;
    },
    result() {
      const rows=[...settlements.values()].map(row=>({...row,createdAt:time(row.createdAt),paidAt:time(row.createdAt),taskIncome:money(row.taskIncome),platformFee:money(row.platformFee),netIncome:money(row.netIncome)}));
      return {settlements:rows,withdrawals:[],payouts:[],fundExceptions:[],availableAmount:0,paidAmount:money(paidCents)};
    }
  };
}
