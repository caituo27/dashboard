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
// Each family supplies its own compatible subjects and complete delivery scope.
// Keep family order stable: category also determines the existing execution timeline.
const products=['露营灯','便携咖啡机','无线键盘','宠物饮水机','桌面收纳盒','运动耳机','旅行背包','空气净化器','智能手环','保温杯','人体工学椅','家用投影仪'];
const families=[
 ['市场研究',pick=>{
   const product=pick(products,3), count=pick([3,4,5],4);
   return [`对比 ${count} 款${product}的价格和核心功能`,`从公开产品页面选择 ${count} 款${product}，记录售价、核心功能、适用人群和资料查询日期。`,`Excel 竞品对比表，附产品链接和差异摘要`,`覆盖 ${count} 款产品；价格注明币种和查询日期，结论能对应来源。`];
 }],
 ['数据处理',pick=>{
   const product=pick(products,3), count=pick([15,20,30,40],4);
   return [`统一 ${count} 条${product}商品资料的规格字段`,`整理任务资料中 ${count} 条${product}商品记录，统一型号、尺寸、重量和单位，保留原始值并标出缺失字段。`,`Excel 商品规格表和异常清单`,`输出 ${count} 条记录；原始值与标准值可核对，不自行补造缺失信息。`];
 }],
 ['内容运营',pick=>{
   const product=pick(products,3), channel=pick(['商品详情页','小红书笔记','公众号推文','邮件推广'],4);
   return [`优化${product}的${channel}文案`,`依据任务提供的${product}资料修改${channel}文案，保留产品事实，删去重复表述和无法证实的效果承诺。`,`修改前后对照稿，附 3 个标题备选`,`产品参数与原资料一致，文案符合${channel}的表达场景，修改处有说明。`];
 }],
 ['金融资讯',pick=>{
   const industry=pick(['新能源汽车','半导体','光伏设备','消费电子','医疗器械','工业机器人','储能','跨境电商'],3);
   return [`整理${industry}行业周报中的经营数据`,`阅读任务提供的${industry}行业周报，提取销量、收入、增速及相关统计期间，区分事实数据与作者判断。`,`经营指标表和一页摘要，附原文页码`,`数字、单位和统计期间准确；每项数据可定位到原文，不补写投资建议。`];
 }],
 ['软件开发',pick=>{
   const api=pick(['登录验证码','订单查询','任务接取','文件上传','分页搜索','用户资料更新','消息通知','库存查询'],3);
   return [`补充${api}接口的异常参数测试用例`,`依据任务提供的${api}接口文档，检查必填项、类型错误、边界值和权限异常，列出请求样例与预期响应。`,`Markdown 测试用例表和 JSON 请求样例`,`用例对应现有接口字段；预期结果注明文档依据，未实际执行的用例不标为通过。`];
 }],
 ['设计创意',pick=>{
   const campaign=pick(['咖啡新品试饮','露营装备上新','会员积分兑换','城市徒步报名','摄影课程预约','读书分享会','宠物领养日','周末市集'],3);
   return [`梳理${campaign}活动页的信息结构`,`根据任务提供的${campaign}活动资料，整理页面区块、报名入口、时间地点和素材需求。`,`页面结构草图、区块文案和素材清单`,`关键活动信息与资料一致；页面层级清晰，每个操作入口注明用途。`];
 }],
 ['数据处理',pick=>{
   const subject=pick(['订单售后','课程体验','物流配送','App 登录','会员服务','商品退换货','客服响应','预约流程'],3),count=pick([20,30,40,50],4);
   return [`将 ${count} 条${subject}反馈按问题分类`,`阅读任务提供的 ${count} 条${subject}反馈，合并重复问题，保留记录编号，统计各主题数量。`,`反馈分类表和高频问题摘要`,`全部 ${count} 条反馈均有分类或待确认标记；主题统计与明细一致。`];
 }],
 ['市场研究',pick=>{
   const city=pick(['杭州','成都','广州','南京','武汉','苏州','长沙','厦门','西安','青岛','宁波','重庆'],3),shop=pick(['咖啡店','书店','健身房','宠物医院','共享办公空间','摄影工作室'],4);
   return [`核对${city} 5 家${shop}的地址和营业时间`,`根据任务中的门店清单核对${city} 5 家${shop}的地址、营业时间及预约方式，优先采用门店官方信息。`,`门店资料表，附来源链接和核对日期`,`逐家对应输入清单；无法确认的信息明确标注，不凭空补全。`];
 }],
 ['内容运营',pick=>{
   const product=pick(products,3),language=pick(['英文','日文','德文','法文','西班牙文'],4);
   return [`校对${product}商品页的${language}文案`,`对照任务提供的中文原稿检查${product}商品页的${language}译文，重点核对参数、单位、术语和使用说明。`,`修订稿和术语对照表`,`数字、型号与原稿一致；语义无遗漏，术语在全文保持一致。`];
 }],
 ['人力资源',pick=>{
   const role=pick(['前端工程师','数据分析师','产品运营','客户成功经理','测试工程师','内容编辑','UI 设计师','电商运营'],3);
   return [`整理${role}岗位的面试考察要点`,`依据任务提供的${role}职位说明，拆分职责和必备技能，为每项能力编写面试问题及判断依据。`,`岗位能力表和面试问题清单`,`问题覆盖职位说明中的核心职责；必备条件和加分项分开列出。`];
 }],
 ['商务办公',pick=>{
   const meeting=pick(['产品迭代周会','客户需求评审会','项目启动会','上线复盘会','销售周会','设计评审会','供应商沟通会','季度运营复盘会'],3);
   return [`提取${meeting}记录中的负责人和截止时间`,`整理任务提供的${meeting}记录，区分已决定事项与讨论建议，提取行动项、负责人和截止时间。`,`Excel 行动项清单和会议摘要`,`每项行动可追溯到原文；未明确的负责人或时间标记为待确认。`];
 }],
 ['数据处理',pick=>{
   const doc=pick(['供应商报价单','采购订单','物流运单','设备规格说明','产品检测报告','会议报名表','展商资料','课程安排表'],3);
   return [`将${doc} PDF 中的表格整理为 Excel`,`提取任务提供的${doc} PDF 中的表格，保留表头、单位和原文页码，合并跨页表格并标记无法辨认的单元格。`,`Excel 数据表和待确认项清单`,`表格行列与原文对应；数字和单位准确，不以推测内容替代缺失值。`];
 }]
];
const scenarios=new Map();
export function taskScenario(index) {
 let value=scenarios.get(index);
 if(!value) {value=Object.freeze(createTaskScenario(index));scenarios.set(index,value);}
 return value;
}
function createTaskScenario(index) {
 const family=families[hash(index,2)%families.length];
 const pick=(values,salt)=>values[hash(index,salt)%values.length];
 const [title,description,deliverables,acceptanceCriteria]=family[1](pick);
 // Most tasks are small, with a smaller share of higher-value analytical work.
 const tier=hash(index,5)%100;
 const reward=tier<65 ? (100+hash(index,6)%501)/100 : tier<93 ? (500+hash(index,7)%501)/100 : (1000+hash(index,8)%1801)/100;
 return {title,category:family[0],description,cardSummary:title,deliverables,reward,acceptanceCriteria};
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
