# 08-skill — Claude Code Skills 与定制体系

> Skills（SKILL.md）/ Hooks / Settings / CLAUDE.md 全面讲解

## 目录

- [概述](#概述)
  - [什么是 Skills](#什么是-skills)
  - [本模块内容](#本模块内容)
- [Part 1: Skills（能力扩展系统）](#part-1-skills能力扩展系统)
  - [Skills 核心概念](#skills-核心概念)
  - [SKILL.md 文件结构](#skillmd-文件结构)
  - [Skills 存放位置与作用域](#skills-存放位置与作用域)
  - [调用控制](#调用控制)
  - [渐进式披露架构](#渐进式披露架构)
  - [Skills vs 旧版 Custom Commands](#skills-vs-旧版-custom-commands)
  - [内置 Bundled Skills](#内置-bundled-skills)
  - [运行 Demo](#运行-skills-demo)
- [Part 2: Hooks / Settings / CLAUDE.md](#part-2-hooks--settings--claudemd)
  - [四大定制能力协同](#四大定制能力协同)
  - [Hooks](#hooks)
  - [Settings](#settings)
  - [CLAUDE.md](#claudemd)
  - [运行 Demo](#运行-定制能力-demo)
- [项目结构](#项目结构)
- [快速安装](#快速安装)

## 概述

### 什么是 Skills

**Skills 是 Claude Code 的能力扩展系统**。创建一个包含 `SKILL.md` 的文件夹，Claude 就会把它加入工具箱。Claude 会在相关时自动使用 Skill，你也可以用 `/skill-name` 手动调用。

Skills 遵循 [Agent Skills](https://agentskills.io) 开放标准，已合并了旧版 Custom Commands（`.claude/commands/*.md`），是 Claude Code 定制能力的统一入口。

```
旧版: .claude/commands/review.md     → /project:review
新版: .claude/skills/review/SKILL.md → /review

旧版文件仍然有效，但 Skills 是推荐方式。
Skills 额外支持：目录结构、frontmatter 配置、自动触发、渐进式披露。
```

### 本模块内容

**Part 1 — Skills（能力扩展系统）**
- Skills 核心概念与 SKILL.md 文件结构
- 存放位置、作用域、调用控制
- 渐进式披露（Progressive Disclosure）三层架构
- 与旧版 Custom Commands 的对比
- 内置 Bundled Skills 介绍

**Part 2 — Hooks / Settings / CLAUDE.md（协同定制）**
- Hooks 自动化钩子
- Settings 权限配置
- CLAUDE.md 项目记忆
- 四者如何协同工作

---

## Part 1: Skills（能力扩展系统）

### Skills 核心概念

每个 Skill 是一个包含 `SKILL.md` 的目录：

```
my-skill/
├── SKILL.md           # 主指令文件（必需）
├── template.md        # 模板（可选）
├── examples/
│   └── sample.md      # 示例输出（可选）
└── scripts/
    └── validate.sh    # 可执行脚本（可选）
```

### SKILL.md 文件结构

```yaml
---
name: review                          # Skill 名称，也是 /slash-command 名
description: 审查代码质量和安全性       # Claude 据此决定何时自动加载
disable-model-invocation: false       # 是否禁止 Claude 自动调用
allowed-tools: Read Grep Glob         # Skill 激活时允许的工具
context: fork                         # 在独立子代理中运行
---

## 审查规则

1. 检查安全漏洞
2. 检查性能问题
3. 按严重程度分级：🔴 必须修复 / 🟡 建议 / 🟢 小问题
```

**常用 Frontmatter 字段：**

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `name` | 推荐 | 名称，kebab-case，也是 `/` 命令名 |
| `description` | 推荐 | 功能描述，Claude 据此自动匹配（建议 < 250 字符） |
| `disable-model-invocation` | 可选 | `true` = 仅手动 `/name` 触发 |
| `user-invocable` | 可选 | `false` = 不显示在 `/` 菜单，仅 Claude 自动调用 |
| `allowed-tools` | 可选 | Skill 激活时允许的工具 |
| `context` | 可选 | `fork` = 在独立子代理中运行 |
| `agent` | 可选 | 配合 `context: fork`，指定子代理类型 |
| `argument-hint` | 可选 | 参数提示，如 `[issue-number]` |
| `hooks` | 可选 | Skill 生命周期钩子 |
| `paths` | 可选 | Glob 模式，限制自动激活的文件范围 |

**变量替换：**

| 变量 | 说明 |
| --- | --- |
| `$ARGUMENTS` / `$0` `$1` ... | 调用时传入的参数 |
| `${CLAUDE_SESSION_ID}` | 当前会话 ID |
| `${CLAUDE_SKILL_DIR}` | Skill 目录路径 |
| `` !`command` `` | 预处理 shell 命令，输出替换到内容中 |

### Skills 存放位置与作用域

| 级别 | 路径 | 适用范围 |
| --- | --- | --- |
| Enterprise | managed settings | 组织内所有用户 |
| Personal | `~/.claude/skills/<name>/SKILL.md` | 你的所有项目 |
| Project | `.claude/skills/<name>/SKILL.md` | 仅当前项目 |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | 启用插件的项目 |

优先级：Enterprise > Personal > Project。同名 Skill 高优先级覆盖低优先级。

### 调用控制

| 配置 | 你可调用 | Claude 可调用 | 典型场景 |
| --- | --- | --- | --- |
| （默认） | ✅ | ✅ | 通用 Skill |
| `disable-model-invocation: true` | ✅ | ❌ | deploy / commit |
| `user-invocable: false` | ❌ | ✅ | 背景知识 / 约定 |

### 渐进式披露架构

Skills 采用三层按需加载，最大限度节省 token：

| 层级 | 加载时机 | 内容 | Token 量 |
| --- | --- | --- | --- |
| Layer 1 | 始终加载 | YAML frontmatter（name + description） | ~100 |
| Layer 2 | 匹配时加载 | SKILL.md 完整内容 | < 5000 |
| Layer 3 | 按需加载 | scripts/、templates/、references/ | 视文件大小 |

### Skills vs 旧版 Custom Commands

| 特性 | Custom Commands (旧) | Skills (新) |
| --- | --- | --- |
| 文件格式 | 单个 `.md` 文件 | `SKILL.md` + 目录 |
| 存放位置 | `.claude/commands/` | `.claude/skills/` |
| 调用方式 | `/project:name` 或 `/user:name` | `/name` |
| 自动触发 | ❌ 仅手动 | ✅ Claude 自动匹配 |
| 附属文件 | ❌ | ✅ 脚本/模板/参考 |
| Frontmatter | ❌ | ✅ 丰富配置 |
| 渐进式披露 | ❌ 全量加载 | ✅ 三层按需加载 |
| 子代理执行 | ❌ | ✅ `context: fork` |

> 旧版 `.claude/commands/*.md` 仍然有效，但推荐迁移到 Skills。

### 内置 Bundled Skills

Claude Code 自带的 Skills，每个会话都可用：

| Skill | 用途 |
| --- | --- |
| `/batch <instruction>` | 大规模并行改代码，每个单元在独立 worktree 中执行并开 PR |
| `/claude-api` | 加载 Claude API 参考文档（多语言 SDK） |
| `/debug [description]` | 开启 debug 日志并排查问题 |
| `/loop [interval] <prompt>` | 定时重复执行提示 |
| `/simplify [focus]` | 并行审查代码复用性/质量/效率 |

### 运行 Skills Demo

```bash
cd 08-skill
npm install

# Skills 概念讲解（无需 API Key）
npm run skill-concepts
```

---

## Part 2: Hooks / Settings / CLAUDE.md

Skills 不是孤立的，它与 Hooks / Settings / CLAUDE.md 协同构成完整的定制体系。

### 四大定制能力协同

```
CLAUDE.md   → 告诉 Claude「你在哪个项目、有什么规范」
Skills      → 告诉 Claude「你能做什么、怎么做」
Hooks       → 告诉 Claude「操作前后自动执行什么」
Settings    → 告诉 Claude「你的权限边界在哪里」
```

### Hooks

| Hook 类型 | 触发时机 | 能力 |
| --- | --- | --- |
| `PreToolUse` | 工具调用前 | 可阻止操作 |
| `PostToolUse` | 工具调用后 | 后处理 |
| `Notification` | 通知发送时 | 自定义通知 |
| `Stop` | 循环结束时 | 清理/验证 |

本模块提供的 Hook 示例：
- `pre-write-guard.sh` — 禁止写入敏感文件
- `post-edit-format.sh` — 编辑后自动格式化
- `post-commit-notify.sh` — 提交后通知

> 💡 Skills 也可以自带 Hooks（通过 `hooks` frontmatter 字段），作用域限定在 Skill 生命周期内。

### Settings

三层配置，优先级从高到低：
1. `.claude/settings.local.json` — 本地覆盖（不提交 git）
2. `.claude/settings.json` — 项目级（团队共享）
3. `~/.claude/settings.json` — 全局

### CLAUDE.md

项目根目录的 Markdown 文件，Claude Code 启动时自动读取。本模块提供两个模板：
- `frontend-project.md` — 前端项目模板
- `backend-project.md` — 后端项目模板

### 运行定制能力 Demo

```bash
cd 08-skill
npm install

# 总览所有配置示例（Slash Commands / Hooks / Settings / CLAUDE.md）
npm run showcase

# Hook 机制详解 + 模拟测试
npm run hooks-demo

# Settings 层级与合并规则
npm run settings-explain

# 一键安装示例到 .claude/ 目录
npm run setup
```

## 项目结构

```
08-skill/
├── examples/
│   ├── commands/               # 项目级 Slash Command（旧版，仍可用）
│   │   ├── review.md           # 代码审查
│   │   ├── test-gen.md         # 测试生成
│   │   ├── doc-gen.md          # 文档生成
│   │   ├── refactor.md         # 重构建议
│   │   └── explain.md          # 代码解读
│   ├── user-commands/          # 个人全局命令
│   │   ├── daily-report.md     # 日报
│   │   └── commit-msg.md       # Commit 信息
│   ├── hooks/                  # Hook 脚本
│   │   ├── pre-write-guard.sh  # 禁止写入敏感文件
│   │   ├── post-edit-format.sh # 编辑后自动格式化
│   │   └── post-commit-notify.sh
│   ├── settings/               # settings.json 示例
│   │   ├── global-settings.json
│   │   ├── project-settings.json
│   │   └── local-settings.json
│   └── claude-md/              # CLAUDE.md 模板
│       ├── frontend-project.md
│       └── backend-project.md
├── src/
│   ├── skill-concepts.ts       # Skills 概念讲解（Part 1）
│   ├── showcase.ts             # 总览所有配置（Part 2）
│   ├── setup.ts                # 一键安装
│   ├── hooks-demo.ts           # Hook 机制讲解
│   └── settings-explain.ts     # Settings 层级详解
├── package.json
├── tsconfig.json
└── README.md
```

## 快速安装

```bash
# 一键安装所有示例到当前模块的 .claude/ 目录
npm run setup
```

手动安装到你的项目：

```bash
# 项目级命令（旧版 commands 格式，仍可用）
mkdir -p <your-project>/.claude/commands
cp examples/commands/*.md <your-project>/.claude/commands/

# 全局命令
mkdir -p ~/.claude/commands
cp examples/user-commands/*.md ~/.claude/commands/

# Hook 脚本
mkdir -p <your-project>/.claude/hooks
cp examples/hooks/*.sh <your-project>/.claude/hooks/
chmod +x <your-project>/.claude/hooks/*.sh

# 配置
cp examples/settings/project-settings.json <your-project>/.claude/settings.json

# CLAUDE.md 模板
cp examples/claude-md/frontend-project.md <your-project>/CLAUDE.md
```
