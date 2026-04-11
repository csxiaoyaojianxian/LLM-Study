/**
 * 03-tool-system.ts — 工具系统深度解析
 *
 * 📌 学习目标：理解 Claude Code 如何注册、分发、并发执行 45+ 工具
 *
 * 对应源码文件：
 * - ClaudeCodeSource/Tool.ts                          — 工具接口定义（792行）
 * - ClaudeCodeSource/tools/                           — 45+ 工具实现
 * - ClaudeCodeSource/services/tools/StreamingToolExecutor.ts — 并发执行器
 * - ClaudeCodeSource/services/tools/toolExecution.ts  — 工具执行逻辑
 *
 * 无需 API Key，直接运行即可学习
 */

// ============================================================
// 1. 工具系统概览
// ============================================================

function showToolSystemOverview(): void {
  console.log("=".repeat(70));
  console.log("🔧 Claude Code 工具系统深度解析");
  console.log("=".repeat(70));

  console.log(`
📌 工具系统是 Claude Code 的"四肢"

  LLM（大脑）通过工具系统与外部世界交互：
  ┌──────────────────────────────────────────────────┐
  │                    LLM (大脑)                     │
  │  "我需要读取 main.ts 的内容"                     │
  │                                                   │
  │  输出: ToolUseBlock {                             │
  │    name: "Read",                                  │
  │    input: { file_path: "/src/main.ts" }           │
  │  }                                                │
  └────────────────────┬─────────────────────────────┘
                       ↓
  ┌──────────────────────────────────────────────────┐
  │              Tool System (四肢)                    │
  │                                                   │
  │  1. 查找工具: tools["Read"]                       │
  │  2. 检查权限: canUseTool("Read", input)           │
  │  3. 执行工具: Read.execute(input, context)        │
  │  4. 返回结果: ToolResultBlock                     │
  └──────────────────────────────────────────────────┘
`);
}

// ============================================================
// 2. Tool 接口定义
// ============================================================

function explainToolInterface(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📋 Tool 接口定义（Tool.ts）");
  console.log("=".repeat(70));

  console.log(`
📌 每个工具都实现 Tool 接口：

  type Tool = {
    // ── 基本信息 ──
    name: string                    // 工具名（LLM 看到的名字）
    description(input, ctx):        // 动态描述（给用户看的）
      Promise<string>
    userFacingName(input): string   // UI 显示名称

    // ── 输入 Schema ──
    inputSchema:                    // JSON Schema 或动态生成
      ToolInputJSONSchema
      | ((ctx) => ToolInputJSONSchema)

    // ── 执行函数 ──
    execute(input, ctx):            // 核心：执行工具逻辑
      Promise<ToolResult>
      | AsyncGenerator<ToolResultPart>  // 支持流式结果！

    // ── 并发控制 ──
    maxConcurrentInvocations?: number   // 最大并发数
    isConcurrencySafe?: boolean         // 是否可并发
    isConcurrencySafe?(input): boolean  // 按输入判断

    // ── 可选钩子 ──
    shouldPrefetch?: boolean        // 是否预取
  }

📌 ToolResult 的多种类型：

  type ToolResult =
    | string                          // 简单文本
    | { type: 'text', text: string }  // 结构化文本
    | { type: 'error', error: string }// 错误
    | { type: 'image', source: ... }  // 图片
    | { type: 'document', ... }       // PDF/文档
    | { type: 'streaming_chunked',    // 流式分块
        chunks: string[] }

📌 ToolUseContext — 工具执行时的上下文：

  type ToolUseContext = {
    options: {
      commands: Command[]               // 可用命令
      tools: Tools                       // 所有工具
      mcpClients: MCPServerConnection[]  // MCP 服务器
      thinkingConfig: ThinkingConfig     // 思考配置
    }
    abortController: AbortController     // 中止控制器
    readFileState: FileStateCache        // 文件缓存
    getAppState(): AppState              // 全局状态
    setAppState(f): void                 // 更新状态
  }

  🔑 关键设计：通过 Context 注入依赖，而不是全局 import
  → 使工具可测试、可隔离
  → 工具不需要知道自己在什么环境中执行
`);
}

// ============================================================
// 3. 工具分类
// ============================================================

function showToolCatalog(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📚 工具分类（45+ 工具）");
  console.log("=".repeat(70));

  interface ToolInfo {
    name: string;
    concurrency: "并发" | "独占" | "受限";
    permission: "低" | "中" | "高";
    description: string;
  }

  const toolCategories: Record<string, ToolInfo[]> = {
    "📂 文件操作": [
      { name: "Read", concurrency: "并发", permission: "中", description: "读取文件（支持图片、PDF、Notebook）" },
      { name: "Edit", concurrency: "独占", permission: "高", description: "精确字符串替换编辑" },
      { name: "Write", concurrency: "独占", permission: "高", description: "创建/覆写文件" },
      { name: "Glob", concurrency: "并发", permission: "低", description: "文件模式匹配搜索" },
      { name: "Grep", concurrency: "并发", permission: "低", description: "ripgrep 内容搜索" },
    ],
    "💻 系统交互": [
      { name: "Bash", concurrency: "受限", permission: "高", description: "Shell 命令执行（支持后台任务）" },
      { name: "TaskOutput", concurrency: "并发", permission: "低", description: "获取后台任务输出" },
      { name: "TaskStop", concurrency: "独占", permission: "中", description: "终止后台任务" },
    ],
    "🌐 网络": [
      { name: "WebFetch", concurrency: "并发", permission: "中", description: "URL 内容抓取 + AI 分析" },
      { name: "WebSearch", concurrency: "并发", permission: "中", description: "Web 搜索" },
    ],
    "🤖 Agent 协调": [
      { name: "Agent", concurrency: "并发", permission: "高", description: "子 Agent 生成" },
      { name: "SendMessage", concurrency: "独占", permission: "高", description: "Agent 间通信" },
      { name: "TeamCreate", concurrency: "独占", permission: "高", description: "创建 Agent 团队" },
    ],
    "📋 任务管理": [
      { name: "TaskCreate", concurrency: "独占", permission: "高", description: "创建任务" },
      { name: "TaskUpdate", concurrency: "独占", permission: "高", description: "更新任务状态" },
      { name: "TaskGet", concurrency: "并发", permission: "低", description: "获取任务详情" },
      { name: "TaskList", concurrency: "并发", permission: "低", description: "列出所有任务" },
    ],
    "🔌 扩展": [
      { name: "MCP", concurrency: "并发", permission: "高", description: "MCP 服务器工具调用" },
      { name: "Skill", concurrency: "独占", permission: "高", description: "技能执行" },
      { name: "NotebookEdit", concurrency: "独占", permission: "高", description: "Jupyter Notebook 编辑" },
    ],
    "⚙️ 辅助": [
      { name: "AskUser", concurrency: "独占", permission: "低", description: "向用户提问" },
      { name: "EnterPlanMode", concurrency: "独占", permission: "低", description: "进入计划模式" },
      { name: "ExitPlanMode", concurrency: "独占", permission: "低", description: "退出计划模式" },
      { name: "Cron*", concurrency: "独占", permission: "中", description: "定时任务管理" },
    ],
  };

  for (const [category, tools] of Object.entries(toolCategories)) {
    console.log(`\n  ${category}:`);
    console.log(
      `  ${"工具名".padEnd(18)} ${"并发性".padEnd(8)} ${"权限".padEnd(6)} 描述`
    );
    console.log(`  ${"─".repeat(60)}`);
    tools.forEach((t) => {
      console.log(
        `  ${t.name.padEnd(18)} ${t.concurrency.padEnd(8)} ${t.permission.padEnd(6)} ${t.description}`
      );
    });
  }
}

// ============================================================
// 4. 工具注册机制
// ============================================================

function explainToolRegistration(): void {
  console.log("\n\n" + "=".repeat(70));
  console.log("📝 工具注册机制");
  console.log("=".repeat(70));

  console.log(`
📌 工具注册发生在启动初始化阶段

  getTools(context: ToolUseContext): Tools

  步骤：
  ┌─── Step 1: 静态工具列表 ────────────────────────────────────┐
  │                                                              │
  │  const tools: Tool[] = [                                     │
  │    BashTool,        // 内置 Shell                            │
  │    FileReadTool,    // 文件读取                              │
  │    FileEditTool,    // 文件编辑                              │
  │    FileWriteTool,   // 文件写入                              │
  │    GlobTool,        // 模式搜索                              │
  │    GrepTool,        // 内容搜索                              │
  │    WebFetchTool,    // URL 抓取                              │
  │    WebSearchTool,   // Web 搜索                              │
  │    AgentTool,       // 子 Agent                              │
  │    SkillTool,       // 技能执行                              │
  │    // ... 30+ more                                           │
  │  ]                                                           │
  └──────────────────────────────────────────────────────────────┘
          ↓
  ┌─── Step 2: 权限过滤 ───────────────────────────────────────-┐
  │                                                              │
  │  // 根据 permissionMode 过滤工具                            │
  │  if (!isAutoModeAvailable()) {                               │
  │    tools = tools.filter(t => !t.requiresAutoMode)            │
  │  }                                                           │
  │                                                              │
  │  // Bridge 模式禁用某些工具                                 │
  │  if (isBridgeMode()) {                                       │
  │    tools = tools.filter(t => !t.disabledInBridge)            │
  │  }                                                           │
  └──────────────────────────────────────────────────────────────┘
          ↓
  ┌─── Step 3: 动态 MCP 工具 ──────────────────────────────────-┐
  │                                                              │
  │  // MCP 服务器提供的工具动态添加                            │
  │  if (context.mcpClients.length > 0) {                        │
  │    const mcpTools = getMcpToolsCommandsAndResources(          │
  │      context.mcpClients                                      │
  │    )                                                         │
  │    tools.push(...mcpTools.tools)                              │
  │  }                                                           │
  │                                                              │
  │  // MCP 工具与内置工具使用完全相同的 Tool 接口！            │
  └──────────────────────────────────────────────────────────────┘
          ↓
  ┌─── Step 4: 生成工具定义 ───────────────────────────────────-┐
  │                                                              │
  │  // 转换为 API 可接受的 tool definitions                    │
  │  const toolDefinitions = tools.map(tool => ({                │
  │    name: tool.name,                                          │
  │    description: tool.description,                            │
  │    input_schema: tool.inputSchema,                           │
  │  }))                                                         │
  │                                                              │
  │  // 这些定义随每次 API 请求发送                             │
  └──────────────────────────────────────────────────────────────┘

📌 关键设计：MCP 工具与内置工具统一接口

  内置工具: Tool { name: "Bash", execute: ... }
  MCP 工具: Tool { name: "mcp__server__tool", execute: ... }
            ↑ execute 内部实际调用 MCP 协议

  对 LLM 来说，两者完全一样，都是可调用的工具
  → 这就是 MCP 的威力：扩展工具集无需修改 Agent 逻辑
`);
}

// ============================================================
// 5. StreamingToolExecutor — 并发执行
// ============================================================

function explainStreamingToolExecutor(): void {
  console.log("=".repeat(70));
  console.log("⚡ StreamingToolExecutor — 并发工具执行器");
  console.log("=".repeat(70));

  console.log(`
📌 核心问题：如何高效执行多个工具调用？

  场景：LLM 同时返回 3 个工具调用
  ToolUse A: Read("main.ts")        ← 读操作，可并发
  ToolUse B: Read("utils.ts")       ← 读操作，可并发
  ToolUse C: Bash("npm install")    ← 写操作，需独占

📌 执行模型：

  ┌──────────────────────────────────────────────────────────────┐
  │ StreamingToolExecutor                                        │
  │                                                              │
  │  Step 1: 分类工具                                            │
  │  ┌──────────────────┐  ┌──────────────────┐                 │
  │  │ 并发安全组        │  │ 独占组            │                 │
  │  │ A: Read main.ts  │  │ C: Bash npm inst  │                 │
  │  │ B: Read utils.ts │  │                    │                 │
  │  └──────────────────┘  └──────────────────┘                 │
  │                                                              │
  │  Step 2: 先执行并发安全组（A 和 B 并行执行）                │
  │  A ─────████████────── 完成 ✓                                │
  │  B ─────██████████──── 完成 ✓                                │
  │         ↓                                                    │
  │  Step 3: 再执行独占组（C 单独执行）                          │
  │  C ──────────████████████──── 完成 ✓                         │
  │                                                              │
  │  Step 4: 按原始顺序返回结果                                  │
  │  → A 的结果  → B 的结果  → C 的结果                          │
  │  （即使 B 比 A 先完成，也保持原始顺序！）                    │
  └──────────────────────────────────────────────────────────────┘

📌 FIFO 结果保证：

  为什么结果要保持原始顺序？
  → LLM 的推理依赖于 ToolUse 和 ToolResult 的一一对应
  → API 要求 ToolResult 的顺序与 ToolUse 一致
  → 乱序会导致 LLM 混淆（读 A 的结果当成 B 的）

  实现方式：
  ┌──────────────────────────────────────────────────────┐
  │ internal queue: TrackedTool[]                        │
  │                                                      │
  │ addTool(toolBlock):                                  │
  │   queue.push({ toolBlock, result: null, status })    │
  │                                                      │
  │ 执行时：result 异步填充                              │
  │   queue[0].result = await executeA()  // 可能后完成  │
  │   queue[1].result = await executeB()  // 可能先完成  │
  │                                                      │
  │ getRemainingResults():                               │
  │   // 从 queue[0] 开始，按序 yield 已完成的结果       │
  │   // 如果 queue[0] 未完成，等待它完成后再 yield      │
  └──────────────────────────────────────────────────────┘

📌 并发安全判断（isConcurrencySafe）：

  不同工具的并发策略：
  ┌────────────────┬──────────────────────────────────────┐
  │ 工具           │ 并发策略                             │
  ├────────────────┼──────────────────────────────────────┤
  │ Read           │ 始终安全（只读操作）                 │
  │ Glob           │ 始终安全（只读操作）                 │
  │ Grep           │ 始终安全（只读操作）                 │
  │ WebFetch       │ 始终安全（无副作用）                 │
  │ Bash           │ 按命令判断（ls 安全, rm 不安全）     │
  │ Edit           │ 始终独占（文件写操作）               │
  │ Write          │ 始终独占（文件写操作）               │
  │ Agent          │ 始终并发（子进程隔离）               │
  └────────────────┴──────────────────────────────────────┘
`);
}

// ============================================================
// 6. 重点工具：BashTool 深度分析
// ============================================================

function explainBashTool(): void {
  console.log("=".repeat(70));
  console.log("💻 重点工具：BashTool 深度分析");
  console.log("=".repeat(70));

  console.log(`
📌 BashTool 是最复杂的工具，因为它能做任何事情

  输入 Schema:
  {
    command: string,           // 要执行的命令
    description?: string,      // 命令描述（给用户看）
    timeout?: number,          // 超时（毫秒，默认 120000）
    run_in_background?: boolean // 是否后台执行
  }

📌 BashTool 的特殊处理：

  1. 安全分类器（Bash Classifier）
     ┌──────────────────────────────────────────────────┐
     │ 用户: "列出文件"                                 │
     │ LLM: Bash { command: "ls -la" }                  │
     │                                                   │
     │ → 分类器判断: "ls 是安全命令" → 自动批准        │
     │ → 不弹出权限确认对话框 → 更流畅的体验           │
     │                                                   │
     │ 用户: "删除所有文件"                             │
     │ LLM: Bash { command: "rm -rf ." }                │
     │                                                   │
     │ → 分类器判断: "rm -rf 是危险命令" → 需要确认    │
     │ → 弹出权限对话框 → 用户决定是否执行             │
     └──────────────────────────────────────────────────┘

  2. 后台任务支持
     ┌──────────────────────────────────────────────────┐
     │ Bash { command: "npm run dev", run_in_background: true }
     │                                                   │
     │ → 创建 TaskState { type: 'local_bash', ... }    │
     │ → 进程在后台运行                                 │
     │ → 通过 TaskOutput 工具读取输出                   │
     │ → 通过 TaskStop 工具终止                         │
     └──────────────────────────────────────────────────┘

  3. 工作目录管理
     ┌──────────────────────────────────────────────────┐
     │ 每次 Bash 执行在当前工作目录（cwd）下运行       │
     │ cd 命令的效果不跨调用持久化                      │
     │ 但 shell 环境从用户 profile 初始化               │
     └──────────────────────────────────────────────────┘

  4. 并发安全判断
     ┌──────────────────────────────────────────────────┐
     │ isConcurrencySafe(input):                        │
     │   // ls, cat, git status 等只读命令 → 并发安全   │
     │   // rm, mv, npm install 等写命令 → 需要独占     │
     │   // 默认保守：不确定 = 不并发                   │
     └──────────────────────────────────────────────────┘
`);
}

// ============================================================
// 7. 工具执行管线
// ============================================================

function explainToolPipeline(): void {
  console.log("=".repeat(70));
  console.log("🔄 工具执行管线（Tool Execution Pipeline）");
  console.log("=".repeat(70));

  console.log(`
📌 一个工具调用的完整执行链路：

  LLM 输出 ToolUseBlock
      ↓
  ┌─── 1. 工具查找 ─────────────────────────────────────────────┐
  │  const tool = tools[toolUseBlock.name]                       │
  │  if (!tool) → 返回 "Unknown tool" 错误                      │
  └──────────────────────────────────────────────────────────────┘
      ↓
  ┌─── 2. 输入解析 ─────────────────────────────────────────────┐
  │  const input = JSON.parse(toolUseBlock.input)                │
  │  // Zod 验证确保输入符合 schema                             │
  └──────────────────────────────────────────────────────────────┘
      ↓
  ┌─── 3. Pre-Hook 执行 ────────────────────────────────────────┐
  │  const hookResult = await executePreToolUseHooks(tool, input)│
  │  if (hookResult.continue === false) → 终止执行              │
  │  if (hookResult.updatedInput) → 使用修改后的输入            │
  └──────────────────────────────────────────────────────────────┘
      ↓
  ┌─── 4. 权限检查 ─────────────────────────────────────────────┐
  │  const permission = await canUseTool(tool, input, ctx)       │
  │  if (permission.behavior === 'deny') → 返回拒绝消息        │
  │  if (permission.behavior === 'ask') → 弹出确认对话框        │
  │  // 详见 04-permission-system.ts                            │
  └──────────────────────────────────────────────────────────────┘
      ↓
  ┌─── 5. 工具执行 ─────────────────────────────────────────────┐
  │  // 检查中止信号                                            │
  │  if (ctx.abortController.signal.aborted) → 返回中止消息     │
  │                                                              │
  │  // 执行工具                                                │
  │  const result = await tool.execute(input, ctx)               │
  │  // 或 for await (const part of tool.execute(...))           │
  │  // → 支持流式进度输出                                      │
  └──────────────────────────────────────────────────────────────┘
      ↓
  ┌─── 6. Post-Hook 执行 ───────────────────────────────────────┐
  │  await executePostToolUseHooks(tool, input, result)          │
  │  // Hook 可以修改输出                                       │
  └──────────────────────────────────────────────────────────────┘
      ↓
  ┌─── 7. 结果封装 ─────────────────────────────────────────────┐
  │  return createUserMessage({                                  │
  │    content: [{                                               │
  │      type: 'tool_result',                                    │
  │      tool_use_id: toolUseBlock.id,                           │
  │      content: result.text,                                   │
  │      is_error: result.isError,                               │
  │    }],                                                       │
  │    sourceToolAssistantUUID: assistantMessage.uuid,           │
  │  })                                                          │
  └──────────────────────────────────────────────────────────────┘

📌 关键设计点：

  1. Pre/Post Hook 环绕执行 → 可拦截、修改、增强
  2. 权限检查在 Hook 之后 → Hook 可以影响权限决策
  3. sourceToolAssistantUUID 追踪链路 → 可追溯到发起的 LLM 回复
  4. 流式执行 → AsyncGenerator 支持实时进度反馈
`);
}

// ============================================================
// 8. 模拟并发工具执行
// ============================================================

async function simulateConcurrentExecution(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 模拟并发工具执行");
  console.log("=".repeat(70));

  interface SimTool {
    name: string;
    input: string;
    isSafe: boolean;
    duration: number;
  }

  const toolCalls: SimTool[] = [
    { name: "Read", input: "main.ts", isSafe: true, duration: 50 },
    { name: "Grep", input: '"TODO"', isSafe: true, duration: 80 },
    { name: "Bash", input: "npm test", isSafe: false, duration: 200 },
    { name: "Read", input: "README.md", isSafe: true, duration: 30 },
  ];

  console.log("\n  📥 LLM 返回 4 个工具调用：\n");
  toolCalls.forEach((t, i) => {
    const safety = t.isSafe ? "✅ 并发安全" : "🔒 需独占";
    console.log(`  ${i + 1}. ${t.name}(${t.input}) — ${safety} — 预估 ${t.duration}ms`);
  });

  // 分组
  const safeGroup = toolCalls.filter((t) => t.isSafe);
  const exclusiveGroup = toolCalls.filter((t) => !t.isSafe);

  console.log("\n  📊 执行策略：\n");
  console.log(`  并发组 (${safeGroup.length} 个): ${safeGroup.map((t) => `${t.name}(${t.input})`).join(", ")}`);
  console.log(`  独占组 (${exclusiveGroup.length} 个): ${exclusiveGroup.map((t) => `${t.name}(${t.input})`).join(", ")}`);

  // 模拟执行
  console.log("\n  ⚡ 开始执行...\n");

  const start = Date.now();

  // 并发组
  console.log("  [并发] 同时执行 Read(main.ts) + Grep(TODO) + Read(README.md)");
  const parallelTime = Math.max(...safeGroup.map((t) => t.duration));
  await new Promise((r) => setTimeout(r, 100)); // 模拟延迟
  console.log(`  [并发] 全部完成 — 耗时 ~${parallelTime}ms (取最慢的)`);

  // 独占组
  console.log(`\n  [独占] 执行 Bash(npm test)`);
  await new Promise((r) => setTimeout(r, 100)); // 模拟延迟
  console.log(`  [独占] 完成 — 耗时 ~${exclusiveGroup[0].duration}ms`);

  const totalParallel = parallelTime + exclusiveGroup[0].duration;
  const totalSerial = toolCalls.reduce((sum, t) => sum + t.duration, 0);

  console.log(`\n  📊 执行对比：`);
  console.log(`  串行执行: ${totalSerial}ms`);
  console.log(`  并发执行: ${totalParallel}ms`);
  console.log(`  节省: ${totalSerial - totalParallel}ms (${(((totalSerial - totalParallel) / totalSerial) * 100).toFixed(0)}%)`);

  console.log(`\n  📤 结果按原始顺序返回：`);
  toolCalls.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name}(${t.input}) → [result]`);
  });
  console.log(`  （即使 Read(README.md) 最先完成，也排在第 4 位）`);
}

// ============================================================
// 9. 小结
// ============================================================

function showSummary(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📝 工具系统学习要点");
  console.log("=".repeat(70));

  console.log(`
  1️⃣  统一接口：所有工具（内置 + MCP）实现相同的 Tool 接口
  2️⃣  流式执行：AsyncGenerator 支持实时进度反馈
  3️⃣  并发控制：按安全性分组，并发 + 独占混合执行
  4️⃣  FIFO 保证：结果按调用顺序返回，即使乱序完成
  5️⃣  管线模式：查找 → Hook → 权限 → 执行 → Hook → 封装
  6️⃣  上下文注入：ToolUseContext 提供全部依赖（DI 模式）

  📌 思考题：
  - 为什么工具结果要按原始顺序返回？乱序会有什么问题？
  - MCP 工具与内置工具统一接口有什么好处？
  - BashTool 的安全分类器如何影响用户体验？
  - 如果你要设计一个新工具，需要考虑哪些方面？

  📂 建议阅读的源码文件（按顺序）：
  1. ClaudeCodeSource/Tool.ts                — 工具接口定义
  2. ClaudeCodeSource/tools/BashTool/        — 最复杂的工具实现
  3. ClaudeCodeSource/tools/FileReadTool/    — 典型读操作工具
  4. ClaudeCodeSource/tools/FileEditTool/    — 典型写操作工具
  5. ClaudeCodeSource/services/tools/StreamingToolExecutor.ts
`);
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  showToolSystemOverview();
  explainToolInterface();
  showToolCatalog();
  explainToolRegistration();
  explainStreamingToolExecutor();
  explainBashTool();
  explainToolPipeline();
  await simulateConcurrentExecution();
  showSummary();
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("03-tool-system.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { showToolSystemOverview, showToolCatalog };
