export const DAY = 86400000;
export const START = Date.parse('2026-07-29T04:00:00Z');
export function hash(value, salt=0) { let x=(value ^ Math.imul(salt+1,0x9e3779b9))>>>0; x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>15))>>>0; }
export const userForExecution = index => hash(index,81)%30000+1;
// Independent positive-rate waves: daytime load plus 10/30 minute bursts.
export function operatingAge(days) {
 const d=Math.max(0,days), tau=2*Math.PI;
 return d+.20*Math.sin(d*tau)/tau+.35*Math.sin(d*tau*144)/(tau*144)+.15*Math.sin(d*tau*48)/(tau*48);
}
export function clock(index) {
 const target=(index/1700000)**(1/1.12)*45;
 let days=target;
 for(let n=0;n<8;n++) {
  const tau=2*Math.PI;
  days-=(operatingAge(days)-target)/(1+.20*Math.cos(days*tau)+.35*Math.cos(days*tau*144)+.15*Math.cos(days*tau*48));
 }
 return START+days*DAY;
}
export function indexAt(at) {return Math.floor(1700000*(operatingAge((at-START)/DAY)/45)**1.12);}
export function agentsAt(at) {
 const d=Math.max(0,(at-START)/DAY), tau=2*Math.PI;
 const age=d+.45*Math.sin(d*tau/3)/(tau/3)+.25*Math.sin(d*tau*24)/(tau*24);
 return Math.floor(30000*(age/45)**.9);
}
export function publicationTime(task) {
 return Math.max(START,clock(orderRange(task)[0])-(120+20*Math.sin(task/250))*60000);
}
export function publishedTaskCount(at) {
 if(at<START) return 0;
 let low=0,high=Math.max(1,taskForOrder(Math.max(1,indexAt(at+3*3600000))));
 while(low<high) {const mid=Math.ceil((low+high)/2);if(publicationTime(mid)<=at)low=mid;else high=mid-1;}
 return low;
}
// Simulation assumptions, not measurements of real Agent throughput.
export const MAX_LIFECYCLE_MS = 8 * 3600000;
export function executionDuration(index, category) {
  const ranges = {'数据处理':[5,25], '内容运营':[15,60], '商务办公':[10,45], '人力资源':[20,60],
    '市场研究':[45,180], '金融资讯':[30,120], '软件开发':[30,180], '设计创意':[30,120]};
  const [min,max] = Object.hasOwn(ranges,category) ? ranges[category] : [15,90];
  const minutes = min + hash(index,32) % (max-min+1);
  // Some tasks need a second pass; the same execution always gets the same duration.
  const retryMinutes = hash(index,36)%10===0 ? 15+hash(index,37)%46 : 0;
  return (minutes+retryMinutes)*60000 + hash(index,33)%59000;
}
export function appealTimeline(index) {
  if(index%825!==0) return null;
  const rejected=timeline(index).completed, id=index/825;
  const submitted=rejected+(5+hash(id,40)%116)*60000;
  const started=submitted+(15+hash(id,41)%166)*60000;
  const resolved=started+(2+hash(id,42)%47)*3600000;
  return {rejected,submitted,started,resolved,approved:hash(id,27)%4===2};
}
export function terminalStatus(index) {
  return index%55===0 ? 'terminated' : 'completed';
}
// Chunked numeric cache: chronology is immutable and reused by financial aggregation.
const timelineChunks = new Map();
export function timeline(index) {
  const chunkId=Math.floor(index/4096),offset=(index%4096)*3;
  let chunk=timelineChunks.get(chunkId);
  if(!chunk) {chunk=new Float64Array(4096*3);timelineChunks.set(chunkId,chunk);}
  if(!chunk[offset]) {
    const accepted=clock(index);
    const submitted=accepted+executionDuration(index,taskScenario(taskForOrder(index)).category);
    chunk[offset]=accepted;chunk[offset+1]=submitted;chunk[offset+2]=submitted+(5+hash(index,34)%116)*60000;
  }
  return {accepted:chunk[offset],submitted:chunk[offset+1],completed:chunk[offset+2],paid:chunk[offset+2]};
}
export function statusAt(index, now, finishedThrough = indexAt(now-MAX_LIFECYCLE_MS)) {
  if(index%825===0) {
    const appeal=appealTimeline(index);
    if(appeal.approved && now>=appeal.resolved) return 'completed';
  }
  if(index<=finishedThrough) return terminalStatus(index);
  const dates=timeline(index);
  return now<dates.submitted ? 'running' : now<dates.completed ? 'reviewing' : terminalStatus(index);
}
export function executionCountsAt(now) {
  const total=indexAt(now), finishedThrough=indexAt(now-MAX_LIFECYCLE_MS);
  let terminated=Math.floor(finishedThrough/55);
  for(let n=825;n<=finishedThrough;n+=825) if(statusAt(n,now,finishedThrough)==='completed') terminated--;
  const counts={running:0,reviewing:0,completed:finishedThrough-terminated,terminated};
  for(let n=finishedThrough+1;n<=total;n++) counts[statusAt(n,now,finishedThrough)]++;
  return counts;
}
const projects=['跨境家居','智能穿戴','城市咖啡','新能源汽车','宠物食品','企业软件','户外装备','社区零售','在线教育','健康管理','文旅出行','消费电子','工业制造','本地生活','绿色能源','个人护理'];
const templates=[
 ['市场研究','竞品价格与卖点对比','对比主要产品的价格、功能和目标客户，标注公开资料来源。','竞品对比表和结论摘要'],
 ['数据处理','商品属性标准化','统一商品属性名称、计量单位和分类，标记缺失项。','标准化数据表和异常清单'],
 ['内容运营','推广文案优化','依据目标人群调整标题和正文，保留事实信息并检查合规表述。','优化后的文案及修改说明'],
 ['金融资讯','行业周报要点提炼','提取行业动态、经营指标和风险事项，并附引用出处。','要点摘要和来源索引'],
 ['软件开发','接口用例与边界检查','检查接口输入输出、异常分支和边界条件，整理可复现步骤。','检查报告和用例清单'],
 ['设计创意','活动页面信息梳理','整理页面层级、关键文案和视觉素材需求，检查信息完整性。','页面结构说明和素材清单'],
 ['数据处理','用户反馈主题归类','按主题归类反馈，提炼高频问题并去除重复项。','分类结果和高频问题摘要'],
 ['市场研究','区域门店资料核验','核对门店地址、营业时间和服务范围，注明无法确认的信息。','核验表和来源链接'],
 ['内容运营','多语言内容校对','核对译文含义、术语和语气，检查数字及专有名词。','校对稿和术语修订表'],
 ['人力资源','岗位能力要求整理','拆解职责、技能和经验要求，合并重复描述。','岗位能力矩阵'],
 ['商务办公','会议行动项整理','提取会议决定、负责人和时间节点，标记待确认事项。','行动项清单和会议摘要'],
 ['数据处理','文档字段提取','提取指定字段并保留原文定位，对不明确的信息单独标记。','结构化字段文件和校验记录']
];
const scenarios=new Map();
export function taskScenario(index) {
 let value=scenarios.get(index);
 if(!value) {value=Object.freeze(createTaskScenario(index));scenarios.set(index,value);}
 return value;
}
function createTaskScenario(index) {
 const h=hash(index,2), t=templates[h%templates.length];
 const project=projects[hash(index,3)%projects.length];
 const batch=1+hash(index,4)%24;
 // Most tasks are small, with a smaller share of higher-value analytical work.
 const tier=hash(index,5)%100;
 const reward=tier<65 ? (100+hash(index,6)%501)/100 : tier<93 ? (500+hash(index,7)%501)/100 : (1000+hash(index,8)%1801)/100;
 return {title:`${project}${t[1]}（第${batch}批）`,category:t[0],description:t[2],deliverables:t[3],reward,
   acceptanceCriteria:'内容覆盖任务范围，来源可追溯，字段完整且格式符合要求。'};
}

const sizes=[9,27,14,32,18,20];
const boundaries=sizes.reduce((all,n)=>[...all,(all.at(-1)??0)+n],[]);
export function taskForOrder(index) {
 const cycle=Math.floor((index-1)/120),within=(index-1)%120;
 return cycle*6+boundaries.findIndex(end=>within<end)+1;
}
export function orderRange(task) {
 const cycle=Math.floor((task-1)/6),slot=(task-1)%6;
 return [cycle*120+(slot?boundaries[slot-1]:0)+1,cycle*120+boundaries[slot]];
}
