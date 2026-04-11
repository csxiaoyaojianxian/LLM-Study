/**
 * 01-bootstrap-flow.ts — Claude Code 启动流程深度解析
 *
 * 📌 学习目标：理解 Claude Code 从 CLI 入口到可交互状态的完整启动链路
 *
 * 对应源码文件：
 * - ClaudeCodeSource/main.tsx           — 入口文件（6,766行）
 * - ClaudeCodeSource/entrypoints/cli.tsx — CLI 执行入口（39KB）
 * - ClaudeCodeSource/bootstrap/state.ts  — 全局单例初始化（56KB）
 * - ClaudeCodeSource/context.ts          — 系统/用户上下文收集
 *
 * 无需 API Key，直接运行即可学习
 */

// ============================================================
// 1. 启动阶段概览
// ============================================================

function showBootstrapOverview(): void {
  console.log("=".repeat(70));
  console.log("🚀 Claude Code 启动流程深度解析");
  console.log("=".repeat(70));

  console.log(`
┌──────────────────────────────────────────────────────────────────────┐
│                    Claude Code 启动时序图                            │
│                                                                      │
│  Phase 1: 预取阶段（并行，最早执行）                                 │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐         │
│  │ MDM 预读取  │  │ Keychain 预取   │  │ 性能打点开始     │         │
│  │ startMdm    │  │ startKeychain   │  │ profileCheckpoint│         │
│  │ RawRead()   │  │ Prefetch()      │  │ ('main_tsx_entry')│        │
│  └─────────────┘  └─────────────────┘  └──────────────────┘         │
│         ↓（不阻塞，后台执行）                                        │
│                                                                      │
│  Phase 2: 模块导入（与 Phase 1 并行）                                │
│  ┌──────────────────────────────────────────────────┐                │
│  │ import Commander, React, Ink, Tools, ...          │                │
│  │ feature flags 决定条件导入哪些模块                │                │
│  └──────────────────────────────────────────────────┘                │
│         ↓                                                            │
│                                                                      │
│  Phase 3: CLI 参数解析                                               │
│  ┌──────────────────────────────────────────────────┐                │
│  │ Commander.js: --model, --bare, --permissions,     │                │
│  │               --remote, -A (addDir), ...          │                │
│  └──────────────────────────────────────────────────┘                │
│         ↓                                                            │
│                                                                      │
│  Phase 4: 初始化序列（串行）                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Settings │→│ Auth     │→│ Context  │→│ Tools    │             │
│  │ 加载+迁移 │  │ API Key  │  │ git状态   │  │ 注册 45+ │             │
│  │          │  │ OAuth    │  │ CLAUDE.md │  │ 工具     │             │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│         ↓                                                            │
│                                                                      │
│  Phase 5: UI 启动                                                    │
│  ┌──────────────────────────────────────────────────┐                │
│  │ React/Ink 渲染 → REPL 交互循环 → 等待用户输入    │                │
│  └──────────────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// 2. 预取优化：冷启动性能的关键
// ============================================================

function explainPrefetchOptimization(): void {
  console.log("\n" + "=".repeat(70));
  console.log("⚡ Phase 1: 预取优化（Prefetch Optimization）");
  console.log("=".repeat(70));

  console.log(`
📌 核心思想：利用 import 评估期间的空闲时间

  问题：macOS Keychain 读取需要 ~65ms（同步调用更慢）
  解决：在 import 语句之前就发起异步预取

  源码位置：main.tsx 前 20 行
  ┌──────────────────────────────────────────┐
  │ // 这些在 import 之前执行！              │
  │ profileCheckpoint('main_tsx_entry')       │
  │ startMdmRawRead()     // MDM 企业策略读取│
  │ startKeychainPrefetch() // 钥匙串预取    │
  │                                          │
  │ // 然后才开始 import（耗时 100-200ms）   │
  │ import { Commander } from 'commander'    │
  │ import React from 'react'                │
  │ import { render } from 'ink'             │
  └──────────────────────────────────────────┘

  时间线：
  T=0ms   ──→ 发起预取（非阻塞）
  T=0ms   ──→ 开始 import 评估
  T=65ms  ──→ Keychain 结果就绪（在后台）
  T=150ms ──→ import 完成，预取结果已可用

  🎯 关键收益：将 65ms 的串行等待变为 0ms（与 import 并行完成）
`);

  // 模拟预取模式
  console.log("  📊 模拟预取 vs 串行启动:");
  const serialTime = 65 + 150; // Keychain + imports
  const parallelTime = Math.max(65, 150); // 并行取最大值
  console.log(`  串行方式: ${serialTime}ms (Keychain 65ms + Imports 150ms)`);
  console.log(`  预取方式: ${parallelTime}ms (并行执行，取最大值)`);
  console.log(
    `  节省: ${serialTime - parallelTime}ms (${(((serialTime - parallelTime) / serialTime) * 100).toFixed(0)}%)\n`
  );
}

// ============================================================
// 3. Feature Flags：条件导入与死代码消除
// ============================================================

function explainFeatureFlags(): void {
  console.log("=".repeat(70));
  console.log("🏳️ Phase 2: Feature Flags 与条件导入");
  console.log("=".repeat(70));

  // 模拟 Feature Flags
  interface FeatureFlag {
    name: string;
    envVar: string;
    description: string;
    modules: string[];
    defaultEnabled: boolean;
  }

  const featureFlags: FeatureFlag[] = [
    {
      name: "COORDINATOR_MODE",
      envVar: "CLAUDE_CODE_COORDINATOR_MODE",
      description: "多 Agent 协调模式（Supervisor + Workers）",
      modules: ["coordinator/coordinatorMode.ts"],
      defaultEnabled: false,
    },
    {
      name: "KAIROS",
      envVar: "(GrowthBook gate)",
      description: "主动式助手模式（Assistant）",
      modules: ["assistant/index.ts"],
      defaultEnabled: false,
    },
    {
      name: "BRIDGE_MODE",
      envVar: "CLAUDE_CODE_BRIDGE",
      description: "IDE 双向桥接模式（VSCode 集成）",
      modules: ["bridge/bridgeMain.ts", "bridge/bridgeMessaging.ts"],
      defaultEnabled: false,
    },
    {
      name: "VOICE_MODE",
      envVar: "CLAUDE_CODE_VOICE",
      description: "语音输入模式",
      modules: ["voice/"],
      defaultEnabled: false,
    },
    {
      name: "TRANSCRIPT_CLASSIFIER",
      envVar: "(GrowthBook gate)",
      description: "ML 安全分类器（Auto 模式的自动审批）",
      modules: ["services/classifier/"],
      defaultEnabled: false,
    },
  ];

  console.log(`
📌 核心机制：Bun 打包器在构建时进行死代码消除（DCE）

  源码模式：
  ┌──────────────────────────────────────────────────┐
  │ const module = feature('FLAG_NAME')              │
  │   ? require('./heavy-module.js')  // ~50KB       │
  │   : null                                         │
  │                                                  │
  │ // 如果 FLAG 关闭，整个 require 被 DCE 剔除     │
  │ // 最终产物不包含这 50KB 代码                    │
  └──────────────────────────────────────────────────┘

📌 已知的 Feature Flags:
`);

  featureFlags.forEach((flag, i) => {
    console.log(`  ${i + 1}. ${flag.name}`);
    console.log(`     环境变量: ${flag.envVar}`);
    console.log(`     功能: ${flag.description}`);
    console.log(`     条件加载: ${flag.modules.join(", ")}`);
    console.log(`     默认启用: ${flag.defaultEnabled ? "✅" : "❌"}`);
    console.log();
  });

  console.log("  🎯 设计收益:");
  console.log("  - 减小发布包体积（未启用的功能不打包）");
  console.log("  - 支持 A/B 测试和灰度发布");
  console.log("  - 无需代码分支即可开关大型功能");
}

// ============================================================
// 4. CLI 参数解析
// ============================================================

function explainCLIParsing(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📋 Phase 3: CLI 参数解析（Commander.js）");
  console.log("=".repeat(70));

  interface CLIOption {
    flag: string;
    description: string;
    example: string;
  }

  const cliOptions: CLIOption[] = [
    {
      flag: "--model <model>",
      description: "覆盖默认 LLM 模型",
      example: "claude --model claude-opus-4-0-20250514",
    },
    {
      flag: "--bare",
      description: "跳过 CLAUDE.md 自动发现",
      example: "claude --bare",
    },
    {
      flag: "-A, --add-dir <path>",
      description: "添加额外上下文目录",
      example: "claude -A /path/to/docs",
    },
    {
      flag: "--permissions <mode>",
      description: "权限模式: default|plan|bypassPermissions|auto",
      example: "claude --permissions auto",
    },
    {
      flag: "--remote",
      description: "远程会话模式",
      example: "claude --remote",
    },
    {
      flag: "-p, --print",
      description: "非交互模式，输出后退出",
      example: 'claude -p "explain this code"',
    },
    {
      flag: "--resume <id>",
      description: "恢复之前的会话",
      example: "claude --resume abc123",
    },
  ];

  console.log("\n  📌 关键 CLI 选项:\n");
  cliOptions.forEach((opt) => {
    console.log(`  ${opt.flag}`);
    console.log(`    说明: ${opt.description}`);
    console.log(`    示例: ${opt.example}`);
    console.log();
  });

  console.log(`  📌 参数优先级链:
  CLI 标志 > 环境变量 > settings.local.json > settings.json > 默认值

  示例：模型选择
  1. --model claude-opus     (最高优先级)
  2. CLAUDE_MODEL=claude-opus (次之)
  3. settings.local.json → model: "claude-opus" (再次)
  4. settings.json → model: "claude-sonnet"  (再次)
  5. 内置默认值                (最低)
`);
}

// ============================================================
// 5. 初始化序列
// ============================================================

function explainInitSequence(): void {
  console.log("=".repeat(70));
  console.log("⚙️  Phase 4: 初始化序列（Init Sequence）");
  console.log("=".repeat(70));

  console.log(`
📌 串行初始化步骤（顺序不可乱）：

  ┌─ Step 1: Settings 加载 ────────────────────────────────────────┐
  │                                                                 │
  │  加载源：                                                       │
  │  ├─ ~/.claude/settings.json        （全局设置）                 │
  │  ├─ ~/.claude/settings.local.json  （本地覆盖，不提交 git）     │
  │  ├─ .claude/settings.json          （项目级设置）               │
  │  └─ MDM 覆盖                        （企业管控策略）            │
  │                                                                 │
  │  配置迁移：                                                     │
  │  ├─ migrateFennecToOpus.ts    （旧模型名 → 新名称）            │
  │  ├─ migrateAutoUpdates.ts     （自动更新配置变更）              │
  │  └─ ... 共 13+ 个迁移脚本                                      │
  │                                                                 │
  │  🔑 关键数据结构：SettingsJson                                  │
  │  {                                                              │
  │    model?: string,              // 默认模型                     │
  │    permissions?: PermissionMode, // 权限模式                    │
  │    customInstructions?: string, // 自定义指令                   │
  │    mcpServers?: MCPServerConfig[], // MCP 服务器配置            │
  │    hooks?: HookConfig[],        // Hook 配置                    │
  │    ...                                                          │
  │  }                                                              │
  └─────────────────────────────────────────────────────────────────┘
           ↓
  ┌─ Step 2: 身份认证 ──────────────────────────────────────────────┐
  │                                                                  │
  │  认证方式（按优先级）：                                          │
  │  1. 环境变量 ANTHROPIC_API_KEY                                   │
  │  2. OAuth Token（~/.claude/oauth-token.json）                    │
  │  3. Keychain（macOS）/ 密钥管理器                                │
  │                                                                  │
  │  Token 刷新：OAuth Token 过期时自动刷新                          │
  └──────────────────────────────────────────────────────────────────┘
           ↓
  ┌─ Step 3: 上下文加载 ────────────────────────────────────────────┐
  │                                                                  │
  │  getSystemContext():                                              │
  │  ├─ Git 状态（分支、最近提交、未暂存变更）                       │
  │  ├─ 当前工作目录                                                 │
  │  └─ 缓存标识                                                     │
  │                                                                  │
  │  getClaudeMds():                                                  │
  │  ├─ 项目根目录 CLAUDE.md                                         │
  │  ├─ .claude/ 目录下的记忆文件                                    │
  │  ├─ --add-dir 指定的额外目录                                     │
  │  └─ 合并为 system-reminder 注入消息列表                          │
  │                                                                  │
  │  ⚡ 缓存策略：memoize() 跨 turn 缓存，CLAUDE.md 变更时清除      │
  └──────────────────────────────────────────────────────────────────┘
           ↓
  ┌─ Step 4: 工具 & 命令注册 ──────────────────────────────────────┐
  │                                                                  │
  │  工具注册（~45 个）：                                             │
  │  ├─ BashTool, FileReadTool, FileEditTool, FileWriteTool          │
  │  ├─ GlobTool, GrepTool, WebFetchTool, WebSearchTool              │
  │  ├─ MCPTool, AgentTool, SkillTool                                │
  │  ├─ TaskCreateTool, TaskUpdateTool, TaskGetTool                  │
  │  └─ 根据 permissionMode 过滤不可用工具                          │
  │                                                                  │
  │  命令注册（~50 个）：                                             │
  │  ├─ /commit, /review, /config, /doctor, /memory                  │
  │  └─ 每个命令是 commands/ 下的独立模块                            │
  └──────────────────────────────────────────────────────────────────┘
           ↓
  ┌─ Step 5: 状态初始化 ────────────────────────────────────────────┐
  │                                                                  │
  │  AppState（Zustand 模式）：                                      │
  │  ├─ settings: SettingsJson                                       │
  │  ├─ permission: ToolPermissionContext                             │
  │  ├─ tasks: Map<taskId, TaskState>                                │
  │  ├─ mcp: { clients, tools, resources }                           │
  │  └─ ui: { expandedView, footerSelection, ... }                  │
  │                                                                  │
  │  Session 恢复（如果 --resume）：                                  │
  │  ├─ restoreCostStateForSession(sessionId)                        │
  │  └─ 恢复消息历史                                                 │
  └──────────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// 6. Bootstrap 单例模式
// ============================================================

function explainBootstrapSingletons(): void {
  console.log("=".repeat(70));
  console.log("🏗️  bootstrap/state.ts 全局单例（56KB）");
  console.log("=".repeat(70));

  console.log(`
📌 bootstrap/state.ts 是 Claude Code 的"全局变量仓库"

  为什么用单例而不是依赖注入？
  → 因为 CLI 工具只有一个进程、一个会话
  → 单例更简单，避免了 DI 容器的复杂性
  → 但通过 memoize() 确保可重置性

📌 关键单例及其职责：

  ┌────────────────────────────┬──────────────────────────────────┐
  │ 单例名称                   │ 职责                             │
  ├────────────────────────────┼──────────────────────────────────┤
  │ currentWorkingDirectory    │ 当前工作目录（可变，cd 后更新）  │
  │ runtimeMainLoopModel      │ 主循环使用的 LLM 模型            │
  │ modelCapabilitiesCache     │ 模型能力缓存（上下文窗口等）    │
  │ sessionId                  │ 当前会话 ID（UUID）              │
  │ registeredHooksRegistry    │ 已注册的 Hook 列表               │
  │ pluginCache                │ 插件缓存                         │
  │ settingsCache (memoize)    │ 设置缓存（文件变更时失效）      │
  │ featureGateCache           │ Feature Flag 缓存                │
  │ fileStateCache (LRU)       │ 文件内容缓存（含 mtime 校验）   │
  └────────────────────────────┴──────────────────────────────────┘

📌 缓存失效策略：

  ┌──────────────────────┬──────────────────────────────┐
  │ 缓存类型             │ 何时失效                     │
  ├──────────────────────┼──────────────────────────────┤
  │ settingsCache        │ .claude/settings.json 变更时 │
  │ systemContextCache   │ System Prompt 注入变更时     │
  │ claudeMdCache        │ CLAUDE.md 文件被修改时       │
  │ fileStateCache       │ 文件 mtime 变更 或 LRU 淘汰 │
  │ modelCapabilities    │ 模型切换时                   │
  └──────────────────────┴──────────────────────────────┘
`);
}

// ============================================================
// 7. React/Ink UI 启动
// ============================================================

function explainUIStartup(): void {
  console.log("=".repeat(70));
  console.log("🖥️  Phase 5: React/Ink 终端 UI 启动");
  console.log("=".repeat(70));

  console.log(`
📌 Claude Code 使用 React + Ink 渲染终端 UI

  为什么选择 React/Ink？
  → 声明式 UI（状态变化自动重绘）
  → 组件化复用（140+ 组件）
  → Yoga 布局引擎（CSS Flexbox in Terminal）
  → 与 React 生态兼容（hooks, context 等）

📌 组件树结构：

  <App>
    └─ <AlternateScreen>
        └─ <REPL>                      ← 主交互循环
            ├─ <MessageDisplay>        ← 消息渲染
            │   ├─ <AssistantMessage>  ← AI 回复（支持 Markdown）
            │   ├─ <ToolUseMessage>    ← 工具调用展示
            │   ├─ <ThinkingMessage>   ← 思考过程
            │   └─ <SystemMessage>     ← 系统消息
            ├─ <PermissionDialog>      ← 权限确认弹窗
            │   ├─ <ToolDescription>
            │   └─ <ApproveButton> / <DenyButton>
            ├─ <ProgressIndicator>     ← 工具执行进度
            └─ <PromptInput>           ← 用户输入框
                └─ <VimEditor>         ← 可选的 Vim 模式

📌 渲染循环：

  1. 用户输入 → 触发 onSubmitMessage
  2. QueryEngine.submitMessage() 返回 AsyncGenerator
  3. 每个 yield 的 SDKMessage → 更新 React state
  4. Ink 检测 state 变更 → 重新渲染受影响的组件
  5. Yoga 计算新布局 → 写入终端 ANSI 序列

📌 关键文件规模：

  ┌────────────────────────────┬──────────┐
  │ 文件                       │ 组件数   │
  ├────────────────────────────┼──────────┤
  │ components/                │ ~140 个  │
  │ components/messages/       │ ~20 个   │
  │ components/permissions/    │ ~15 个   │
  │ screens/                   │ ~5 个    │
  │ ink/                       │ ~30 个   │
  └────────────────────────────┴──────────┘
`);
}

// ============================================================
// 8. 模拟简化版启动流程
// ============================================================

async function simulateBootstrap(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 模拟简化版启动流程");
  console.log("=".repeat(70));

  // 模拟各阶段耗时
  interface BootstrapPhase {
    name: string;
    duration: number;
    parallel?: boolean;
  }

  const phases: BootstrapPhase[] = [
    { name: "Keychain 预取", duration: 65, parallel: true },
    { name: "MDM 预读取", duration: 20, parallel: true },
    { name: "模块 import", duration: 150, parallel: true },
    { name: "Settings 加载 + 迁移", duration: 30 },
    { name: "Auth 验证", duration: 45 },
    { name: "Git 状态检测", duration: 80 },
    { name: "CLAUDE.md 发现与解析", duration: 25 },
    { name: "工具注册 (45+)", duration: 15 },
    { name: "命令注册 (50+)", duration: 10 },
    { name: "AppState 初始化", duration: 5 },
    { name: "React/Ink 首次渲染", duration: 40 },
  ];

  console.log("\n  📊 各阶段耗时模拟：\n");

  let totalTime = 0;
  const parallelPhases = phases.filter((p) => p.parallel);
  const serialPhases = phases.filter((p) => !p.parallel);

  // 并行阶段（取最大值）
  const parallelTime = Math.max(...parallelPhases.map((p) => p.duration));
  console.log("  ⚡ 并行预取阶段（同时执行，取最大值）:");
  parallelPhases.forEach((p) => {
    const bar = "█".repeat(Math.floor(p.duration / 5));
    console.log(`     ${p.name.padEnd(20)} ${bar} ${p.duration}ms`);
  });
  console.log(`     ${"并行耗时".padEnd(20)} → ${parallelTime}ms`);
  totalTime += parallelTime;

  console.log("\n  🔄 串行初始化阶段:");
  serialPhases.forEach((p) => {
    const bar = "█".repeat(Math.floor(p.duration / 5));
    console.log(`     ${p.name.padEnd(20)} ${bar} ${p.duration}ms`);
    totalTime += p.duration;
  });

  console.log(`\n  📊 总启动时间: ~${totalTime}ms (~${(totalTime / 1000).toFixed(1)}s)`);
  console.log("  💡 实际启动通常 < 1s（得益于 Bun 的快速启动）");
}

// ============================================================
// 9. 小结
// ============================================================

function showSummary(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📝 启动流程学习要点");
  console.log("=".repeat(70));

  console.log(`
  1️⃣  预取优化：在 import 之前发起耗时 I/O，利用并行节省启动时间
  2️⃣  Feature Flags：条件导入 + 打包器 DCE = 按需加载、灵活开关
  3️⃣  配置层级：CLI > 环境变量 > local settings > settings > 默认值
  4️⃣  Bootstrap 单例：memoize + 缓存失效 = 简单高效的全局状态
  5️⃣  React/Ink UI：声明式终端界面，140+ 组件 + Yoga 布局引擎

  📌 思考题：
  - 为什么预取要在 import 之前而不是之后？
  - Feature Flags 模式适用于哪些场景？你的项目可以借鉴吗？
  - 单例 vs 依赖注入，CLI 工具为什么选单例更合适？
  - 如果要加速启动，还有哪些优化空间？

  📂 建议阅读的源码文件（按顺序）：
  1. ClaudeCodeSource/main.tsx:1-50       — 预取阶段
  2. ClaudeCodeSource/main.tsx:50-200     — Feature Flags
  3. ClaudeCodeSource/entrypoints/cli.tsx  — 完整 CLI 初始化
  4. ClaudeCodeSource/bootstrap/state.ts   — 全局单例
  5. ClaudeCodeSource/context.ts           — 上下文收集
`);
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  showBootstrapOverview();
  explainPrefetchOptimization();
  explainFeatureFlags();
  explainCLIParsing();
  explainInitSequence();
  explainBootstrapSingletons();
  explainUIStartup();
  await simulateBootstrap();
  showSummary();
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("01-bootstrap-flow.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { showBootstrapOverview, explainPrefetchOptimization };
