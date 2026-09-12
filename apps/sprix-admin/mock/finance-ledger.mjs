import {settlementAmounts} from "./settlement-amounts.mjs";
const money = cents => cents / 100;
const time = at => new Date(at).toISOString();
// Completed executions settle and automatically pay out at the same instant.
// Keep compact task aggregates here; individual payout rows are paginated from executions.
export function createFinanceLedger() {
  const settlements=new Map();
  const rowViews=new Map();
  let paidCents=0;
  return {
    add(task,index,user,reward,completedAt) {
      const {gross,fee,net}=settlementAmounts(reward);
      let total=settlements.get(task.id);
      if(!total) {
        total={backendId:`demo:settlement:${task.id.split(':')[2]}`,settlementNo:`demo:settlement:${task.id.split(':')[2]}`,taskTitle:task.title,taskIncome:0,platformFee:0,netIncome:0,settlementStatus:'已入账',createdAt:completedAt};
        settlements.set(task.id,total);
      }
      rowViews.delete(task.id);
      total.taskIncome+=gross;total.platformFee+=fee;total.netIncome+=net;paidCents+=net;
      if(completedAt>total.createdAt)total.createdAt=completedAt;
    },
    result() {
      const rows=[...settlements.entries()].map(([id,row])=>{
        if(!rowViews.has(id)) rowViews.set(id,Object.freeze({...row,createdAt:time(row.createdAt),paidAt:time(row.createdAt),taskIncome:money(row.taskIncome),platformFee:money(row.platformFee),netIncome:money(row.netIncome)}));
        return rowViews.get(id);
      });
      return {settlements:rows,withdrawals:[],payouts:[],fundExceptions:[],availableAmount:0,paidAmount:money(paidCents)};
    }
  };
}
