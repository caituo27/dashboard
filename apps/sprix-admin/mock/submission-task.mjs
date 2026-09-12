import {timestamp} from './record-order.mjs';
export function taskAtSubmission(task,patch,submittedAt) {
  const history=patch?.contentHistory;
  if(!history?.length) return task;
  let selected=history[0].before;
  for(const change of history) if(timestamp(change.at)<=timestamp(submittedAt)) selected=change.after;
  return {...task,...selected};
}
export function taskContent(task) {
  return Object.fromEntries(['title','category','description','deliverables','acceptanceCriteria','submissionRows','attachmentNames','estimatedTokens'].map(key=>[key,task[key]]));
}
export function editedTaskContent(current,payload) {
 const changed=['title','category','description','deliverables','acceptanceCriteria'].some(key=>payload[key]!==current[key]);
 const content={...taskContent(current),...Object.fromEntries(['title','category','description','deliverables','acceptanceCriteria'].map(key=>[key,payload[key]])),estimatedTokens:payload.estimatedTokens ?? current.estimatedTokens};
 if(changed) {
   // A free-form edit has no generated answer. Keep its new brief explicit instead of reusing an unrelated answer.
   content.submissionRows=null;
   content.attachmentNames=null;
 }
 return content;
}
