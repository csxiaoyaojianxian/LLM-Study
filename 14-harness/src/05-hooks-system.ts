/**
 * 05-hooks-system.ts — Hook 系统与 CLAUDE.md 上下文加载
 *
 * 📌 学习目标：理解 Claude Code 的 Hook 事件系统和上下文注入机制
 *
 * 对应源码文件：
 * - ClaudeCodeSource/utils/hooks/hooks.ts        — Hook 执行引擎（159KB）
 * - ClaudeCodeSource/utils/hooks/hookEvents.ts   — Hook 事件定义
 * - ClaudeCodeSource/utils/hooks/sessionHooks.ts — 会话级 Hook 注册表
 * - ClaudeCodeSource/context.ts                   — CLAUDE.md 发现与注入
 * - ClaudeCodeSource/types/hooks.ts               — Hook 类型定义
 *
 * 无需 API Key，直接运行即可学习
 */

// ============================================================
// 1. Hook 系统概览
// ============================================================

function showHookSystemOverview(): void {
  console.log("=".repeat(70));
  console.log("🪝 Claude Code Hook 系统深度解析");
  console.log("=".repeat(70));

  console.log(`
📌 Hook 是什么？

  Hook = 在特定事件发生时自动执行的自定义逻辑
  类似于 Git Hooks（pre-commit, post-merge 等）

  Claude Code 的 Hook 可以：
  ✅ 在工具执行前/后运行自定义脚本
  ✅ 修改工具输入（如自动 lint 代码）
  ✅ 阻止危险操作
  ✅ 发送通知（如 Slack 通知）
  ✅ 收集审计日志

📌 Hook 系统架构：

  ┌──────────────────────────────────────────────────────────────┐
  │                     Hook 配置来源                             │
  │                                                              │
  │  ~/.claude/settings.json  → 全局 Hook                       │
  │  .claude/settings.json    → 项目级 Hook                     │
  │  SDK 参数                 → 程序化 Hook                     │
  └──────────────────────────┬───────────────────────────────────┘
                             ↓
  ┌──────────────────────────────────────────────────────────────┐
  │              Hook Registry (会话级注册表)                     │
  │                                                              │
  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
  │  │ PreToolUse   │  │ PostToolUse  │  │ SessionStart │      │
  │  │ handlers[]   │  │ handlers[]   │  │ handlers[]   │      │
  │  └──────────────┘  └──────────────┘  └──────────────┘      │
  │  ... (14+ 事件类型)                                         │
  └──────────────────────────┬───────────────────────────────────┘
                             ↓
  ┌──────────────────────────────────────────────────────────────┐
  │              Hook 执行引擎 (hooks.ts, 159KB)                 │
  │                                                              │
  │  事件匹配 → 权限检查 → 串行执行 → 结果处理                 │
  └──────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// 2. Hook 事件类型
// ============================================================

function explainHookEvents(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📡 Hook 事件类型（14+ 种）");
  console.log("=".repeat(70));

  interface HookEvent {
    name: string;
    timing: string;
    capabilities: string[];
    example: string;
  }

  const hookEvents: HookEvent[] = [
    {
      name: "SessionStart",
      timing: "会话开始时",
      capabilities: ["注入初始上下文", "设置监听路径"],
      example: "启动 dev server、检查环境配置",
    },
    {
      name: "SessionEnd",
      timing: "会话结束时",
      capabilities: ["清理资源", "保存状态"],
      example: "关闭后台进程、提交草稿",
    },
    {
      name: "UserPromptSubmit",
      timing: "用户发送消息后",
      capabilities: ["修改消息", "添加上下文"],
      example: "自动附加项目状态信息",
    },
    {
      name: "PreToolUse",
      timing: "工具执行前",
      capabilities: ["修改输入", "阻止执行", "更改权限"],
      example: "验证 Bash 命令安全性、自动修正路径",
    },
    {
      name: "PostToolUse",
      timing: "工具执行成功后",
      capabilities: ["修改输出", "触发副作用"],
      example: "自动 lint、发送通知、记录日志",
    },
    {
      name: "PostToolUseFailure",
      timing: "工具执行失败后",
      capabilities: ["建议恢复方案", "记录错误"],
      example: "分析失败原因、建议修复命令",
    },
    {
      name: "PreCompact",
      timing: "上下文压缩前",
      capabilities: ["标记重要上下文", "追加备忘"],
      example: "保存关键决策记录",
    },
    {
      name: "PostCompact",
      timing: "上下文压缩后",
      capabilities: ["修改恢复策略", "注入提醒"],
      example: "重新注入被压缩的关键信息",
    },
    {
      name: "FileChanged",
      timing: "文件系统变更时",
      capabilities: ["通知变更", "触发重建"],
      example: "检测配置文件变更、重新加载",
    },
    {
      name: "Notification",
      timing: "系统通知时",
      capabilities: ["自定义通知渠道"],
      example: "发送到 Slack/邮件/桌面通知",
    },
  ];

  hookEvents.forEach((event) => {
    console.log(`\n  🔔 ${event.name}`);
    console.log(`     触发: ${event.timing}`);
    console.log(`     能力: ${event.capabilities.join("、")}`);
    console.log(`     示例: ${event.example}`);
  });
}

// ============================================================
// 3. Hook 配置格式
// ============================================================

function explainHookConfiguration(): void {
  console.log("\n\n" + "=".repeat(70));
  console.log("📝 Hook 配置格式");
  console.log("=".repeat(70));

  console.log(`
📌 在 .claude/settings.json 中配置 Hook：

  {
    "hooks": {
      "PreToolUse": [
        {
          // ── 匹配条件 ──
          "matcher": {
            "tool": "Bash",               // 匹配 Bash 工具
            "input": {
              "command": "rm *"            // 匹配 rm 命令
            }
          },

          // ── 执行方式 ──
          "hooks": [
            {
              "type": "command",
              "command": "/path/to/safety-check.sh"
            }
          ]
        }
      ],

      "PostToolUse": [
        {
          "matcher": {
            "tool": "Write"               // 匹配文件写入
          },
          "hooks": [
            {
              "type": "command",
              "command": "npx eslint --fix $FILE_PATH"
            }
          ]
        }
      ]
    }
  }

📌 Hook 执行方式：

  ┌── Shell 命令 ──────────────────────────────────────────────┐
  │ {                                                           │
  │   "type": "command",                                        │
  │   "command": "my-script.sh",                                │
  │   "timeout": 5000          // 超时 5 秒                    │
  │ }                                                           │
  │                                                             │
  │ 输入：通过 stdin 以 JSON 格式传入                          │
  │ 输出：通过 stdout 以 JSON 格式返回                         │
  └─────────────────────────────────────────────────────────────┘

  ┌── HTTP 回调 ───────────────────────────────────────────────┐
  │ {                                                           │
  │   "type": "http",                                           │
  │   "url": "https://hooks.example.com/audit",                │
  │   "method": "POST",                                         │
  │   "timeout": 30000         // 超时 30 秒                   │
  │ }                                                           │
  │                                                             │
  │ 输入：通过 HTTP Body 以 JSON 格式发送                      │
  │ 输出：通过 HTTP Response 以 JSON 格式返回                  │
  └─────────────────────────────────────────────────────────────┘

📌 Hook 输出 Schema（统一的返回格式）：

  {
    // 是否继续（false = 阻止后续操作）
    "continue": true,

    // PreToolUse 专用
    "decision": "approve" | "block",     // 权限决策
    "updatedInput": { ... },             // 修改后的输入

    // 通用
    "systemMessage": "...",              // 注入系统消息
    "additionalContext": "...",          // 追加上下文
    "reason": "...",                     // 决策原因

    // 异步 Hook
    "async": true,                       // 标记为异步
    "asyncTimeout": 30000                // 异步超时
  }
`);
}

// ============================================================
// 4. Hook 执行引擎
// ============================================================

function explainHookExecution(): void {
  console.log("=".repeat(70));
  console.log("⚙️  Hook 执行引擎");
  console.log("=".repeat(70));

  console.log(`
📌 Hook 的执行机制：

  ┌─── 执行顺序：串行 ──────────────────────────────────────────┐
  │                                                              │
  │  Hook A → 完成 → Hook B → 完成 → Hook C → 完成             │
  │                                                              │
  │  为什么串行？                                                │
  │  → 避免权限决策的竞态条件                                   │
  │  → Hook B 可以使用 Hook A 修改后的输入                      │
  │  → 保证决策一致性                                            │
  └──────────────────────────────────────────────────────────────┘

  ┌─── 链式修改 ────────────────────────────────────────────────┐
  │                                                              │
  │  原始输入: { command: "rm -rf /tmp" }                        │
  │      ↓                                                       │
  │  Hook A: 安全检查 → updatedInput: { command: "rm -rf ./tmp"} │
  │      ↓ (修改后的输入传给下一个 Hook)                        │
  │  Hook B: 日志记录 → 不修改，仅记录                          │
  │      ↓                                                       │
  │  Hook C: 审批 → decision: "approve"                          │
  │      ↓                                                       │
  │  最终输入: { command: "rm -rf ./tmp" }                       │
  │  最终决策: approve                                            │
  └──────────────────────────────────────────────────────────────┘

  ┌─── 中断机制 ────────────────────────────────────────────────┐
  │                                                              │
  │  任何 Hook 返回 { continue: false } → 立即终止              │
  │  后续 Hook 不再执行                                         │
  │  工具调用被取消                                              │
  │                                                              │
  │  Hook A: { continue: true }   → 继续                        │
  │  Hook B: { continue: false }  → 终止！                      │
  │  Hook C: 不执行                                              │
  └──────────────────────────────────────────────────────────────┘

📌 异步 Hook 的特殊处理：

  长时间运行的 Hook（如 HTTP 回调）可以使用异步模式：

  1. Hook 返回 { async: true, asyncTimeout: 30000 }
  2. 系统注册 pendingAsyncHook(hookId, promise)
  3. 后台轮询（每 500ms）检查完成状态
  4. 同时向 UI 报告进度
  5. 超时后自动终止

  适用场景：
  - 远程审批流程（等待人工审批）
  - 复杂安全扫描
  - 外部 CI 检查
`);
}

// ============================================================
// 5. CLAUDE.md 上下文加载系统
// ============================================================

function explainClaudeMdSystem(): void {
  console.log("=".repeat(70));
  console.log("📄 CLAUDE.md 上下文加载系统");
  console.log("=".repeat(70));

  console.log(`
📌 CLAUDE.md 是什么？

  CLAUDE.md 是项目级的指令文件
  类似于 .editorconfig 或 .eslintrc —— 但面向 AI 助手

  它告诉 Claude Code：
  - 项目是做什么的
  - 代码架构长什么样
  - 有哪些约定和规范
  - 当前的状态和注意事项

📌 CLAUDE.md 发现机制：

  ┌─── 搜索路径（按优先级） ────────────────────────────────────┐
  │                                                              │
  │  1. 当前工作目录/CLAUDE.md           （项目根目录）         │
  │  2. 当前工作目录/.claude/CLAUDE.md    （隐藏目录）          │
  │  3. ~/.claude/CLAUDE.md               （用户全局）           │
  │  4. --add-dir 指定目录/CLAUDE.md      （额外目录）          │
  │  5. .claude/ 下的记忆文件             （持久记忆）          │
  │                                                              │
  │  多个 CLAUDE.md → 合并（不是覆盖）                          │
  │  项目级 + 用户级 = 完整上下文                               │
  └──────────────────────────────────────────────────────────────┘

📌 注入方式：

  CLAUDE.md 内容不是作为 system prompt 注入
  而是作为 system-reminder 类型的 UserMessage 注入到消息列表开头

  为什么不用 system prompt？
  → system prompt 有 token 限制，而且不方便动态更新
  → 作为 UserMessage 可以被 LLM 自然理解
  → 支持多个 CLAUDE.md 合并

  注入格式：
  ┌──────────────────────────────────────────────────────────────┐
  │ <system-reminder>                                            │
  │ Codebase and user instructions are shown below.              │
  │ Be sure to adhere to these instructions.                     │
  │ IMPORTANT: These instructions OVERRIDE any default behavior  │
  │                                                              │
  │ Contents of /path/to/CLAUDE.md (project instructions):       │
  │                                                              │
  │ # Project Overview                                           │
  │ This is a TypeScript project...                              │
  │ ...                                                          │
  │ </system-reminder>                                           │
  └──────────────────────────────────────────────────────────────┘

📌 缓存策略：

  getClaudeMds() 使用 memoize() 缓存
  ┌──────────────────────────────────────────────────────────────┐
  │ 缓存有效：跨 turn 持续有效                                  │
  │ 缓存失效：                                                  │
  │   - CLAUDE.md 文件被修改（文件监控）                        │
  │   - System Prompt 注入内容变更                               │
  │   - 工作目录变更（cd 后）                                   │
  │   - 用户执行 /memory 命令                                   │
  └──────────────────────────────────────────────────────────────┘

📌 记忆文件（Memory Files）：

  除了 CLAUDE.md，还有记忆文件系统：
  ┌──────────────────────────────────────────────────────────────┐
  │ .claude/memory/                                              │
  │ ├── preferences.md     ← 用户偏好（代码风格等）            │
  │ ├── architecture.md    ← 架构决策记录                       │
  │ └── conventions.md     ← 项目约定                           │
  │                                                              │
  │ 通过 /memory 命令管理                                       │
  │ 合并到 CLAUDE.md 上下文中一起注入                           │
  └──────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// 6. 系统上下文构建
// ============================================================

function explainSystemContext(): void {
  console.log("=".repeat(70));
  console.log("🌐 系统上下文构建（System Context）");
  console.log("=".repeat(70));

  console.log(`
📌 每次 API 调用前，构建完整的上下文：

  fetchSystemPromptParts()
      ↓
  ┌─── 1. 基础系统提示词 ──────────────────────────────────────┐
  │ "You are Claude, made by Anthropic.                         │
  │  You are an AI assistant specialized in software            │
  │  development..."                                             │
  │                                                              │
  │ + 工具使用指南                                               │
  │ + 最佳实践提示                                               │
  │ + 安全约束                                                   │
  └──────────────────────────────────────────────────────────────┘
      ↓ 合并
  ┌─── 2. 用户上下文 ──────────────────────────────────────────-┐
  │                                                              │
  │  getClaudeMds():                                              │
  │  ├─ CLAUDE.md 内容（项目指令）                               │
  │  ├─ 记忆文件内容                                             │
  │  └─ 额外目录的 CLAUDE.md                                    │
  │                                                              │
  │  currentDate: "2026-04-12"                                    │
  │                                                              │
  │  customInstructions:                                          │
  │  (用户在 settings.json 中配置的自定义指令)                   │
  └──────────────────────────────────────────────────────────────┘
      ↓ 合并
  ┌─── 3. 系统上下文 ──────────────────────────────────────────-┐
  │                                                              │
  │  getSystemContext():                                          │
  │  ├─ Git 状态（分支名、最近提交、未暂存变更）                │
  │  ├─ 当前工作目录                                             │
  │  └─ 环境信息                                                 │
  └──────────────────────────────────────────────────────────────┘
      ↓ 组装
  ┌─── 最终消息列表 ───────────────────────────────────────────-┐
  │                                                              │
  │  [                                                           │
  │    { role: "system", content: 基础系统提示词 },              │
  │    { role: "user", content: "<system-reminder>               │
  │        CLAUDE.md 内容 + 记忆文件 + Git 状态                 │
  │      </system-reminder>" },                                  │
  │    { role: "user", content: 用户实际输入 },                  │
  │    ... 后续对话历史 ...                                      │
  │  ]                                                           │
  └──────────────────────────────────────────────────────────────┘

📌 上下文的 Token 预算分配：

  总上下文窗口: 200K tokens (以 Claude Opus 为例)
  ┌────────────────────────────┬──────────────┐
  │ 组成部分                   │ 估算 Token   │
  ├────────────────────────────┼──────────────┤
  │ 系统提示词                 │ ~5K          │
  │ CLAUDE.md + 记忆文件       │ ~2K-10K      │
  │ Git 状态 + 环境信息        │ ~1K          │
  │ 工具定义 (45+ 工具)       │ ~15K-20K     │
  │ 对话历史                   │ ~150K-170K   │
  │ 预留输出                   │ ~16K         │
  └────────────────────────────┴──────────────┘
`);
}

// ============================================================
// 7. 模拟 Hook 执行
// ============================================================

async function simulateHookExecution(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 模拟 Hook 执行场景");
  console.log("=".repeat(70));

  console.log(`
  📌 场景：文件写入后自动运行 ESLint

  配置：
  {
    "hooks": {
      "PostToolUse": [{
        "matcher": { "tool": "Write", "input": { "file_path": "*.ts" } },
        "hooks": [{ "type": "command", "command": "npx eslint --fix $FILE_PATH" }]
      }]
    }
  }

  执行过程：
`);

  const steps = [
    { time: "T+0ms", event: "LLM 调用 Write({ file_path: 'src/app.ts', content: '...' })" },
    { time: "T+5ms", event: "PreToolUse Hook 检查 → 无匹配 → 跳过" },
    { time: "T+10ms", event: "权限检查 → alwaysAllow 匹配 → 允许" },
    { time: "T+15ms", event: "Write 工具执行 → 文件写入成功" },
    { time: "T+20ms", event: "PostToolUse Hook 匹配！工具=Write, 文件=*.ts" },
    { time: "T+25ms", event: "执行 Hook: npx eslint --fix src/app.ts" },
    { time: "T+500ms", event: "ESLint 完成 → 自动修复 2 个问题" },
    { time: "T+505ms", event: "Hook 返回: { systemMessage: 'ESLint: 2 issues fixed' }" },
    { time: "T+510ms", event: "系统消息注入到对话 → LLM 可以看到 lint 结果" },
  ];

  steps.forEach((s) => {
    console.log(`  ${s.time.padEnd(12)} ${s.event}`);
  });

  console.log(`
  📌 场景：危险命令拦截

  配置：
  {
    "hooks": {
      "PreToolUse": [{
        "matcher": { "tool": "Bash", "input": { "command": "rm -rf *" } },
        "hooks": [{ "type": "command", "command": "echo '{\\"continue\\":false,\\"reason\\":\\"Blocked dangerous rm\\"}'" }]
      }]
    }
  }

  执行过程：
`);

  const steps2 = [
    { time: "T+0ms", event: "LLM 调用 Bash({ command: 'rm -rf /tmp/old' })" },
    { time: "T+5ms", event: "PreToolUse Hook 匹配！工具=Bash, 命令=rm -rf *" },
    { time: "T+10ms", event: "执行 Hook → 返回 { continue: false, reason: 'Blocked' }" },
    { time: "T+15ms", event: "⛔ 工具执行被阻止！" },
    { time: "T+20ms", event: "返回错误给 LLM: 'Hook blocked: dangerous rm command'" },
    { time: "T+25ms", event: "LLM 收到错误，尝试更安全的替代方案" },
  ];

  steps2.forEach((s) => {
    console.log(`  ${s.time.padEnd(12)} ${s.event}`);
  });
}

// ============================================================
// 8. 小结
// ============================================================

function showSummary(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📝 Hook 系统与上下文加载学习要点");
  console.log("=".repeat(70));

  console.log(`
  1️⃣  14+ 事件类型：覆盖工具调用、会话生命周期、文件变更等
  2️⃣  串行执行：避免竞态条件，支持链式修改
  3️⃣  多种执行方式：Shell 命令 / HTTP 回调 / 异步轮询
  4️⃣  CLAUDE.md 注入：作为 system-reminder UserMessage，非 system prompt
  5️⃣  缓存策略：memoize 跨 turn 缓存，文件变更时失效
  6️⃣  记忆文件：.claude/memory/ 下的持久化上下文

  📌 Hook 的实际应用场景：
  - CI/CD 集成：写入代码后自动运行测试
  - 安全审计：记录所有工具调用到日志
  - 代码规范：写入文件后自动格式化
  - 审批流程：高危操作需要远程审批
  - 通知：重要操作完成后通知团队

  📌 思考题：
  - Hook 串行执行会不会成为性能瓶颈？什么时候适合用异步？
  - CLAUDE.md 作为 UserMessage 注入和作为 system prompt 有什么区别？
  - 如何设计 Hook 来实现"写入代码后自动运行测试"？
  - 记忆文件和 CLAUDE.md 应该分别放什么内容？

  📂 建议阅读的源码文件（按顺序）：
  1. ClaudeCodeSource/types/hooks.ts              — Hook 类型定义
  2. ClaudeCodeSource/utils/hooks/hookEvents.ts   — 事件类型
  3. ClaudeCodeSource/utils/hooks/hooks.ts        — 执行引擎
  4. ClaudeCodeSource/context.ts                   — CLAUDE.md 加载
  5. ClaudeCodeSource/utils/hooks/sessionHooks.ts — 会话注册表
`);
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  showHookSystemOverview();
  explainHookEvents();
  explainHookConfiguration();
  explainHookExecution();
  explainClaudeMdSystem();
  explainSystemContext();
  await simulateHookExecution();
  showSummary();
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("05-hooks-system.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { showHookSystemOverview, explainClaudeMdSystem };
