/**
 * rate-limit.ts — 限流与并发控制
 *
 * 演示令牌桶限流、并发信号量、指数退避重试。
 * 纯逻辑演示，无需 API Key。
 *
 * 三者在生产环境中组成完整防御链：
 *   请求 → TokenBucket（速率限制，超限拒绝）
 *        → Semaphore（并发控制，超限排队）
 *        → withRetry（失败重试，指数退避）
 *
 * 组合使用示例：
 *   const bucket = new TokenBucket(10, 8.33);  // 500 RPM
 *   const sem = new Semaphore(5);               // 最多 5 并发
 *   async function safeCall(prompt: string) {
 *     if (!bucket.tryConsume()) throw new Error("429");
 *     return sem.run(() => withRetry(() => callAPI(prompt)));
 *   }
 *
 * 运行: npm run rate-limit
 */

// ============================================================
// 1. Token Bucket 令牌桶
// ============================================================
//
// 原理：桶中持有 token，每个请求消耗 1 个 token，桶按固定速率自动补充。
// 特点：允许突发（桶满时可瞬间打出 capacity 个请求），但长期速率受 refillRate 限制。
// vs 其他算法：
//   - 令牌桶：超限直接拒绝（非阻塞），适合"要么通过要么报错"
//   - 信号量：超限排队等待（阻塞），适合"都要执行，只是限速"
//
// 使用示例（对接 OpenAI 500 RPM 限制）：
//   const limiter = new TokenBucket(10, 500 / 60); // 容量10, 每秒补8.33个
//   if (limiter.tryConsume()) { await callOpenAI(); }
//   else { throw new Error("429 rate limited"); }
// ============================================================

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,    // 桶容量（决定允许的最大突发量）
    private refillRate: number,  // 每秒补充 token 数（决定长期平均速率）
  ) {
    this.tokens = capacity;      // 初始桶是满的
    this.lastRefill = Date.now();
  }

  /** 尝试消耗 n 个 token，返回是否成功（非阻塞，超限立即返回 false） */
  tryConsume(n = 1): boolean {
    this.refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  /**
   * 懒补充（lazy refill）：不用 setInterval 定时器，而是每次调用时根据时间差计算应补多少。
   * 优势：零定时器开销，纯数学计算，即使创建大量 TokenBucket 实例也不影响性能。
   * 计算：tokens += elapsed(秒) * refillRate，上限为 capacity
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// ============================================================
// 2. 并发信号量
// ============================================================
//
// 原理：限制同时执行的异步任务数量。超出上限的任务排队等待（阻塞），直到有坑位释放。
// 核心机制：acquire() 请求坑位 → 执行任务 → release() 释放坑位 → 唤醒队头等待者。
//
// 与 TokenBucket 的区别：
//   TokenBucket: 超限 → 立即拒绝（非阻塞）  → 适合速率控制（RPM/TPM）
//   Semaphore:   超限 → 排队等待（阻塞）    → 适合并发控制（同时最多 N 个请求在飞）
//
// 使用示例（批量处理 100 个文档，限制 5 并发）：
//   const sem = new Semaphore(5);
//   await Promise.all(docs.map(doc => sem.run(() => processDoc(doc))));
// ============================================================

class Semaphore {
  private waiting: Array<() => void> = [];  // 排队中的任务回调（每个是一个 resolve 函数）
  private running = 0;                       // 当前正在执行的任务数

  constructor(private maxConcurrency: number) {}

  /**
   * 请求一个"坑位"。
   * - 有空位：running++ 后立即返回（resolve）
   * - 无空位：创建一个 pending 的 Promise，将其 resolve 存入 waiting 数组。
   *           Promise 会一直挂起，直到 release() 从 waiting 中取出并执行这个 resolve。
   *   这就是 JS 中用 Promise 实现"阻塞等待"的经典范式。
   */
  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.running++;
        resolve();  // 被 release() 调用时才执行，此时 await acquire() 才返回
      });
    });
  }

  /** 释放一个"坑位"，并从等待队列中唤醒下一个任务（FIFO 顺序） */
  release(): void {
    this.running--;
    const next = this.waiting.shift();  // 队头出队
    if (next) next();                   // 调用 resolve，唤醒等待者
  }

  /** 包装异步任务：自动 acquire → 执行 → finally release，避免手动管理生命周期 */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();  // finally 确保即使 fn() 抛异常也会释放坑位
    }
  }

  get currentRunning(): number {
    return this.running;
  }

  get queueLength(): number {
    return this.waiting.length;
  }
}

// ============================================================
// 3. 指数退避重试（Exponential Backoff with Jitter）
// ============================================================
//
// 原理：失败后等一会儿再重试，每次等待时间翻倍，加随机抖动避免惊群效应。
//
// 退避时间线（baseDelayMs=1000, maxRetries=3）：
//   attempt 0 → 失败 → wait 1000ms × 2^0 = 1s   (+ jitter → 500~1000ms)
//   attempt 1 → 失败 → wait 1000ms × 2^1 = 2s   (+ jitter → 1000~2000ms)
//   attempt 2 → 失败 → wait 1000ms × 2^2 = 4s   (+ jitter → 2000~4000ms)
//   attempt 3 → 失败 → 放弃，throw lastError
//
// 为什么 jitter 很关键？
//   假设 1000 个客户端同时收到 429，如果都精确等 1s 后重试
//   → 1s 后又来 1000 个请求 → 又全部 429 → 雪崩（惊群效应）
//   加 jitter 后重试被打散在 500ms 窗口内，服务端压力均匀得多。
//
// 最佳实践：
//   - 只对可重试的错误重试（429/500/503），不重试 400/401
//   - maxRetries 通常 2-3 次
//   - 结合限流使用，避免重试加剧过载
// ============================================================

interface RetryOptions {
  maxRetries: number;    // 最大重试次数（总尝试次数 = maxRetries + 1）
  baseDelayMs: number;   // 首次重试的基础等待时间
  maxDelayMs: number;    // 等待时间上限（防止 2^n 指数爆炸，如 2^10 = 1024s）
  jitter: boolean;       // 是否添加随机抖动（建议始终开启，避免惊群效应）
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitter: true }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === options.maxRetries) break;  // 最后一次失败，不再等待，直接退出

      // 指数退避: delay = baseDelay * 2^attempt
      let delay = options.baseDelayMs * Math.pow(2, attempt);
      delay = Math.min(delay, options.maxDelayMs);  // 封顶，防止无限增长

      // 随机抖动：将 delay 缩放到 [50%, 100%] 范围，打散多客户端的重试时刻
      if (options.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      console.log(`    ⏳ 重试 ${attempt + 1}/${options.maxRetries}，等待 ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: 限流算法讲解 */
function demo1_concepts(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: 限流算法概念讲解                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 为什么需要限流？");
  console.log("─────────────────────────────────────────");
  console.log("  • LLM API 有速率限制（RPM/TPM）");
  console.log("  • 突发请求可能导致 429 Too Many Requests");
  console.log("  • 并发过高会浪费资源和预算\n");

  console.log("🔧 常见限流算法：");
  console.log("  ┌──────────────┬──────────────────────────────────┐");
  console.log("  │ 算法          │ 特点                              │");
  console.log("  ├──────────────┼──────────────────────────────────┤");
  console.log("  │ 令牌桶        │ 允许突发，匀速补充 token          │");
  console.log("  │ 滑动窗口      │ 固定窗口内限制总量                │");
  console.log("  │ 漏桶          │ 匀速流出，超出排队                │");
  console.log("  │ 并发信号量    │ 限制同时执行的任务数              │");
  console.log("  └──────────────┴──────────────────────────────────┘\n");

  console.log("📋 OpenAI 速率限制参考（Tier 1）：");
  console.log("  ┌──────────────┬──────────┬──────────┐");
  console.log("  │ 模型          │ RPM      │ TPM      │");
  console.log("  ├──────────────┼──────────┼──────────┤");
  console.log("  │ gpt-4o       │ 500      │ 30,000   │");
  console.log("  │ gpt-4o-mini  │ 500      │ 200,000  │");
  console.log("  │ dall-e-3     │ 5        │ -        │");
  console.log("  │ whisper-1    │ 50       │ -        │");
  console.log("  │ tts-1        │ 50       │ -        │");
  console.log("  └──────────────┴──────────┴──────────┘");
  console.log("");
}

/** Demo 2: Token Bucket 实战 */
async function demo2_tokenBucket(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: 令牌桶 (Token Bucket) 实战              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // 5 RPM 的限制（每秒补 5/60 ≈ 0.083 个 token）
  // 为了演示加速：5 token 容量，每秒 2 个
  const bucket = new TokenBucket(5, 2);

  console.log("⚙️  配置: 容量=5, 补充速率=2/s");
  console.log("📋 模拟 10 个快速请求：\n");

  for (let i = 1; i <= 10; i++) {
    const allowed = bucket.tryConsume();
    const status = allowed ? "✅ 通过" : "❌ 拒绝";
    console.log(`  请求 ${i.toString().padStart(2)}: ${status}  (剩余 token: ${bucket.available})`);

    // 每 3 个请求等一下让 token 恢复
    if (i === 5) {
      console.log("  ... 等待 2 秒让 token 恢复 ...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log(`  (恢复后可用 token: ${bucket.available})`);
    }
  }
  console.log("");
}

/** Demo 3: 并发信号量 */
async function demo3_semaphore(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 并发信号量 (Semaphore)                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const sem = new Semaphore(3); // 最多 3 个并发
  console.log("⚙️  最大并发数: 3");
  console.log("📋 启动 8 个模拟 API 请求：\n");

  const tasks = Array.from({ length: 8 }, (_, i) => i + 1);
  const startTime = Date.now();

  const results = await Promise.all(
    tasks.map((id) =>
      sem.run(async () => {
        const elapsed = Date.now() - startTime;
        console.log(`  ⏳ 任务 ${id} 开始 (${elapsed}ms, 并发: ${sem.currentRunning}, 排队: ${sem.queueLength})`);
        // 模拟 API 调用
        await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200));
        const done = Date.now() - startTime;
        console.log(`  ✅ 任务 ${id} 完成 (${done}ms)`);
        return id;
      })
    )
  );

  const totalTime = Date.now() - startTime;
  console.log(`\n⏱️  全部完成，总耗时: ${totalTime}ms`);
  console.log(`   无并发限制理论耗时: ~400ms`);
  console.log(`   最大并发=3 实际耗时: ~${totalTime}ms`);
  console.log(`   (因为 8 个任务分 3 批执行)\n`);
}

/** Demo 4: 指数退避重试 */
async function demo4_retryWithBackoff(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 4: 指数退避重试                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 指数退避原理：");
  console.log("  retry 1: wait 1s");
  console.log("  retry 2: wait 2s");
  console.log("  retry 3: wait 4s");
  console.log("  + 随机抖动 (jitter) 避免惊群效应\n");

  // 模拟一个会失败几次的 API 调用
  let callCount = 0;
  const maxFailures = 2;

  console.log(`📋 模拟一个会失败 ${maxFailures} 次后成功的 API 调用：\n`);

  try {
    const result = await withRetry(
      async () => {
        callCount++;
        console.log(`  🔄 第 ${callCount} 次尝试...`);
        if (callCount <= maxFailures) {
          throw new Error(`429 Too Many Requests (模拟第 ${callCount} 次失败)`);
        }
        return `成功！经过 ${callCount} 次尝试`;
      },
      { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 5000, jitter: true }
    );

    console.log(`\n  ✅ 最终结果: ${result}\n`);
  } catch (error: any) {
    console.log(`\n  ❌ 最终失败: ${error.message}\n`);
  }

  // 演示全部失败的情况
  console.log("📋 模拟一个始终失败的 API 调用：\n");
  let failCount = 0;

  try {
    await withRetry(
      async () => {
        failCount++;
        console.log(`  🔄 第 ${failCount} 次尝试...`);
        throw new Error("500 Internal Server Error");
      },
      { maxRetries: 2, baseDelayMs: 300, maxDelayMs: 2000, jitter: false }
    );
  } catch (error: any) {
    console.log(`\n  ❌ 放弃重试: ${error.message} (共尝试 ${failCount} 次)\n`);
  }

  console.log("💡 重试最佳实践：");
  console.log("  • 只对可重试的错误重试（429/500/503，不重试 400/401）");
  console.log("  • 设置合理的 maxRetries（通常 2-3 次）");
  console.log("  • 添加 jitter 避免多客户端同时重试");
  console.log("  • 结合限流使用，避免重试加剧过载");
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n🚦 ===== 10-deployment: 限流与并发控制 =====\n");

  demo1_concepts();
  await demo2_tokenBucket();
  await demo3_semaphore();
  await demo4_retryWithBackoff();

  console.log("🎉 限流与并发控制演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("rate-limit.ts");
if (isMainModule) {
  main().catch(console.error);
}

export { TokenBucket, Semaphore, withRetry };
