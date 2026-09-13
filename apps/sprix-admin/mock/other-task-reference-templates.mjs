import {OTHER_TASK_REFERENCE_ROWS} from './other-task-reference-data.mjs';

const rowsByPrefix=Object.freeze(Object.fromEntries(
  ['FIN','CNT','OFF','MKT','WEB','UI','ADS','AGT'].map(prefix=>[
    prefix,
    Object.freeze(OTHER_TASK_REFERENCE_ROWS.filter(row=>row.sourceId.startsWith(`${prefix}-`)))
  ])
));

function interleave(prefixes){
  const output=[];
  for(let index=0;prefixes.some(prefix=>index<rowsByPrefix[prefix].length);index++){
    for(const prefix of prefixes)if(index<rowsByPrefix[prefix].length)output.push(rowsByPrefix[prefix][index]);
  }
  return Object.freeze(output);
}

export const OTHER_TASK_REFERENCE_POOLS=Object.freeze({
  网站开发:rowsByPrefix.WEB,
  营销:rowsByPrefix.ADS,
  设计:rowsByPrefix.UI,
  知识问答:rowsByPrefix.CNT,
  其他:interleave(['FIN','MKT','OFF','AGT'])
});

const attachmentByCategory=Object.freeze({
  网站开发:Object.freeze({filename:'页面与接口清单.csv',mimeType:'text/csv'}),
  营销:Object.freeze({filename:'营销内容交付清单.csv',mimeType:'text/csv'}),
  设计:Object.freeze({filename:'界面需求清单.csv',mimeType:'text/csv'}),
  知识问答:Object.freeze({filename:'内容问答字段.json',mimeType:'application/json'}),
  其他:Object.freeze({filename:'业务资料清单.csv',mimeType:'text/csv'})
});

const positiveSequence=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):1;
const templateAt=(pool,sequence)=>pool[(positiveSequence(sequence)-1)%pool.length];
const batchTitle=(template,pool,sequence)=>{
  const normalized=positiveSequence(sequence);
  return normalized>pool.length?`${template.title}·批次 ${String(normalized).padStart(6,'0')}`:template.title;
};
const csvCell=value=>`"${String(value??'').replaceAll('"','""')}"`;
const toCsv=rows=>'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';

function contentFromTemplate(template,pool,sequence,category){
  const title=batchTitle(template,pool,sequence);
  const attachment=attachmentByCategory[category];
  return Object.freeze({
    title,
    category,
    recommendedTaskType:category,
    sourceType:'Sprix AI平台任务',
    sourceTaskId:template.sourceId,
    sourceCategory:template.sourceCategory,
    cardSummary:title,
    description:template.description,
    deliverables:template.deliverables,
    acceptanceCriteria:template.acceptanceCriteria,
    estimatedTokens:template.estimatedTokens,
    attachmentNames:Object.freeze(['任务背景说明.md',attachment.filename]),
    submissionRows:Object.freeze([
      Object.freeze(['参考任务编号',template.sourceId]),
      Object.freeze(['任务说明',template.description]),
      Object.freeze(['交付范围',template.deliverables]),
      Object.freeze(['验收依据',template.acceptanceCriteria])
    ])
  });
}

export function otherTaskReferenceContent(category,sequence,reward=0,totalSlots=1){
  const pool=OTHER_TASK_REFERENCE_POOLS[category];
  if(!pool)throw new RangeError(`Unsupported reference task category: ${category}`);
  return contentFromTemplate(templateAt(pool,sequence),pool,sequence,category,reward,totalSlots);
}

export function sourceTaskReferenceContent(prefix,index,reward=0,totalSlots=1){
  const pool=rowsByPrefix[prefix];
  if(!pool?.length)return null;
  const sequence=positiveSequence(index);
  const template=templateAt(pool,sequence);
  const inferredCategory=prefix==='WEB'?'网站开发':prefix==='ADS'?'营销':prefix==='UI'?'设计':prefix==='CNT'?'知识问答':'其他';
  return contentFromTemplate(template,pool,sequence,inferredCategory,reward,totalSlots);
}

function attachmentContents(template,category,title){
  const background=`# ${title}\n\n参考任务编号：${template.sourceId}\n\n## 任务说明\n${template.description}\n\n## 交付标准\n${template.deliverables}\n\n## 验收标准\n${template.acceptanceCriteria}\n`;
  const rows=[
    ['字段','内容'],
    ['参考任务编号',template.sourceId],
    ['参考业务分类',template.sourceCategory],
    ['任务名称',title],
    ['任务说明',template.description],
    ['交付标准',template.deliverables],
    ['验收标准',template.acceptanceCriteria]
  ];
  if(category==='知识问答'){
    return [background,JSON.stringify({sourceTaskId:template.sourceId,title,description:template.description,deliverables:template.deliverables,acceptanceCriteria:template.acceptanceCriteria},null,2)+'\n'];
  }
  return [background,toCsv(rows)];
}

export function otherTaskReferenceAttachmentPayloads(taskId,category,sequence,createdAt='2026-09-06 23:59:59'){
  const pool=OTHER_TASK_REFERENCE_POOLS[category];
  if(!pool)return [];
  const normalized=positiveSequence(sequence),template=templateAt(pool,normalized),title=batchTitle(template,pool,normalized),specific=attachmentByCategory[category];
  const definitions=[{filename:'任务背景说明.md',mimeType:'text/markdown'},specific];
  const contents=attachmentContents(template,category,title);
  return definitions.map((attachment,sortOrder)=>{
    const content=contents[sortOrder],attachmentId=`task-input-${normalized}-${sortOrder+1}`;
    return {attachmentId,fileId:attachmentId,filename:attachment.filename,mimeType:attachment.mimeType,sortOrder,createdAt,downloadUrl:`/mock-api/admin/task-attachment?id=${encodeURIComponent(taskId)}&file=${attachmentId}`,content};
  });
}
