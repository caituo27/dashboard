import {platformCumulativeOverview} from './business-metrics.mjs';

export const LIVE_OVERVIEW_INTERVAL_MS=5*60*1000;

let lastAdvancedAt=Date.now();
let amountCents=Math.round(platformCumulativeOverview.amount*100);
let orderCount=platformCumulativeOverview.orders;
let agentCount=platformCumulativeOverview.agents;

function randomInteger(minimum,maximum){
 return minimum+Math.floor(Math.random()*(maximum-minimum+1));
}

function advanceRound(){
 const completedCount=randomInteger(1,5);
 for(let index=0;index<completedCount;index++)amountCents+=randomInteger(1000,15000);
 orderCount+=completedCount;
 agentCount+=randomInteger(1,5);
}

export function readLiveBusinessState(now=Date.now()){
 const elapsedRounds=Math.max(0,Math.floor((now-lastAdvancedAt)/LIVE_OVERVIEW_INTERVAL_MS));
 for(let round=0;round<elapsedRounds;round++)advanceRound();
 if(elapsedRounds)lastAdvancedAt+=elapsedRounds*LIVE_OVERVIEW_INTERVAL_MS;
 return {
  overview:{amount:amountCents/100,orders:orderCount,tasks:platformCumulativeOverview.tasks,agents:agentCount}
 };
}
