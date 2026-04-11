/**
 * 02-agent-loop.ts — Agent 循环与消息流转深度解析
 *
 * 📌 学习目标：理解 Claude Code 的核心 Agent 循环如何运作
 *
 * 对应源码文件：
 * - ClaudeCodeSource/QueryEngine.ts  — 查询引擎（1,295行）
 * - ClaudeCodeSource/query.ts        — 查询循环编排（1,729行）
 * - ClaudeCodeSource/services/api/claude.ts — API 调用层（125KB）
 * - ClaudeCodeSource/services/compact/ — 上下文压缩
 *
 * 无需 API Key，直接运行即可学习
 */

// ============================================================
// 1. Agent 循环概览
// ============================================================

function showAgentLoopOverview(): void {
  console.log("=".repeat(70));
  console.log("🔄 Claude Code Agent 循环深度解析");
  console.log("=".repeat(70));

  console.log(`
📌 Claude Code 的核心是一个 Agent 循环（Agentic Loop）

  与传统聊天机器人的区别：
  ┌─────────────────────────────────────────────────────────────────┐
  │ 传统 Chat Bot:  用户 → LLM → 回复 → 结束                      │
  │                                                                 │
  │ Agent Loop:     用户 → LLM → [工具调用] → LLM → [工具调用]     │
  │                       → LLM → ... → 最终回复 → 结束            │
  └─────────────────────────────────────────────────────────────────┘

  Agent 可以多轮调用工具直到任务完成。这就是 Claude Code 能
  "自主编程"的核心机制。

📌 两层架构：

  ┌─────────────────────────────────────────────┐
  │  QueryEngine.ts (外层)                       │
  │  - 管理消息历史（mutableMessages）           │
  │  - 处理用户输入（斜杠命令展开）              │
  │  - 对外暴露 AsyncGenerator<SDKMessage>       │
  │  - 成本累计和 Session 状态                   │
  │                                               │
  │  ┌─────────────────────────────────────────┐ │
  │  │  query.ts (内层)                         │ │
  │  │  - API 调用 + 流式处理                   │ │
  │  │  - 工具执行编排                          │ │
  │  │  - Token 预算检查                        │ │
  │  │  - 上下文压缩触发                        │ │
  │  │  - 停止条件判断                          │ │
  │  └─────────────────────────────────────────┘ │
  └─────────────────────────────────────────────┘
`);
}

// ============================================================
// 2. QueryEngine 详解
// ============================================================

function explainQueryEngine(): void {
  console.log("\n" + "=".repeat(70));
  console.log("🔧 QueryEngine.ts — 查询引擎（外层）");
  console.log("=".repeat(70));

  console.log(`
📌 QueryEngine 是 Claude Code 与 UI 的桥梁

  核心方法：submitMessage()

  async *submitMessage(
    prompt: string | ContentBlockParam[],
    options?: { uuid?: string; isMeta?: boolean }
  ): AsyncGenerator<SDKMessage, void, unknown>

  关键点：
  1. 返回 AsyncGenerator → 支持流式输出到 UI
  2. 维护 mutableMessages → 跨 turn 持久化的消息列表
  3. 不可重入 → 同一时间只能处理一个请求

📌 submitMessage 流程：

  ┌─── Step 1: 准备阶段 ─────────────────────────────────────────┐
  │                                                                │
  │  // 清除旧缓存                                                │
  │  clearSystemPromptCache()                                      │
  │                                                                │
  │  // 获取系统提示词（git 状态、CLAUDE.md、当前日期等）         │
  │  const systemPrompt = await fetchSystemPromptParts(...)        │
  │                                                                │
  │  // 构建处理上下文                                            │
  │  const processContext = {                                      │
  │    messages: this.mutableMessages,  // ← 持久化消息列表       │
  │    setMessages: fn => { ... },      // ← 修改消息列表         │
  │    hooks, notifiers, elicitation    // ← 回调函数             │
  │  }                                                             │
  └────────────────────────────────────────────────────────────────┘
          ↓
  ┌─── Step 2: 用户输入处理 ─────────────────────────────────────┐
  │                                                                │
  │  processUserInput(prompt, processContext)                       │
  │  ├─ 斜杠命令展开（/commit → 实际操作）                        │
  │  ├─ 消息规范化（添加 UUID、时间戳）                           │
  │  └─ 追加到 mutableMessages                                    │
  └────────────────────────────────────────────────────────────────┘
          ↓
  ┌─── Step 3: 进入 query 循环 ─────────────────────────────────-┐
  │                                                                │
  │  for await (const msg of query(queryConfig)) {                 │
  │    // 转换为 SDK 消息格式                                      │
  │    yield toSDKMessage(msg)                                     │
  │    // 累计 Token 使用量                                        │
  │    if (msg.type === 'assistant') accumulateUsage(msg)          │
  │  }                                                             │
  └────────────────────────────────────────────────────────────────┘
          ↓
  ┌─── Step 4: 完成 ────────────────────────────────────────────-─┐
  │                                                                │
  │  yield {                                                       │
  │    type: 'session_complete',                                   │
  │    usage: totalUsage,          // 总 Token 使用量              │
  │    denials: permissionDenials, // 被拒绝的工具调用             │
  │  }                                                             │
  └────────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// 3. query.ts 核心循环
// ============================================================

function explainQueryLoop(): void {
  console.log("\n" + "=".repeat(70));
  console.log("🔁 query.ts — 核心 Agent 循环（内层）");
  console.log("=".repeat(70));

  console.log(`
📌 query.ts 是 Agent 循环的心脏（1,729 行）

  while (true) {
    ┌─── 1. 消息规范化 ──────────────────────────────────────────┐
    │  const normalized = normalizeMessagesForAPI(               │
    │    messages,           // 完整消息历史                     │
    │    systemPrompt,       // 系统提示词                       │
    │    userContext,         // git 状态、CLAUDE.md 等           │
    │    appendSystemContext  // 追加上下文（在请求时注入）       │
    │  )                                                         │
    │                                                            │
    │  ⚠️ 重要：normalizeMessagesForAPI 不是幂等的！             │
    │  调用两次会重复注入上下文 → 每次 API 调用只调一次          │
    └────────────────────────────────────────────────────────────┘
            ↓
    ┌─── 2. Token 预算检查 ──────────────────────────────────────┐
    │  if (hasExceededTokenBudget(messages, model)) {            │
    │    // 超出预算 → 触发压缩或停止                           │
    │    yield createSystemMessage('Budget exceeded')            │
    │    break                                                   │
    │  }                                                         │
    └────────────────────────────────────────────────────────────┘
            ↓
    ┌─── 3. API 调用（流式） ────────────────────────────────────┐
    │  const apiCall = streamMessageWithRetry({                  │
    │    model: runtimeMainLoopModel,                            │
    │    system: systemPrompt,                                   │
    │    messages: normalized,                                   │
    │    tools: toolDefinitions,     // 所有可用工具的 schema    │
    │    thinking: {                                             │
    │      type: 'enabled',                                      │
    │      budget_tokens: 8000       // 自适应思考预算           │
    │    },                                                      │
    │    betas: ['interleaved-thinking-2025-05-14'],             │
    │  })                                                        │
    └────────────────────────────────────────────────────────────┘
            ↓
    ┌─── 4. 流事件处理 ─────────────────────────────────────────-┐
    │  for await (const event of apiCall) {                      │
    │    switch (event.type) {                                   │
    │      case 'content_block_start':                           │
    │        → 开始新的文本块 / 工具调用块 / 思考块              │
    │      case 'content_block_delta':                           │
    │        → 增量文本、工具参数 JSON 片段                      │
    │        → yield 到 UI 实现实时打字效果                      │
    │      case 'content_block_stop':                            │
    │        → 一个块完成                                        │
    │      case 'message_delta':                                 │
    │        → stop_reason + usage 统计                          │
    │      case 'message_stop':                                  │
    │        → 整个响应完成                                      │
    │    }                                                       │
    │  }                                                         │
    └────────────────────────────────────────────────────────────┘
            ↓
    ┌─── 5. 工具执行 ───────────────────────────────────────────-┐
    │  // 从流中重建完整的 AssistantMessage                      │
    │  const assistantMsg = reconstructMessageFromStream(...)     │
    │  mutableMessages.push(assistantMsg)                        │
    │                                                            │
    │  // 提取所有 tool_use 块                                   │
    │  const toolCalls = assistantMsg.content                    │
    │    .filter(b => b.type === 'tool_use')                     │
    │                                                            │
    │  if (toolCalls.length === 0) {                             │
    │    break  // 没有工具调用 → 结束当前 turn                  │
    │  }                                                         │
    │                                                            │
    │  // 并发执行工具                                           │
    │  const results = yield* StreamingToolExecutor.run(          │
    │    toolCalls, runTools, toolUseContext                      │
    │  )                                                         │
    │  mutableMessages.push(...results)                          │
    └────────────────────────────────────────────────────────────┘
            ↓
    ┌─── 6. 循环判断 ───────────────────────────────────────────-┐
    │  // 有工具结果 → 继续循环（让 LLM 基于结果继续推理）      │
    │  // 无工具调用 → break（LLM 认为任务完成）                │
    │  // 预算耗尽 → break                                       │
    │  // 最大轮次 → break                                       │
    │  continue  // → 回到 Step 1                                │
    └────────────────────────────────────────────────────────────┘
  }
`);
}

// ============================================================
// 4. 消息类型系统
// ============================================================

function explainMessageTypes(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📨 消息类型系统（Message Types）");
  console.log("=".repeat(70));

  interface MessageTypeInfo {
    type: string;
    description: string;
    role: string;
    example: string;
  }

  const messageTypes: MessageTypeInfo[] = [
    {
      type: "UserMessage",
      description: "用户输入的消息",
      role: "user",
      example: '"帮我写一个排序函数"',
    },
    {
      type: "AssistantMessage",
      description: "AI 助手的回复（含文本、工具调用、思考）",
      role: "assistant",
      example: "content: [TextBlock, ToolUseBlock, ThinkingBlock]",
    },
    {
      type: "ToolResultMessage",
      description: "工具执行结果（作为 UserMessage 的 content）",
      role: "user",
      example: "tool_result: { tool_use_id, content, is_error }",
    },
    {
      type: "SystemMessage",
      description: "系统提示/警告",
      role: "system",
      example: '"Budget exceeded" / "Context compacted"',
    },
    {
      type: "ProgressMessage",
      description: "工具执行进度",
      role: "system",
      example: "{ percentage: 45, message: 'Reading files...' }",
    },
    {
      type: "TombstoneMessage",
      description: "被压缩/裁剪的历史占位符",
      role: "system",
      example: '"[Previous context compacted]"',
    },
    {
      type: "HookResultMessage",
      description: "Hook 执行的输出",
      role: "system",
      example: '"Hook: lint passed"',
    },
  ];

  console.log("\n  📌 消息类型一览：\n");
  messageTypes.forEach((mt) => {
    console.log(`  📩 ${mt.type}`);
    console.log(`     角色: ${mt.role}`);
    console.log(`     说明: ${mt.description}`);
    console.log(`     示例: ${mt.example}`);
    console.log();
  });

  console.log(`  📌 ContentBlock 类型（AssistantMessage 内部）：

  AssistantMessage.content = [
    TextBlock          → 普通文本回复
    ToolUseBlock       → 工具调用请求 { id, name, input }
    ThinkingBlock      → 思考过程（仅本轮可见，不回传 API）
    RedactedThinkingBlock → 被隐藏的思考（API 返回时已脱敏）
  ]

  📌 关键设计：工具调用结果以 UserMessage 身份发送

  为什么？因为 Anthropic API 要求严格的消息交替：
  User → Assistant → User → Assistant → ...

  所以工具结果被包装成 UserMessage：
  Assistant: [TextBlock, ToolUseBlock(id=abc)]
  User:      [ToolResultBlock(tool_use_id=abc, content="...")]
  `);
}

// ============================================================
// 5. 消息规范化管线
// ============================================================

function explainMessageNormalization(): void {
  console.log("=".repeat(70));
  console.log("🔄 消息规范化管线（Message Normalization Pipeline）");
  console.log("=".repeat(70));

  console.log(`
📌 normalizeMessagesForAPI() 在每次 API 调用前执行

  输入：mutableMessages（原始消息历史）
  输出：API 可接受的规范化消息列表

  处理步骤：
  ┌──────────────────────────────────────────────────────────────┐
  │ 1. 上下文注入                                               │
  │    → 在消息列表开头注入 git 状态、CLAUDE.md 内容            │
  │    → 作为 system-reminder 类型的 UserMessage                │
  ├──────────────────────────────────────────────────────────────┤
  │ 2. 压缩边界检查                                             │
  │    → 检测是否跨越了之前的压缩边界                           │
  │    → TombstoneMessage 标记被压缩的历史                      │
  ├──────────────────────────────────────────────────────────────┤
  │ 3. 权限审计附加                                             │
  │    → 将权限决策记录附加到相关消息                           │
  ├──────────────────────────────────────────────────────────────┤
  │ 4. 工具定义去重                                             │
  │    → 避免重复注入已在上下文中的工具定义                     │
  ├──────────────────────────────────────────────────────────────┤
  │ 5. 严格工具结果配对                                         │
  │    → 验证每个 ToolUseBlock 都有对应的 ToolResultBlock       │
  │    → 缺失的补充合成的错误结果                               │
  ├──────────────────────────────────────────────────────────────┤
  │ 6. 图片验证                                                 │
  │    → 验证图片满足 API 尺寸/格式限制                         │
  └──────────────────────────────────────────────────────────────┘

  ⚠️ 核心注意点：

  1. 非幂等操作！调用两次会重复注入上下文
     → 所以 mutableMessages 持久化，normalization 每次 API 调用只做一次

  2. 原始消息列表是可变的（mutable）
     → 工具结果直接 push 到 mutableMessages
     → 压缩后替换旧消息为 TombstoneMessage

  3. sourceToolAssistantUUID 追踪链路
     → 每个 ToolResultMessage 关联到产生它的 AssistantMessage
     → 用于中止传播、权限审计、分析追踪
`);
}

// ============================================================
// 6. 上下文压缩（Context Compaction）
// ============================================================

function explainContextCompaction(): void {
  console.log("=".repeat(70));
  console.log("🗜️  上下文压缩（Context Compaction）");
  console.log("=".repeat(70));

  console.log(`
📌 为什么需要压缩？

  模型上下文窗口有限（如 200K tokens）
  长对话 + 大量工具输出 → 很容易超限
  超限 = API 返回 Prompt-Too-Long (PTL) 错误

📌 三种压缩模式：

  ┌── Auto-Compact（自动压缩） ─────────────────────────────────┐
  │ 触发条件：Token 使用接近上下文窗口 90%                      │
  │ 行为：压缩当前 turn 之前的所有消息                          │
  │ 目标：压缩后保留 ~50K tokens                                │
  │ 触发位置：query.ts 循环内                                   │
  │                                                              │
  │ 原始消息: [M1, M2, M3, M4, M5, M6(当前)]                   │
  │           ──────────────────┤               │                │
  │           压缩这部分         │  保留当前 turn                │
  │           → TombstoneMessage │                               │
  └──────────────────────────────────────────────────────────────┘

  ┌── Snip-Compact（手动裁剪） ─────────────────────────────────┐
  │ 触发条件：用户执行 /snip 命令                               │
  │ 行为：创建对话状态快照，允许标记"保留"区域                 │
  │ 特点：可选择性保留重要上下文                                │
  └──────────────────────────────────────────────────────────────┘

  ┌── Microcompact（API 级微压缩） ─────────────────────────────┐
  │ 触发条件：在 normalizeMessagesForAPI() 内部                 │
  │ 行为：裁剪大型消息（如图片块）以减少 PTL 风险              │
  │ 特点：透明执行，用户不感知                                  │
  └──────────────────────────────────────────────────────────────┘

📌 压缩后恢复策略：

  POST_COMPACT_MAX_FILES_TO_RESTORE = 5   // 恢复最近访问的文件
  POST_COMPACT_TOKEN_BUDGET = 50K         // 恢复内容的 token 预算
  POST_COMPACT_MAX_TOKENS_PER_FILE = 5K   // 单文件恢复上限

  恢复优先级：最近访问的文件优先（LRU 策略）
  → FileStateCache 追踪文件访问时间
  → "刚读过的文件很可能马上还要用"

📌 错误处理中的压缩：

  streamMessageWithRetry() 的重试逻辑：
  ┌──────────────────────────────────────────────┐
  │ 1. 发送 API 请求                             │
  │ 2. 收到 PTL 错误                             │
  │ 3. 不是简单重试！而是触发 auto-compact       │
  │ 4. 压缩后用更短的上下文重试                  │
  │                                               │
  │ 🔑 关键洞察：                                 │
  │ PTL 错误 → 压缩后重试（不是简单 replay）     │
  │ 因为相同的大上下文重发还是会失败              │
  └──────────────────────────────────────────────┘
`);
}

// ============================================================
// 7. 流式处理架构
// ============================================================

function explainStreamingArchitecture(): void {
  console.log("=".repeat(70));
  console.log("🌊 流式处理架构（Streaming Architecture）");
  console.log("=".repeat(70));

  console.log(`
📌 Claude Code 全链路使用 AsyncGenerator 实现流式处理

  为什么全链路流式？
  → 用户体验：打字效果、实时进度
  → 内存效率：不需要等完整响应才处理
  → 可中断性：用户可以随时 Ctrl+C

📌 流式处理链路：

  API Server (SSE)
    ↓ Server-Sent Events
  streamMessageWithRetry()         ← 重试 + 错误处理
    ↓ AsyncGenerator<StreamEvent>
  query.ts 循环                    ← 工具提取 + 消息组装
    ↓ AsyncGenerator<QueryEvent>
  QueryEngine.submitMessage()      ← 成本统计 + SDK 转换
    ↓ AsyncGenerator<SDKMessage>
  React/Ink REPL 组件              ← 状态更新 → 重新渲染
    ↓ Terminal ANSI
  用户终端

📌 流事件类型（Server → Client）：

  content_block_start  → 新块开始（TextBlock / ToolUseBlock / ThinkingBlock）
  content_block_delta  → 增量内容（文本片段、JSON 片段）
  content_block_stop   → 块完成
  message_delta        → 消息级元数据（usage、stop_reason）
  message_stop         → 整个响应完成

📌 流式重组（Stream Reassembly）：

  API 返回的是碎片化的流事件，需要重组为完整消息：

  事件序列：
  content_block_start(TextBlock)
  content_block_delta("我来")
  content_block_delta("帮你")
  content_block_delta("写代码")
  content_block_stop
  content_block_start(ToolUseBlock: bash)
  content_block_delta('{"comma')
  content_block_delta('nd":"ls"}')
  content_block_stop
  message_stop

  重组结果：
  AssistantMessage {
    content: [
      TextBlock("我来帮你写代码"),
      ToolUseBlock({ name: "bash", input: { command: "ls" } })
    ]
  }
`);
}

// ============================================================
// 8. 模拟 Agent 循环
// ============================================================

async function simulateAgentLoop(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 模拟 Agent 循环执行过程");
  console.log("=".repeat(70));

  // 模拟消息类型
  interface SimMessage {
    role: "user" | "assistant" | "tool_result";
    content: string;
    toolCalls?: Array<{ name: string; input: string }>;
  }

  const messages: SimMessage[] = [];

  // Turn 1: 用户输入
  console.log("\n  📝 用户: '帮我查看当前目录有哪些文件，然后读取 README.md'\n");
  messages.push({
    role: "user",
    content: "帮我查看当前目录有哪些文件，然后读取 README.md",
  });

  // Turn 2: LLM 决定调用工具
  console.log("  --- Agent Loop: Turn 1 ---");
  console.log("  🤖 LLM 思考: 需要先列出文件，再读取 README.md");
  console.log('  🔧 LLM 决定调用工具: Bash { command: "ls -la" }');
  messages.push({
    role: "assistant",
    content: "我来帮你查看文件列表。",
    toolCalls: [{ name: "Bash", input: 'command: "ls -la"' }],
  });

  // 工具执行
  console.log("  ⚙️  执行 Bash: ls -la");
  console.log(
    "  📤 工具结果: README.md  package.json  src/  tsconfig.json"
  );
  messages.push({
    role: "tool_result",
    content: "README.md  package.json  src/  tsconfig.json",
  });

  // Turn 3: LLM 继续
  console.log("\n  --- Agent Loop: Turn 2 ---");
  console.log("  🤖 LLM 思考: 已看到文件列表，现在需要读取 README.md");
  console.log('  🔧 LLM 决定调用工具: FileRead { path: "README.md" }');
  messages.push({
    role: "assistant",
    content: "找到了 README.md，让我读取它的内容。",
    toolCalls: [{ name: "FileRead", input: 'path: "README.md"' }],
  });

  console.log("  ⚙️  执行 FileRead: README.md");
  console.log("  📤 工具结果: # My Project\\nThis is a demo...");
  messages.push({
    role: "tool_result",
    content: "# My Project\\nThis is a demo project.",
  });

  // Turn 4: LLM 完成
  console.log("\n  --- Agent Loop: Turn 3 ---");
  console.log("  🤖 LLM 思考: 已获得所有信息，可以回复用户");
  console.log("  ✅ LLM 返回最终回复（无工具调用 → 循环结束）");
  console.log(
    '  💬 回复: "当前目录包含 4 个项目：README.md、package.json...'
  );

  // 统计
  console.log("\n  📊 Agent 循环统计:");
  console.log(`  总 Turn 数: 3`);
  console.log(`  工具调用: 2 次 (Bash × 1, FileRead × 1)`);
  console.log(`  消息总数: ${messages.length}`);
  console.log(
    `  停止原因: end_turn (LLM 认为任务完成，未返回 tool_use)`
  );
}

// ============================================================
// 9. 停止条件
// ============================================================

function explainStopConditions(): void {
  console.log("\n" + "=".repeat(70));
  console.log("🛑 Agent 循环停止条件");
  console.log("=".repeat(70));

  interface StopCondition {
    name: string;
    trigger: string;
    action: string;
  }

  const stopConditions: StopCondition[] = [
    {
      name: "end_turn",
      trigger: "LLM 回复中没有 tool_use 块",
      action: "正常结束，返回最终回复给用户",
    },
    {
      name: "budget_exceeded",
      trigger: "累计 Token 使用量超过预算",
      action: "终止循环，通知用户预算耗尽",
    },
    {
      name: "max_turns",
      trigger: "循环次数达到上限（防止无限循环）",
      action: "终止循环，返回当前已有结果",
    },
    {
      name: "user_abort",
      trigger: "用户按 Ctrl+C / 取消",
      action: "AbortController.abort() 传播到所有异步操作",
    },
    {
      name: "prompt_too_long",
      trigger: "上下文超过模型窗口（压缩后仍超限）",
      action: "终止循环，提示用户",
    },
  ];

  console.log("\n  📌 五种停止条件：\n");
  stopConditions.forEach((sc, i) => {
    console.log(`  ${i + 1}. ${sc.name}`);
    console.log(`     触发: ${sc.trigger}`);
    console.log(`     行为: ${sc.action}`);
    console.log();
  });
}

// ============================================================
// 10. 小结
// ============================================================

function showSummary(): void {
  console.log("=".repeat(70));
  console.log("📝 Agent 循环学习要点");
  console.log("=".repeat(70));

  console.log(`
  1️⃣  两层架构：QueryEngine（外层管理）+ query.ts（内层循环）
  2️⃣  循环核心：API 调用 → 流式处理 → 工具执行 → 继续或停止
  3️⃣  消息持久化：mutableMessages 跨 turn 持久化，normalization 不幂等
  4️⃣  流式全链路：AsyncGenerator 从 API 到 UI 全链路流式传递
  5️⃣  智能压缩：PTL 错误触发压缩而非简单重试
  6️⃣  停止条件：end_turn / budget / max_turns / abort / PTL

  📌 思考题：
  - 为什么 mutableMessages 是"可变"的而不是不可变的？
  - 消息规范化为什么不能是幂等操作？
  - 如果没有压缩机制，Agent 能执行多少轮工具调用？
  - 全链路流式处理带来了哪些工程复杂度？

  📂 建议阅读的源码文件（按顺序）：
  1. ClaudeCodeSource/QueryEngine.ts:209-400   — submitMessage 方法
  2. ClaudeCodeSource/query.ts:150-500         — 核心循环
  3. ClaudeCodeSource/query.ts:500-800         — 流事件处理
  4. ClaudeCodeSource/services/api/claude.ts    — API 调用层
  5. ClaudeCodeSource/services/compact/         — 压缩实现
`);
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  showAgentLoopOverview();
  explainQueryEngine();
  explainQueryLoop();
  explainMessageTypes();
  explainMessageNormalization();
  explainContextCompaction();
  explainStreamingArchitecture();
  await simulateAgentLoop();
  explainStopConditions();
  showSummary();
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("02-agent-loop.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { showAgentLoopOverview, explainQueryEngine };
