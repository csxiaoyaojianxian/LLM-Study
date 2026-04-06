# 08-skill — Claude Skill 开发

> Slash Commands / Hooks / Custom Instructions / settings.json 配置详解

## 目录

- [概述](#概述)
- [运行方式](#运行方式)
- [四大定制能力](#四大定制能力)
- [项目结构](#项目结构)
- [快速安装](#快速安装)

## 概述

本模块教你定制 Claude Code 的行为和能力：

1. **Slash Commands** — 自定义 `/project:xxx` 和 `/user:xxx` 命令
2. **Hooks** — 自动化钩子（文件操作前后触发）
3. **Settings** — 权限控制、偏好配置、分层管理
4. **CLAUDE.md** — 项目级指令和上下文

## 运行方式

```bash
cd 08-skill
npm install

# 总览所有配置示例
npm run showcase

# Hook 机制详解 + 模拟测试
npm run hooks-demo

# Settings 层级与合并规则
npm run settings-explain

# 一键安装示例到 .claude/ 目录
npm run setup
```

## 四大定制能力

### 📝 Slash Commands

在 Claude Code 中输入 `/` 触发的自定义命令。

| 命令 | 作用域 | 用途 |
| --- | --- | --- |
| `/project:review` | 项目 | 代码审查 |
| `/project:test-gen` | 项目 | 测试生成 |
| `/project:doc-gen` | 项目 | 文档生成 |
| `/project:refactor` | 项目 | 重构建议 |
| `/project:explain` | 项目 | 代码解读 |
| `/user:daily-report` | 个人 | 日报生成 |
| `/user:commit-msg` | 个人 | Commit 信息 |

**安装位置**：
- 项目命令 → `.claude/commands/*.md`
- 个人命令 → `~/.claude/commands/*.md`

### 🪝 Hooks

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

### ⚙️ Settings

三层配置，优先级从高到低：
1. `.claude/settings.local.json` — 本地覆盖
2. `.claude/settings.json` — 项目级
3. `~/.claude/settings.json` — 全局

### 📋 CLAUDE.md

项目根目录的 Markdown 文件，Claude Code 启动时自动读取。本模块提供两个模板：
- `frontend-project.md` — 前端项目模板
- `backend-project.md` — 后端项目模板

## 项目结构

```
08-skill/
├── examples/
│   ├── commands/               # 项目级 Slash Command
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
│   ├── showcase.ts             # 总览所有配置
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
# 项目级命令
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
