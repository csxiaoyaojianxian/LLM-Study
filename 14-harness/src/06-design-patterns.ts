/**
 * 06-design-patterns.ts — 架构设计模式总结
 *
 * 📌 学习目标：提炼 Claude Code 源码中的核心设计模式，应用到自己的项目
 *
 * 对应源码文件：
 * - ClaudeCodeSource/state/AppStateStore.ts    — 状态管理
 * - ClaudeCodeSource/services/tools/StreamingToolExecutor.ts — 并发
 * - ClaudeCodeSource/bootstrap/state.ts        — 单例+缓存
 * - ClaudeCodeSource/services/api/errors.ts    — 错误处理
 * - ClaudeCodeSource/cost-tracker.ts           — 成本追踪
 *
 * 无需 API Key，直接运行即可学习
 */

// ============================================================
// 1. 概览
// ============================================================

function showPatternsOverview(): void {
  console.log("=".repeat(70));
  console.log("🏗️  Claude Code 核心设计模式总结");
  console.log("=".repeat(70));

  console.log(`
📌 从 1,900+ 文件的生产级代码中提炼出 10 大设计模式

  这些模式不仅适用于 AI Harness 开发
  也适用于任何复杂 TypeScript/Node.js 项目

  ┌──────────────────────────────────────────────────────────────┐
  │  #  模式名称              对应文件/系统                      │
  ├──────────────────────────────────────────────────────────────┤
  │  1  全链路 AsyncGenerator  QueryEngine → query → UI          │
  │  2  FIFO 并发执行器        StreamingToolExecutor              │
  │  3  多层决策管线            Permission System                 │
  │  4  Memoize + 选择性失效   bootstrap/state.ts                │
  │  5  DeepImmutable 状态     AppState                          │
  │  6  Feature Flag + DCE     main.tsx 条件导入                  │
  │  7  上下文注入（DI）       ToolUseContext                     │
  │  8  Token 感知重试          streamMessageWithRetry            │
  │  9  渐进式信任              Permission Rules                 │
  │ 10  串行 Hook 管线          hooks.ts                         │
  └──────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// Pattern 1: 全链路 AsyncGenerator
// ============================================================

function pattern1_AsyncGenerator(): void {
  console.log("\n" + "=".repeat(70));
  console.log("🔄 模式 1: 全链路 AsyncGenerator（流式处理）");
  console.log("=".repeat(70));

  console.log(`
📌 问题：如何从 API 到 UI 实现全链路流式传输？

📌 解决方案：每一层都返回 AsyncGenerator

  async function* apiLayer(): AsyncGenerator<StreamEvent> {
    // 从 SSE 流中 yield 事件
    for await (const event of sseStream) {
      yield event
    }
  }

  async function* queryLayer(): AsyncGenerator<QueryEvent> {
    // 消费 API 层的 generator
    for await (const event of apiLayer()) {
      // 处理事件（提取工具调用等）
      yield transformedEvent
    }
    // 执行工具后继续循环
    yield* toolResults
  }

  async function* engineLayer(): AsyncGenerator<SDKMessage> {
    // 消费 query 层的 generator
    for await (const event of queryLayer()) {
      yield toSDKMessage(event)
    }
  }

📌 核心优势：

  ┌─── 实时性 ─────────────────────────────────────────────────┐
  │ 每个 token 产生后立即传递到 UI                              │
  │ 用户看到"打字"效果而非等待完整响应                         │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 内存效率 ───────────────────────────────────────────────┐
  │ 不需要缓存完整响应                                          │
  │ 100K token 的响应不会一次性占满内存                         │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 可中断性 ───────────────────────────────────────────────┐
  │ 用户 Ctrl+C → AbortController.abort()                      │
  │ generator 在下一个 yield 点自动终止                         │
  │ 不需要特殊的取消逻辑                                       │
  └─────────────────────────────────────────────────────────────┘

📌 适用场景：
  ✅ LLM 流式响应处理
  ✅ 文件流处理（大文件逐行读取）
  ✅ WebSocket/SSE 事件处理
  ✅ 分页数据加载
`);
}

// ============================================================
// Pattern 2: FIFO 并发执行器
// ============================================================

function pattern2_FIFOExecutor(): void {
  console.log("=".repeat(70));
  console.log("⚡ 模式 2: FIFO 并发执行器");
  console.log("=".repeat(70));

  console.log(`
📌 问题：多个任务需要并发执行，但结果必须按提交顺序返回

📌 解决方案：内部并发 + 有序缓冲 + 按序 yield

  class FIFOExecutor<T> {
    private queue: Array<{
      task: Promise<T>,
      result: T | null,
      status: 'pending' | 'done'
    }> = []

    // 添加任务（立即开始执行）
    addTask(taskFn: () => Promise<T>): void {
      const entry = { task: null, result: null, status: 'pending' }
      entry.task = taskFn().then(r => {
        entry.result = r
        entry.status = 'done'
      })
      this.queue.push(entry)
    }

    // 按序获取结果
    async *getResults(): AsyncGenerator<T> {
      while (this.queue.length > 0) {
        const first = this.queue[0]
        if (first.status === 'done') {
          yield first.result!
          this.queue.shift()
        } else {
          await first.task  // 等待队首完成
        }
      }
    }
  }

📌 执行时序示例：

  提交: Task A (100ms), Task B (50ms), Task C (200ms)

  T=0ms    A 开始 | B 开始 | C 开始
  T=50ms   B 完成（缓冲，不 yield，因为 A 还没完成）
  T=100ms  A 完成 → yield A → yield B（B 已缓冲）
  T=200ms  C 完成 → yield C

  结果顺序: A → B → C ✅（与提交顺序一致）

📌 适用场景：
  ✅ 批量 API 请求（并发发送，按序处理结果）
  ✅ 多文件处理（并发读取，按顺序合并）
  ✅ 测试执行（并发运行，按序报告）
`);
}

// ============================================================
// Pattern 3: 多层决策管线
// ============================================================

function pattern3_DecisionPipeline(): void {
  console.log("=".repeat(70));
  console.log("📊 模式 3: 多层决策管线");
  console.log("=".repeat(70));

  console.log(`
📌 问题：复杂的决策需要多个维度的判断

📌 解决方案：分层决策，每层可以终止或传递

  async function makeDecision(input): Promise<Decision> {
    // Layer 1: 快速路径（规则匹配）
    const ruleDecision = matchRules(input)
    if (ruleDecision.isTerminal) return ruleDecision

    // Layer 2: 智能判断（ML 分类器）
    const classifierDecision = await classify(input)
    if (classifierDecision.confidence > 0.95) return classifierDecision

    // Layer 3: 人工介入
    const humanDecision = await askHuman(input)
    return humanDecision
  }

📌 设计特点：

  ┌─── 快速路径优先 ───────────────────────────────────────────┐
  │ 80% 的请求在 Layer 1 就能决定（~1ms）                      │
  │ 减少不必要的 ML 推理或人工等待                             │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 逐层升级 ──────────────────────────────────────────────-┐
  │ 简单场景: 规则搞定                                          │
  │ 模糊场景: 分类器辅助                                        │
  │ 高风险: 人工介入                                            │
  │ → 决策质量随层级提升                                        │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 可扩展 ────────────────────────────────────────────────-┐
  │ 新增一层决策 = 新增一个函数                                 │
  │ 移除一层 = 注释掉对应代码                                   │
  │ 调整顺序 = 改变调用顺序                                     │
  └─────────────────────────────────────────────────────────────┘

📌 适用场景：
  ✅ 权限控制（规则 → 角色 → 上下文 → 审批）
  ✅ 内容审核（关键词 → ML → 人工）
  ✅ 路由分发（规则 → 负载均衡 → 降级）
`);
}

// ============================================================
// Pattern 4: Memoize + 选择性失效
// ============================================================

function pattern4_MemoizeWithInvalidation(): void {
  console.log("=".repeat(70));
  console.log("💾 模式 4: Memoize + 选择性失效");
  console.log("=".repeat(70));

  console.log(`
📌 问题：重复计算 expensive 的值，但值可能在某些条件下过时

📌 解决方案：memoize 缓存 + 精确的失效条件

  // 创建带缓存的函数
  const getSystemContext = memoize(async () => {
    const gitStatus = await getGitStatus()     // 耗时操作
    const claudeMd = await readClaudeMd()       // 文件 I/O
    return { gitStatus, claudeMd }
  })

  // 使用时直接调用（命中缓存则不执行）
  const ctx = await getSystemContext()  // 第一次: ~100ms
  const ctx = await getSystemContext()  // 第二次: ~0ms (缓存)

  // 精确失效
  function onFileChanged(path: string) {
    if (path.endsWith('CLAUDE.md')) {
      getSystemContext.cache.clear()  // 只清除相关缓存
    }
  }

📌 与传统缓存的区别：

  传统缓存:
  cache.set(key, value, ttl=60s)
  → 60s 后过期，不管值有没有变
  → 可能读到脏数据或频繁重算

  Memoize + 选择性失效:
  → 值不变就永远不失效（最高效）
  → 值变了立即失效（最准确）
  → 需要明确知道失效条件

📌 Claude Code 中的实际应用：

  ┌────────────────────────────┬──────────────────────────────┐
  │ 缓存函数                   │ 失效条件                     │
  ├────────────────────────────┼──────────────────────────────┤
  │ getSystemContext()         │ git 操作后                   │
  │ getClaudeMds()             │ CLAUDE.md 文件变更           │
  │ getSettings()              │ settings.json 变更           │
  │ getModelCapabilities()     │ 模型切换                     │
  │ getRegisteredHooks()       │ hook 配置变更                │
  └────────────────────────────┴──────────────────────────────┘

📌 适用场景：
  ✅ 配置文件读取
  ✅ 数据库 schema 缓存
  ✅ API 元数据缓存
  ✅ 编译结果缓存（源文件变更时失效）
`);
}

// ============================================================
// Pattern 5: DeepImmutable 状态管理
// ============================================================

function pattern5_DeepImmutable(): void {
  console.log("=".repeat(70));
  console.log("🔒 模式 5: DeepImmutable 状态管理");
  console.log("=".repeat(70));

  console.log(`
📌 问题：复杂的全局状态容易被意外修改

📌 解决方案：DeepImmutable 类型 + setter 函数

  // 类型系统强制不可变
  type DeepImmutable<T> =
    T extends object
      ? { readonly [K in keyof T]: DeepImmutable<T[K]> }
      : T

  // 状态只读
  const state: DeepImmutable<AppState> = getAppState()
  state.settings.model = 'new'  // ← TypeScript 编译错误！

  // 修改必须通过 setter
  setAppState(prev => ({
    ...prev,
    settings: { ...prev.settings, model: 'new' }
  }))

📌 Zustand 模式的状态订阅：

  // 订阅特定状态片段
  appState.subscribe(
    state => state.permission.toolPermissionContext,
    (newContext) => {
      updatePermissionCache(newContext)  // 自动响应变更
    }
  )

📌 核心收益：

  ┌─── 防意外修改 ─────────────────────────────────────────────┐
  │ 工具执行中不会意外修改全局状态                              │
  │ 编译期就能发现错误，不用等到运行时                         │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 数据流透明 ─────────────────────────────────────────────┐
  │ 所有修改都通过 setAppState → 可追踪                        │
  │ 类似 Redux 的单向数据流                                    │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 自动响应 ──────────────────────────────────────────────-┐
  │ subscribe 自动触发 UI 重渲染                                │
  │ 无需手动刷新                                                │
  └─────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// Pattern 6-10: 快速概览
// ============================================================

function patternsQuickOverview(): void {
  console.log("=".repeat(70));
  console.log("📋 模式 6-10: 快速概览");
  console.log("=".repeat(70));

  console.log(`

  ┌─── 模式 6: Feature Flag + 死代码消除 ─────────────────────┐
  │                                                             │
  │  const module = feature('FLAG')                             │
  │    ? require('./heavy-module.js')  // 50KB                  │
  │    : null                                                   │
  │                                                             │
  │  打包器在构建时评估 feature('FLAG')                        │
  │  如果为 false → 整个 require 被剔除 → 包体积更小          │
  │                                                             │
  │  收益：A/B 测试、灰度发布、减小包体积                     │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 模式 7: 上下文注入（依赖注入的变体） ──────────────────┐
  │                                                             │
  │  // 工具不直接 import 依赖                                 │
  │  async function execute(input, context: ToolUseContext) {   │
  │    const state = context.getAppState()    // 从上下文获取   │
  │    const abort = context.abortController  // 从上下文获取   │
  │  }                                                          │
  │                                                             │
  │  收益：                                                     │
  │  - 工具可独立测试（mock context）                          │
  │  - 无循环依赖                                               │
  │  - 运行时可替换实现                                         │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 模式 8: Token 感知重试 ─────────────────────────────────┐
  │                                                             │
  │  try {                                                      │
  │    await callAPI(messages)                                   │
  │  } catch (e) {                                              │
  │    if (isPromptTooLong(e)) {                                │
  │      // 不是简单重试！而是压缩后重试                       │
  │      await compactMessages()                                │
  │      await callAPI(shorterMessages)  // 用更短的上下文     │
  │    } else if (isRateLimit(e)) {                             │
  │      await sleep(exponentialBackoff())                       │
  │      await callAPI(messages)  // 相同请求重试              │
  │    }                                                        │
  │  }                                                          │
  │                                                             │
  │  关键：不同错误类型 → 不同重试策略                         │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 模式 9: 渐进式信任 ─────────────────────────────────────┐
  │                                                             │
  │  第 1 次使用：所有操作需确认                               │
  │  用户选择"总是允许 npm run *" → 规则持久化                │
  │  第 2 次使用：npm run 命令自动批准                         │
  │  用户选择"总是允许 docker *" → 规则持久化                 │
  │  第 N 次使用：大多数操作自动批准                           │
  │                                                             │
  │  规则集随使用量增长 → 确认频率自然下降                    │
  │  用户建立信任模型 → 安全性与效率兼顾                      │
  └─────────────────────────────────────────────────────────────┘

  ┌─── 模式 10: 串行 Hook 管线 ────────────────────────────────┐
  │                                                             │
  │  for (const hook of matchingHooks) {                        │
  │    const result = await hook.execute(input)                 │
  │    if (result.continue === false) break   // 中断           │
  │    if (result.updatedInput) {                               │
  │      input = result.updatedInput          // 链式修改       │
  │    }                                                        │
  │  }                                                          │
  │                                                             │
  │  串行保证：                                                 │
  │  - 无竞态条件                                               │
  │  - 后续 Hook 可使用前置 Hook 的修改结果                    │
  │  - 中断语义清晰                                             │
  └─────────────────────────────────────────────────────────────┘
`);
}

// ============================================================
// 实战：Token 成本追踪系统
// ============================================================

function explainCostTracking(): void {
  console.log("=".repeat(70));
  console.log("💰 实战模式：Token 成本追踪系统");
  console.log("=".repeat(70));

  console.log(`
📌 Claude Code 的成本追踪（cost-tracker.ts）是多个模式的综合应用

  ┌─── 模式应用 ───────────────────────────────────────────────┐
  │                                                             │
  │  1. DeepImmutable 状态                                      │
  │     modelUsage: DeepImmutable<Record<string, Usage>>        │
  │                                                             │
  │  2. 按模型累积                                              │
  │     每次 API 调用后累加 input/output/cache tokens           │
  │                                                             │
  │  3. 会话持久化                                              │
  │     saveCurrentSessionCosts() → 保存到 .claude/config      │
  │     restoreCostStateForSession() → 恢复之前的成本          │
  │                                                             │
  │  4. 实时计算                                                │
  │     USD 成本 = Σ(tokens × rate) 对每个 token 类型          │
  │     input / output / cache_read / cache_creation            │
  └─────────────────────────────────────────────────────────────┘

📌 成本计算公式：

  calculateUSDCost(model, usage) =
    usage.input_tokens × inputRate[model]
    + usage.output_tokens × outputRate[model]
    + usage.cache_read_input_tokens × cacheReadRate[model]
    + usage.cache_creation_input_tokens × cacheCreationRate[model]

📌 Token 统计的三种精度：

  ┌──────────────────────┬──────────────────────────────────────┐
  │ 精度                 │ 方法                                 │
  ├──────────────────────┼──────────────────────────────────────┤
  │ 精确                 │ 从 API 响应头读取（最准）            │
  │ 采样                 │ 从最近一次 API 调用推算              │
  │ 估算                 │ 按字符数粗略计算（最快）             │
  └──────────────────────┴──────────────────────────────────────┘

  使用场景：
  - 精确：最终账单、成本报告
  - 采样：循环中的预算检查
  - 估算：压缩前的 token 压力评估
`);
}

// ============================================================
// 总结：如何将这些模式应用到你的项目
// ============================================================

function showApplicationGuide(): void {
  console.log("\n" + "=".repeat(70));
  console.log("🎯 如何将这些模式应用到你的项目");
  console.log("=".repeat(70));

  console.log(`
📌 场景 1：构建 AI Agent 应用

  必用模式：
  #1 AsyncGenerator  → LLM 流式响应
  #2 FIFO 执行器     → 并发工具调用
  #3 决策管线        → 权限控制
  #8 Token 感知重试  → 上下文管理

📌 场景 2：构建 CLI 工具

  必用模式：
  #4 Memoize 缓存    → 配置/文件读取
  #6 Feature Flag    → 功能开关
  #7 上下文注入      → 可测试的命令

📌 场景 3：构建 Web 后端

  必用模式：
  #3 决策管线        → 认证/授权
  #5 不可变状态      → 请求上下文
  #9 渐进式信任      → 用户权限提升
  #10 Hook 管线      → 中间件

📌 通用建议：

  1. 从简单开始：先实现核心功能，再添加模式
  2. 按需引入：不要为了用模式而用模式
  3. 保持一致：一个项目内统一使用相同的模式
  4. 文档化：为复杂模式添加注释和文档

📌 学习路径建议：

  入门：先理解模式 #1 (AsyncGenerator) 和 #7 (DI)
  进阶：学习模式 #2 (FIFO) 和 #3 (决策管线)
  高级：研究模式 #4 (Memoize) 和 #8 (Token 感知重试)

  📂 建议阅读的源码文件（按学习优先级）：
  1. ClaudeCodeSource/QueryEngine.ts        — 模式 #1 的最佳实践
  2. ClaudeCodeSource/services/tools/StreamingToolExecutor.ts — 模式 #2
  3. ClaudeCodeSource/hooks/useCanUseTool.tsx — 模式 #3
  4. ClaudeCodeSource/bootstrap/state.ts     — 模式 #4
  5. ClaudeCodeSource/state/AppStateStore.ts — 模式 #5
  6. ClaudeCodeSource/services/api/errors.ts — 模式 #8
  7. ClaudeCodeSource/cost-tracker.ts        — 综合应用
`);
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  showPatternsOverview();
  pattern1_AsyncGenerator();
  pattern2_FIFOExecutor();
  pattern3_DecisionPipeline();
  pattern4_MemoizeWithInvalidation();
  pattern5_DeepImmutable();
  patternsQuickOverview();
  explainCostTracking();
  showApplicationGuide();
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("06-design-patterns.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { showPatternsOverview, pattern1_AsyncGenerator };
