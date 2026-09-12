import {hash} from './business-scenario.mjs';
const surnames=[...'陈林王李张刘赵周吴郑黄徐孙朱胡郭何高罗梁宋谢唐许邓冯韩曹曾彭'];
const agents=['Codex Agent','Claude Code','OpenCode Agent','Hermes Agent'];
const profiles=new Map();
export function businessProfile(index) {
 const uid=(Math.max(1,Number(index))-1)%30000+1;
 let value=profiles.get(uid);
 if(!value) {value=Object.freeze(createBusinessProfile(uid));profiles.set(uid,value);}
 return value;
}
function createBusinessProfile(index) {
 const uid=(Math.max(1,Number(index))-1)%30000+1;
 const surname=surnames[hash(uid,10)%surnames.length];
 const phone=`${['138','139','150','158','186','188','135','136','151','177'][hash(uid,15)%10]}${String(hash(uid,18)%10000).padStart(4,'0')}${String(hash(uid,16)%10000).padStart(4,'0')}`;
 const userName=`用户${phone.slice(-4)}`;
 return {userName,phone,verifiedName:`${surname}**`,alipayAccount:phone,agentName:agents[hash(uid,17)%agents.length]};
}
