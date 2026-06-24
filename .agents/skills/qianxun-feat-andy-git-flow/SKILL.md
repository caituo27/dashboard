---
name: qianxun-feat-andy-git-flow
description: Use when the user asks to commit, pull main, merge main, push to feat/andy, or prepare Qianxun work for the remote feat/andy branch.
---

# Qianxun Feat Andy Git Flow

## Use This For

- 用户说“提交代码”“提交到远端”“推送到 feat/andy”。
- 用户说“拉 main”“合 main”“拉一下主分支”。
- 当前分支应保持在 `feat/andy`，并要把本地工作同步到 `origin/feat/andy`。

## Required Flow

1. 先确认状态：
   - `git status --short`
   - `git branch --show-current`
2. 提交前只暂存本次相关文件，不把 `.codex/worktrees`、`dist`、无关产物带进去。
3. 提交后如果用户要求拉 main：
   - `git fetch origin main`
   - 在 `feat/andy` 上 `git merge origin/main`
   - 有冲突时保留用户刚确认的本地产品/UI意图，同时吸收 main 的非冲突更新。
4. 合并后做受影响包的最小验证。只有用户要求、合并冲突涉及类型/构建、
   或准备发布/提测时才跑 H5 build；候选命令：
   - `pnpm --dir qianxun-h5-candidate build`
5. 合并提交完成后推送：
   - `git push origin feat/andy`

## Safety Rules

- 不使用 `git reset --hard` 或 `git checkout --` 回滚用户改动。
- 不在 `.codex/worktrees` 中提交业务代码。
- 如果当前不在 `feat/andy`，先说明并切回或请用户确认。
- 如果已有 dev server 正在跑，不为提交随手停掉，除非它阻塞验证或用户要求。
