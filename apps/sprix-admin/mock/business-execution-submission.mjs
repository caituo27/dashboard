import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {hash} from './business-scenario.mjs';

const categoryProfiles=Object.freeze({
  数据标注:Object.freeze({
    filenames:['任务交付说明.md','交付文件清单.csv'],
    sections:[['任务包结构','已按任务要求整理目录、输入材料、交付结果和验收说明。'],['数据与字段','已核对必填字段、文件格式、命名规则和来源标识。'],['质量检查','已执行完整性、可打开性和抽样一致性检查，并保留检查结果。']],
    issue:'质检报告中的抽检样本索引可以进一步细化，当前不影响任务包复核。',
    improvement:'在交付清单中补充抽检样本与原始材料的对应位置，便于平台快速复核。'
  }),
  网站开发:Object.freeze({
    filenames:['网站交付说明.md','功能验收清单.csv'],
    sections:[['页面与功能','已完成核心页面、主要交互和响应式布局说明。'],['接口与状态','已整理接口调用、加载、空数据、失败和重试状态。'],['交付检查','已核对启动方式、关键路径和浏览器兼容注意事项。']],
    issue:'异常状态的截图证据可以进一步补充，当前功能说明和复核路径完整。',
    improvement:'补充一组请求失败与恢复后的对照截图，方便平台确认异常处理。'
  }),
  营销:Object.freeze({
    filenames:['营销内容方案.md','投放文案清单.csv'],
    sections:[['目标人群','已按任务描述明确核心用户、使用场景和转化目标。'],['内容方案','已输出主标题、正文、行动引导和渠道适配版本。'],['合规检查','已移除绝对化承诺，并统一产品名称、数字和行动入口。']],
    issue:'部分渠道版本的字数限制说明可以更具体，当前文案可直接进入平台复核。',
    improvement:'在文案清单中补充渠道、字符数和素材尺寸三列，方便后续投放。'
  }),
  设计:Object.freeze({
    filenames:['界面方案说明.md','页面结构.svg'],
    sections:[['信息架构','已梳理页面层级、核心信息和主要操作入口。'],['组件状态','已覆盖默认、加载、空状态、失败和完成状态。'],['响应式方案','已说明桌面端与移动端的信息优先级和布局变化。']],
    issue:'个别组件状态的触发条件可以进一步标注，当前不影响整体方案理解。',
    improvement:'在组件说明中补充状态触发条件及恢复路径，便于平台逐项复核。'
  }),
  知识问答:Object.freeze({
    filenames:['知识问答交付文档.md','问答条目清单.csv'],
    sections:[['问题结构','已按用户场景整理高频问题、标准答案和适用范围。'],['答案校对','已统一术语、数字和产品名称，并移除无依据的延伸结论。'],['使用说明','已补充限制条件、异常情况和进一步咨询入口。']],
    issue:'部分答案的来源位置可以进一步细化，当前内容与任务已知信息一致。',
    improvement:'为关键答案补充来源章节或材料位置，方便平台快速回查。'
  }),
  其他:Object.freeze({
    filenames:['业务交付报告.md','交付明细.csv'],
    sections:[['任务理解','已根据任务背景拆分目标、限制条件和交付边界。'],['交付内容','已整理主要结论、执行清单和需要平台确认的事项。'],['一致性检查','已核对名称、数据、时间和来源描述，未将待确认项写成既定事实。']],
    issue:'交付明细中的来源位置可以进一步具体，当前结论和任务要求一致。',
    improvement:'为关键结论补充材料页码或字段位置，降低平台复核成本。'
  })
});

const csvCell=value=>`"${String(value??'').replaceAll('"','""')}"`;
const toCsv=rows=>'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
const escapeXml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

function markdownReport(task,row,sections,manual){
  return `# ${task.title}\n\n执行编号：${row.executionNo}\n提交时间：${row.submittedAt}\n提交方式：${manual?'用户人工上传':row.agentName}\n\n## 任务说明\n${task.description}\n\n## 交付标准\n${task.deliverables}\n\n## 交付内容\n${sections.map(([title,body])=>`### ${title}\n${body}`).join('\n\n')}\n\n## 验收依据\n${task.acceptanceCriteria}\n`;
}

function designSvg(task,sections){
  const cards=sections.map(([title,body],index)=>({title,body,index}));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="720" viewBox="0 0 1120 720"><rect width="1120" height="720" fill="#f5f7f7"/><g font-family="Arial, sans-serif" fill="#183c36"><text x="48" y="62" font-size="28" font-weight="700">${escapeXml(task.title)}</text><text x="48" y="96" font-size="16">平台验收预览 · 页面信息结构</text>${cards.map(({title,body,index})=>`<rect x="${48+index*350}" y="138" width="320" height="430" rx="12" fill="#ffffff" stroke="#c9d8d4"/><text x="${70+index*350}" y="184" font-size="20" font-weight="700">${escapeXml(title)}</text><foreignObject x="${70+index*350}" y="212" width="276" height="310"><div xmlns="http://www.w3.org/1999/xhtml" style="font:16px Arial,sans-serif;line-height:1.7;color:#4b5e59">${escapeXml(body)}</div></foreignObject>`).join('')}<text x="48" y="638" font-size="16">包含默认、加载、空状态、失败与完成状态说明</text></g></svg>`;
}

function generatedFiles(task,row,manual){
  const profile=categoryProfiles[task.category]??categoryProfiles.其他;
  const report=markdownReport(task,row,profile.sections,manual);
  const detail=task.category==='设计'
    ? designSvg(task,profile.sections)
    : toCsv([['交付项','内容'],...profile.sections,['验收依据',task.acceptanceCriteria]]);
  const definitions=[
    {name:manual?`人工补交_${profile.filenames[0]}`:profile.filenames[0],mimeType:'text/markdown',content:report},
    {name:manual?`人工补交_${profile.filenames[1]}`:profile.filenames[1],mimeType:task.category==='设计'?'image/svg+xml':'text/csv',content:detail}
  ];
  return definitions.map((definition,sortOrder)=>{
    const sourceKey=manual?'manual-':'',bytes=Buffer.from(definition.content),fileId=`business-result-${row.executionIndex}-${sourceKey}${sortOrder+1}`;
    return {...definition,filename:definition.name,bytes,fileId,artifactId:`artifact-${row.executionIndex}-${sourceKey}${sortOrder+1}`,sortOrder,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),createdAt:row.submittedAt,downloadUrl:`/mock-api/admin/artifact?id=${encodeURIComponent(row.executionId)}&file=${fileId}`};
  });
}

function agentResultOutput(task,row,files,failed=false){
  const estimate=Math.max(2400,Number(task.estimatedTokens)||8000);
  const used=Math.round(estimate*(0.62+(hash(row.executionIndex,121)%19)/100));
  const outputTokens=Math.max(480,Math.round(used*(0.21+(hash(row.executionIndex,122)%12)/100)));
  const inputTokens=used-outputTokens;
  const profile=categoryProfiles[task.category]??categoryProfiles.其他;
  return {
    exitCode:0,inputTokens,outputTokens,receivedAt:row.submittedAt,
    finalMessage:failed
      ? `原 Agent 已完成“${task.title}”并提交${files.map(file=>file.name).join('、')}。本地质检发现交付证据不完整，后续由用户人工补交。`
      : `已完成“${task.title}”的交付。已提交${files.map(file=>file.name).join('、')}，内容覆盖${profile.sections.map(([title])=>title).join('、')}，请结合任务要求复核附件。`
  };
}

function agentOutput(task,row,files){
  const profile=categoryProfiles[task.category]??categoryProfiles.其他;
  return {
    output:agentResultOutput(task,row,files),
    acceptance:{
      acceptanceId:`acceptance-${row.executionIndex}`,status:'PASSED',score:Number(row.agentScore),
      summary:`本地质检已通过，交付内容覆盖“${task.title}”的主要要求，现提交平台复核。`,
      issues:[profile.issue],failureReasons:[],improvementSuggestions:[profile.improvement],
      details:{status:'PASSED',acceptanceStatus:'LOCAL_PASSED',score:Number(row.agentScore),summary:'本地质检通过，等待平台审核。',issues:[profile.issue],improvementSuggestions:[profile.improvement]},
      mappedBusinessStatus:'reviewing',receivedAt:row.submittedAt
    }
  };
}

function manualOutput(task,row,agentFiles,manualFiles){
  const profile=categoryProfiles[task.category]??categoryProfiles.其他;
  const originalScore=62+hash(row.executionIndex,123)%17;
  return {
    output:agentResultOutput(task,row,agentFiles,true),
    acceptance:{
      acceptanceId:`acceptance-${row.executionIndex}`,status:'FAILED',score:originalScore,
      summary:`原 Agent 交付未完全满足“${task.title}”的要求，用户已人工补交，当前等待平台审核。`,
      issues:[`原交付未完整覆盖${profile.sections.at(-1)[0]}，需要结合人工补交文件复核。`],
      failureReasons:['原 Agent 交付证据不完整，未直接进入平台通过状态。'],
      improvementSuggestions:[profile.improvement],mappedBusinessStatus:'reviewing',receivedAt:row.submittedAt
    },
    manualSubmissions:[{
      submissionId:`manual-${row.executionIndex}`,submissionNo:1,source:'USER_MANUAL',status:'PENDING_REVIEW',
      description:`用户已针对原交付缺失内容补充${manualFiles.map(file=>file.name).join('、')}，请按任务验收标准进行平台审核。`,
      reviewReason:null,submittedAt:row.submittedAt,reviewedAt:null,
      files:manualFiles.map(file=>({id:file.fileId,fileId:file.fileId,filename:file.name,mimeType:file.mimeType,sizeBytes:file.sizeBytes,sha256:file.sha256,sortOrder:file.sortOrder,downloadUrl:file.downloadUrl,createdAt:file.createdAt}))
    }]
  };
}

export function buildBusinessExecutionSubmission(task,row){
  const manual=row.reviewSource==='USER_MANUAL';
  const agentFiles=generatedFiles(task,row,false);
  const manualFiles=manual?generatedFiles(task,row,true):[];
  const files=[...agentFiles,...manualFiles];
  const content=manual?manualOutput(task,row,agentFiles,manualFiles):agentOutput(task,row,agentFiles);
  return {
    files,
    result:{
      executionId:row.executionId,executionNo:row.executionNo,taskId:row.taskId,
      executionStatus:'reviewing',reviewSource:row.reviewSource,artifacts:agentFiles.map(file=>({
        artifactId:file.artifactId,fileId:file.fileId,role:'DELIVERABLE',name:file.name,mimeType:file.mimeType,sizeBytes:file.sizeBytes,
        sha256:file.sha256,localRelativePath:file.name,receivedAt:row.submittedAt,downloadUrl:file.downloadUrl
      })),
      ...content,
      manualSubmissions:content.manualSubmissions??[]
    }
  };
}
