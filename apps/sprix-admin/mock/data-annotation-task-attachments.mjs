import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {dataAnnotationTaskTemplate} from './data-annotation-task-templates.mjs';

function attachmentBody(template,attachment){
  if(attachment.mimeType==='application/json') return JSON.stringify({task:template.title,description:template.description,deliverables:template.deliverables,acceptanceCriteria:template.acceptanceCriteria},null,2)+'\n';
  if(attachment.mimeType==='text/csv') return '\ufeff字段,内容\r\n'+[['任务名称',template.title],['任务描述',template.description],['交付标准',template.deliverables],['验收标准',template.acceptanceCriteria]].map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
  if(attachment.mimeType==='chemical/x-mdl-molfile') return `${template.title}\n  SprixAI  2D\n\n  0  0  0  0  0  0  0  0  0  0  1 V2000\nM  END\n`;
  return `# ${template.title}\n\n## 任务说明\n${template.description}\n\n## 交付标准\n${template.deliverables}\n\n## 验收标准\n${template.acceptanceCriteria}\n`;
}

export function dataAnnotationTaskAttachmentFiles(taskId,index,reward=0,totalSlots=1,createdAt='2026-09-06 23:59:59'){
  const template=dataAnnotationTaskTemplate(index,reward,totalSlots);
  return template.attachments.map((attachment,sortOrder)=>{
    const content=attachmentBody(template,attachment),bytes=Buffer.from(content),attachmentId=`task-input-${index}-${sortOrder+1}`;
    return {attachmentId,fileId:attachmentId,filename:attachment.filename,mimeType:attachment.mimeType,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sortOrder,createdAt,downloadUrl:`/mock-api/admin/task-attachment?id=${encodeURIComponent(taskId)}&file=${attachmentId}`,content,bytes};
  });
}
