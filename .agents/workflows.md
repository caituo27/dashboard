# Qianxun Workflows

这个文件统一管理千寻项目里的 Codex workflow。

workflow 是“让 Codex 按一套固定流程做事”的入口。
skill 是具体能力；workflow 可以组合多个 skill。

## 使用方式

在 prompt 里直接写：

```text
使用 <workflow-name>，<你的任务>
```

例如：

```text
使用 swagger-update-workflow，处理这次 Swagger 更新。
自动生成 API，找对应调用点，更新前端 service 和 mock server，最后说明协议变化。
```

## Workflow 列表

| Workflow                          | 什么时候用                                                                                           | 会用到的 skill                                                                                                                                     | 推荐 prompt                                                                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `swagger-update-workflow`         | Swagger / OpenAPI 更新，API 生成文件变化，需要同步前端调用、service adapter 和 mock server           | `using-superpowers`、`swagger-update-workflow`、`api-gen`、`qianxun-feature-completion`                                                            | `使用 swagger-update-workflow，处理这次 Swagger 更新。自动生成 API，找对应调用点，更新前端 service 和 mock server，最后说明协议变化。`         |
| `feature-completion-review`       | 检查某个功能有没有真的做完，哪些是假的、哪些只是 Toast、哪些没接 API                                 | `using-superpowers`、`qianxun-feature-completion`、`qianxun-human-handoff`                                                                         | `使用 feature-completion-review，检查「功能名」是否闭环，告诉我哪些是真的、哪些没做、后续人要改什么。`                                         |
| `bug-investigation-workflow`      | 排查页面、状态、接口、mock server 或 C/B 联动 bug，需要先复现和定位根因再修                          | `using-superpowers`、`systematic-debugging`、`qianxun-feature-completion`、必要时 `readable-react-code` / `qianxun-ui`                             | `使用 bug-investigation-workflow，排查「问题描述」。先复现和定位根因，再最小修改，最后给验证结果。`                                            |
| `mock-api-parity-review`          | 检查 mock server、generated API、service adapter、Zustand/page state 和 UI 期待是否一致              | `using-superpowers`、`qianxun-feature-completion`、`qianxun-human-handoff`                                                                         | `使用 mock-api-parity-review，检查「模块名」的 mock server、service adapter、页面数据结构是否一致。标出 Divergent / Local demo / Real。`       |
| `qianxun-change-verification`     | 新增、修改或删除功能 / 行为后，按影响面做最小验证；默认不跑完整 build/test，除非风险或用户要求       | `using-superpowers`、`test-driven-development`、`qianxun-change-verification`、必要时 `qianxun-ui`                                                 | `使用 qianxun-change-verification，验证当前改动。缺测试就补最小测试；UI 流程用浏览器点击检查，并记录不一致；不要默认跑完整 build/test。`       |
| `human-handoff-review`            | 扫 AI 写过的代码，输出人类接手清单                                                                   | `using-superpowers`、`qianxun-human-handoff`                                                                                                       | `使用 human-handoff-review，扫描「模块/页面」，告诉我 AI 做了什么、哪些没做、哪些是假数据、人下一步改哪里。`                                   |
| `readable-react-refactor`         | React / TSX / Zustand / service 代码太难读，需要保持行为不变重构                                     | `using-superpowers`、`readable-react-code`、必要时 `qianxun-ui`                                                                                    | `使用 readable-react-refactor，重构「文件/组件」，保持行为不变，让代码更适合人读，并更新对应 md 说明。`                                        |
| `qianxun-ui-polish`               | C 端或 B 端 H5 页面 UI 优化，需要符合千寻视觉规范                                                    | `using-superpowers`、`qianxun-ui`、必要时 `readable-react-code`                                                                                    | `使用 qianxun-ui-polish，优化「页面名」UI，保持千寻设计体系，不引入新的视觉风格。`                                                             |
| `qianxun-debug-handoff`           | 小程序拿到 `wxCode / phoneCode` 后，需要复制 H5 handoff 链接，让普通浏览器换 cookie 并继续调试 H5    | `using-superpowers`、`qianxun-debug-handoff`、必要时 `bug-investigation-workflow`                                                                  | `使用 qianxun-debug-handoff，跑 debug 模式，读取剪贴板 handoff 链接，改成 localhost 打开并确认当前用户。`                                      |
| `qianxun-feat-andy-git-flow`      | 提交、拉 main、合 main 或推送到远端 `feat/andy`，需要固定 Git 顺序和冲突处理口径                     | `using-superpowers`、`qianxun-feat-andy-git-flow`、必要时 `pre-merge-verification-workflow`                                                        | `使用 qianxun-feat-andy-git-flow，提交当前改动，拉 main 合并后推送到 feat/andy。`                                                              |
| `claude-ui-handoff`               | Claude Design / 外部 UI agent 已输出 design brief、prompt 或 HTML/CSS demo，需要转成千寻真实工程实现 | `using-superpowers`、`qianxun-ui`、`readable-react-code`、`qianxun-change-verification`、必要时 `qianxun-feature-completion`                       | `使用 claude-ui-handoff，根据「design brief / demo 路径」实现「页面名」UI。先判断是否需要更新 qianxun-ui 或页面验收文档，再实现、截图和测试。` |
| `tsx-handoff-docs`                | 给 TSX 文件补同目录 md，说明做了什么、没做什么                                                       | `using-superpowers`、`qianxun-human-handoff`                                                                                                       | `使用 tsx-handoff-docs，给「TSX 文件」生成对应 md，说明这个页面做了什么、哪些没做。`                                                           |
| `pre-merge-verification-workflow` | 交给人类 review、handoff、commit、merge、PR 或发布前才用，按实际 diff 做必要验证                     | `using-superpowers`、`verification-before-completion`、`qianxun-change-verification`、`qianxun-human-handoff`、必要时 `qianxun-feature-completion` | `使用 pre-merge-verification-workflow，检查当前改动是否可以交给人类合并。只跑 diff 和风险需要的验证命令，输出结果、剩余风险和需要打开的文件。` |

## Workflow 细节

### swagger-update-workflow

定义文件：

- `.agents/skills/swagger-update-workflow/SKILL.md`

目标：

- 自动处理 Swagger 更新后的完整链路。

固定步骤：

1. 看 `git status` / `git diff`，确认哪边 API 变了。
2. 必要时运行 API generator。
3. 总结协议变化：endpoint、operation、request、response、field、enum、required。
4. 搜索旧 operation / DTO / 字段名，找调用点。
5. 优先更新 service adapter，例如 `candidateApi.ts`。
6. 同步 `qianxun-mock-server`。
7. 只有在 generated API、service adapter 或跨包类型风险需要时，才跑受影响 H5 build。
8. 如果改了 TSX，更新同目录 md。
9. 输出协议变更和剩余风险。

### feature-completion-review

目标：

- 检查一个功能是否真的闭环。

固定步骤：

1. 找页面入口。
2. 找点击 handler。
3. 找 Zustand action 或页面局部 mutation。
4. 找 service adapter。
5. 找 generated API 或 mock server 路由。
6. 检查 mutation 后 UI 是否刷新。
7. 标注 `Done / Partial / Placeholder / Missing`。

### bug-investigation-workflow

定义文件：

- `.agents/skills/bug-investigation-workflow/SKILL.md`

目标：

- 对页面、状态、接口、mock server 或 C/B 联动问题做证据优先的根因排查。

固定步骤：

1. 记录用户可见问题和受影响端。
2. 用最小路径复现或证明失败。
3. 按 UI entry -> handler -> Zustand/page state -> service adapter -> generated API -> mock route/db -> UI refresh 追踪。
4. 标注 `Toast-only / Local demo / Hardcoded / Divergent / Missing` 风险。
5. 在最低正确层做最小修复。
6. 用原始症状或最小命令验证。
7. 输出根因、修复、验证和剩余风险。

### mock-api-parity-review

定义文件：

- `.agents/skills/mock-api-parity-review/SKILL.md`

目标：

- 检查一个功能的数据结构和行为是否在 UI、Zustand、service adapter、generated API、mock server 之间一致。

固定步骤：

1. 选定功能、实体、路由或 endpoint。
2. 对比页面 props/state、store action、service mapping、generated DTO、mock route、mock DB seed。
3. 使用 `Real / Local demo / Toast-only / Hardcoded / Divergent / Missing` 标注数据来源。
4. 找出字段、枚举、状态刷新、权限或 C/B 端共享模型差异。
5. 默认只审计；除非用户明确要求，否则不改代码。
6. 输出 contract trail、mismatch 和最小下一步。

### qianxun-change-verification

定义文件：

- `.agents/skills/qianxun-change-verification/SKILL.md`

目标：

- 新增、修改或删除功能后，按真实 diff 选择测试、浏览器点击和 build/check。
- 新增或修改测试时标注来源：产品 prompt / PRD、bug 回归、API 契约、代码不变量、设计规则或 smoke baseline。
- 可测逻辑缺测试时，先补最小测试用例，且不能只覆盖常规情况。
- UI / 产品流程改动必须用浏览器或 Playwright 风格点击路径验证，并记录不一致；边界情况也要检查移动端样式排版。

固定步骤：

1. 看 `git status` / `git diff --name-only`，确认改了哪些包。
2. 找产品来源：产品 prompt / PRD、验收用例文档、页面 `.md`、Swagger/API contract，或用户本次请求。
3. 判断用户要求是否和产品来源一致；如果不一致，先二次确认是否要修改产品 prompt / PRD，不要直接让代码偏离产品口径。
4. 如果确认需求变更，先更新产品来源或验收用例文档，再更新测试，再改代码；如果不变，按现有产品口径修实现。
5. 判断改动属于逻辑、UI 流程、service/store/hook/shared、跨端联动还是 mock server。
6. 先确认测试来源；不能把 agent 自己推导的 smoke baseline 说成产品验收。
7. 搜同领域现有测试；缺少可测逻辑测试时补最小用例，并包含有意义的边界条件。
8. 优先跑单文件或最小测试；只有风险无法隔离时才扩大到包级 test。
9. 对 UI / 流程改动打开本地 H5，点击关键路径，检查 console、网络、视觉遮挡和按钮结果；边界状态要优先看 375px 移动端排版，并按风险补 320px / 430px、长文案、空态、错误态、disabled/loading。
10. 更新文档前先按“模块 + 文档类型”找已有 md；同模块同类型更新同一份，不按日期重复新增；不同类型文档不要混在一起。
11. 如果本轮修复的是之前检查出来的 gap / 未覆盖项 / demo / placeholder / Toast-only / Hardcoded / Divergent / Missing，必须同步更新当时记录这些问题的 md 文档，不需要等用户再次提醒。
12. 更新验证报告和必要的 TSX 同目录说明文档，写清产品来源、测试来源、已覆盖项、未覆盖项和剩余风险。
13. 对没有 unit/e2e script 的包，先用浏览器/手工路径或静态检查；只有风险需要或用户要求时才跑最近的 build/check。

### human-handoff-review

目标：

- 让人类知道 AI 写了什么、没写什么。

固定输出：

```text
What is already real:
- ...

What is demo/placeholder:
- ...

Main risks:
- ...

Recommended next work:
1. ...
2. ...

Files to open first:
- path:line - why
```

### readable-react-refactor

目标：

- 保持行为不变，把 React / TSX 写得更适合人读。

固定要求：

- JSX 不要大段挤一行。
- handler / footer / render 分支要命名。
- 不在 JSX 里写复杂 async。
- 不为减少行数而抽象。
- 改重要 TSX 后更新同目录 md。

### qianxun-ui-polish

目标：

- 优化 UI，但不偏离千寻设计体系。

固定要求：

- 优先使用 `@qianxun/shared/ui`。
- 优先使用 design tokens。
- 不随意新增一套视觉语言。
- 移动端 375px 宽度优先；430px 作为宽屏补充检查。
- 检查文字溢出、按钮挤压、内容遮挡。

### claude-ui-handoff

目标：

- 把 Claude Design / 外部 UI agent 的审美方案转成千寻项目内可维护、可测试的真实 H5 代码。

固定步骤：

1. 读取 Claude 输出的 Design Brief、Codex Implementation Prompt 和 HTML/CSS demo。
2. 判断输出属于全局规则还是页面方案：全局规则更新 `qianxun-ui` skill 和 `assets/qx-design-system.css`；页面方案更新对应 design brief / 验收用例 / 页面 md。
3. 对照 `qianxun-ui` 检查冲突：禁止紫/粉/青、禁止纯白重阴影、`flow` 只能给 running、数字用 mono。
4. 生成实现计划：哪些改 shared tokens / shared UI，哪些改页面 TSX/CSS，哪些需要测试。
5. 实现时优先复用 `@qianxun/shared/ui`；不要直接粘贴 demo CSS。
6. 用 Browser 或 Playwright 在 320 / 375 / 430 检查页面，并覆盖长文案、空态、loading/error、按钮组尺寸一致性。
7. 更新相关 md，写清设计来源、覆盖状态和剩余风险。

### tsx-handoff-docs

目标：

- 给 TSX 旁边补 md 说明。

命名：

- `Example.tsx` -> `Example.md`
- `index.tsx` -> `index.md`

必须写：

- 这个 TSX 文件做什么。
- 已完成什么。
- 哪些没做。
- 哪些是 `Real / Local demo / Toast-only / Hardcoded / Divergent / Missing`。
- 数据来源。
- 主要交互。
- 后续接手建议。

### pre-merge-verification-workflow

定义文件：

- `.agents/skills/pre-merge-verification-workflow/SKILL.md`

目标：

- 在交给人类 review、handoff、commit、merge 或 PR 前，根据真实 diff 做最小但可信的验证。

固定步骤：

1. 看 `git status` / `git diff`，区分本次改动和用户已有改动。
2. 按改动面选择最小验证命令：浏览器检查、单文件测试、`node --check` 优先；H5/shared/weapp build 只在合并/发布风险或构建相关改动时跑。
3. 如果改了重要 TSX，确认同目录 md 说明存在。
4. 如果改了产品行为，叠加 `qianxun-feature-completion`。
5. 新鲜运行验证命令并读取结果。
6. 输出已验证、未验证、剩余风险和需要打开的文件。

## 新增 Workflow 的规则

新增 workflow 时：

1. 如果是复杂流程，优先创建 `.agents/skills/<workflow-name>/SKILL.md`。
2. 在本文件 `Workflow 列表` 增加一行。
3. 在 `AGENTS.md` 的默认约束里补一句触发规则。
4. workflow 名称使用 kebab-case，例如 `swagger-update-workflow`。
