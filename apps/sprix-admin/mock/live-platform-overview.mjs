import {platformCumulativeOverview} from './business-metrics.mjs';

export const LIVE_OVERVIEW_INTERVAL_MS=5*60*1000;

let lastAdvancedAt=Date.now();
let orderCount=platformCumulativeOverview.orders;
let taskCount=platformCumulativeOverview.tasks;
let agentCount=platformCumulativeOverview.agents;

function randomInteger(minimum,maximum){
 return minimum+Math.floor(Math.random()*(maximum-minimum+1));
}

function advanceRound(){
 const completedCount=randomInteger(1,5);
 orderCount+=completedCount;
 taskCount+=completedCount;
 agentCount+=randomInteger(1,5);
}

export function readLiveBusinessState(now=Date.now()){
 const elapsedRounds=Math.max(0,Math.floor((now-lastAdvancedAt)/LIVE_OVERVIEW_INTERVAL_MS));
 for(let round=0;round<elapsedRounds;round++)advanceRound();
 if(elapsedRounds)lastAdvancedAt+=elapsedRounds*LIVE_OVERVIEW_INTERVAL_MS;
 return {
  overview:{amount:platformCumulativeOverview.amount,orders:orderCount,tasks:taskCount,agents:agentCount}
 };
}
