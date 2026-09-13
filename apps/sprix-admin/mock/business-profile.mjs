import {hash} from './business-scenario.mjs';
import {anonymizedUserName,virtualPhoneForIdentity} from '../shared/user-identity.mjs';
const agents=['Codex Agent','Claude Code','OpenCode Agent','Hermes Agent'];
const profiles=new Map();
const profileBatches=new Map();
const taskCapabilityKeywords=Object.freeze({
 '网站开发':['开发','计算机','算法','python','自动化编程','网页','代码'],
 '营销':['新媒体','电商','品牌','运营','销售','营销','小红书','校园大使','活动策划','跨境'],
 '设计':['设计','3d','建模','动画','视频','短剧','剪辑','cad','autocad','revit','ui/ux'],
 '数据标注':['数据','算法','检索','标注','材料','法律','ct','计算机','paper'],
 '知识问答':['经济','知识产权','教育','法律','医学','ct','材料','新闻','主持','职业规划'],
 '其他':['零售','团队管理'],
});
const taskSpecificCapabilityRules=Object.freeze([
 {weight:300,taskKeywords:['ct','医学','医疗','肾癌','胃部'],agentKeywords:['ct','医学']},
 {weight:300,taskKeywords:['金融','经济','投研'],agentKeywords:['经济']},
 {weight:300,taskKeywords:['法律','法务','知识产权','专利'],agentKeywords:['法律','知识产权']},
 {weight:300,taskKeywords:['教育','课程','教学'],agentKeywords:['教育']},
 {weight:300,taskKeywords:['化学','材料'],agentKeywords:['材料','paper']},
 {weight:300,taskKeywords:['药物计算','分子模拟'],agentKeywords:['材料','paper','算法']},
 {weight:300,taskKeywords:['计算机','电子工程','信息科学','量子计算','代码'],agentKeywords:['计算机','算法','python','开发','自动化编程','代码']},
 {weight:300,taskKeywords:['图像推理','计算机视觉'],agentKeywords:['计算机','算法']},
 {weight:300,taskKeywords:['网络安全','数字取证','信息安全'],agentKeywords:['计算机','算法']},
 {weight:300,taskKeywords:['视觉媒体','图片生成','视觉素材'],agentKeywords:['ui/ux','平面设计','视频','3d','建模','动画','传媒']},
 {weight:300,taskKeywords:['天文','空间科学','数学','阅卷','交通仿真'],agentKeywords:['计算机','算法','paper']},
 {weight:300,taskKeywords:['生物工程','生物医学','生命科学'],agentKeywords:['ct','医学','paper']},
 {weight:300,taskKeywords:['土木','建筑工程'],agentKeywords:['cad','autocad','revit','画图']},
 {weight:150,taskKeywords:['物流','工业工程','能源','工程领域'],agentKeywords:['计算机','算法','自动化编程','cad','autocad','revit']},
 {weight:250,taskKeywords:['html','svg','网页','网站','官网','首页','详情页','落地页','卡片','组件规范','模块'],agentKeywords:['网页设计','ui/ux','平面设计','开发','代码']},
 {weight:200,taskKeywords:['bp','产品架构','商业模式','市场机会','方案'],agentKeywords:['设计','ui/ux','平面设计','品牌','策划','团队管理']},
 {weight:250,taskKeywords:['ppt','演示文稿','汇报文件','复盘文件'],agentKeywords:['ui/ux','平面设计','品牌','策划','团队管理','会展','传媒']},
 {weight:250,taskKeywords:['渠道清单','渠道调研','渠道整理'],agentKeywords:['用户运营','销售','品牌','策划']},
 {weight:250,taskKeywords:['ocr','检索','资料标注','语料标注','数据清洗','转写'],agentKeywords:['数据清洗','paper标注','检索','算法','计算机']},
 {weight:250,taskKeywords:['edm','邮件','投放文案','营销文案','推广文案','召回','促活'],agentKeywords:['品牌','策划','新媒体','营销','运营','销售','电商']},
 {weight:250,taskKeywords:['seo','词表','关键词'],agentKeywords:['品牌','策划','新媒体','营销','运营','电商']},
 {weight:250,taskKeywords:['社媒素材','社交媒体素材','社媒内容'],agentKeywords:['品牌','新媒体','视频','图片生成','电商编导']},
 {weight:250,taskKeywords:['短视频','视频制作','视频剪辑','动画制作','短剧','分镜'],agentKeywords:['视频','动画','3d','短剧']},
]);
const sourceProfiles=[
 ['南楠','在校学生','17688970313','经济学'],
 ['周瑞','自由职业者','13632673417','知识产权'],
 ['张宗仁','在职','18720968417','房地产、销售'],
 ['林乐','在职','13414611511','新媒体运营'],
 ['钟鸣怡','在职','13267016420','电商编导'],
 ['张意红','在职','17876924893','教育'],
 ['王瑞龙','在职','18793181208','零售'],
 ['张琳','在职','17520464971','运营、职业规划'],
 ['焦子桉','在职','18671604269','品牌、策划'],
 ['杨广','创业者','18927441763','设计、会展、传媒'],
 ['张志峰','在职','13712143595','3D设计、建模、动画设计师'],
 ['冯凯盈','自由职业者','18825404615','新媒体、小红书'],
 ['朱知理','自由职业者','13242002673','教育、校园营销'],
 ['李建强','在职','18838981831','跨境营销'],
 ['唐林','自由职业者','17674513551','新闻、主持'],
 ['蔡文彬','自由职业者','18802565263','计算机、算法'],
 ['檀焜','在职','15956951255','用户运营、增长'],
 ['吕仲凯','在校学生','18475782916','用户运营、销售'],
 ['黎彩荧','在职','18944733106','校园营销'],
 ['连博','创业者','19279310887','开发'],
 ['廖嘉怡','在校学生','18200798016','新媒体'],
 ['李凤娇','自由职业者','18238181170','小红书运营'],
 ['钟伟鹏','在职','13058373555','计算机领域'],
 ['乔静静','在校学生','18363336180','AI短剧制作/短视频制作/新媒体账号运营/流量运营'],
 ['何智杰','在校学生','17665491851','3d建模、动画设计师'],
 ['郭红旗','在职','17397234570','团队管理'],
 ['黄嘉基','在校学生','19876296243','校园大使运营'],
 ['苏龙飞','在职','19310118745','用户运营'],
 ['胡明旭','在校学生','18066108745','数据清洗'],
 ['李金宝','在职','19842420809','CAD自动化编程'],
 ['西尔扎提 阿卜杜拉','在校学生','13319878675','法律、材料学'],
 ['卢森涛','在校学生','15875591020','平面设计、网页设计'],
 ['唐子旭','在校学生','18681068754','活动策划'],
 ['骆咏诗','在职','15918837265','ct下的胃部观察'],
 ['唐伯俊','在校学生','13825486891','CAD画图、代码开发'],
 ['吴彦其','在校学生','18759355600','python、autocad、revit'],
 ['杨宏伟','在校学生','18034823585','Ui/Ux design、3d world model、Algorithm expert、Cutting-edge research、Quant Algorithm'],
 ['叶㻸杰','在职','13534320277','paper标注及检索'],
 ['李柯','创业者','15101820073','视频剪辑，视频图片生成'],
 ['李奥霜','创业者','19132968352','视频剪辑，视频图片生成'],
];

const maskVerifiedName=name=>name.length<=2?`${name[0]}*`:`${name[0]}${'*'.repeat(Math.min(2,name.length-1))}`;
export const MOCK_PROFILE_POOL=Object.freeze(sourceProfiles
 .map(([userName,identityStatus,phone,agentType],index)=>Object.freeze({sourceIndex:index+1,userName,identityStatus,phone,agentType}))
 .sort((a,b)=>hash(a.sourceIndex,91)-hash(b.sourceIndex,91)));
export const MOCK_PHONE_POOL=Object.freeze(MOCK_PROFILE_POOL.map(profile=>profile.phone));
const normalizedCapability=value=>String(value??'').toLowerCase().replace(/\s+/g,'');
function normalizeTaskContext(taskContext){
 if(typeof taskContext==='string')return {category:taskContext,text:'',key:taskContext};
 const category=String(taskContext?.category??taskContext?.taskCategory??taskContext?.type??'');
 const text=normalizedCapability([
  taskContext?.title,
  taskContext?.taskTitle,
 ].filter(Boolean).join(' '));
 return {category,text,key:`${category}:${text}`};
}
export function agentTypeMatchesTaskCategory(agentType,taskCategory) {
 const capability=normalizedCapability(agentType),keywords=taskCapabilityKeywords[taskCategory];
 if(!keywords)return true;
 if(taskCategory==='其他') {
  const primaryKeywords=Object.entries(taskCapabilityKeywords).filter(([category])=>category!=='其他').flatMap(([,values])=>values);
  return keywords.some(keyword=>capability.includes(normalizedCapability(keyword)))||!primaryKeywords.some(keyword=>capability.includes(normalizedCapability(keyword)));
 }
 return keywords.some(keyword=>capability.includes(normalizedCapability(keyword)));
}
function taskSpecificMatchScore(agentType,taskText){
 const capability=normalizedCapability(agentType);
 return taskSpecificCapabilityRules.reduce((score,rule)=>{
  const taskMatches=rule.taskKeywords.some(keyword=>taskText.includes(normalizedCapability(keyword)));
  const agentMatches=rule.agentKeywords.some(keyword=>capability.includes(normalizedCapability(keyword)));
  return score+(taskMatches&&agentMatches?rule.weight:0);
 },0);
}
export function agentTypeMatchScore(agentType,taskContext){
 const task=normalizeTaskContext(taskContext);
 return taskSpecificMatchScore(agentType,task.text)+(agentTypeMatchesTaskCategory(agentType,task.category)?10:0);
}
export function businessProfile(index) {
 const uid=(Math.max(1,Number(index))-1)%30000+1;
 let value=profiles.get(uid);
 if(!value) {value=Object.freeze(createBusinessProfile(uid));profiles.set(uid,value);}
 return value;
}
export function businessProfileForBatchPosition(position,identity=position,taskContext) {
 const normalized=Math.max(1,Number(position)),zeroBased=normalized-1,batch=Math.floor(zeroBased/MOCK_PROFILE_POOL.length),offset=zeroBased%MOCK_PROFILE_POOL.length,cacheKey=`identity:${batch}`;
 let sources=profileBatches.get(cacheKey);
 if(!sources) {
  sources=[...MOCK_PROFILE_POOL].sort((a,b)=>hash(a.sourceIndex+batch*131,92)-hash(b.sourceIndex+batch*131,92)||a.sourceIndex-b.sourceIndex);
  profileBatches.set(cacheKey,sources);
 }
 return createBusinessProfileFromSource(sources[offset],identity);
}
export function businessProfileForIdentity(identity){
 let value=2166136261;
 for(const character of String(identity??'')){value^=character.codePointAt(0);value=Math.imul(value,16777619)>>>0;}
 return businessProfile(value%30000+1);
}
function createBusinessProfile(index) {
 const uid=(Math.max(1,Number(index))-1)%30000+1;
 const source=MOCK_PROFILE_POOL[hash(uid,15)%MOCK_PROFILE_POOL.length];
 return createBusinessProfileFromSource(source,uid);
}
function createBusinessProfileFromSource(source,identity) {
 const uid=(Math.max(1,Number(identity))-1)%30000+1;
 const userName=anonymizedUserName(source.sourceIndex),phone=source.phone;
 return {identityIndex:source.sourceIndex,sourceIndex:source.sourceIndex,userName,phone,virtualPhone:virtualPhoneForIdentity(source.sourceIndex),identityStatus:source.identityStatus,agentType:source.agentType,verifiedName:maskVerifiedName(userName),alipayAccount:phone,agentName:agents[hash(uid,17)%agents.length]};
}
