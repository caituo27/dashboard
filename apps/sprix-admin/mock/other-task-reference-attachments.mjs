import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {otherTaskReferenceAttachmentPayloads} from './other-task-reference-templates.mjs';

export function otherTaskReferenceAttachmentFiles(taskId,category,sequence,createdAt='2026-09-06 23:59:59'){
  return otherTaskReferenceAttachmentPayloads(taskId,category,sequence,createdAt).map(payload=>{
    const bytes=Buffer.from(payload.content);
    return {...payload,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),bytes};
  });
}
