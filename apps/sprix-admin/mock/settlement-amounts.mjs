// Round the platform fee once, then derive net income from the stored gross and fee.
// This keeps every settlement row balanced to the cent: gross = fee + net.
export function settlementAmounts(reward) {
 const gross=Math.round(reward*100);
 if(!Number.isSafeInteger(gross)||gross<0) throw new Error('无效结算金额');
 const fee=Math.floor((gross+5)/10),net=gross-fee;
 return {gross,fee,net};
}
