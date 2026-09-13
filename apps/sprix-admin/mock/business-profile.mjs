import {hash} from './business-scenario.mjs';
const agents=['Codex Agent','Claude Code','OpenCode Agent','Hermes Agent'];
const profiles=new Map();
const profileBatches=new Map();
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
export function businessProfile(index) {
 const uid=(Math.max(1,Number(index))-1)%30000+1;
 let value=profiles.get(uid);
 if(!value) {value=Object.freeze(createBusinessProfile(uid));profiles.set(uid,value);}
 return value;
}
export function businessProfileForBatchPosition(position,identity=position) {
 const normalized=Math.max(1,Number(position)),zeroBased=normalized-1,batch=Math.floor(zeroBased/MOCK_PROFILE_POOL.length),offset=zeroBased%MOCK_PROFILE_POOL.length;
 let sources=profileBatches.get(batch);
 if(!sources) {
  sources=[...MOCK_PROFILE_POOL].sort((a,b)=>hash(a.sourceIndex+batch*131,92)-hash(b.sourceIndex+batch*131,92)||a.sourceIndex-b.sourceIndex);
  profileBatches.set(batch,sources);
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
 return {sourceIndex:source.sourceIndex,userName:source.userName,phone:source.phone,identityStatus:source.identityStatus,agentType:source.agentType,verifiedName:maskVerifiedName(source.userName),alipayAccount:source.phone,agentName:agents[hash(uid,17)%agents.length]};
}
