// FundsService computes fee and net independently before numeric(12,2) storage.
// Positive half-cent ties round up, as PostgreSQL numeric and Alipay HALF_UP do.
export function settlementAmounts(reward) {
 const gross=Math.round(reward*100);
 if(!Number.isSafeInteger(gross)||gross<0) throw new Error('无效结算金额');
 const fee=Math.floor((gross+5)/10),net=Math.floor((gross*9+5)/10);
 return {gross,fee,net};
}
