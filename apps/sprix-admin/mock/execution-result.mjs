import { createHash } from 'node:crypto';
import { hash } from './business-scenario.mjs';

const sections = {
  '设计创意': [['首屏', '活动主题、适用人群和预约入口放在同一屏，主按钮使用“立即预约”。'], ['活动介绍', '按课程内容、参与方式、注意事项排列；费用与取消规则紧邻预约入口。'], ['预约表单', '仅保留姓名、联系方式和预约场次；必填项逐项校验，失败时保留已填内容。'], ['提交反馈', '成功页展示预约信息与后续联系说明，避免重复提交。'], ['素材清单', '主视觉、讲师或活动照片、场地照片；图片需提供横版及移动端裁切版本。']],
  '软件开发': [['缺失参数', '分别省略必填参数，检查错误码及字段提示；失败请求不得产生业务记录。'], ['边界值', '覆盖空字符串、最大长度及超长输入，核对服务端校验与接口定义。'], ['身份校验', '使用过期凭证、缺失凭证及无权限身份，确认拒绝访问且不泄露资源内容。'], ['重复请求', '同一业务请求重复提交，核对幂等性与最终记录数量。']],
  '数据处理': [['字段结构', '保留原始值、标准值、单位、来源位置和处理说明，空值与数值零分开记录。'], ['格式规范', '日期统一为 YYYY-MM-DD，数值与单位分列，标识字段按文本保存。'], ['异常处理', '重复项保留来源索引；不一致项单列复核，不用猜测值覆盖原文。']],
  '市场研究': [['对比维度', '按价格、功能、适用人群、限制条件排列，同口径数据放在同一列。'], ['来源核对', '优先记录官方页面，分别保留来源地址及核对时间，动态价格附有效条件。'], ['结论边界', '资料不足的维度不参与排序；事实与分析判断分开呈现。']],
  '内容运营': [['标题结构', '先表达使用场景，再写明确利益点，删除绝对化及未经证实的效果承诺。'], ['正文顺序', '按用户问题、产品说明、使用限制、行动入口组织，每段只保留一个核心信息。'], ['校对要点', '规格、型号、数量和单位逐项与原稿核对，全文统一术语。']],
  '金融资讯': [['指标口径', '营业收入、利润与出货量分别列示，币种、单位、报告期间独立标注。'], ['变动说明', '同比与环比拆开比较，基期缺失时不计算增长率。'], ['来源索引', '每项指标对应报告页码；经营事实与分析判断分开，不延伸为投资建议。']],
  '人力资源': [['能力维度', '将必备能力与加分项分列，每项能力对应可观察的工作产出。'], ['问题设计', '要求候选人说明情境、个人行动和结果，追问其独立负责的部分。'], ['评价依据', '按证据完整度与岗位相关性记录，避免仅凭表达风格判断。']],
  '商务办公': [['事项分类', '将已决定事项、待确认问题和讨论建议分开记录。'], ['执行清单', '行动项对应负责人、截止时间、依赖项及原文位置。'], ['待确认项', '原文未明确的信息单列，不将建议写成已经通过的决定。']]
};

// Construct only the requested execution. No artifacts are added to list snapshots.
export function executionSubmission(ledger, id) {
  if (!/^demo:execution:[1-9]\d*$/.test(id ?? '')) return null;
  const index = Number(id.split(':')[2]);
  if (!Number.isSafeInteger(index) || (index > ledger.orders && !ledger.consumerRows.has(index))) return null;
  const candidate = ledger.execution(index);
  const detail = ledger.detail(candidate.taskId);
  const record = detail && Object.values(detail.records).flat().find(row => row.executionId === id);
  if (!record) return null;
  const result = {executionId:id, taskId:record.taskId, executionStatus:record.acceptanceStatus, reviewSource:'AGENT', artifacts:[]};
  if (!record.submittedAt) return {result, files:[]};
  const task = detail.task;
  const receivedAt = record.submittedAt;
  const rows = task.submissionRows ?? sections[task.category] ?? sections['商务办公'];
  const number = `EX-${String(index).padStart(8,'0')}`;
  const report = `# ${task.title}\n\n执行编号：${number}\n提交时间：${receivedAt}\n执行 Agent：${record.agentName}\n\n## 任务要求\n${task.description}\n\n## 交付范围\n${task.deliverables}\n\n## 交付内容\n${rows.map(([title,body])=>`### ${title}\n${body}`).join('\n\n')}\n\n## 验收依据\n${task.acceptanceCriteria}\n\n## 复核备注\n${record.acceptanceIssues || '按任务验收标准逐项复核。'}\n`;
  const csv = '\ufeff条目,内容\r\n'+rows.map(row=>row.map(value=>`"${value.replaceAll('"','""')}"`).join(',')).join('\r\n');
  const files = [{name:'交付内容.md',mimeType:'text/markdown',content:report},{name:'交付明细.csv',mimeType:'text/csv',content:csv}].map((file,i)=>{
    const bytes=Buffer.from(file.content);
    return {...file,bytes,artifactId:`artifact-${index}-${i+1}`};
  });
  if (task.category === '设计创意') {
    const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const content = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="880" viewBox="0 0 960 880"><rect width="960" height="880" fill="#f5f7f7"/><g font-family="sans-serif" fill="#183c36"><text x="48" y="52" font-size="22">${escape(task.title)}</text>${rows.map(([title,body],i)=>`<rect x="48" y="${82+i*150}" width="864" height="126" rx="12" fill="white" stroke="#c7d9d4"/><text x="72" y="${118+i*150}" font-size="20">${i+1}. ${escape(title)}</text>${[body.slice(0,34),body.slice(34)].map((line,j)=>`<text x="72" y="${152+i*150+j*24}" font-size="17">${escape(line)}</text>`).join('')}`).join('')}</g></svg>`;
    files.push({name:'页面信息结构.svg',mimeType:'image/svg+xml',content,bytes:Buffer.from(content),artifactId:`artifact-${index}-3`});
  }
  result.output = {exitCode:0,inputTokens:1800+hash(index,71)%14500,outputTokens:650+hash(index,72)%4200,receivedAt,
    finalMessage:`已整理“${task.title}”的交付文档与明细表。内容包括：${rows.map(row=>row[0]).join('、')}。请结合任务要求复核附件。`};
  result.artifacts = files.map(file=>({artifactId:file.artifactId,fileId:file.artifactId,role:'DELIVERABLE',name:file.name,mimeType:file.mimeType,sizeBytes:file.bytes.length,
    sha256:createHash('sha256').update(file.bytes).digest('hex'),localRelativePath:file.name,receivedAt,
    downloadUrl:`/mock-api/admin/artifact?id=${encodeURIComponent(id)}&file=${file.artifactId}`}));
  result.acceptance = {acceptanceId:id,status:record.acceptanceStatus,score:record.acceptanceScore,summary:record.acceptanceSummary,issues:record.acceptanceIssues,
    failureReasons:record.acceptanceFailureReasons,improvementSuggestions:record.acceptanceImprovementSuggestions};
  return {result,files};
}
