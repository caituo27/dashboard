export const DAY = 86400000;
export const START = Date.parse('2026-07-29T04:00:00Z');
// Fixed across deployments and process restarts: no automatic publication after this point.
export const TASK_PUBLICATION_STOP_AT = Date.parse('2026-09-12T10:44:05Z');
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
function uncappedIndexAt(at) {return Math.floor(1700000*(operatingAge((at-START)/DAY)/45)**1.12);}
let finalOrderCapacity;
export function indexAt(at) {
 finalOrderCapacity ??= orderRange(publishedTaskCount(TASK_PUBLICATION_STOP_AT))[1];
 return Math.min(uncappedIndexAt(at),finalOrderCapacity);
}
export function agentsAt(at) {
 const d=Math.max(0,(at-START)/DAY), tau=2*Math.PI;
 const age=d+.45*Math.sin(d*tau/3)/(tau/3)+.25*Math.sin(d*tau*24)/(tau*24);
 return Math.floor(30000*(age/45)**.9);
}
export function publicationTime(task) {
 return Math.max(START,clock(orderRange(task)[0])-(120+20*Math.sin(task/250))*60000);
}
export function publishedTaskCount(at) {
 at=Math.min(at,TASK_PUBLICATION_STOP_AT);
 if(at<START) return 0;
 let low=0,high=Math.max(1,taskForOrder(Math.max(1,uncappedIndexAt(at+3*3600000))));
 while(low<high) {const mid=Math.ceil((low+high)/2);if(publicationTime(mid)<=at)low=mid;else high=mid-1;}
 return low;
}
// Simulation assumptions, not measurements of real Agent throughput.
export const MAX_LIFECYCLE_MS = 8 * 3600000;
export function executionDuration(index, category) {
  category = ({'数据标注':'数据处理','AI 内容创作':'内容运营','翻译 / 本地化':'内容运营','办公文档':'商务办公','市场调研':'市场研究','企业经营 / 投融资咨询':'金融资讯','工具类':'软件开发','Agent 自动化 / Python 开发':'软件开发','UI 设计':'设计创意'})[category] ?? category;
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
    const submitted=accepted+executionDuration(index,taskScenario(taskForOrder(index)).durationCategory);
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
// Reference-inspired briefs: original subjects, embedded inputs, and checkable outputs.
// Family positions and categories stay fixed to preserve reward and timeline rules.
const products=['折叠阅读灯','桌面理线架','磁吸便签板','通勤午餐袋','可调节书立','便携餐具盒','旅行分装瓶','挂耳收纳袋','防水地图袋','双层笔袋','随身药品盒','移动显示器支架','折叠文件夹','桌边挂钩','便携杯套','键盘防尘罩','证件收纳册','阅读书签尺','相机内胆包','数据线收纳卷','骑行工具袋','旅行洗漱包','绘图笔收纳筒','行李标签套'];
const businesses=['乐器租用','社区洗护','攀岩体验','会议室预订','行李寄存','旧物寄售','植物养护','手作课程','鞋履修护','球场预约','档案整理','展位预订','共享画室','器材托管','图书寄售','场地保洁','展品运输','设备巡检','展馆导览','排练室预订','露台绿化','社区代收','窗帘清洗','工位租赁','临时仓储','打印装订','展台搭建','自行车保养','灯光器材租赁','会议速记','录音棚预约','照片修复'];
const families=[
 ['市场研究',pick=>{
   const business=pick(businesses,3),audience=pick(['首次使用的个人用户','门店运营人员','企业行政采购人员','小型团队负责人'],4);
   const rows=[['目标用户',audience],['需求识别',`记录用户为什么需要${business}，区分临时需求与固定周期需求。`],['方案比较','按计费单位、服务范围、取消条件逐项对照，不把未披露价格记为免费。'],['转化步骤','了解服务 → 确认适用条件 → 提交咨询 → 确认订单；分别记录流失原因。'],['访谈问题','上次选择服务时比较了哪些条件？在哪一步放弃？什么信息会帮助你作决定？']];
   return [`${business}服务的${audience}调研提纲`,`业务准备开展${business}需求访谈，访谈对象为${audience}。目前只有业务方向，没有访谈记录或公开竞品数据。请输出用户分层、比较维度、转化路径和访谈问题，供下一轮调研使用。`,`Markdown 调研提纲和 CSV 维度表，覆盖 5 个部分。`,`5 个部分齐全；问题围绕${business}与${audience}；不能将研究假设写成已经发生的访谈结论。`,rows];
 }],
 ['数据处理',pick=>{
   const product=pick(products,3),prefix=pick(['RD','LM','TX','GP'],4);
   const input=[`${prefix.toLowerCase()} 101`,`${prefix}_102`,`${prefix}-101`,'未知',` ${prefix}-103 `];
   const rows=input.map((raw,i)=>[raw,i===3?'无效：缺少可识别编号':i===2?`${prefix}-101；重复，第 1 行已保留`:`${prefix}-${i===0?'101':i===1?'102':'103'}；保留`]);
   return [`清理${product}资料中的编号与重复项`,`入库前需核对${product}资料。输入编号依次为：${input.map(x=>`「${x}」`).join('、')}。标准格式为 ${prefix}-三位数字；忽略大小写和首尾空格，将空格、下划线统一为短横线。相同标准编号只保留首次出现的记录，无效输入单列。`,`CSV 原始值与处理结果表，以及 Markdown 清洗说明。`,`5 条输入均可追溯；有效去重后为 3 个编号；重复 1 条、无效 1 条，不删除异常记录的处理依据。`,rows];
 }],
 ['内容运营',pick=>{
   const product=pick(products,3),channel=pick(['商品详情首屏','店铺上新公告','社群产品介绍','订阅邮件'],4);
   const rows=[['标题一',`${product}，让日常收纳更有条理`],['标题二',`给${product}留一个顺手的位置`],['标题三',`从整理好${product}开始轻装出行`],['介绍正文',`这款${product}面向日常通勤与居家整理场景。下单前请核对尺寸、材质和适配条件，选择符合实际使用需求的款式。`],['行动入口','查看规格与使用说明'],['待确认字段','尺寸、材质、价格、库存和发货时间均未提供，发布前需补齐。']];
   return [`${product}上新的${channel}文案`,`店铺准备在${channel}介绍${product}，受众为通勤及居家整理用户。已知信息只有品类和使用场景，尺寸、材质、价格与活动规则均未提供。请写 3 个标题、1 段介绍、1 个行动入口，并列出发布前待确认字段。`,`Markdown 文案稿和 CSV 文案条目表，共 6 项。`,`3 个标题有差异；正文和入口围绕${product}；不声称未知性能、折扣或销售成绩，待确认字段单列。`,rows];
 }],
 ['金融资讯',pick=>{
   const business=pick(businesses,3),focus=pick(['首次付费转化','服务履约效率','客户复购','渠道获客成本'],4);
   const rows=[
     ['有效线索',`${business}咨询按客户标识去重，剔除测试、垃圾及无法联系的记录；同一客户重复咨询计 1 条。保留首次咨询时间和来源渠道，跨渠道归属规则由运营确认。`],
     ['首次付费转化率','统计期内首次进入的有效线索中，在约定转化窗口内首次付费的客户数 / 该批有效线索数 × 100%。分子必须来自同一批分母客户；窗口尚未结束的批次单列。分母为零记 N/A，不记 0%。退款订单是否剔除需统一。'],
     ['履约完成率',`应在统计期完成的${business}订单中，实际完成的订单数 / 应在统计期完成的订单数 × 100%。分母按约定完成时间选取，不能混入其他周期订单；取消及改期订单单列，剔除规则待确认。分母为零记 N/A。另列按时完成数与逾期完成数，避免完成率掩盖延误。`],
     ['复购率','同一首购批次中，在首购后 30 天内再次付费的客户数 / 已满 30 天观察期的该批首购客户数 × 100%。30 天为本方案建议窗口，需业务确认；未满观察期客户单列，不提前判为未复购。分母为零记 N/A。'],
     ['获客成本','按统一渠道归属规则汇总的获客支出 / 对应获客批次的新增付费客户数，单位为元/人。费用期间与转化窗口需对齐，不混入履约成本；新增付费客户为零时记 N/A，并保留支出金额，不能写成零成本。'],
     ['讨论重点',`本次围绕${focus}统一口径，未计算实际指标值。上线统计前需确认客户去重键、转化窗口、退款处理、取消改期规则和渠道归属。需补充咨询、支付、约定履约、实际完成及渠道费用明细；当前没有经营报表，不能判断${business}盈利、增长或投资价值。`]
   ];
   return [`${business}业务的${focus}指标口径`,`经营团队准备讨论${business}的${focus}，需要先统一统计定义。已知流程为咨询、首次付费、服务完成、再次购买，尚无真实经营报表。请整理指标名称、计算口径、分母为零的处理方式和讨论边界。`,`Markdown 口径说明及 CSV 指标表，至少包含 5 个指标和讨论重点。`,`定义能对应咨询到复购流程；转换率分子分母一致；不填造收入、成本、客户数或投资判断。`,rows];
 }],
 ['软件开发',pick=>{
   const business=pick(businesses,3),limit=pick([10,20,50,100],4);
   const rows=[['默认请求','输入 {}；预期 page=1，pageSize=20。'],['页码下限','输入 {"page":0}；预期参数校验失败。'],['类型错误','输入 {"page":"abc"}；预期拒绝非整数页码。'],['分页上限',`输入 {"pageSize":${limit+1}}；预期参数校验失败。`],['有效边界',`输入 {"page":1,"pageSize":${limit}}；预期参数校验通过。`],['未登录','缺少访问凭证；预期拒绝访问，不返回列表数据。']];
   return [`${business}订单列表的分页与权限用例`,`为${business}订单列表补充测试设计。约定 page 为大于等于 1 的整数，默认 1；pageSize 默认 20，允许 1 至 ${limit}，若默认值超出上限则按上限处理；未登录不能访问。这里只编写用例，不调用线上接口。`,`Markdown 用例说明和 CSV 请求与预期表，共 6 条。`,`覆盖默认、下限、类型、上限、有效边界和未登录；请求与预期对应约定；不得将未执行的测试写成已通过。`,rows.map(([a,b])=>[a,a==='默认请求'?`输入 {}；预期 page=1，pageSize=${Math.min(20,limit)}。`:b])];
 }],
 ['设计创意',pick=>{
   const business=pick(businesses,3),entry=pick(['预约确认页','服务选择页','进度查询页','个人订单页'],4);
   const rows=[['页面目标',`让用户在${business}${entry}找到当前状态与下一步操作。`],['信息顺序','先显示服务名称与状态，再显示所选服务、规则说明和操作入口。'],['主要入口',({'进度查询页':'主操作“查看处理进度”，次操作“联系服务人员”。','预约确认页':'主操作“确认预约”，提交后显示预约结果；次操作“返回修改”。','服务选择页':'主操作“选择服务”，完成后进入预约确认；次操作“查看服务说明”。','个人订单页':'主操作“查看订单详情”，次操作“联系服务人员”。'})[entry]],['状态规则','加载时显示进度提示；无订单时显示服务入口；失败时保留输入并提供重试。'],['素材要求','服务示意图使用可替换资源；没有门店、价格和服务时间时不添加虚构信息。']];
   return [`${business}${entry}的信息层级与状态说明`,`我们正在完善${business}的线上服务流程，需要设计${entry}供前端开发使用。面向已进入服务流程的用户，页面应展示服务名称、当前状态、规则说明及下一步入口。请提交桌面端信息层级方案，并说明手机端的排列顺序；补齐加载、无记录和请求失败时的提示及操作。此次只做页面结构设计，不制作品牌视觉或接入实际订单，价格和门店资料由业务配置提供。`,`Markdown 页面方案、CSV 区块说明和 SVG 结构草图，覆盖 5 个部分。`,`页面目标与${entry}一致；至少说明加载、空数据、失败 3 种状态；每个入口有用途，草图能对照区块说明。`,rows];
 }],
 ['数据处理',pick=>{
   const business=pick(businesses,3),channel=pick(['在线客服','服务评价','咨询留言','订单回访'],4);
   const rows=[['找不到取消预约的位置','使用问题：入口可发现性不足'],['希望能提前一天提醒我','功能建议：新增提醒能力'],['套餐费用没有写清包含几次','价格反馈：计费范围不明确'],['服务人员解释得很清楚','正向评价：认可沟通体验'],['点提交后一直转圈','使用问题：提交状态异常'],['支持按服务地点筛选就更方便了','功能建议：增加地点筛选']];
   return [`标注${business}${channel}的 6 条反馈`,`以下为${business}${channel}的待标注文本：${rows.map(([text],i)=>`${i+1}. ${text}`).join('；')}。仅允许使用“使用问题、功能建议、价格反馈、正向评价”四种标签，每条选一个主要标签并说明依据。`,`CSV 原文与标签依据表，以及 Markdown 分类数量摘要。`,`完整标注 6 条；使用问题 2 条、功能建议 2 条、价格反馈和正向评价各 1 条；依据能对应原文，不新增标签。`,rows];
 }],
 ['市场研究',pick=>{
   const business=pick(businesses,3),city=pick(['合肥','泉州','佛山','昆明','济南','南昌','温州','珠海'],4);
   const rows=[['服务范围',`确认${city}${business}是否覆盖目标区域，记录区域限制。`],['计费方式','核对按次、按时或套餐计费，以及超时费用和押金是否另计。'],['取消规则','分别记录取消截止条件、退费规则和改期限制。'],['营业与预约','核对营业时段、预约提前量及名额是否需要二次确认。'],['证据记录','每项记录来源地址、查询日期和原文摘录；未披露字段注明未披露。']];
   return [`${city}${business}门店调研的字段与核验清单`,`准备调研${city}的${business}服务，需要先制定统一采集表。当前没有门店名单，不要求提供店名或声称已完成走访。请围绕服务范围、计费、取消规则、预约要求和证据记录给出字段说明。`,`Markdown 调研说明和 CSV 核验清单，包含 5 个维度。`,`每个维度说明核对内容；必须保留来源与查询日期要求；不编造门店、地址、价格或走访结果。`,rows];
 }],
 ['内容运营',pick=>{
   const business=pick(businesses,3),channel=pick(['帮助中心','预约邮件','订单通知','客服快捷回复'],4);
   const rows=[['中文原文',`您的${business}申请已收到，请在订单页面查看进度。确认前无需重复提交。`],['英文版本',`We have received your request. Check your order page for updates. There is no need to submit another request while you wait for confirmation.`],['精简版本','Request received. Visit your order page for updates. Please avoid duplicate submissions.'],['术语说明','申请使用 request；收到不等于确认，因此不使用 confirmed。'],['语气说明','使用中性提示，不增加确认时限、退款承诺或其他未提供条件。']];
   return [`${business}${channel}的英文状态提示`,`请将用于${business}${channel}的中文提示本地化为英文。原文：“您的${business}申请已收到，请在订单页面查看进度。确认前无需重复提交。”输出完整版本、精简版本和术语解释。`,`Markdown 双语稿和 CSV 对照表，共 5 项。`,`保留收到申请、订单页查询、避免重复提交三层含义；不得把收到申请改为确认成功；不得补写处理时限。`,rows];
 }],
 ['人力资源',pick=>{
   const role=pick(['实施顾问','技术支持专员','用户研究助理','项目协调员','知识库编辑','数据质检员','渠道运营专员','售后培训专员'],3),team=pick(['交付团队','客户服务团队','运营团队','产品支持团队'],4);
   const rows=[['需求理解','请举例说明如何将模糊需求拆成可确认的问题；观察是否复述目标并确认限制。'],['信息记录','请描述如何记录来源、版本与待确认事项；观察交接是否可追溯。'],['异常处理','遇到输入不完整时如何推进；观察是否区分已知事实和假设。'],['协作沟通','不同同事对优先级有分歧时如何确认；观察是否说明影响与决策人。'],['交付检查','提交前如何自查；观察是否有可执行的核对步骤。']];
   return [`${team}${role}的面试问题与观察要点`,`为${team}招聘${role}编写面试提纲。职责限定为需求确认、资料记录、异常跟进和交付检查，不预设学历、薪资或年限门槛。需要 5 个行为问题，每个问题配观察依据。`,`Markdown 面试提纲和 CSV 问题与观察点表。`,`5 个问题覆盖指定职责；评价依据可观察；不编造公司待遇或将个人特征作为评分依据。`,rows];
 }],
 ['商务办公',pick=>{
   const business=pick(businesses,3),meeting=pick(['需求对齐会','试运营复盘会','服务流程评审会','客服问题周会'],4);
   const rows=[['核对服务清单','产品组负责；下次例会前完成；已确认行动。'],['补充常见问题','客服组负责；截止时间未明确，待确认；已确认行动。'],['调整首页入口','设计组先评估；是否实施待下次讨论，不作为已批准改动。'],['同步未决事项','项目协调人汇总上述截止时间与决策项，在下次例会确认。']];
   return [`整理${business}${meeting}的行动项`,`会议摘录：“产品组在下次例会前核对服务清单；客服组补充常见问题，暂未确定时间；有人建议调整首页入口，由设计组评估后再讨论。”请提取负责人、时间和决策状态，区分已确认工作与建议。`,`Markdown 会议摘要和 CSV 行动项表，包含 3 条原文事项及 1 条后续确认事项。`,`行动项可追溯到摘录；未明确时间写待确认；首页调整必须保留待评估状态，不捏造会议日期或批准结论。`,rows];
 }],
 ['数据处理',pick=>{
   const business=pick(businesses,3),unit=pick(['次','小时','天','场'],4),price=pick([12,18,24,36],5);
   const rows=[['A 项',`单价 ${price} 元/${unit}；数量 2；小计 ${price*2} 元`],['B 项',`单价 ${price+6} 元/${unit}；数量 3；小计 ${(price+6)*3} 元`],['C 项',`单价未提供；数量 1；小计不可计算`],['可核对小计',`${price*2+(price+6)*3} 元，仅包含 A、B 项，不能当作完整订单总额。`]];
   return [`校核${business}报价摘录的单位和小计`,`${business}报价资料摘录：A 项单价 ${price} 元/${unit}，数量 2；B 项单价 ${price+6} 元/${unit}，数量 3；C 项数量 1，单价缺失。请整理各项单价、数量和小计，说明哪些金额可以汇总、哪些需补充。`,`CSV 核对结果表和 Markdown 异常说明，共 4 项。`,`A、B 小计按单价乘数量计算；C 项不得以零代替缺失价格；可计算小计明确排除 C 项。`,rows];
 }]
];
const scenarios=new Map();
export function taskScenario(index) {
 let value=scenarios.get(index);
 if(!value) {value=Object.freeze(createTaskScenario(index));scenarios.set(index,value);}
 return value;
}
function createTaskScenario(index) {
 const familyIndex=hash(index,2)%families.length;
 const family=families[familyIndex];
 const pick=(values,salt)=>values[hash(index,salt)%values.length];
 const [title,description,deliverables,acceptanceCriteria,submissionRows]=family[1](pick);
 // Most tasks are small, with a smaller share of higher-value analytical work.
 const tier=hash(index,5)%100;
 const reward=tier<65 ? (100+hash(index,6)%501)/100 : tier<93 ? (500+hash(index,7)%501)/100 : (1000+hash(index,8)%1801)/100;
 const categories=['市场调研','数据标注','AI 内容创作','企业经营 / 投融资咨询','工具类','UI 设计','数据标注','市场调研','翻译 / 本地化','办公文档','工具类','数据标注'];
 const tokenRanges=[[9000,18000],[2500,6500],[5000,10000],[11000,21000],[10000,22000],[9000,18000],[2500,6000],[8000,15000],[3000,7000],[7000,13000],[3500,8000],[2500,6500]];
 const [minTokens,maxTokens]=tokenRanges[familyIndex];
 const estimatedTokens=Math.round((minTokens+hash(index,74)%(maxTokens-minTokens+1))/100)*100;
 const attachmentNames=[['调研提纲.md','调研维度.csv'],['清洗说明.md','编号清洗结果.csv'],['上新文案.md','文案条目.csv'],['指标口径.md','经营指标.csv'],['测试用例说明.md','分页权限用例.csv'],['页面方案.md','页面区块说明.csv'],['标注说明.md','反馈标注.csv'],['调研准备.md','门店核验清单.csv'],['双语提示.md','翻译对照.csv'],['面试提纲.md','面试观察点.csv'],['会议摘要.md','行动项.csv'],['报价核对说明.md','报价明细.csv']][familyIndex];
 return {title,category:categories[familyIndex],durationCategory:family[0],estimatedTokens,attachmentNames,description,cardSummary:title,deliverables,reward,acceptanceCriteria,submissionRows:Object.freeze(submissionRows.map(row=>Object.freeze(row)))};
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
