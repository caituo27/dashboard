const freezeTemplate=template=>Object.freeze({
  category:'数据标注',sourceType:'Sprix AI平台任务',...template,
  attachments:Object.freeze(template.attachments.map(Object.freeze))
});

const task=(title,description,deliverables,acceptanceCriteria,referenceTotalAmount,referenceReward,referenceSlots,attachments)=>freezeTemplate({
  title,description,deliverables,acceptanceCriteria,referenceTotalAmount,referenceReward,referenceSlots,attachments
});

const aleDeliverables='提交 1 个压缩包，包含 task_card.json、input Pack、rubrics.json 等内容，输出物需严格按照参考规范编写。';
const aleAcceptance='压缩包存在，内容文件可打开且可编辑，目录、文件格式与内容符合参考规范。';
const aleAttachment=Object.freeze([{filename:'ALE任务包标准_参考摘要.md',mimeType:'text/markdown'}]);
const aleTask=(domain,total,reward,slots)=>task(
  `${domain}领域ALE任务包设计`,
  `请参考附件规范，输出一个${domain}领域中符合标准的 ALE 任务包。`,
  aleDeliverables,aleAcceptance,total,reward,slots,aleAttachment
);

const specificTemplates=[
  task('计算机ALE','请参考给定的 ALE 规范文档，输出一个符合文档标准的计算机领域任务包。','提交 1 个压缩包，包含 task_card.json、input Pack、rubrics.json。输出物需严格按照参考规范编写。',aleAcceptance,200000,1000,200,aleAttachment),
  task('CTF题库交付与SOP规范文档','产出一份 CTF 竞赛题库标注规则 SOP，并设计两条原创、多类型、可执行的 CTF 题目 Demo，配套运行环境、在线服务、分段计分机制与参考答案。','提交 1 个压缩包，包含 SOP 说明文档、JSON/YAML 题目 manifest、Rubric 模板、Judge 结构化输出示例及单题验收 Checklist。','交付物完整且格式规范，题目具备独立原创性、可执行环境、可验证证据与自动评分逻辑，并明确阶段门禁及安全隔离约束。',300000,6000,50,[{filename:'CTF-SOP规范_参考摘要.md',mimeType:'text/markdown'},{filename:'CTF题目manifest模板.json',mimeType:'application/json'}]),
  task('漏洞沙箱修复','根据指定 CVE 清单构建漏洞修复沙箱数据集。任务包遵循 Terminal-Bench 规范，包含环境、任务、参考修复及功能与漏洞测试，并提交 NoOp、Oracle 和模型 Trial 的评测记录。','提交 Dockerfile、docker-compose.yaml、task.yaml、solution.sh、run-tests.sh、test_func.py、test_vuln.py 及完整 evaluation-results 目录和质检报告。','使用指定评测 Pipeline 全检；NoOp Reward 为 0、Oracle Reward 为 1；模型 Trial 和得分卡完整，不得泄露答案、绕过测试或破坏正常功能。',600000,1500,400,[{filename:'selected_1000_可交付清单.csv',mimeType:'text/csv'},{filename:'漏洞修复沙箱交付说明.md',mimeType:'text/markdown'}]),
  task('图像推理数据标注与采集','采集并标注以图像结构规律为核心的封闭式视觉推理题，覆盖图形矩阵、空间旋转折叠和数理逻辑等题型。中英文按 6:4 或 4:6 分布，每条数据包含清晰图像、唯一答案与结构化推理字段。','提交 JPG/JPEG/PNG 图片及 JSON 数据。JSON 包含 MD5、image_domain、image_size、QA_diff、question、option、answer 和 COT 等字段。','全检格式和质量；题目来源合规，答案唯一，CoT 推导完整。字段缺失、语言混杂、低质图片或题面泄露答案均不通过。',4000000,8,500000,[{filename:'视觉推理标注字段模板.json',mimeType:'application/json'},{filename:'图像质量检查清单.md',mimeType:'text/markdown'}]),
  task('视觉推理生成器数据','开发一个程序化任务生成器并交付 10k 条样本。每条样本由生成器随机采样题目、精确求解并渲染为视频与图像双模态，覆盖约束谜题、模式归纳、几何作图和动态仿真。','按生成器/任务/实例三级目录交付；实例包含 first_frame.png、ground_truth.mp4、末帧、prompt.txt、image/ 和 metadata.json。','视频与图像为 1024×1024、16fps、10 至 200 帧且可解码；答案唯一可验证，画面清晰，无答案泄露，并可通过 metadata 与随机种子复现。',360000,1200,300,[{filename:'视觉推理生成器目录规范.md',mimeType:'text/markdown'},{filename:'metadata字段模板.json',mimeType:'application/json'}]),
  task('审计领域大模型训练数据集采集与标注','面向审计领域大模型预训练与问答，采集权威图书、期刊及论文集全文，完成数字化提取、OCR、文本清洗和结构化标注，形成可溯源 JSONL 训练数据。','提交主体 JSONL、完整 Meta 字段、原始 PDF 目录、statistics.csv、quality_report.pdf、README.md 和 catalog.csv。','内容与 OCR 准确率均不低于 99%，全局重复率不高于 2%，Meta 完整率 100%；方向、出版物类型、时间和来源分布满足约束，不含涉密、侵权或合成虚假内容。',1500000,2500,420,[{filename:'审计语料Meta字段模板.json',mimeType:'application/json'},{filename:'审计数据质检清单.csv',mimeType:'text/csv'}]),
  task('研究级数学问题阅卷数据标注任务','对七个前沿数学领域的论文证明题模型解答进行质量校验，逐步判断数学有效性、约束满足度和逻辑完整性，定位 Fatal Error 与 Recoverable Error，并撰写英文 Reviewer Comment。','在指定平台提交 Reviewer Comment、First Fatal Error Step、Recoverable Error Steps、Remark 和 Report Error Case 等结构化字段。','按领域与预测结果分组进行三轮抽检；必填字段完整、格式规范、错误定位准确。最终合格率达到约定门槛后验收。',300000,500,600,[{filename:'数学阅卷字段说明.md',mimeType:'text/markdown'},{filename:'数学阅卷标注模板.csv',mimeType:'text/csv'}]),
  task('化学结构式OCR标注与转写任务','对文档图片中的化学结构式进行版面分析与转写，使用化学结构绘制或识别工具将图像准确转写为标准 .mol 代码。','提交 MDL Molfile V2000 格式文本，准确表示原子、化学键、价态、R 基团、自定义标签与重复单元。','检测框包含分子最小区域；.mol 在 Ketcher 中渲染后与原图结构一致，并符合电荷、价态、特殊基团和文件格式规范。',45000,150,300,[{filename:'化学结构式转写规则.md',mimeType:'text/markdown'},{filename:'Molfile_V2000示例.mol',mimeType:'chemical/x-mdl-molfile'}]),
  task('基于CT的肾癌智能检测标注任务','对下腹部 CT 多期相序列中的肾脏、病灶、静脉、动脉、肾盂输尿管等结构进行三维语义分割与属性判断。','在标注系统提交带多期相 3D 分割掩膜及属性标注的结构化数据，确保起止层面完整并符合平台导出格式。','序列完整，器官、病灶和血管轮廓贴合影像边缘，无漏分割或错分割；癌栓、坏死区和解剖变异按规范处理。',200000,200,1000,[{filename:'肾癌CT标注类别说明.md',mimeType:'text/markdown'},{filename:'三维分割质检清单.csv',mimeType:'text/csv'}]),
  task('跨学科 Peer Review 评测数据集标注项目','对英文理工科论文同行评审意见进行人工核查与补全，校验原文引用、作者回应配对、意见分类等维度，检查并补录漏召回的实质性意见。','提交带独立 annotator_id 的完整 HTML 标注结果和数据集，包含已有意见的九维审核、论文级漏召回检查和新增意见明细。','抽检比例不低于 10%，整体合格率达到 95%；未达标须按规则全量整改，最终低于结算门槛则不通过。',525000,1000,525,[{filename:'PeerReview九维标注说明.md',mimeType:'text/markdown'},{filename:'PeerReview标注模板.csv',mimeType:'text/csv'}])
];

const aleTemplates=[
  ['视觉媒体',60000,2000,30],['土木工程',50000,2000,25],['电子工程',70000,2000,35],['生物工程',50000,2000,25],['化学工程',60000,2000,30],
  ['临床医学',70000,2000,35],['材料与计算物理',50000,2000,25],['计算机图形学',60000,2000,30],['天文与空间科学',50000,2000,25],['交通仿真',50000,2000,25],
  ['软件工程',70000,2000,35],['机械工程',70000,2000,35],['物流与工业工程',50000,2000,25],['网络安全与数字取证',50000,2000,25],['物流与工业工程',50000,2000,25],
  ['金融',50000,2000,25],['教育与信息科学',50000,2000,25],['能源',50000,2000,25],['药物计算与分子模拟',50000,2000,25],['量子计算',50000,2000,25]
].map(values=>aleTask(...values));

const exploitTemplate=task('基于 selected_1000.jsonl 清单构建 Terminal-Bench 格式的漏洞利用沙箱（Exploit docker）数据集','根据指定 CVE 清单构建标准化漏洞利用沙箱数据。任务包包含 Harbor 配置、Agent 任务说明、漏洞环境、公开评测入口和私有验证脚本，并通过 Harbor、OpenHands 与模型评测 Pipeline 完成因果差分验证。','提交 Terminal-Bench 公开任务包与私有 verify 文件、完整 evaluation-results 目录及数据质检报告。','Harbor 配置与环境可启动；私有利用在修复前成功、修复后失效；instruction.md 无泄密；模型 Trial 无 ERROR，目录结构规范且非重复拷贝。',600000,1500,400,[{filename:'selected_1000_可交付清单.csv',mimeType:'text/csv'},{filename:'Exploit沙箱交付规范.md',mimeType:'text/markdown'}]);

export const DATA_ANNOTATION_TASK_TEMPLATES=Object.freeze([...specificTemplates,...aleTemplates,exploitTemplate]);

const tier=value=>value<0.34?0:value<0.67?1:2;
const referenceRanks=new Map(DATA_ANNOTATION_TASK_TEMPLATES
  .map((template,index)=>({index,score:Math.log1p(template.referenceReward)*0.7+Math.log1p(template.referenceSlots)*0.3}))
  .sort((a,b)=>a.score-b.score)
  .map((item,rank)=>[item.index,tier(rank/(DATA_ANNOTATION_TASK_TEMPLATES.length-1))]));

function targetTier(reward,totalSlots){
  const rewardScore=reward<80?0:reward<500?1:2;
  const slotScore=totalSlots<4?0:totalSlots<20?1:2;
  return Math.round(rewardScore*0.7+slotScore*0.3);
}

export function dataAnnotationTaskTemplate(index,reward=0,totalSlots=1){
  if(index>=1&&index<=DATA_ANNOTATION_TASK_TEMPLATES.length)return DATA_ANNOTATION_TASK_TEMPLATES[index-1];
  const candidates=DATA_ANNOTATION_TASK_TEMPLATES.map((template,templateIndex)=>({template,templateIndex})).filter(({templateIndex})=>referenceRanks.get(templateIndex)===targetTier(reward,totalSlots));
  return candidates[Math.abs((index*17+totalSlots*7+Math.round(reward*100)))%candidates.length].template;
}

export function dataAnnotationTaskContent(index,reward=0,totalSlots=1){
  const template=dataAnnotationTaskTemplate(index,reward,totalSlots);
  const cycle=Math.floor(Math.max(0,index-1)/DATA_ANNOTATION_TASK_TEMPLATES.length)+1;
  const templateIndex=DATA_ANNOTATION_TASK_TEMPLATES.indexOf(template),duplicateOrdinal=DATA_ANNOTATION_TASK_TEMPLATES.slice(0,templateIndex+1).filter(item=>item.title===template.title).length;
  const title=cycle>1?`${template.title}·批次 ${String(index).padStart(6,'0')}`:duplicateOrdinal>1?`${template.title}·参考批次 ${String(duplicateOrdinal).padStart(2,'0')}`:template.title;
  return Object.freeze({
    title,category:'数据标注',recommendedTaskType:'数据标注',sourceType:'Sprix AI平台任务',cardSummary:title,
    description:template.description,deliverables:template.deliverables,acceptanceCriteria:template.acceptanceCriteria,
    attachmentNames:Object.freeze(template.attachments.map(item=>item.filename)),
    submissionRows:Object.freeze([
      Object.freeze(['任务说明',template.description]),
      Object.freeze(['交付范围',template.deliverables]),
      Object.freeze(['验收依据',template.acceptanceCriteria])
    ])
  });
}
