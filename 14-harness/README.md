# Module 14: 从 Claude Code 源码学习 Harness 工程

> 🎯 **学习目标**：通过阅读 Claude Code 源码（1,900+ 文件，512,000+ 行），掌握生产级 AI Agent Harness 的架构设计与工程实践。

## 前置知识

- 完成 Module 01-13 的学习
- 熟悉 TypeScript、Node.js/Bun
- 了解 LLM API 调用（流式响应、工具调用）
- 建议先完成 Module 06（Agent）和 Module 07（MCP）

## 什么是 Harness？

在 AI Agent 领域，**Harness**（驾驭框架）指的是围绕 LLM 构建的完整运行时系统：

```
┌──────────────────────────────────────────────────────┐
│                     Harness                           │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ 启动引导 │  │ Agent 循环│  │ 工具系统          │    │
│  │ Bootstrap│  │ Query Loop│  │ Tool System       │    │
│  └─────────┘  └──────────┘  └──────────────────┘    │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ 权限系统 │  │ Hook 系统 │  │ 状态管理          │    │
│  │ Permission│ │ Hooks     │  │ State Mgmt        │    │
│  └─────────┘  └──────────┘  └──────────────────┘    │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ 上下文   │  │ 成本追踪 │  │ 多 Agent 协调     │    │
│  │ Context  │  │ Cost Track│  │ Coordinator       │    │
│  └─────────┘  └──────────┘  └──────────────────┘    │
│                                                       │
│                  ┌─────────┐                          │
│                  │   LLM   │  ← 大脑                  │
│                  └─────────┘                          │
└──────────────────────────────────────────────────────┘
```

Harness 就是 LLM 的"身体"——负责感知环境、执行动作、管理安全。

## 源码结构概览

Claude Code 源码位于 `ClaudeCodeSource/` 目录下：

```
ClaudeCodeSource/
├── main.tsx                 # CLI 入口文件（6,766行）
├── QueryEngine.ts           # 查询引擎 —— Agent 循环外层（1,295行）
├── query.ts                 # 查询循环 —— Agent 循环内层（1,729行）
├── Tool.ts                  # 工具接口定义（792行）
├── commands.ts              # 斜杠命令注册中心（754行）
├── context.ts               # CLAUDE.md 上下文收集
├── cost-tracker.ts          # Token 成本追踪
├── Task.ts                  # 任务定义
│
├── tools/                   # 45+ 工具实现
│   ├── BashTool/            #   Shell 命令执行
│   ├── FileReadTool/        #   文件读取（图片、PDF、Notebook）
│   ├── FileEditTool/        #   精确字符串替换编辑
│   ├── FileWriteTool/       #   文件创建/覆写
│   ├── GlobTool/            #   文件模式匹配
│   ├── GrepTool/            #   ripgrep 内容搜索
│   ├── WebFetchTool/        #   URL 内容抓取
│   ├── AgentTool/           #   子 Agent 生成
│   ├── MCPTool/             #   MCP 工具调用
│   └── ...                  #   20+ 更多工具
│
├── services/
│   ├── api/claude.ts        #   Anthropic API 封装（125KB）
│   ├── tools/
│   │   ├── StreamingToolExecutor.ts  # 并发工具执行器
│   │   └── toolExecution.ts          # 工具执行逻辑
│   ├── compact/             #   上下文压缩
│   └── mcp/                 #   MCP 协议
│
├── hooks/
│   ├── useCanUseTool.tsx    #   权限决策入口
│   └── toolPermission/      #   权限处理器
│
├── utils/hooks/
│   ├── hooks.ts             #   Hook 执行引擎（159KB）
│   └── hookEvents.ts        #   Hook 事件定义
│
├── state/
│   ├── AppStateStore.ts     #   Zustand 模式状态管理（21KB）
│   └── AppState.tsx         #   状态类型定义（23KB）
│
├── bootstrap/state.ts       #   全局单例初始化（56KB）
├── coordinator/             #   多 Agent 协调
├── components/              #   Ink 终端 UI 组件（140+）
├── commands/                #   斜杠命令实现（50+）
└── entrypoints/cli.tsx      #   CLI 完整初始化（39KB）
```

**规模**：~1,900 文件，512,000+ 行 TypeScript

## 学习路线图

本模块按 6 个主题循序渐进，每个主题对应一个可运行的教学脚本：

```
npm run 01-bootstrap    →  启动流程（冷启动优化、Feature Flag）
        ↓
npm run 02-agent-loop   →  Agent 循环（消息流转、流式处理）
        ↓
npm run 03-tool-system  →  工具系统（注册、执行、并发控制）
        ↓
npm run 04-permission   →  权限系统（多层决策、渐进信任）
        ↓
npm run 05-hooks        →  Hook 与上下文（事件系统、CLAUDE.md）
        ↓
npm run 06-patterns     →  设计模式（10 大模式总结与应用）
```

## 快速开始

```bash
cd 14-harness
npm install

# 按顺序运行 6 个教学脚本
npm run 01-bootstrap     # 启动流程解析
npm run 02-agent-loop    # Agent 循环解析
npm run 03-tool-system   # 工具系统解析
npm run 04-permission    # 权限系统解析
npm run 05-hooks         # Hook 系统解析
npm run 06-patterns      # 设计模式总结
```

所有脚本**无需 API Key**，通过详细的注释和模拟演示来讲解架构。

---

## 一、启动流程（01-bootstrap-flow.ts）

### 1.1 预取优化

Claude Code 在 `import` 语句执行之前就发起 I/O 操作：

```typescript
// main.tsx 最前面（在 import 之前！）
profileCheckpoint('main_tsx_entry')
startMdmRawRead()        // MDM 企业策略预读取
startKeychainPrefetch()   // macOS Keychain 预取（~65ms）

// 然后才是 import（~150ms）
import { Commander } from 'commander'
import React from 'react'
```

**为什么这样做？** 因为 Node.js/Bun 在评估 `import` 时是同步阻塞的，但预取是异步的——两者可以并行执行，节省 ~65ms 启动时间。

### 1.2 Feature Flags 与条件导入

```typescript
// Bun 打包器在构建时评估 feature()
const coordinatorModule = feature('COORDINATOR_MODE')
  ? require('./coordinator/coordinatorMode.js')  // ~50KB
  : null

// FLAG 关闭 → 整个 require 被 DCE（死代码消除）
// 最终产物不包含这 50KB 代码
```

已知 Feature Flags：
- `COORDINATOR_MODE` — 多 Agent 协调
- `KAIROS` — 主动式助手模式
- `BRIDGE_MODE` — IDE 集成
- `VOICE_MODE` — 语音输入
- `TRANSCRIPT_CLASSIFIER` — ML 安全分类器

### 1.3 初始化序列

```
Settings 加载 → Auth 验证 → Context 加载 → Tools 注册 → State 初始化 → UI 启动
```

配置优先级：CLI 标志 > 环境变量 > settings.local.json > settings.json > 默认值

### 运行示例

```bash
npm run 01-bootstrap
```

```
🚀 Claude Code 启动流程深度解析
============================================================
⚡ Phase 1: 预取优化（Prefetch Optimization）
  串行方式: 215ms (Keychain 65ms + Imports 150ms)
  预取方式: 150ms (并行执行，取最大值)
  节省: 65ms (30%)
...
```

**📂 建议阅读源码**：`main.tsx:1-50` → `entrypoints/cli.tsx` → `bootstrap/state.ts`

---

## 二、Agent 循环（02-agent-loop.ts）

### 2.1 两层架构

```
QueryEngine.ts（外层）
  ├─ 管理 mutableMessages（跨 turn 持久化）
  ├─ 处理用户输入（斜杠命令展开）
  └─ 对外暴露 AsyncGenerator<SDKMessage>

  query.ts（内层）
    ├─ API 调用 + 流式处理
    ├─ 工具执行编排
    ├─ Token 预算检查
    └─ 上下文压缩触发
```

### 2.2 核心循环

```
while (true) {
  1. normalizeMessagesForAPI()     ← 消息规范化（非幂等！）
  2. hasExceededTokenBudget()      ← Token 预算检查
  3. streamMessageWithRetry()      ← API 调用（流式 + 重试）
  4. 处理流事件                     ← 文本/工具调用/思考
  5. StreamingToolExecutor.run()   ← 并发执行工具
  6. 有工具结果 → continue         ← 继续循环
     无工具调用 → break            ← 任务完成
}
```

### 2.3 消息规范化

`normalizeMessagesForAPI()` 是一个**非幂等**操作——调用两次会重复注入上下文。这是为什么 `mutableMessages` 是持久化的：规范化只在 API 调用时做一次。

### 2.4 上下文压缩

当 Token 使用接近上下文窗口 90% 时触发 auto-compact：
- 压缩当前 turn 之前的历史消息
- 保留 ~50K tokens
- 恢复最近访问的 5 个文件（LRU 策略）

**关键洞察**：PTL（Prompt-Too-Long）错误触发的是压缩而非简单重试，因为相同的大上下文重发还是会失败。

**📂 建议阅读源码**：`QueryEngine.ts:209-400` → `query.ts:150-800`

---

## 三、工具系统（03-tool-system.ts）

### 3.1 Tool 接口

```typescript
type Tool = {
  name: string
  description(input, ctx): Promise<string>
  inputSchema: ToolInputJSONSchema
  execute(input, ctx): Promise<ToolResult> | AsyncGenerator<ToolResultPart>
  isConcurrencySafe?: boolean | ((input) => boolean)
  maxConcurrentInvocations?: number
}
```

关键设计：`execute` 返回 `AsyncGenerator` → 支持流式进度反馈。

### 3.2 45+ 工具分类

| 类别 | 工具 | 并发性 |
|------|------|--------|
| 文件操作 | Read, Edit, Write, Glob, Grep | 读并发/写独占 |
| 系统交互 | Bash, TaskOutput, TaskStop | 受限 |
| 网络 | WebFetch, WebSearch | 并发 |
| Agent | Agent, SendMessage, TeamCreate | 并发/独占 |
| 扩展 | MCP, Skill, NotebookEdit | 混合 |

### 3.3 并发执行器（StreamingToolExecutor）

```
LLM 同时返回 3 个工具调用:
  A: Read("main.ts")     ← 可并发
  B: Read("utils.ts")    ← 可并发
  C: Bash("npm test")    ← 需独占

执行策略:
  A + B 并行 → 完成后 → C 独占执行
  结果按 A → B → C 原始顺序返回（FIFO 保证）
```

### 3.4 工具执行管线

```
LLM 输出 ToolUseBlock
  → 工具查找
  → Pre-Hook 执行（可修改输入/阻止执行）
  → 权限检查（可批准/拒绝/询问）
  → 工具执行（支持流式进度）
  → Post-Hook 执行（可修改输出）
  → 结果封装为 ToolResultBlock
```

### 3.5 MCP 统一接口

内置工具和 MCP 工具实现完全相同的 `Tool` 接口。对 LLM 来说两者无区别——这就是 MCP 的威力：扩展工具集无需修改 Agent 逻辑。

**📂 建议阅读源码**：`Tool.ts` → `tools/BashTool/` → `services/tools/StreamingToolExecutor.ts`

---

## 四、权限系统（04-permission-system.ts）

### 4.1 五层决策架构

```
工具调用请求
  ↓ Layer 1: 配置规则 (alwaysAllow / alwaysDeny / alwaysAsk)
  ↓ Layer 2: 安全分类器 (ML 模型，可选)
  ↓ Layer 3: 交互确认 (弹出对话框)
  ↓ Layer 4: 协调器验证 (Worker 权限约束)
  ↓ Layer 5: 最终决策 (执行 / 拒绝)
```

### 4.2 四种权限模式

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| `default` | 全部需确认 | 日常开发 |
| `plan` | 只读自动，写需确认 | 代码审查 |
| `auto` | ML 分类器判断 | 高级用户 |
| `bypassPermissions` | 全部自动 | CI/CD |

### 4.3 渐进式信任

用户每次选择"总是允许"都会添加到规则集：

```
初始: { allow: [] }
第 1 次: 用户批准 "ls" → { allow: ["Bash(ls *)"] }
第 2 次: 用户批准 "npm run" → { allow: ["Bash(ls *)", "Bash(npm run *)"] }
第 N 次: 大多数操作自动批准
```

规则集随使用量增长 → 确认频率自然下降 → 安全与效率兼顾。

### 4.4 Worker 权限约束

多 Agent 场景下，Worker 有受限的工具集，且不能弹出交互确认框。遇到无权操作时，通过 `SendMessage` 向 Coordinator 请求审批。

**📂 建议阅读源码**：`hooks/useCanUseTool.tsx` → `hooks/toolPermission/handlers/`

---

## 五、Hook 与上下文（05-hooks-system.ts）

### 5.1 Hook 事件类型

| 事件 | 触发时机 | 能力 |
|------|----------|------|
| `PreToolUse` | 工具执行前 | 修改输入、阻止执行 |
| `PostToolUse` | 工具执行后 | 修改输出、触发副作用 |
| `SessionStart` | 会话开始 | 注入初始上下文 |
| `FileChanged` | 文件变更 | 通知、触发重建 |
| `PreCompact` | 压缩前 | 标记重要上下文 |
| ... | ... | 14+ 种事件 |

### 5.2 Hook 配置

```json
// .claude/settings.json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": { "tool": "Write", "input": { "file_path": "*.ts" } },
      "hooks": [{ "type": "command", "command": "npx eslint --fix $FILE_PATH" }]
    }]
  }
}
```

### 5.3 Hook 执行特点

- **串行执行**：避免竞态条件，支持链式修改
- **中断机制**：`{ continue: false }` 立即终止后续 Hook
- **异步支持**：长时间 Hook 可后台轮询

### 5.4 CLAUDE.md 上下文注入

CLAUDE.md 内容作为 `<system-reminder>` 类型的 UserMessage 注入，而非 system prompt：

```
搜索路径:
  1. ./CLAUDE.md              (项目根目录)
  2. ./.claude/CLAUDE.md      (隐藏目录)
  3. ~/.claude/CLAUDE.md      (用户全局)
  4. --add-dir 指定目录       (额外目录)
  5. .claude/memory/          (记忆文件)
```

多个 CLAUDE.md → 合并（非覆盖），使用 `memoize()` 跨 turn 缓存。

**📂 建议阅读源码**：`types/hooks.ts` → `utils/hooks/hooks.ts` → `context.ts`

---

## 六、设计模式总结（06-design-patterns.ts）

从 Claude Code 源码中提炼的 10 大设计模式：

| # | 模式 | 核心思想 | 源码位置 |
|---|------|----------|----------|
| 1 | 全链路 AsyncGenerator | 从 API 到 UI 全链路流式 | QueryEngine.ts |
| 2 | FIFO 并发执行器 | 并发执行 + 有序返回 | StreamingToolExecutor.ts |
| 3 | 多层决策管线 | 快速路径 → ML → 人工 | useCanUseTool.tsx |
| 4 | Memoize + 选择性失效 | 精确缓存失效条件 | bootstrap/state.ts |
| 5 | DeepImmutable 状态 | 编译期防意外修改 | AppStateStore.ts |
| 6 | Feature Flag + DCE | 按需加载，减小包体积 | main.tsx |
| 7 | 上下文注入（DI） | ToolUseContext 提供依赖 | Tool.ts |
| 8 | Token 感知重试 | PTL → 压缩后重试 | api/errors.ts |
| 9 | 渐进式信任 | 规则集随使用增长 | Permission Rules |
| 10 | 串行 Hook 管线 | 无竞态 + 链式修改 | hooks.ts |

### 模式应用场景

- **构建 AI Agent**：#1 + #2 + #3 + #8
- **构建 CLI 工具**：#4 + #6 + #7
- **构建 Web 后端**：#3 + #5 + #9 + #10

---

## 源码阅读路线（推荐顺序）

对照教学脚本，按以下顺序阅读源码效果最佳：

### 第 1 天：入口与循环
1. `main.tsx:1-50` — 预取优化
2. `main.tsx:50-200` — Feature Flags
3. `QueryEngine.ts:209-400` — submitMessage
4. `query.ts:150-500` — 核心 Agent 循环

### 第 2 天：工具与权限
5. `Tool.ts` — 工具接口定义
6. `tools/BashTool/` — 最复杂的工具
7. `services/tools/StreamingToolExecutor.ts` — 并发执行
8. `hooks/useCanUseTool.tsx` — 权限决策

### 第 3 天：扩展与状态
9. `context.ts` — CLAUDE.md 加载
10. `utils/hooks/hooks.ts` — Hook 引擎
11. `state/AppStateStore.ts` — 状态管理
12. `cost-tracker.ts` — 成本追踪

### 第 4 天：高级主题
13. `services/api/claude.ts` — API 调用层
14. `services/compact/` — 上下文压缩
15. `coordinator/coordinatorMode.ts` — 多 Agent
16. `entrypoints/cli.tsx` — 完整初始化

---

## 思考题

每节附带的思考题汇总，建议在阅读源码后回答：

1. 预取优化在什么条件下收益最大？你的项目能用吗？
2. 为什么 mutableMessages 是可变的而不是不可变的？
3. 消息规范化为什么不能是幂等操作？
4. 如果你要设计一个新工具，需要考虑哪些方面？
5. "总是允许"会不会造成安全隐患？如何平衡？
6. Hook 串行执行会不会成为性能瓶颈？
7. CLAUDE.md 作为 UserMessage 和作为 system prompt 有什么区别？
8. 10 大设计模式中，哪些可以直接应用到你的项目？

---

## 与其他模块的关系

| 本模块主题 | 相关模块 | 对照学习 |
|-----------|---------|---------|
| Agent 循环 | Module 06 (Agent) | 对比 ReAct 循环与 Claude Code 循环 |
| 工具系统 | Module 07 (MCP) | 对比 MCP 工具与内置工具的统一接口 |
| Hook 系统 | Module 08 (Skills) | 对比 Hook 配置与 Skill 定制 |
| 权限系统 | Module 04 (RAG) | 理解工具执行中的安全考量 |
| 流式处理 | Module 02 (Chat SDK) | 对比 useChat 与 QueryEngine 的流式实现 |

---

## 参考资源

- [Claude Code 官方文档](https://docs.anthropic.com/en/docs/claude-code)
- [Anthropic API 文档](https://docs.anthropic.com/en/api)
- [Ink — React for CLIs](https://github.com/vadimdemedes/ink)
- [Bun 打包器文档](https://bun.sh/docs/bundler)
