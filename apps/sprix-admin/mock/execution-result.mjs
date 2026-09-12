import {taskAtSubmission} from './submission-task.mjs';
import {localAcceptance} from './local-acceptance.mjs';
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
  const result = {executionId:id, taskId:record.taskId, executionStatus:record.taskExecutionStatus??record.acceptanceStatus, reviewSource:'AGENT', artifacts:[]};
  if (!record.submittedAt) return {result, files:[]};
  const task = taskAtSubmission(detail.task,ledger.submissionPatch?.(record.taskId),record.submittedAt);
  const receivedAt = record.submittedAt;
  const rows = task.submissionRows===null
    ? [['交付状态','任务要求调整后，当前执行未提供与最新版本对应的交付内容。'],['处理建议','请按最新任务要求重新执行并提交产物。']]
    : task.submissionRows ?? sections[task.category] ?? sections['商务办公'];
  const number = `EX-${String(index).padStart(8,'0')}`;
  const report = `# ${task.title}\n\n执行编号：${number}\n提交时间：${receivedAt}\n执行 Agent：${record.agentName}\n\n## 任务要求\n${task.description}\n\n## 交付范围\n${task.deliverables}\n\n## 交付内容\n${rows.map(([title,body])=>`### ${title}\n${body}`).join('\n\n')}\n\n## 验收依据\n${task.acceptanceCriteria}\n`;
  const csv = '\ufeff条目,内容\r\n'+rows.map(row=>row.map(value=>`"${value.replaceAll('"','""')}"`).join(',')).join('\r\n');
  const files = [{name:task.attachmentNames?.[0] ?? '交付内容.md',mimeType:'text/markdown',content:report},{name:task.attachmentNames?.[1] ?? '交付明细.csv',mimeType:'text/csv',content:csv}].map((file,i)=>{
    const bytes=Buffer.from(file.content);
    return {...file,bytes,fileId:`file-${index}-${i+1}`,artifactId:`artifact-${index}-${i+1}`};
  });
  if (['设计创意','UI 设计'].includes(task.category)) {
    const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const content = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="950" viewBox="0 0 1120 950"><rect width="1120" height="950" fill="#f5f7f7"/><g font-family="sans-serif" fill="#183c36"><text x="30" y="40" font-size="22">${escape(task.title)}</text><text x="30" y="76" font-size="16">桌面端：服务信息与操作并列</text><rect x="30" y="95" width="690" height="560" rx="12" fill="white" stroke="#bacfc9"/><text x="50" y="130" font-size="20">服务中心 / 当前服务</text><rect x="50" y="155" width="420" height="160" fill="#eef5f3"/><text x="65" y="190" font-size="18">服务名称、当前状态</text><text x="65" y="230" font-size="16">所选服务 / 订单摘要</text><rect x="490" y="155" width="210" height="270" fill="#e2efeb"/><text x="510" y="190" font-size="18">下一步操作</text><text x="510" y="230" font-size="15">${escape((rows[2]?.[1] ?? '').slice(0,13))}</text><text x="510" y="265" font-size="15">${escape((rows[2]?.[1] ?? '').slice(13,26))}</text><text x="510" y="300" font-size="15">${escape((rows[2]?.[1] ?? '').slice(26))}</text><rect x="50" y="335" width="420" height="150" fill="#f5f7f7"/><text x="65" y="370" font-size="18">服务规则及信息说明</text><text x="65" y="410" font-size="16">价格与门店信息由业务配置提供</text><text x="50" y="540" font-size="16">操作后：展示结果，保留查看详情入口</text><text x="760" y="76" font-size="16">手机端：信息在前、操作在后</text><rect x="760" y="95" width="320" height="560" rx="18" fill="white" stroke="#bacfc9"/>${['服务名称与状态','所选服务 / 订单摘要','服务规则说明','主要操作 / 返回入口'].map((label,i)=>`<rect x="780" y="${130+i*115}" width="280" height="95" rx="6" fill="#eef5f3"/><text x="800" y="${170+i*115}" font-size="17">${label}</text>`).join('')}<text x="30" y="700" font-size="20">异常状态与恢复入口</text>${[['加载中','正在读取服务信息，暂不重复提交'],['无记录','暂无相关记录，提供返回服务列表入口'],['请求失败','保留已填信息，提供重试和返回入口']].map(([label,body],i)=>`<rect x="${30+i*355}" y="725" width="335" height="145" rx="8" fill="white" stroke="#bacfc9"/><text x="${45+i*355}" y="760" font-size="19">${label}</text><text x="${45+i*355}" y="800" font-size="15">${body}</text>`).join('')}</g></svg>`;
    const svg={name:'页面信息结构.svg',mimeType:'image/svg+xml',content,bytes:Buffer.from(content),fileId:`file-${index}-2`,artifactId:`artifact-${index}-2`};
    files.splice(1,1,svg);
  }
  const estimate=task.estimatedTokens ?? 10000;
  const used=Math.round(estimate*(0.8+(hash(index,71)%51)/100));
  const outputTokens=Math.round(used*(0.2+(hash(index,72)%21)/100));
  result.output = {exitCode:0,inputTokens:used-outputTokens,outputTokens,receivedAt,
    finalMessage:`已整理“${task.title}”的交付文档与明细表。内容包括：${rows.map(row=>row[0]).join('、')}。请结合任务要求复核附件。`};
  result.artifacts = files.map(file=>({artifactId:file.artifactId,fileId:file.fileId,role:'DELIVERABLE',name:file.name,mimeType:file.mimeType,sizeBytes:file.bytes.length,
    sha256:createHash('sha256').update(file.bytes).digest('hex'),localRelativePath:file.name,receivedAt,
    downloadUrl:`/mock-api/admin/artifact?id=${encodeURIComponent(id)}&file=${file.fileId}`}));
  const localReview=record.localAcceptance??localAcceptance(index,task,record.status??'reviewing',record.acceptanceScore??record.score??85,record.terminationReason);
  result.acceptance = localReview?{acceptanceId:`acceptance-${index}`,status:localReview.status,score:localReview.score,summary:localReview.summary,issues:localReview.issues,
    failureReasons:localReview.failureReasons,improvementSuggestions:localReview.improvementSuggestions,details:{status:localReview.status,acceptanceStatus:localReview.acceptanceStatus,score:localReview.score,scores:localReview.scores,summary:localReview.summary,issues:localReview.issues,failureReasons:localReview.failureReasons,improvementSuggestions:localReview.improvementSuggestions},mappedBusinessStatus:record.mappedBusinessStatus??'platform_review_pending',receivedAt}:null;
  return {result,files};
}
