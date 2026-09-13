import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {hash} from './business-scenario.mjs';

const marketingCopy=Object.freeze([
  Object.freeze({channel:'公众号',headline:'把重复交付交给可验收的 Agent',callToAction:'查看任务案例'}),
  Object.freeze({channel:'社群',headline:'今天就发布一项可量化的协作任务',callToAction:'立即体验'}),
  Object.freeze({channel:'信息流',headline:'从发布到验收，一处跟进 Agent 交付',callToAction:'了解详情'})
]);

const enhancedCategoryProfiles=Object.freeze({
  数据标注:Object.freeze({
    focus:'标签口径、标注结果和质量抽检',
    sections:[
      ['标注范围','完成文本意图、实体边界和异常样本三类标注，结果按样本编号关联原始输入。'],
      ['标签口径','标签定义、正反例和冲突处理规则已写入独立口径文件。'],
      ['质量抽检','完成格式校验、漏标复查和分层抽检，保留可追溯的样本记录。']
    ],
    issue:'非阻断关注项：边界样本的跨批次一致性仍建议由平台追加抽查。',
    improvement:'平台复核时可按标签分层抽取边界样本，并记录复核人与口径版本。',
    manualGap:'原 Agent 交付的边界样本复核证据不足，本地质检未通过。',
    files:[
      {name:'标注任务交付报告.md',mimeType:'text/markdown',kind:'report'},
      {
        name:'标注结果样例.csv',mimeType:'text/csv',kind:'csv',
        columns:['sample_id','text','label','review_status'],
        rows:[
          ['S-001','如何修改绑定手机号','账号设置','PASS'],
          ['S-002','付款后多久到账','结算时效','PASS'],
          ['S-003','无法下载交付文件','交付异常','MANUAL_REVIEW']
        ]
      },
      {
        name:'标签定义与边界.yaml',mimeType:'application/yaml',kind:'yaml',
        entries:[
          ['schema_version','annotation-v2'],
          ['required_fields','sample_id,text,label,review_status'],
          ['boundary_rule','同时包含付款与到账时优先标记结算时效'],
          ['conflict_resolution','低置信度样本进入 MANUAL_REVIEW']
        ]
      },
      {
        name:'质量抽检记录.json',mimeType:'application/json',kind:'json',
        records:[
          {check:'必填字段完整性',sampleSize:120,result:'PASS'},
          {check:'标签一致性复核',sampleSize:36,result:'PASS'},
          {check:'边界样本复核',sampleSize:12,result:'FOLLOW_UP'}
        ]
      },
      {
        name:'异常样本处置清单.csv',mimeType:'text/csv',kind:'csv',
        columns:['sample_id','exception','resolution','owner'],
        rows:[
          ['S-003','意图重叠','转人工复核','质检员'],
          ['S-017','文本截断','回查原始输入','数据管理员'],
          ['S-029','标签缺少','按口径补标','标注员']
        ]
      }
    ],
    supplements:[
      {
        name:'边界样本补充抽检.csv',mimeType:'text/csv',kind:'csv',
        columns:['sample_id','original_label','reviewed_label','evidence'],
        rows:[
          ['S-003','交付异常','交付异常','同时包含下载失败描述'],
          ['S-041','账号设置','账号安全','涉及验证码泄露风险'],
          ['S-088','结算时效','结算时效','明确询问到账时间']
        ]
      },
      {
        name:'标签边界复核说明.md',mimeType:'text/markdown',kind:'markdown',
        title:'标签边界补证说明',
        bullets:['补充复核意图重叠、短文本和否定表达样本。','采用 annotation-v2 口径，未修改普通样本结果。','争议样本保留原文与复核结论，供平台逐条核验。']
      },
      {
        name:'异常样本复核记录.json',mimeType:'application/json',kind:'json',
        records:[
          {sampleId:'S-003',decision:'维持原标签',reviewer:'用户复核'},
          {sampleId:'S-041',decision:'调整为账号安全',reviewer:'用户复核'}
        ]
      }
    ]
  }),
  网站开发:Object.freeze({
    focus:'核心页面、接口联调和异常恢复路径',
    sections:[
      ['功能实现','核心页面、表单校验、列表筛选和详情跳转均有明确验收路径。'],
      ['接口联调','整理请求参数、成功响应、空数据与错误响应的处理结果。'],
      ['部署交接','提供环境变量示例、构建步骤和回滚检查项。']
    ],
    issue:'非阻断关注项：低版本浏览器的视觉差异建议在平台环境继续观察。',
    improvement:'平台复核时建议覆盖一次接口超时后的重试与状态恢复路径。',
    manualGap:'原 Agent 交付缺少异常恢复路径的复测证据，本地质检未通过。',
    files:[
      {name:'网站交付报告.md',mimeType:'text/markdown',kind:'report'},
      {
        name:'功能与接口验收清单.csv',mimeType:'text/csv',kind:'csv',
        columns:['route','scenario','expected','result'],
        rows:[
          ['/tasks','列表筛选','条件更新后返回首屏','PASS'],
          ['/tasks/:id','详情加载','展示任务与执行记录','PASS'],
          ['/acceptance/:id','审核提交','提交后刷新审核状态','PASS']
        ]
      },
      {
        name:'部署配置示例.yaml',mimeType:'application/yaml',kind:'yaml',
        entries:[
          ['runtime','nodejs-22'],['build_command','pnpm build'],
          ['health_path','/health'],['rollback_condition','健康检查连续三次失败']
        ]
      },
      {
        name:'接口响应样例.json',mimeType:'application/json',kind:'json',
        records:[
          {route:'/api/tasks',status:200,result:'返回分页任务列表'},
          {route:'/api/acceptance/demo',status:409,result:'展示状态冲突并刷新详情'}
        ]
      },
      {
        name:'页面信息结构.svg',mimeType:'image/svg+xml',kind:'svg',
        cards:[
          ['任务列表','筛选、分页、状态标签'],
          ['执行详情','Agent 结果、附件、质检结论'],
          ['平台审核','通过、驳回、补证复核']
        ]
      }
    ],
    supplements:[
      {
        name:'异常路径复测清单.csv',mimeType:'text/csv',kind:'csv',
        columns:['scenario','trigger','recovery','result'],
        rows:[
          ['接口超时','延迟超过 8 秒','保留筛选条件后重试','PASS'],
          ['状态冲突','审核记录已更新','刷新详情并禁用重复提交','PASS'],
          ['空数据','结果集为空','展示空状态和返回入口','PASS']
        ]
      },
      {
        name:'兼容性补证说明.md',mimeType:'text/markdown',kind:'markdown',
        title:'兼容性与恢复补证',
        bullets:['补充验证桌面端常用浏览器的列表、详情和审核主路径。','请求失败时不会清空用户已填写的审核意见。','恢复后重新拉取服务端状态，避免沿用过期页面数据。']
      },
      {
        name:'恢复流程记录.json',mimeType:'application/json',kind:'json',
        records:[
          {case:'timeout-retry',attempts:2,result:'PASS'},
          {case:'conflict-refresh',attempts:1,result:'PASS'}
        ]
      }
    ]
  }),
  营销:Object.freeze({
    focus:'目标人群、渠道文案和投放监测口径',
    sections:[
      ['受众与目标','围绕中小团队负责人设定认知、访问和咨询三层转化目标。'],
      ['渠道内容','分别给出公众号、社群和信息流可直接使用的文案版本。'],
      ['效果监测','定义曝光、点击、有效咨询和转化成本的统计口径。']
    ],
    issue:'非阻断关注项：实际投放后仍需依据渠道样本量校准点击率基准。',
    improvement:'首轮投放建议保留渠道与素材版本字段，以便归因和复盘。',
    manualGap:'原 Agent 交付缺少渠道字数与合规校验凭证，本地质检未通过。',
    files:[
      {name:'营销方案交付报告.md',mimeType:'text/markdown',kind:'report'},
      {
        name:'渠道投放文案.csv',mimeType:'text/csv',kind:'csv',
        columns:['channel','headline','call_to_action','status'],
        rows:marketingCopy.map(({channel,headline,callToAction})=>[
          channel,headline,callToAction,'READY'
        ])
      },
      {
        name:'内容排期.yaml',mimeType:'application/yaml',kind:'yaml',
        entries:[
          ['week_1','价值主张与用户痛点'],['week_2','真实任务案例拆解'],
          ['week_3','交付验收方法'],['cadence','每周二和周四发布']
        ]
      },
      {
        name:'投放指标定义.json',mimeType:'application/json',kind:'json',
        records:[
          {metric:'CTR',formula:'clicks / impressions',owner:'投放运营'},
          {metric:'有效咨询率',formula:'qualified_leads / clicks',owner:'销售运营'}
        ]
      },
      {
        name:'落地页文案.md',mimeType:'text/markdown',kind:'markdown',
        title:'落地页文案',
        bullets:['首屏：发布任务，获得可下载、可验收的 Agent 交付。','价值点：明确范围、跟踪进度、统一验收证据。','行动按钮：查看任务案例；次级入口：了解结算规则。']
      }
    ],
    supplements:[
      {
        name:'渠道合规复核清单.csv',mimeType:'text/csv',kind:'csv',
        columns:['channel','character_count','absolute_claim','result'],
        rows:marketingCopy.map(({channel,headline})=>[
          channel,String([...headline].length),'无','PASS'
        ])
      },
      {
        name:'文案修改依据.md',mimeType:'text/markdown',kind:'markdown',
        title:'渠道文案补证说明',
        bullets:['删除无法由当前产品证据支持的绝对化表达。','统一产品名称、行动入口和结算相关描述。','记录各渠道标题字数，便于上线前再次校验。']
      },
      {
        name:'素材版本复核.json',mimeType:'application/json',kind:'json',
        records:[
          {version:'A',channel:'公众号',compliance:'PASS'},
          {version:'B',channel:'信息流',compliance:'PASS'}
        ]
      }
    ]
  }),
  设计:Object.freeze({
    focus:'信息架构、组件状态和响应式交互',
    sections:[
      ['信息架构','页面按任务概况、交付文件、质检结果和平台操作组织。'],
      ['组件状态','覆盖默认、加载、空数据、失败、禁用与完成状态。'],
      ['响应式规则','桌面端突出对照审核，移动端按信息优先级单列排列。']
    ],
    issue:'非阻断关注项：超长文件名下的窄屏换行效果建议结合真实数据复核。',
    improvement:'平台复核时建议用超长标题和五个附件验证窄屏信息层级。',
    manualGap:'原 Agent 交付未覆盖窄屏极端数据与异常恢复场景的复核证据，本地质检未通过。',
    files:[
      {name:'设计方案交付报告.md',mimeType:'text/markdown',kind:'report'},
      {
        name:'页面结构稿.svg',mimeType:'image/svg+xml',kind:'svg',
        cards:[
          ['任务概况','分类、奖励、执行 Agent'],
          ['交付证据','文件、说明、Token 用量'],
          ['验收操作','质检结论、建议、审核按钮']
        ]
      },
      {
        name:'设计令牌.json',mimeType:'application/json',kind:'json',
        records:[
          {token:'color.brand',value:'#0F766E',usage:'主操作与通过状态'},
          {token:'space.card',value:'16px',usage:'卡片内边距'},
          {token:'radius.panel',value:'12px',usage:'信息面板'}
        ]
      },
      {
        name:'组件状态清单.csv',mimeType:'text/csv',kind:'csv',
        columns:['component','state','trigger','presentation'],
        rows:[
          ['附件卡片','loading','下载请求进行中','按钮禁用并显示进度'],
          ['审核按钮','disabled','资料不完整','提示缺失项'],
          ['结果面板','error','详情请求失败','错误说明与重试入口']
        ]
      },
      {
        name:'交互规则.yaml',mimeType:'application/yaml',kind:'yaml',
        entries:[
          ['primary_action','每个审核节点只保留一个主操作'],
          ['loading_feedback','超过 300ms 展示加载状态'],
          ['error_recovery','保留上下文并提供原位重试'],
          ['mobile_breakpoint','768px']
        ]
      }
    ],
    supplements:[
      {
        name:'窄屏与异常恢复补证清单.csv',mimeType:'text/csv',kind:'csv',
        columns:['scenario','test_input','expected','verified'],
        rows:[
          ['窄屏极端数据','375px、超长标题、五个附件','主信息与审核操作保持可见','YES'],
          ['异常恢复','详情接口返回 5xx','保留上下文并提供原位重试','YES'],
          ['下载中断','附件请求失败','展示错误说明与恢复入口','YES']
        ]
      },
      {
        name:'窄屏布局复核说明.md',mimeType:'text/markdown',kind:'markdown',
        title:'窄屏与状态补证',
        bullets:['在 375px 内容宽度下保持标题、状态与主操作可见。','超长文件名截断展示，同时保留完整标题提示。','失败状态提供原位重试，不要求用户返回列表。']
      },
      {
        name:'交互复核记录.json',mimeType:'application/json',kind:'json',
        records:[
          {viewport:'375x812',case:'five-files',result:'PASS'},
          {viewport:'1440x900',case:'error-retry',result:'PASS'}
        ]
      }
    ]
  }),
  知识问答:Object.freeze({
    focus:'标准答案、适用边界和来源索引',
    sections:[
      ['问题整理','按账号、任务发布、交付验收和结算四个主题组织高频问题。'],
      ['答案校对','答案包含前提条件、操作路径和无法确认时的升级入口。'],
      ['来源追溯','关键结论关联到材料章节或产品规则，不扩写无依据结论。']
    ],
    issue:'非阻断关注项：产品规则更新后需要同步复核答案中的时效描述。',
    improvement:'建议为每次知识库更新记录来源版本和生效日期。',
    manualGap:'原 Agent 交付的关键答案缺少精确来源位置，本地质检未通过。',
    files:[
      {name:'知识问答交付报告.md',mimeType:'text/markdown',kind:'report'},
      {
        name:'问答知识库.csv',mimeType:'text/csv',kind:'csv',
        columns:['question','answer','scope','source'],
        rows:[
          ['如何查看交付文件','进入执行详情，在提交产物区域下载','已提交执行','任务详情说明'],
          ['人工补交后谁来审核','由平台复核补充材料','人工补交执行','验收流程说明'],
          ['质检通过是否等于平台通过','不等于，仍需平台完成复核','Agent 自动交付','验收状态说明']
        ]
      },
      {
        name:'来源索引.yaml',mimeType:'application/yaml',kind:'yaml',
        entries:[
          ['account_questions','用户指南 / 账号管理'],
          ['delivery_questions','任务指南 / 交付与下载'],
          ['acceptance_questions','平台规则 / 验收流程'],
          ['settlement_questions','平台规则 / 结算说明']
        ]
      },
      {
        name:'结构化问答.json',mimeType:'application/json',kind:'json',
        records:[
          {id:'QA-01',intent:'download_artifact',confidence:0.96,escalate:false},
          {id:'QA-02',intent:'manual_review',confidence:0.93,escalate:false},
          {id:'QA-03',intent:'unknown_policy',confidence:0.62,escalate:true}
        ]
      },
      {
        name:'回答边界说明.md',mimeType:'text/markdown',kind:'markdown',
        title:'回答适用边界',
        bullets:['涉及账户安全和支付异常时只提供官方处理入口。','无法从任务材料确认的时效不承诺具体时间。','产品规则冲突时以当前平台页面和正式规则为准。']
      }
    ],
    supplements:[
      {
        name:'关键答案来源补证.csv',mimeType:'text/csv',kind:'csv',
        columns:['qa_id','claim','source_location','reviewed'],
        rows:[
          ['QA-01','交付文件在详情页下载','任务指南 3.2','YES'],
          ['QA-02','人工补交由平台复核','验收流程 4.1','YES'],
          ['QA-03','未知规则转人工','客服规范 2.4','YES']
        ]
      },
      {
        name:'来源版本复核说明.md',mimeType:'text/markdown',kind:'markdown',
        title:'来源定位补证',
        bullets:['为关键答案补充章节级来源位置。','对时效、支付和账号安全类答案增加版本复核标记。','无法确认的问答保持升级人工处理，不生成推测性结论。']
      },
      {
        name:'问答复核记录.json',mimeType:'application/json',kind:'json',
        records:[
          {qaId:'QA-01',sourceVerified:true},
          {qaId:'QA-02',sourceVerified:true},
          {qaId:'QA-03',sourceVerified:true}
        ]
      }
    ]
  }),
  其他:Object.freeze({
    focus:'任务边界、执行成果和复核依据',
    sections:[
      ['任务拆解','将任务目标拆分为输入核对、执行处理、结果整理和验收交接。'],
      ['成果整理','主结论与执行清单分别记录，待确认项未写成既定事实。'],
      ['交付核对','核对文件命名、数据口径、来源位置和后续责任人。']
    ],
    issue:'非阻断关注项：个别外部依赖项仍需平台结合最新业务状态确认。',
    improvement:'平台复核时建议为外部依赖项补充责任人和确认截止时间。',
    manualGap:'原 Agent 交付缺少外部依赖项的责任与证据记录，本地质检未通过。',
    files:[
      {name:'业务交付报告.md',mimeType:'text/markdown',kind:'report'},
      {
        name:'执行成果清单.csv',mimeType:'text/csv',kind:'csv',
        columns:['deliverable','result','evidence','status'],
        rows:[
          ['输入核对','已确认任务范围','交付报告 / 任务说明','DONE'],
          ['成果整理','已形成可复核文件','执行成果清单','DONE'],
          ['外部依赖','列入待确认事项','交付配置','FOLLOW_UP']
        ]
      },
      {
        name:'交付配置.yaml',mimeType:'application/yaml',kind:'yaml',
        entries:[
          ['scope_control','仅处理任务描述内事项'],
          ['evidence_policy','关键结论必须指向交付文件'],
          ['open_item_policy','待确认事项保留责任人与状态'],
          ['handoff_status','ready_for_review']
        ]
      },
      {
        name:'结果摘要.json',mimeType:'application/json',kind:'json',
        records:[
          {item:'范围核对',status:'DONE'},
          {item:'成果文件',status:'DONE'},
          {item:'外部依赖确认',status:'FOLLOW_UP'}
        ]
      },
      {
        name:'交付流程.svg',mimeType:'image/svg+xml',kind:'svg',
        cards:[
          ['输入核对','任务目标与限制条件'],
          ['执行整理','成果、证据与待确认项'],
          ['平台复核','按验收标准确认结果']
        ]
      }
    ],
    supplements:[
      {
        name:'外部依赖补证清单.csv',mimeType:'text/csv',kind:'csv',
        columns:['dependency','owner','evidence','status'],
        rows:[
          ['业务口径确认','平台运营','任务验收标准','READY'],
          ['外部数据更新','数据负责人','来源更新时间记录','READY'],
          ['后续执行窗口','任务发布方','沟通纪要','READY']
        ]
      },
      {
        name:'待确认事项说明.md',mimeType:'text/markdown',kind:'markdown',
        title:'外部依赖补证说明',
        bullets:['逐项补充外部依赖的责任人、证据位置和当前状态。','补证不修改原 Agent 已提交成果，只用于支持平台判断。','尚未发生的外部动作继续标记为待确认。']
      },
      {
        name:'补充证据索引.json',mimeType:'application/json',kind:'json',
        records:[
          {evidence:'任务验收标准',owner:'平台运营',available:true},
          {evidence:'来源更新时间记录',owner:'数据负责人',available:true}
        ]
      }
    ]
  })
});

const legacyCategoryProfiles=Object.freeze({
  数据标注:Object.freeze({
    filenames:['任务交付说明.md','交付文件清单.csv'],
    sections:[
      ['任务包结构','已按任务要求整理目录、输入材料、交付结果和验收说明。'],
      ['数据与字段','已核对必填字段、文件格式、命名规则和来源标识。'],
      ['质量检查','已执行完整性、可打开性和抽样一致性检查，并保留检查结果。']
    ],
    issue:'质检报告中的抽检样本索引可以进一步细化，当前不影响任务包复核。',
    improvement:'在交付清单中补充抽检样本与原始材料的对应位置，便于平台快速复核。'
  }),
  网站开发:Object.freeze({
    filenames:['网站交付说明.md','功能验收清单.csv'],
    sections:[
      ['页面与功能','已完成核心页面、主要交互和响应式布局说明。'],
      ['接口与状态','已整理接口调用、加载、空数据、失败和重试状态。'],
      ['交付检查','已核对启动方式、关键路径和浏览器兼容注意事项。']
    ],
    issue:'异常状态的截图证据可以进一步补充，当前功能说明和复核路径完整。',
    improvement:'补充一组请求失败与恢复后的对照截图，方便平台确认异常处理。'
  }),
  营销:Object.freeze({
    filenames:['营销内容方案.md','投放文案清单.csv'],
    sections:[
      ['目标人群','已按任务描述明确核心用户、使用场景和转化目标。'],
      ['内容方案','已输出主标题、正文、行动引导和渠道适配版本。'],
      ['合规检查','已移除绝对化承诺，并统一产品名称、数字和行动入口。']
    ],
    issue:'部分渠道版本的字数限制说明可以更具体，当前文案可直接进入平台复核。',
    improvement:'在文案清单中补充渠道、字符数和素材尺寸三列，方便后续投放。'
  }),
  设计:Object.freeze({
    filenames:['界面方案说明.md','页面结构.svg'],
    sections:[
      ['信息架构','已梳理页面层级、核心信息和主要操作入口。'],
      ['组件状态','已覆盖默认、加载、空状态、失败和完成状态。'],
      ['响应式方案','已说明桌面端与移动端的信息优先级和布局变化。']
    ],
    issue:'个别组件状态的触发条件可以进一步标注，当前不影响整体方案理解。',
    improvement:'在组件说明中补充状态触发条件及恢复路径，便于平台逐项复核。'
  }),
  知识问答:Object.freeze({
    filenames:['知识问答交付文档.md','问答条目清单.csv'],
    sections:[
      ['问题结构','已按用户场景整理高频问题、标准答案和适用范围。'],
      ['答案校对','已统一术语、数字和产品名称，并移除无依据的延伸结论。'],
      ['使用说明','已补充限制条件、异常情况和进一步咨询入口。']
    ],
    issue:'部分答案的来源位置可以进一步细化，当前内容与任务已知信息一致。',
    improvement:'为关键答案补充来源章节或材料位置，方便平台快速回查。'
  }),
  其他:Object.freeze({
    filenames:['业务交付报告.md','交付明细.csv'],
    sections:[
      ['任务理解','已根据任务背景拆分目标、限制条件和交付边界。'],
      ['交付内容','已整理主要结论、执行清单和需要平台确认的事项。'],
      ['一致性检查','已核对名称、数据、时间和来源描述，未将待确认项写成既定事实。']
    ],
    issue:'交付明细中的来源位置可以进一步具体，当前结论和任务要求一致。',
    improvement:'为关键结论补充材料页码或字段位置，降低平台复核成本。'
  })
});

const csvCell=value=>`"${String(value??'').replaceAll('"','""')}"`;
const toCsv=rows=>'\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
const yamlValue=value=>JSON.stringify(String(value??''));
const escapeXml=value=>String(value??'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;');

function profileFor(category){
  return enhancedCategoryProfiles[category]??enhancedCategoryProfiles.其他;
}

function stringSeed(value){
  let result=2166136261;
  for(const character of String(value??'')){
    result^=character.codePointAt(0);
    result=Math.imul(result,16777619);
  }
  return result>>>0;
}

function stableFileCount(row,manual){
  const minimum=manual?1:2;
  const maximum=manual?3:5;
  const executionIndex=Number(row.executionIndex)||0;
  const seed=(stringSeed(row.executionId)^executionIndex)>>>0;
  return minimum+hash(seed,manual?132:131)%(maximum-minimum+1);
}

function selectedDefinitions(task,row,manual){
  const profile=profileFor(task.category);
  const definitions=manual?profile.supplements:profile.files;
  return definitions.slice(0,stableFileCount(row,manual));
}

function legacyProfileFor(category){
  return legacyCategoryProfiles[category]??legacyCategoryProfiles.其他;
}

function legacyMarkdownReport(task,row,sections,manual){
  return [
    `# ${task.title}\n\n`,
    `执行编号：${row.executionNo}\n`,
    `提交时间：${row.submittedAt}\n`,
    `提交方式：${manual?'用户人工上传':row.agentName}\n\n`,
    `## 任务说明\n${task.description}\n\n`,
    `## 交付标准\n${task.deliverables}\n\n`,
    `## 交付内容\n${sections.map(([title,body])=>`### ${title}\n${body}`).join('\n\n')}\n\n`,
    `## 验收依据\n${task.acceptanceCriteria}\n`
  ].join('');
}

function legacyDesignSvg(task,sections){
  const cards=sections.map(([title,body],index)=>({title,body,index}));
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="720" viewBox="0 0 1120 720">',
    '<rect width="1120" height="720" fill="#f5f7f7"/>',
    '<g font-family="Arial, sans-serif" fill="#183c36">',
    `<text x="48" y="62" font-size="28" font-weight="700">${escapeXml(task.title)}</text>`,
    '<text x="48" y="96" font-size="16">平台验收预览 · 页面信息结构</text>',
    cards.map(({title,body,index})=>[
      `<rect x="${48+index*350}" y="138" width="320" height="430" rx="12" fill="#ffffff" stroke="#c9d8d4"/>`,
      `<text x="${70+index*350}" y="184" font-size="20" font-weight="700">${escapeXml(title)}</text>`,
      `<foreignObject x="${70+index*350}" y="212" width="276" height="310">`,
      `<div xmlns="http://www.w3.org/1999/xhtml" style="font:16px Arial,sans-serif;line-height:1.7;color:#4b5e59">${escapeXml(body)}</div>`,
      '</foreignObject>'
    ].join('')).join(''),
    '<text x="48" y="638" font-size="16">包含默认、加载、空状态、失败与完成状态说明</text>',
    '</g></svg>'
  ].join('');
}

function legacyGeneratedFiles(task,row,manual){
  const profile=legacyProfileFor(task.category);
  const report=legacyMarkdownReport(task,row,profile.sections,manual);
  const detail=task.category==='设计'
    ? legacyDesignSvg(task,profile.sections)
    : toCsv([['交付项','内容'],...profile.sections,['验收依据',task.acceptanceCriteria]]);
  const definitions=[
    {
      name:manual?`人工补交_${profile.filenames[0]}`:profile.filenames[0],
      mimeType:'text/markdown',content:report
    },
    {
      name:manual?`人工补交_${profile.filenames[1]}`:profile.filenames[1],
      mimeType:task.category==='设计'?'image/svg+xml':'text/csv',content:detail
    }
  ];
  return definitions.map((definition,sortOrder)=>{
    const sourceKey=manual?'manual-':'';
    const bytes=Buffer.from(definition.content);
    const fileId=`business-result-${row.executionIndex}-${sourceKey}${sortOrder+1}`;
    return {
      ...definition,
      filename:definition.name,
      bytes,
      fileId,
      artifactId:`artifact-${row.executionIndex}-${sourceKey}${sortOrder+1}`,
      sortOrder,
      sizeBytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex'),
      createdAt:row.submittedAt,
      downloadUrl:`/mock-api/admin/artifact?id=${encodeURIComponent(row.executionId)}&file=${fileId}`
    };
  });
}

function legacyAgentResultOutput(task,row,files,failed=false){
  const estimate=Math.max(2400,Number(task.estimatedTokens)||8000);
  const used=Math.round(estimate*(0.62+(hash(row.executionIndex,121)%19)/100));
  const outputTokens=Math.max(480,Math.round(used*(0.21+(hash(row.executionIndex,122)%12)/100)));
  const inputTokens=used-outputTokens;
  const profile=legacyProfileFor(task.category);
  return {
    exitCode:0,inputTokens,outputTokens,receivedAt:row.submittedAt,
    finalMessage:failed
      ? `原 Agent 已完成“${task.title}”并提交${files.map(file=>file.name).join('、')}。本地质检发现交付证据不完整，后续由用户人工补交。`
      : `已完成“${task.title}”的交付。已提交${files.map(file=>file.name).join('、')}，内容覆盖${profile.sections.map(([title])=>title).join('、')}，请结合任务要求复核附件。`
  };
}

function legacyAgentOutput(task,row,files){
  const profile=legacyProfileFor(task.category);
  return {
    output:legacyAgentResultOutput(task,row,files),
    acceptance:{
      acceptanceId:`acceptance-${row.executionIndex}`,
      status:'PASSED',score:Number(row.agentScore),
      summary:`本地质检已通过，交付内容覆盖“${task.title}”的主要要求，现提交平台复核。`,
      issues:[profile.issue],failureReasons:[],
      improvementSuggestions:[profile.improvement],
      details:{
        status:'PASSED',acceptanceStatus:'LOCAL_PASSED',score:Number(row.agentScore),
        summary:'本地质检通过，等待平台审核。',issues:[profile.issue],
        improvementSuggestions:[profile.improvement]
      },
      mappedBusinessStatus:'reviewing',receivedAt:row.submittedAt
    }
  };
}

function legacyManualOutput(task,row,agentFiles,manualFiles){
  const profile=legacyProfileFor(task.category);
  const originalScore=62+hash(row.executionIndex,123)%17;
  return {
    output:legacyAgentResultOutput(task,row,agentFiles,true),
    acceptance:{
      acceptanceId:`acceptance-${row.executionIndex}`,
      status:'FAILED',score:originalScore,
      summary:`原 Agent 交付未完全满足“${task.title}”的要求，用户已人工补交，当前等待平台审核。`,
      issues:[`原交付未完整覆盖${profile.sections.at(-1)[0]}，需要结合人工补交文件复核。`],
      failureReasons:['原 Agent 交付证据不完整，未直接进入平台通过状态。'],
      improvementSuggestions:[profile.improvement],
      mappedBusinessStatus:'reviewing',receivedAt:row.submittedAt
    },
    manualSubmissions:[{
      submissionId:`manual-${row.executionIndex}`,
      submissionNo:1,source:'USER_MANUAL',status:'PENDING_REVIEW',
      description:`用户已针对原交付缺失内容补充${manualFiles.map(file=>file.name).join('、')}，请按任务验收标准进行平台审核。`,
      reviewReason:null,submittedAt:row.submittedAt,reviewedAt:null,
      files:manualFiles.map(file=>({
        id:file.fileId,fileId:file.fileId,filename:file.name,
        mimeType:file.mimeType,sizeBytes:file.sizeBytes,sha256:file.sha256,
        sortOrder:file.sortOrder,downloadUrl:file.downloadUrl,createdAt:file.createdAt
      }))
    }]
  };
}

function markdownReport(task,row,profile,fileNames){
  const qualityResult=row.reviewSource==='USER_MANUAL'
    ? profile.manualGap
    : `已完成文件可打开性、字段完整性和任务范围一致性检查。${profile.issue}`;
  return `# ${task.title}交付报告

执行编号：${row.executionNo}
提交时间：${row.submittedAt}
执行 Agent：${row.agentName}
任务分类：${task.category}

## 任务说明

${task.description}

## 交付标准

${task.deliverables}

## 本次交付

${profile.sections.map(([title,body])=>`### ${title}\n\n${body}`).join('\n\n')}

实际提交文件：${fileNames.join('、')}。

## 本地质检

${qualityResult}

## 验收依据

${task.acceptanceCriteria}
`;
}

function markdownEvidence(task,row,definition){
  return `# ${definition.title}

关联任务：${task.title}
执行编号：${row.executionNo}
补证时间：${row.submittedAt}

${definition.bullets.map(item=>`- ${item}`).join('\n')}
`;
}

function csvContent(task,row,definition){
  return toCsv([
    ['execution_no','task_title',...definition.columns],
    ...definition.rows.map(values=>[row.executionNo,task.title,...values])
  ]);
}

function yamlContent(task,row,definition){
  return [
    'version: "1.0"',
    `task_title: ${yamlValue(task.title)}`,
    `execution_no: ${yamlValue(row.executionNo)}`,
    `category: ${yamlValue(task.category)}`,
    'entries:',
    ...definition.entries.flatMap(([item,value])=>[
      `  - item: ${yamlValue(item)}`,
      `    value: ${yamlValue(value)}`
    ]),
    ''
  ].join('\n');
}

function jsonContent(task,row,definition){
  return JSON.stringify({
    taskTitle:task.title,
    executionId:row.executionId,
    executionNo:row.executionNo,
    category:task.category,
    generatedAt:row.submittedAt,
    records:definition.records
  },null,2)+'\n';
}

function svgContent(task,row,definition){
  const cards=definition.cards.map(([title,body],index)=>{
    const x=48+index*350;
    return [
      `<rect x="${x}" y="150" width="320" height="390" rx="14" fill="#ffffff" stroke="#bfd2cd"/>`,
      `<text x="${x+22}" y="198" font-size="20" font-weight="700">${escapeXml(title)}</text>`,
      `<foreignObject x="${x+22}" y="224" width="276" height="250">`,
      `<div xmlns="http://www.w3.org/1999/xhtml" style="font:16px Arial,sans-serif;line-height:1.7;color:#475b56">${escapeXml(body)}</div>`,
      '</foreignObject>'
    ].join('');
  }).join('');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="660" viewBox="0 0 1120 660">',
    '<rect width="1120" height="660" fill="#f3f7f6"/>',
    '<g font-family="Arial, sans-serif" fill="#173e37">',
    `<text x="48" y="62" font-size="28" font-weight="700">${escapeXml(task.title)}</text>`,
    `<text x="48" y="98" font-size="15">执行编号：${escapeXml(row.executionNo)}</text>`,
    cards,
    '<text x="48" y="610" font-size="15">交付预览 · 请结合报告和验收标准复核</text>',
    '</g>',
    '</svg>',
    ''
  ].join('\n');
}

function contentFor(task,row,profile,definition,fileNames){
  if(definition.kind==='report')return markdownReport(task,row,profile,fileNames);
  if(definition.kind==='markdown')return markdownEvidence(task,row,definition);
  if(definition.kind==='csv')return csvContent(task,row,definition);
  if(definition.kind==='yaml')return yamlContent(task,row,definition);
  if(definition.kind==='json')return jsonContent(task,row,definition);
  if(definition.kind==='svg')return svgContent(task,row,definition);
  throw new RangeError(`不支持的交付文件类型：${definition.kind}`);
}

function generatedFiles(task,row,manual){
  const profile=profileFor(task.category);
  const definitions=selectedDefinitions(task,row,manual);
  const fileNames=definitions.map(definition=>definition.name);
  return definitions.map((definition,sortOrder)=>{
    const content=contentFor(task,row,profile,definition,fileNames);
    const bytes=Buffer.from(content);
    const sourceKey=manual?'manual-':'';
    const fileId=`business-result-${row.executionIndex}-${sourceKey}${sortOrder+1}`;
    return {
      name:definition.name,
      filename:definition.name,
      mimeType:definition.mimeType,
      content,
      bytes,
      fileId,
      artifactId:`artifact-${row.executionIndex}-${sourceKey}${sortOrder+1}`,
      sortOrder,
      sizeBytes:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex'),
      createdAt:row.submittedAt,
      downloadUrl:`/mock-api/admin/artifact?id=${encodeURIComponent(row.executionId)}&file=${fileId}`
    };
  });
}

export function businessAcceptanceCopy(task,row){
  const profile=profileFor(task.category);
  const manual=row.reviewSource==='USER_MANUAL';
  const agentFileNames=selectedDefinitions(task,row,false).map(file=>file.name);
  const manualFileNames=manual
    ? selectedDefinitions(task,row,true).map(file=>file.name)
    : [];
  if(manual){
    return {
      acceptanceSummary:`${task.category}任务的原 Agent 本地质检未通过；用户已补充${manualFileNames.join('、')}，等待平台按原验收标准复核。`,
      acceptanceIssues:profile.manualGap,
      acceptanceImprovementSuggestions:profile.improvement,
      manualSubmissionDescription:`针对“${profile.focus}”补充${manualFileNames.join('、')}；补证内容独立于原 Agent 文件，等待平台复核。`,
      agentFileNames,
      manualFileNames
    };
  }
  return {
    acceptanceSummary:`${task.category}任务本地质检通过；${agentFileNames.length} 个文件已覆盖${profile.focus}，现提交平台复核。`,
    acceptanceIssues:profile.issue,
    acceptanceImprovementSuggestions:profile.improvement,
    manualSubmissionDescription:undefined,
    agentFileNames,
    manualFileNames
  };
}

function agentResultOutput(task,row,files,failed=false){
  const estimate=Math.max(2400,Number(task.estimatedTokens)||8000);
  const used=Math.round(estimate*(0.62+(hash(row.executionIndex,121)%19)/100));
  const outputTokens=Math.max(480,Math.round(used*(0.21+(hash(row.executionIndex,122)%12)/100)));
  const inputTokens=used-outputTokens;
  const profile=profileFor(task.category);
  const fileNames=files.map(file=>file.name).join('、');
  return {
    exitCode:0,
    inputTokens,
    outputTokens,
    receivedAt:row.submittedAt,
    finalMessage:failed
      ? `原 Agent 已完成“${task.title}”并提交${fileNames}。${profile.manualGap}后续补证由用户独立提交。`
      : `已完成“${task.title}”的${task.category}交付，共提交 ${files.length} 个文件：${fileNames}。内容覆盖${profile.focus}，本地质检通过。`
  };
}

function agentOutput(task,row,files){
  const copy=businessAcceptanceCopy(task,row);
  return {
    output:agentResultOutput(task,row,files),
    acceptance:{
      acceptanceId:`acceptance-${row.executionIndex}`,
      status:'PASSED',
      score:Number(row.agentScore),
      summary:copy.acceptanceSummary,
      issues:[copy.acceptanceIssues],
      failureReasons:[],
      improvementSuggestions:[copy.acceptanceImprovementSuggestions],
      details:{
        status:'PASSED',acceptanceStatus:'LOCAL_PASSED',
        score:Number(row.agentScore),summary:copy.acceptanceSummary,
        issues:[copy.acceptanceIssues],
        improvementSuggestions:[copy.acceptanceImprovementSuggestions]
      },
      mappedBusinessStatus:'reviewing',receivedAt:row.submittedAt
    }
  };
}

function manualOutput(task,row,agentFiles,manualFiles){
  const copy=businessAcceptanceCopy(task,row);
  const originalScore=62+hash(row.executionIndex,123)%17;
  const failureReasons=['原 Agent 本地质检未通过，不能以自动质检结果直接进入平台通过状态。'];
  return {
    output:agentResultOutput(task,row,agentFiles,true),
    acceptance:{
      acceptanceId:`acceptance-${row.executionIndex}`,
      status:'FAILED',score:originalScore,summary:copy.acceptanceSummary,
      issues:[copy.acceptanceIssues],failureReasons,
      improvementSuggestions:[copy.acceptanceImprovementSuggestions],
      details:{
        status:'FAILED',acceptanceStatus:'LOCAL_FAILED',score:originalScore,
        summary:copy.acceptanceSummary,issues:[copy.acceptanceIssues],failureReasons,
        improvementSuggestions:[copy.acceptanceImprovementSuggestions]
      },
      mappedBusinessStatus:'reviewing',receivedAt:row.submittedAt
    },
    manualSubmissions:[{
      submissionId:`manual-${row.executionIndex}`,
      submissionNo:1,source:'USER_MANUAL',status:'PENDING_REVIEW',
      description:copy.manualSubmissionDescription,
      reviewReason:null,submittedAt:row.submittedAt,reviewedAt:null,
      files:manualFiles.map(file=>({
        id:file.fileId,fileId:file.fileId,filename:file.name,
        mimeType:file.mimeType,sizeBytes:file.sizeBytes,sha256:file.sha256,
        sortOrder:file.sortOrder,downloadUrl:file.downloadUrl,createdAt:file.createdAt
      }))
    }]
  };
}

function submissionEnvelope(task,row,agentFiles,manualFiles,content){
  const files=[...agentFiles,...manualFiles];
  return {
    files,
    result:{
      executionId:row.executionId,executionNo:row.executionNo,taskId:row.taskId,
      executionStatus:'reviewing',reviewSource:row.reviewSource,
      artifacts:agentFiles.map(file=>({
        artifactId:file.artifactId,fileId:file.fileId,role:'DELIVERABLE',
        name:file.name,mimeType:file.mimeType,sizeBytes:file.sizeBytes,
        sha256:file.sha256,localRelativePath:file.name,
        receivedAt:row.submittedAt,downloadUrl:file.downloadUrl
      })),
      ...content,
      manualSubmissions:content.manualSubmissions??[]
    }
  };
}

function buildRealisticSubmission(task,row){
  const manual=row.reviewSource==='USER_MANUAL';
  const agentFiles=generatedFiles(task,row,false);
  const manualFiles=manual?generatedFiles(task,row,true):[];
  const content=manual
    ? manualOutput(task,row,agentFiles,manualFiles)
    : agentOutput(task,row,agentFiles);
  return submissionEnvelope(task,row,agentFiles,manualFiles,content);
}

function buildLegacySubmission(task,row){
  const manual=row.reviewSource==='USER_MANUAL';
  const agentFiles=legacyGeneratedFiles(task,row,false);
  const manualFiles=manual?legacyGeneratedFiles(task,row,true):[];
  const content=manual
    ? legacyManualOutput(task,row,agentFiles,manualFiles)
    : legacyAgentOutput(task,row,agentFiles);
  return submissionEnvelope(task,row,agentFiles,manualFiles,content);
}

export function buildBusinessExecutionSubmission(task,row,options={}){
  return options.realistic===true
    ? buildRealisticSubmission(task,row)
    : buildLegacySubmission(task,row);
}
