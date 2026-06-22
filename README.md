# AI Config Rater

评估你的 AI 配置（Codex / Claude Code 等），从六个维度评分并生成雷达图。本地后端调用你本机的 `codex` CLI（走你的 ChatGPT/Codex 订阅，无需 API key）。

支持三种模式：

- **扫描目录（agent 模式）**：给一个目录绝对路径，Codex 进入该目录，用文件工具自动找出并通读相关配置文件（`AGENTS.md`、`CLAUDE.md`、`.codex/config.toml`、`.cursorrules` 等）后再综合评分。也接受单个文件路径。
- **粘贴文本**：直接粘贴或上传一段配置，单次评估，不读取任何文件。
- **对话评估（行为评估）**：选一个本机 AI（Codex / Claude Code），评估器向它提一组固定探针问题，根据它的**真实回答**打分。裁判固定用 Codex，保证评分标准统一。可选填项目目录让你的配置在被面试的 AI 上生效。接口 `POST /api/interview`（`{agent, dir?}`）、`GET /api/agents`（探测可用 CLI）。

## 评估维度

清晰度 · 完整性 · 安全性 · 可维护性 · 针对性 · 高效性

## 技术栈

前端 Vite + React + TypeScript + Tailwind v4 + framer-motion（雷达图用 react-chartjs-2）。
后端 Express，调用本机 `codex` CLI。UI 设计系统见 skill [`.claude/skills/lessie-ui`](.claude/skills/lessie-ui/SKILL.md)。

## 运行

前提：本机已安装并登录 Codex CLI（`codex` 命令可用，且能正常 `codex exec`）。

**生产 / 直接用：**

```bash
npm install
npm run build      # 构建前端到 dist/
npm start          # 起 Express，单端口托管 dist/ + API
```

打开 http://localhost:3100 。

**开发（前端热更新）：**

```bash
npm run dev        # 同时起 Express(3100) + Vite(5173，/api 代理到 3100)
```

开发时访问 http://localhost:5173 。

> 后端默认端口 3100。如需更改：`PORT=4000 npm start`。
> 注意：改了 `server.js` 后端代码需重启；改了前端代码 `npm run dev` 会热更新，`npm start` 模式需重新 `npm run build`。

## 工作原理

```
浏览器 ──POST /api/evaluate──> Express ──spawn `codex exec [-C <dir>] -o <file>`──> Codex
  {dir} 或 {config}                                                        (目录模式下自己读文件)
       <──── 六维评分 JSON ────                                            返回评估
```

后端代码见 [server.js](server.js)，前端在 [src/](src/)。评估 prompt 与维度定义在 `server.js` 顶部，可自行调整。
