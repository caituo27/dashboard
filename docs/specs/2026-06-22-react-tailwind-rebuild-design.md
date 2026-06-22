# AI Config Rater — React + Tailwind 重构设计

日期：2026-06-22

## 目标
把现有的原生 HTML/JS 前端重构为 Vite + React + TypeScript + Tailwind v4，
还原 lessie.ai 的浅色「极光」动态风格，并把这套风格抽成一个**仅本项目**的设计 skill，
供后续在本项目新建页面时复用。后端 Express + Codex 评估逻辑保持不变。

## 技术栈
- Vite + React 18 + TypeScript
- Tailwind v4（CSS-first 配置，设计令牌写在 `@theme`）
- framer-motion（进场/滚动淡入、轮播词）
- react-chartjs-2 + chart.js（六维雷达图）
- concurrently（dev 同时起后端 + Vite）

## 项目结构
```
agentDemo/
  server.js          # 后端不变；静态目录 public/ -> dist/，加 SPA 兜底
  vite.config.ts     # react + tailwind 插件；/api 代理到 :3100
  tsconfig*.json
  index.html         # Vite 入口
  src/
    main.tsx, App.tsx
    index.css        # @import tailwindcss + @theme 令牌 + keyframes
    types.ts
    lib/api.ts       # evaluate() 封装
    components/
      Aurora, NavBar, Hero, Evaluator, Results, RadarChart
      ui/ PillButton, Card, ModeTabs
  .claude/skills/lessie-ui/SKILL.md
```

## 设计令牌（@theme）
- 颜色：`--color-bg/ink/ink-soft/line/card/pill/accent` + 极光 4 色
- 字体：`--font-serif`(Instrument Serif，大标题/斜体强调)、`--font-sans`(Inter)
- 圆角 `--radius-card`、柔和阴影 `--shadow-soft`
- 动画：`aurora-drift`、`fade-up`

## 动态
- Aurora：4 团径向渐变缓慢漂移/呼吸（CSS keyframes）
- Hero 轮播词：italic 衬线词每 ~2.2s 切换，淡入淡出（framer-motion AnimatePresence）
- 进场/滚动：区块 `whileInView` 上滑淡入
- 结果：雷达图 + 分数条进场动画

## 交互（沿用现有后端契约）
- 模式切换：扫描目录 / 粘贴文本
- 目录模式输入框接受目录或单文件路径
- POST `/api/evaluate`，body `{dir}` 或 `{config}`
- 渲染：综合分 + 六维雷达 + 维度分数条&点评 + 总评 + 改进建议

## 运行
- `npm run dev`：concurrently 起 Express(3100) + Vite(5173，/api 代理)
- `npm run build`：vite build -> dist/
- `npm start`：Express 托管 dist/ + API（单端口 3100）

## Skill：lessie-ui（仅本项目）
记录：何时用 → 令牌清单 → 字体规则 → 核心组件用法 → 动画模式 → Do/Don't。
以 `src/index.css` 的令牌与 `components/ui` 为单一事实源。
