import { createHash } from 'node:crypto';
import { isSeedExecutionId, parseSeedExecutionId, stableSeedHash } from './seed-task-scenario.mjs';

const json=(value)=>JSON.stringify(value,null,2)+'\n';
const jsonl=(rows)=>rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
const csvCell=(value)=>`"${String(value??'').replaceAll('"','""')}"`;
const csv=(rows)=>'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
const xml=(value)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const yamlScalar=(value)=>JSON.stringify(String(value??''));

function familyFor(task) {
  const text=`${task.title} ${task.category} ${task.deliverables} ${task.acceptanceCriteria}`;
  if(/CTF/i.test(text))return 'ctf';
  if(/漏洞|沙箱|Terminal-Bench|Exploit/i.test(text))return 'sandbox';
  if(/\bALE\b/i.test(text))return 'ale';
  if(/图像|视觉|OCR|CT|化学结构|多模态/i.test(text))return 'multimodal';
  if(/数学|Peer\s*Review|审计|学术|评审/i.test(text))return 'academic';
  return 'generic';
}

function common(task,record) {
  return {task_id:task.id,task_title:task.title,execution_no:record.executionNo,submitted_at:record.submittedAt??record.completedAt,acceptance_criteria:task.acceptanceCriteria};
}

function previewSvg(task,record) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="720" viewBox="0 0 1120 720"><rect width="1120" height="720" fill="#f4f7f6"/><g font-family="Arial,sans-serif" fill="#183c36"><text x="48" y="62" font-size="28" font-weight="700">${xml(task.title)}</text><text x="48" y="96" font-size="16">标注抽样预览 · ${xml(record.executionNo)}</text>${['输入样本','结构化标注','质量复核'].map((label,index)=>`<rect x="${48+index*350}" y="145" width="320" height="390" rx="14" fill="white" stroke="#c7d8d3"/><text x="${72+index*350}" y="190" font-size="20" font-weight="700">${label}</text><text x="${72+index*350}" y="234" font-size="15">样本 ${index+1} · 字段完整</text><text x="${72+index*350}" y="270" font-size="15">置信度 ${(0.94+index*0.01).toFixed(2)}</text><rect x="${72+index*350}" y="305" width="270" height="150" rx="8" fill="#edf4f2"/>`).join('')}<text x="48" y="620" font-size="16">提交时间：${xml(record.submittedAt??record.completedAt)}</text></g></svg>`;
}

function fileDefinitions(task,record) {
  const info=common(task,record),family=familyFor(task);
  const score=Number(record.acceptanceScore??record.score??92);
  const quality={...info,sample_count:120+stableSeedHash(record.executionId,11)%480,pass_rate:Number((0.965+(stableSeedHash(record.executionId,13)%25)/1000).toFixed(3)),score,status:'ready_for_platform_review'};
  const report=`# ${task.title} 交付报告\n\n执行编号：${record.executionNo}\n提交时间：${info.submitted_at}\n执行 Agent：${record.agentName}\n\n## 交付范围\n${task.deliverables}\n\n## 验收结果\n已按“${task.acceptanceCriteria}”完成自检。抽样通过率 ${(quality.pass_rate*100).toFixed(1)}%，交付文件与清单可逐项追溯。\n\n## 问题记录\n未发现阻断交付的问题；建议平台复核边界样本与评分口径。\n`;
  if(family==='sandbox')return [
    ['dataset_manifest.jsonl','application/x-ndjson',jsonl([{...info,path:'datasets/train.jsonl',records:quality.sample_count,integrity_state:'verified'},{...info,path:'datasets/validation.jsonl',records:48,integrity_state:'verified'}])],
    ['task_package_index.csv','text/csv',csv([['package','scenario','status'],['sandbox-a','权限边界','passed'],['sandbox-b','异常恢复','passed'],['sandbox-c','验收回放','passed']])],
    ['evaluation_scorecard.json','application/json',json({...quality,dimensions:{correctness:score,safety:score-1,reproducibility:score+1}})],
    ['qa_report.md','text/markdown',report],['runbook.yaml','text/yaml',`task: ${yamlScalar(task.title)}\nexecution: ${yamlScalar(record.executionNo)}\nsteps:\n  - prepare_sandbox\n  - replay_cases\n  - verify_outputs\nresult: passed\n`],
    ['README.md','text/markdown',`# 交付目录\n\n本目录对应 ${task.title} / ${record.executionNo}。先查看 qa_report.md，再按 runbook.yaml 复现验收流程。\n`]
  ];
  if(family==='ctf')return [
    ['ctf_sop.md','text/markdown',report],['challenge_manifest.yaml','text/yaml',`task: ${yamlScalar(task.title)}\nexecution: ${yamlScalar(record.executionNo)}\nchallenges: 12\nreplayable: true\n`],
    ['rubric.json','application/json',json({...info,dimensions:['可复现性','步骤完整度','安全边界'],passing_score:85})],
    ['judge_output.json','application/json',json({...quality,passed_cases:12,total_cases:12})],
    ['acceptance_checklist.csv','text/csv',csv([['检查项','结果'],['环境隔离','通过'],['攻击链复现','通过'],['修复验证','通过']])],
    ['README.md','text/markdown',`# ${task.title}\n\n执行 ${record.executionNo} 的复核入口与文件说明。\n`]
  ];
  if(family==='ale')return [
    ['task_card.json','application/json',json({...info,objective:task.deliverables,input_contract:'manifest-driven',output_contract:'scored-delivery'})],
    ['rubrics.json','application/json',json({...info,dimensions:[{name:'准确性',weight:0.45},{name:'完整性',weight:0.35},{name:'可复核性',weight:0.2}],passing_score:85})],
    ['input_pack_manifest.csv','text/csv',csv([['文件','用途','状态'],['task_card.json','任务定义','ready'],['rubrics.json','评分规则','ready'],['scorecard.json','运行结果','ready']])],
    ['scorecard.json','application/json',json({...quality,dimension_scores:{accuracy:score,completeness:score-1,traceability:score+1}})],
    ['evaluation_report.md','text/markdown',report],['README.md','text/markdown',`# ALE 任务包\n\n任务：${task.title}\n执行：${record.executionNo}\n按 task_card、rubrics、scorecard、evaluation_report 顺序复核。\n`]
  ];
  if(family==='multimodal')return [
    ['annotations_sample.jsonl','application/x-ndjson',jsonl(Array.from({length:6},(_,index)=>({...info,sample_id:`sample-${String(index+1).padStart(3,'0')}`,label:['positive','negative','uncertain'][index%3],confidence:Number((0.94+index/100).toFixed(2))})))],
    ['label_schema.json','application/json',json({...info,version:'1.0',labels:['positive','negative','uncertain'],required_fields:['sample_id','label','confidence']})],
    ['quality_summary.csv','text/csv',csv([['指标','结果'],['抽样数量',quality.sample_count],['通过率',quality.pass_rate],['综合评分',score]])],
    ['qa_report.md','text/markdown',report],['sample_preview.svg','image/svg+xml',previewSvg(task,record)]
  ];
  if(family==='academic')return [
    ['review_annotations.jsonl','application/x-ndjson',jsonl(Array.from({length:5},(_,index)=>({...info,item:index+1,issue_type:['论证完整性','引用一致性','公式校验'][index%3],decision:index===4?'needs-review':'accepted'})))],
    ['error_index.csv','text/csv',csv([['条目','问题类型','处理'],['A-017','引用一致性','已修订'],['A-043','公式校验','已复核'],['A-081','边界结论','平台复核']])],
    ['sampling_report.csv','text/csv',csv([['指标','结果'],['样本量',quality.sample_count],['抽样通过率',quality.pass_rate],['评分',score]])],
    ['quality_report.md','text/markdown',report],['README.md','text/markdown',`# 评审交付说明\n\n${task.title} 的批注、问题索引与抽样报告均关联执行 ${record.executionNo}。\n`]
  ];
  return [
    ['annotations_sample.jsonl','application/x-ndjson',jsonl(Array.from({length:6},(_,index)=>({...info,row:index+1,label:['合格','需复核'][index%2],source_index:`source-${index+1}`})))],
    ['data_dictionary.json','application/json',json({...info,fields:{row:'样本序号',label:'标注结论',source_index:'原始材料位置'}})],
    ['quality_summary.csv','text/csv',csv([['指标','结果'],['交付条目',quality.sample_count],['抽样通过率',quality.pass_rate],['综合评分',score]])],
    ['delivery_manifest.yaml','text/yaml',`task: ${yamlScalar(task.title)}\nexecution: ${yamlScalar(record.executionNo)}\nfiles: 5\nstatus: ready_for_review\n`],
    ['qa_report.md','text/markdown',report]
  ];
}

export function seedExecutionSubmission(id,context) {
  if(!isSeedExecutionId(id)||!context?.task||!context?.record)return null;
  const parsed=parseSeedExecutionId(id),task=context.task,record=context.record;
  if(parsed.taskId!==task.id||record.executionId!==id)return null;
  const encodedContext=Buffer.from(JSON.stringify(context)).toString('base64url');
  const files=fileDefinitions(task,record).map(([name,mimeType,content],index)=>{
    const bytes=Buffer.from(content),fileId=`seed-result-${parsed.ordinal}-${index+1}`;
    return {name,mimeType,content,bytes,fileId,artifactId:`seed-artifact-${parsed.ordinal}-${index+1}`,
      sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
      downloadUrl:`/mock-api/admin/artifact?id=${encodeURIComponent(id)}&file=${fileId}&context=${encodedContext}`};
  });
  const score=Number(record.acceptanceScore??record.score??92),receivedAt=record.submittedAt??record.completedAt;
  const estimate=Math.max(2400,Number(task.estimatedTokens)||10000),used=Math.round(estimate*(0.72+(stableSeedHash(id,101)%17)/100));
  const outputTokens=Math.max(480,Math.round(used*(0.22+(stableSeedHash(id,103)%10)/100)));
  return {files,result:{executionId:id,executionNo:record.executionNo,taskId:task.id,executionStatus:record.acceptanceStatus??'待平台验收',reviewSource:record.reviewSource??'AGENT',
    output:{exitCode:0,inputTokens:used-outputTokens,outputTokens,receivedAt,finalMessage:`已完成“${task.title}”交付，共提交 ${files.length} 个任务化文件，覆盖任务清单、质量校验与验收复核材料。抽样通过率达到 ${((0.965+(stableSeedHash(id,13)%25)/1000)*100).toFixed(1)}%，请按验收标准复核。`},
    artifacts:files.map(file=>({artifactId:file.artifactId,fileId:file.fileId,role:'DELIVERABLE',name:file.name,mimeType:file.mimeType,sizeBytes:file.sizeBytes,sha256:file.sha256,localRelativePath:file.name,receivedAt,downloadUrl:file.downloadUrl})),
    acceptance:{acceptanceId:`seed-acceptance-${parsed.ordinal}`,status:'PASSED',score,summary:`交付文件覆盖“${task.title}”主要验收项，结构与抽样结果一致。`,issues:['建议平台抽查边界样本，并确认评分口径与任务验收标准一致。'],failureReasons:[],improvementSuggestions:['复核通过后归档清单、质量报告与验收结论。'],details:{status:'PASSED',score,fileCount:files.length,family:familyFor(task)},mappedBusinessStatus:record.acceptanceStatus==='验收通过'?'completed':'platform_review_pending',receivedAt},manualSubmissions:[]}};
}

export function decodeSeedExecutionContext(value) {
  try{return JSON.parse(Buffer.from(String(value??''),'base64url').toString('utf8'));}catch{return null;}
}
