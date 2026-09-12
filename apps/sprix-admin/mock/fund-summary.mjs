export function fundSummary(funds) {
 const sum=(rows,field)=>rows.reduce((s,r)=>s+Math.round((r[field]??0)*100),0)/100;
 return {available:funds.availableAmount ?? sum(funds.withdrawals,'withdrawableBalance'),settling:sum(funds.settlements.filter(r=>r.settlementStatus==='结算中'),'netIncome'),reviewing:sum(funds.withdrawals.filter(r=>r.withdrawStatus==='提现审核中'),'applyAmount'),paying:sum(funds.payouts.filter(r=>r.withdrawStatus==='待打款'),'payoutAmount'),paid:funds.paidAmount ?? sum(funds.withdrawals.filter(r=>r.withdrawStatus==='已提现'),'applyAmount'),exceptions:sum(funds.fundExceptions,'exceptionAmount'),settledNet:sum(funds.settlements.filter(r=>r.settlementStatus==='已入账'),'netIncome')};
}
