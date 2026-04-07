# AI应用开发实践系列(第8期)—Claude Code Skills定制体系

本系列面向传统web应用开发者，聚焦AI应用开发的实战技能。
本期是系列终篇，我们跳出"调用AI"的视角，转而聚焦"定制AI"——讲解如何通过 Skills / Hooks / Settings / CLAUDE.md 四大机制，将 Claude Code 从通用编码助手打造成你的专属 AI 开发伙伴。
源代码：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/08-skill](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/08-skill)

> 📚 **系列导航**（共8期）
>
> | 期数 | 主题 | 核心内容 |
> | --- | --- | --- |
> | 第1期 | 从零构建智能聊天应用 | HTML + API + AI SDK + Function Calling |
> | 第2期 | Prompt Engineering | 提示词模板 + 结构化输出 + 思维链 |
> | 第3期 | RAG 检索增强生成 | 分块 + 向量化 + 检索 + 多轮对话 |
> | 第4期 | Agent 智能体 | ReAct + 工具调用 + 规划与执行 |
> | 第5期 | MCP 协议 | 模型上下文协议 + 工具服务化 |
> | 第6期 | LangChain 应用框架 | Chain + Memory + Agent + RAG 集成 |
> | 第7期 | 模型微调与部署 | LoRA + 量化 + 推理优化 |
> | **第8期** | **Claude Code Skills 定制体系** | **Skills + Hooks + Settings + CLAUDE.md** |

## 一、从 Copilot 到个人专家

### 1.1 AI 编程助手的进化

回顾这两年 AI 编程助手的发展路径：

```
2022  GitHub Copilot      → 单行/多行代码补全
2023  ChatGPT + Cursor    → 对话式编程，上下文理解
2024  Agentic Coding      → 自主规划、多步骤执行
2025  Claude Code + Skills → 可定制的 AI 开发伙伴
```

早期的 AI 助手像一把"瑞士军刀"——功能多但每一项都是通用的。而今天我们真正需要的，是一个**了解你的项目、遵守你的规范、执行你的流程**的"专属工匠"。

### 1.2 Claude Code 的定位

Claude Code 不只是代码补全工具，它是一个**可深度定制的 AI 开发伙伴**。通过四大机制，你可以：

| 机制 | 类比 | 作用 |
| --- | --- | --- |
| **CLAUDE.md** | 员工手册 | 告诉 AI 项目背景、技术栈、编码规范 |
| **Skills** | 技能证书 | 教会 AI 执行特定任务（审查、部署、生成文档） |
| **Hooks** | 自动化流水线 | 操作前后自动触发检查、格式化、通知 |
| **Settings** | 门禁系统 | 控制 AI 的权限边界（能做什么、不能做什么） |

这就像给一个新员工入职：先给他项目手册（CLAUDE.md），再培训专业技能（Skills），配上自动化工具（Hooks），最后设好权限（Settings）。

## 二、Skills — Claude Code 的能力扩展系统

### 2.0 Skills 是什么

**Skills 是 Claude Code 的能力扩展系统。** 创建一个包含 `SKILL.md` 的文件夹，Claude 就会把它加入工具箱。Claude 会在相关时自动使用 Skill，你也可以用 `/skill-name` 手动调用。

Skills 遵循 [Agent Skills](https://agentskills.io) 开放标准，已合并了旧版 Custom Commands（`.claude/commands/*.md`），是 Claude Code 定制能力的**统一入口**。

```
旧版: .claude/commands/review.md     → /project:review
新版: .claude/skills/review/SKILL.md → /review

旧版文件仍然有效，但 Skills 是推荐方式。
Skills 额外支持：目录结构、frontmatter 配置、自动触发、渐进式披露。
```

### SKILL.md 文件结构

每个 Skill 的核心是 `SKILL.md` 文件，由 **YAML frontmatter**（元数据配置）和 **Markdown 内容**（操作指令）两部分组成：

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

审查对象: $ARGUMENTS
```

**Frontmatter 完整字段说明：**

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `name` | 推荐 | Skill 名称，kebab-case 格式，也是 `/` 命令名 |
| `description` | 推荐 | 功能描述，Claude 据此自动匹配（建议 < 250 字符） |
| `disable-model-invocation` | 可选 | `true` = 仅手动 `/name` 触发，Claude 不会自动调用 |
| `user-invocable` | 可选 | `false` = 不显示在 `/` 菜单，仅 Claude 自动调用 |
| `allowed-tools` | 可选 | Skill 激活时允许使用的工具列表 |
| `context` | 可选 | `fork` = 在独立子代理中运行，不污染主会话上下文 |
| `agent` | 可选 | 配合 `context: fork`，指定子代理类型（如 Explore） |
| `argument-hint` | 可选 | 参数提示，如 `[issue-number]`，自动补全时显示 |
| `hooks` | 可选 | Skill 自带的生命周期钩子 |
| `paths` | 可选 | Glob 模式，限制自动激活的文件范围 |

**目录结构：**

一个完整的 Skill 不仅仅是一个文件，而是一个目录：

```
my-skill/
├── SKILL.md           # 主指令文件（必需）
├── template.md        # 模板文件（可选）
├── examples/
│   └── sample.md      # 示例输出（可选）
└── scripts/
    └── validate.sh    # 可执行脚本（可选）
```

**变量替换：**

| 变量 | 说明 |
| --- | --- |
| `$ARGUMENTS` / `$0` `$1` ... | 调用时传入的参数 |
| `${CLAUDE_SESSION_ID}` | 当前会话 ID |
| `${CLAUDE_SKILL_DIR}` | Skill 目录路径 |
| `` !`command` `` | 预处理 shell 命令，输出替换到内容中 |

### 2.1 存放位置与作用域

Skills 的存放位置决定了**谁能使用**：

| 级别 | 路径 | 适用范围 |
| --- | --- | --- |
| Enterprise（企业） | managed settings 管理 | 组织内所有用户 |
| Personal（个人） | `~/.claude/skills/<name>/SKILL.md` | 你的所有项目 |
| Project（项目） | `.claude/skills/<name>/SKILL.md` | 仅当前项目 |
| Plugin（插件） | `<plugin>/skills/<name>/SKILL.md` | 启用插件的项目 |

**优先级规则：Enterprise > Personal > Project**。同名 Skill，高优先级覆盖低优先级。Plugin Skill 使用 `plugin-name:skill-name` 命名空间，不会冲突。

**Monorepo 支持：** 在子目录工作时，Claude 自动发现嵌套的 `.claude/skills/`。例如编辑 `packages/frontend/` 下的文件时，也会加载 `packages/frontend/.claude/skills/` 中的 Skill。

### 2.2 调用控制

Skill 的调用方有两个：**你（手动 `/name`）** 和 **Claude（自动匹配）**。通过 frontmatter 可以精确控制：

| frontmatter 配置 | 你可调用 | Claude 可调用 | 典型场景 |
| --- | --- | --- | --- |
| （默认） | ✅ | ✅ | 通用 Skill（代码审查、解释代码） |
| `disable-model-invocation: true` | ✅ | ❌ | 危险操作（deploy、commit、发布） |
| `user-invocable: false` | ❌ | ✅ | 背景知识、内部约定、自动检查 |

**为什么需要 `disable-model-invocation`？** 想象一下，你有一个 `/deploy` Skill，如果 Claude 在聊天中误判"用户想部署"而自动触发，后果不堪设想。设为 `true` 后，只有你手动输入 `/deploy` 才会执行。

**为什么需要 `user-invocable: false`？** 有些 Skill 是给 Claude 的"背景知识"，比如团队的代码风格约定。你不需要手动调用它，但 Claude 在写代码时会自动参考。

### 2.3 渐进式披露架构

Skills 的设计非常精妙——**三层按需加载**，最大限度节省 token：

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 1: 元数据（约 100 tokens）              ← 始终加载      │
│ ─────────────────────────────────────────────                │
│ 只读取 YAML frontmatter 的 name + description               │
│ Claude 扫描所有 Skill，判断哪个与当前任务相关                 │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: 主指令（< 5000 tokens）              ← 匹配时加载   │
│ ─────────────────────────────────────────────                │
│ Claude 判断某个 Skill 相关后，加载完整 SKILL.md 内容          │
│ 包含操作步骤、规则约束、输出格式等                            │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: 附属资源                              ← 按需加载    │
│ ─────────────────────────────────────────────                │
│ scripts/、templates/、references/ 中的文件                   │
│ 仅在 Claude 执行具体步骤时才读取                              │
└──────────────────────────────────────────────────────────────┘
```

**Token 效率对比：**

| 方案 | 10 个命令的 Token 消耗 | 说明 |
| --- | --- | --- |
| 旧版 Custom Commands | ~50,000 tokens | 全量加载所有命令内容 |
| Skills 渐进式披露 | ~1,000 + 按需加载 | 仅加载元数据 + 匹配到的 Skill |

上下文占用降低 **80%+**，这对于长会话来说意义重大。

### 2.4 内置 Bundled Skills

Claude Code 自带以下 Bundled Skills，每个会话都可直接使用：

| Skill | 用途 |
| --- | --- |
| `/batch <instruction>` | 大规模并行改代码，每个单元在独立 worktree 中执行并开 PR |
| `/claude-api` | 加载 Claude API 参考文档（支持多语言 SDK） |
| `/debug [description]` | 开启 debug 日志并排查问题 |
| `/loop [interval] <prompt>` | 定时重复执行提示（如每 5 分钟检查部署状态） |
| `/simplify [focus]` | 并行审查最近修改的代码，检查复用性/质量/效率 |

Bundled Skills 和自定义 Skills 的工作方式一致——它们本质上都是给 Claude 一个详细的 playbook（操作手册），Claude 据此派生并行 agent、读取文件、适配你的代码库。

### 2.5 动态上下文注入

Skill 中可以用 `` !`command` `` 语法在**发送给 Claude 前**执行 shell 命令，将输出动态替换到内容中：

```yaml
---
name: pr-summary
description: Summarize PR changes
context: fork
agent: Explore
---

## PR Context
- Diff: !`gh pr diff`
- Comments: !`gh pr view --comments`

Summarize this pull request focusing on:
1. What changed and why
2. Potential risks
3. Suggested reviewers
```

当你执行 `/pr-summary` 时，Claude 收到的不是 `` !`gh pr diff` `` 这段文字，而是实际的 diff 内容。这让 Skill 能根据**当前环境状态**动态注入上下文，非常强大。

## 三、Hooks — 事件驱动的自动化

Hooks 是 Claude Code 的自动化钩子系统，类似 Git Hooks，但针对的是 **Claude 的工具调用**。

### 3.1 Hook 类型

```
用户请求 → Claude 决策 → [PreToolUse] → 工具执行 → [PostToolUse] → 返回结果
                            ↓ (可阻止)                   ↓ (可后处理)
                         阻止执行                      格式化/通知/记录

Agent 循环结束时 → [Stop]          通知发送时 → [Notification]
```

| Hook 类型 | 触发时机 | 能力 | 典型场景 |
| --- | --- | --- | --- |
| `PreToolUse` | 工具调用前 | 可阻止操作 | 禁止写入 .env、限制危险命令 |
| `PostToolUse` | 工具调用后 | 后处理 | 自动格式化、提交通知、记录日志 |
| `Notification` | 通知发送时 | 自定义通知 | 发送到 Slack/飞书/邮件 |
| `Stop` | Agent 循环结束时 | 清理/验证 | 运行测试、检查代码规范 |

### 3.2 实战示例

**示例1：写入保护（PreToolUse）**

阻止 Claude 修改敏感文件：

```bash
#!/bin/bash
# pre-write-guard.sh — 禁止写入敏感文件
# Hook 类型: PreToolUse (Write/Edit)

# 从 stdin 读取 JSON 输入
INPUT=$(cat)

# 提取文件路径
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
params = data.get('tool_input', {})
print(params.get('file_path', params.get('path', '')))
" 2>/dev/null)

# 受保护的文件模式
PROTECTED_PATTERNS=(".env" "credentials" "secrets" "private_key" "*.pem" "*.key")

# 检查是否匹配
for pattern in "${PROTECTED_PATTERNS[@]}"; do
  case "$FILE_PATH" in
    *"$pattern"*)
      # 输出 JSON 阻止操作
      echo '{"decision": "block", "reason": "🔒 安全防护: 禁止修改敏感文件 '"$FILE_PATH"'"}'
      exit 0
      ;;
  esac
done

exit 0
```

关键点：**PreToolUse** 脚本通过 stdout 输出 `{"decision": "block", "reason": "..."}` 即可阻止操作。

**示例2：自动格式化（PostToolUse）**

编辑文件后自动运行 Prettier：

```bash
#!/bin/bash
# post-edit-format.sh — 编辑后自动格式化
# Hook 类型: PostToolUse (Write/Edit)

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
params = data.get('tool_input', {})
print(params.get('file_path', params.get('path', '')))
" 2>/dev/null)

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    if command -v npx &> /dev/null; then
      npx prettier --write "$FILE_PATH" 2>/dev/null
    fi
    ;;
  *.py)
    if command -v black &> /dev/null; then
      black "$FILE_PATH" 2>/dev/null
    fi
    ;;
esac

exit 0
```

**示例3：提交通知（PostToolUse）**

git commit 后自动输出提交信息，还可以扩展为发送到 Webhook：

```bash
#!/bin/bash
# post-commit-notify.sh — 提交后通知
# Hook 类型: PostToolUse (Bash)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('tool_input', {}).get('command', ''))
" 2>/dev/null)

case "$COMMAND" in
  *"git commit"*)
    COMMIT_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null)
    COMMIT_HASH=$(git log -1 --pretty=format:"%h" 2>/dev/null)
    BRANCH=$(git branch --show-current 2>/dev/null)

    if [ -n "$COMMIT_HASH" ]; then
      echo "📦 提交成功！分支: $BRANCH | Hash: $COMMIT_HASH | 消息: $COMMIT_MSG"
      # 可选: 发送到 Slack/飞书 Webhook
      # curl -s -X POST "$WEBHOOK_URL" -d "{\"text\": \"[$BRANCH] $COMMIT_HASH: $COMMIT_MSG\"}"
    fi
    ;;
esac

exit 0
```

### 3.3 Hook 配置方式

在 `settings.json` 中注册 Hook：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/pre-write-guard.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/post-edit-format.sh"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/post-commit-notify.sh"
          }
        ]
      }
    ]
  }
}
```

- `matcher`：正则匹配工具名称（`Write|Edit` 匹配写入和编辑操作）
- Hook 脚本通过 **stdin** 接收 `{tool_name, tool_input}` JSON
- PreToolUse 脚本通过 **stdout** 返回 `{decision, reason}` JSON

> 💡 **Skill 自带 Hooks：** Skills 也可以通过 `hooks` frontmatter 字段声明自己的钩子，作用域限定在 Skill 生命周期内，不会影响全局。

## 四、Settings — 权限控制

### 4.1 三层配置体系

Claude Code 使用三层 `settings.json` 配置，优先级从高到低：

```
优先级高 ─────────────────────────────── 优先级低

┌─────────────────────┐
│ settings.local.json │  ← 本地覆盖（不提交 git）
│ .claude/            │     个人开发环境特殊配置
└─────────┬───────────┘
          │ 覆盖
┌─────────▼───────────┐
│ settings.json       │  ← 项目级（提交到 git）
│ .claude/            │     团队共享的项目配置
└─────────┬───────────┘
          │ 覆盖
┌─────────▼───────────┐
│ settings.json       │  ← 全局（所有项目通用）
│ ~/.claude/          │     个人默认偏好
└─────────────────────┘
```

### 4.2 permissions 的 allow/deny

`permissions` 控制 Claude 可以使用哪些工具：

**allow 列表（白名单）—— 允许 Claude 自动使用，无需每次确认：**

```json
{
  "permissions": {
    "allow": [
      "Read",                  // 允许读取文件
      "Glob",                  // 允许文件搜索
      "Grep",                  // 允许内容搜索
      "Bash(npm run *)",       // 允许运行 npm 脚本
      "Bash(git *)",           // 允许 git 操作
      "Write(src/**)",         // 允许写入 src 目录
      "Edit(src/**)"           // 允许编辑 src 目录
    ]
  }
}
```

**deny 列表（黑名单）—— 永远禁止的操作：**

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf *)",           // 禁止删除操作
      "Bash(git push --force *)", // 禁止强制推送
      "Write(.env*)",             // 禁止写入环境变量文件
      "Bash(curl * | bash)"       // 禁止管道执行
    ]
  }
}
```

### 4.3 合并规则

当多层配置同时存在时：

| 字段 | 合并方式 | 说明 |
| --- | --- | --- |
| `permissions.allow` | **取并集** | 所有层级的 allow 合并 |
| `permissions.deny` | **取并集** | 所有层级的 deny 合并 |
| `hooks` | 同 matcher 高优先级覆盖 | 项目级覆盖全局同 matcher 的 hook |
| 其他字段 | 高优先级覆盖低优先级 | 如 preferences |

⚠️ **deny 优先于 allow：** 当同一操作同时出现在 allow 和 deny 中时，deny 生效。这保证了安全策略不会被意外绕过。

合并示例：

```
全局 allow:  [Read, Glob, Grep]
项目 allow:  [Bash(npm run *), Write(src/**)]
本地 allow:  [Bash(docker *)]
───────────────────────────────────────
合并后 allow: [Read, Glob, Grep, Bash(npm run *), Write(src/**), Bash(docker *)]

项目 deny:   [Bash(rm -rf *), Write(.env*)]
───────────────────────────────────────
合并后 deny:  [Bash(rm -rf *), Write(.env*)]
```

### 4.4 常用配置模式

**🔒 安全优先型（生产项目）：**

```json
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep"],
    "deny": ["Bash(rm *)", "Bash(git push *)", "Write(.env*)"]
  }
}
```

**🚀 开发宽松型（个人项目）：**

```json
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep", "Write", "Edit", "Bash(npm *)", "Bash(git *)"],
    "deny": ["Bash(rm -rf /)"]
  }
}
```

**🏭 CI/CD 型（自动化流水线）：**

```json
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep", "Bash(npm run test)", "Bash(npm run build)"],
    "deny": ["Write", "Edit", "Bash(git push *)"]
  }
}
```

## 五、CLAUDE.md — 项目记忆

### 5.1 项目级指令文件

`CLAUDE.md` 是放在项目目录中的 Markdown 文件，Claude Code 启动时**自动读取**，作为项目上下文。它可以分层存在：

| 位置 | 作用 |
| --- | --- |
| 项目根目录 `CLAUDE.md` | 团队共享的项目上下文 |
| 子目录 `CLAUDE.md` | 模块级别的补充说明 |
| 父目录 `CLAUDE.md` | 工作区级别（Monorepo 场景） |

### 5.2 与 Skills 的互补

CLAUDE.md 和 Skills 定位不同，互相补充：

| 维度 | CLAUDE.md | Skills |
| --- | --- | --- |
| 定义的是 | **上下文**（你在哪） | **能力**（你能做什么） |
| 加载时机 | 启动时自动加载 | 匹配时按需加载 |
| 格式 | 纯 Markdown | YAML frontmatter + Markdown |
| 典型内容 | 技术栈、项目结构、编码规范 | 代码审查流程、部署步骤、生成模板 |

### 5.3 模板示例

**前端项目 CLAUDE.md 模板：**

```markdown
# CLAUDE.md — 前端项目

## 技术栈
- **框架**: React 18 / Next.js 14 (App Router)
- **语言**: TypeScript 5
- **样式**: Tailwind CSS / CSS Modules
- **测试**: Vitest + Testing Library

## 开发命令
npm run dev       # 开发服务器
npm run build     # 生产构建
npm run lint      # ESLint 检查
npm run test      # 运行测试

## 项目结构
src/
├── app/              # Next.js App Router 页面
├── components/       # React 组件（ui/ + features/）
├── hooks/            # 自定义 Hooks
├── lib/              # 工具函数
└── types/            # TypeScript 类型定义

## 编码规范
- 组件使用函数式组件 + Hooks
- 命名: 组件 PascalCase，函数 camelCase，常量 UPPER_SNAKE_CASE
- 使用 'use client' 标记客户端组件
- 所有 API 调用通过 /api 路由代理

## 注意事项
- 不要修改 next.config.js 除非明确要求
- 环境变量以 NEXT_PUBLIC_ 前缀暴露给客户端
```

**后端项目 CLAUDE.md 模板：**

```markdown
# CLAUDE.md — 后端项目

## 技术栈
- **运行时**: Node.js 20 LTS
- **框架**: Express / NestJS
- **语言**: TypeScript 5
- **数据库**: PostgreSQL + Prisma ORM
- **测试**: Jest + Supertest

## 开发命令
npm run dev       # 开发模式（热重载）
npm run build     # TypeScript 编译
npm run test      # 运行测试
npm run migrate   # 数据库迁移

## 编码规范
- 遵循三层架构: Controller → Service → Repository
- 错误处理统一通过错误中间件
- 数据校验使用 Zod schema
- 日志使用 pino，不要使用 console.log

## API 规范
- RESTful 风格，使用 HTTP 动词
- 响应格式: { code: number, data: T, message: string }
- 认证: Bearer Token in Authorization header

## 注意事项
- 不要直接操作数据库，通过 Prisma Client
- 敏感配置通过环境变量，不要硬编码
- SQL 查询必须参数化，防止注入
```

## 六、四大机制协同工作

### 6.1 全景图

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Claude Code 定制体系全景                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────────┐     ┌──────────────────────────┐         │
│   │ 📋 CLAUDE.md          │     │ 🧩 Skills (SKILL.md)     │         │
│   │ "你在哪个项目"        │     │ "你能做什么"              │         │
│   │                       │     │                           │         │
│   │ • 技术栈 & 项目结构   │     │ • /review 代码审查        │         │
│   │ • 编码规范 & 约定     │     │ • /deploy 部署应用        │         │
│   │ • 构建/运行命令       │     │ • /test-gen 生成测试      │         │
│   │ • 启动时自动加载      │     │ • 自动匹配 + 手动调用     │         │
│   └──────────┬────────────┘     └──────────┬────────────────┘         │
│              │                              │                         │
│              ▼                              ▼                         │
│   ┌──────────────────────────────────────────────────────┐           │
│   │                   Claude Code 运行时                  │           │
│   │                                                       │           │
│   │  CLAUDE.md 提供上下文 → Skills 提供能力 →             │           │
│   │  Hooks 自动化操作 → Settings 控制边界                 │           │
│   └──────────────────────────────────────────────────────┘           │
│              ▲                              ▲                         │
│              │                              │                         │
│   ┌──────────┴────────────┐     ┌──────────┴────────────────┐         │
│   │ 🪝 Hooks              │     │ ⚙️  Settings               │         │
│   │ "操作前后做什么"       │     │ "权限边界在哪"             │         │
│   │                       │     │                           │         │
│   │ • PreToolUse 写入防护 │     │ • allow: 白名单           │         │
│   │ • PostToolUse 自动格式│     │ • deny: 黑名单            │         │
│   │ • Notification 通知   │     │ • 三层优先级合并          │         │
│   │ • Stop 循环结束清理   │     │ • deny 优先于 allow       │         │
│   └───────────────────────┘     └───────────────────────────┘         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 协作流程示例

假设你在一个 React 项目中让 Claude 审查代码并修复问题：

```
1️⃣  Claude Code 启动
   → 读取 CLAUDE.md，了解到这是 React 18 + TypeScript 项目

2️⃣  你输入 "/review src/auth.ts"
   → Skills 系统匹配到 review Skill，加载审查规则

3️⃣  Claude 读取文件、生成审查报告
   → Settings 允许 Read、Grep（在 allow 列表中）

4️⃣  Claude 修复问题，写入文件
   → PreToolUse Hook 检查：不是敏感文件 ✅ 放行
   → 文件写入成功
   → PostToolUse Hook 自动运行 prettier 格式化

5️⃣  Claude 提交代码
   → Settings 允许 Bash(git *)
   → PostToolUse Hook 输出提交信息通知
```

四大机制各司其职，无缝协作。

## 七、系列总结

### 7.1 八期完整学习路线回顾

回顾整个系列，我们走过了一条从"调用AI"到"定制AI"的完整路径：

```
第1期  ┌─────────────────────┐  从零开始
       │ HTML + API + AI SDK │  → 学会调用大模型 API
       │ Function Calling    │  → 让 AI 拥有"双手"
       └─────────┬───────────┘
                 ▼
第2期  ┌─────────────────────┐  提升质量
       │ Prompt Engineering  │  → 结构化提示词
       │ 思维链 + 结构化输出  │  → 让 AI 输出可控
       └─────────┬───────────┘
                 ▼
第3期  ┌─────────────────────┐  扩展知识
       │ RAG 检索增强生成     │  → 分块 + 向量化 + 检索
       │ 多轮对话 RAG        │  → 让 AI 拥有"记忆"
       └─────────┬───────────┘
                 ▼
第4期  ┌─────────────────────┐  自主行动
       │ Agent 智能体        │  → ReAct 循环
       │ 工具调用 + 规划     │  → 让 AI 自主决策
       └─────────┬───────────┘
                 ▼
第5期  ┌─────────────────────┐  标准化
       │ MCP 协议            │  → 模型上下文协议
       │ 工具服务化          │  → 统一的工具接入标准
       └─────────┬───────────┘
                 ▼
第6期  ┌─────────────────────┐  工程化
       │ LangChain 框架      │  → Chain + Memory + Agent
       │ RAG 集成            │  → 一站式开发框架
       └─────────┬───────────┘
                 ▼
第7期  ┌─────────────────────┐  底层优化
       │ 模型微调与部署      │  → LoRA + 量化
       │ 推理优化            │  → 性能与成本平衡
       └─────────┬───────────┘
                 ▼
第8期  ┌─────────────────────┐  个性定制
       │ Claude Code Skills  │  → Skills + Hooks
       │ 定制体系            │  → Settings + CLAUDE.md
       └─────────────────────┘  → 打造专属 AI 伙伴
```

### 7.2 从 HTML 聊天到定制 AI 伙伴

第1期，我们用一个简单的 `fetch` 调用实现了和 AI 的对话；到第8期，我们已经能定制 AI 的能力、行为、权限和自动化流程。

这个进化路径反映了 AI 应用开发的核心趋势：**AI 正在从"工具"变成"伙伴"，而定制化是这个转变的关键。**

### 7.3 推荐资源

**官方文档：**
- [Claude Code 官方文档](https://docs.anthropic.com/en/docs/claude-code)
- [Agent Skills 开放标准](https://agentskills.io)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

**本系列源码：**
- [LLM-Study GitHub 仓库](https://github.com/csxiaoyaojianxian/LLM-Study)

**运行本期 Demo：**

```bash
cd 08-skill
npm install

# Skills 概念讲解（无需 API Key）
npm run skill-concepts

# 总览所有配置示例
npm run showcase

# Hook 机制详解 + 模拟测试
npm run hooks-demo

# Settings 层级与合并规则
npm run settings-explain

# 一键安装示例到 .claude/ 目录
npm run setup
```

---

> 🎉 **系列完结！** 从第1期的 HTML 聊天到第8期的 Skills 定制，希望这个系列帮你建立了 AI 应用开发的完整知识体系。AI 开发的世界还在快速演进，保持学习，持续实践。祝你在 AI 时代乘风破浪！
