import {DAY,hash} from './business-scenario.mjs';
import {businessProfile} from './business-profile.mjs';
const money = cents => cents / 100;
const time = at => new Date(at).toISOString();
// Each user has a staggered weekly withdrawal schedule. A batch only exists once
// its cutoff is reached; later settlements go into a different immutable batch.
export function createFinanceLedger(initialNow) {
  const settlements=new Map(), batches=new Map(), schedules=new Map();

  return {
    add(task,index,user,reward,completedAt,identity) {
      const gross=Math.round(reward*100),fee=Math.floor(gross*.10),net=gross-fee;
      let total=settlements.get(task.id);
      if(!total) {
        total={backendId:`demo:settlement:${task.id.split(':')[2]}`,settlementNo:`demo:settlement:${task.id.split(':')[2]}`,taskTitle:task.title,taskIncome:0,platformFee:0,netIncome:0,settlementStatus:'已入账',createdAt:completedAt};
        settlements.set(task.id,total);
      }
      total.taskIncome+=gross;total.platformFee+=fee;total.netIncome+=net;
      if(completedAt>total.createdAt) total.createdAt=completedAt;
      let schedule=schedules.get(user);
      if(!schedule) {schedule={offset:(hash(user,140)%7)*DAY+3600000,delay:(1+hash(user,141)%6)*3600000};schedules.set(user,schedule);}
      const period=7*DAY, offset=schedule.offset;
      const appliedAt=(Math.floor((completedAt-offset)/period)+1)*period+offset;
      const key=Math.floor(appliedAt/DAY)*100000+user;
      let batch=batches.get(key);
      if(!batch) {
        const id=`demo:withdrawal:${key}`,paidAt=appliedAt+schedule.delay,profile=identity ? {userName:identity.userName,phone:identity.phone,agentName:identity.agentName} : businessProfile(user);
        batch={backendId:id,withdrawalNo:id,userName:profile.userName,userPhone:profile.phone,agentName:profile.agentName,applyAmount:0,appliedAt:time(appliedAt),paidAt:time(paidAt),withdrawableBalance:0};
        batches.set(key,batch);
      }
      batch.applyAmount+=net;
    },
    result(now=initialNow) {
      let availableCents=0;
      const rows=[...settlements.values()].map(row=>({...row,createdAt:time(row.createdAt),taskIncome:money(row.taskIncome),platformFee:money(row.platformFee),netIncome:money(row.netIncome)}));
      const withdrawals=[];
      for(const row of batches.values()) {
        if(Date.parse(row.appliedAt)>now) {availableCents+=row.applyAmount;continue;}
        const paid=Date.parse(row.paidAt)<=now;
        withdrawals.push({...row,applyAmount:money(row.applyAmount),paidAt:paid?row.paidAt:undefined,withdrawStatus:paid?'已提现':'待打款'});
      }
      return {settlements:rows,withdrawals,payouts:withdrawals.filter(row=>row.withdrawStatus==='待打款').map(row=>({...row,payoutAmount:row.applyAmount,approvedAt:row.appliedAt})),fundExceptions:[],availableAmount:money(availableCents)};
    }
  };
}
