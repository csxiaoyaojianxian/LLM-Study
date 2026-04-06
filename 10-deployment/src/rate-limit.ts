/**
 * rate-limit.ts — 限流与并发控制
 *
 * 演示令牌桶限流、并发信号量、指数退避重试。
 * 纯逻辑演示，无需 API Key。
 *
 * 运行: npm run rate-limit
 */

// ============================================================
// 1. Token Bucket 令牌桶
// ============================================================

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,    // 桶容量
    private refillRate: number,  // 每秒补充 token 数
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /** 尝试消耗 n 个 token，返回是否成功 */
  tryConsume(n = 1): boolean {
    this.refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  /** 补充 token */
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

class Semaphore {
  private waiting: Array<() => void> = [];
  private running = 0;

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }
    // 等待释放
    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    const next = this.waiting.shift();
    if (next) next();
  }

  /** 包装异步任务 */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
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
// 3. 指数退避重试
// ============================================================

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
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

      if (attempt === options.maxRetries) break;

      // 指数退避: delay = baseDelay * 2^attempt
      let delay = options.baseDelayMs * Math.pow(2, attempt);
      delay = Math.min(delay, options.maxDelayMs);

      // 添加随机抖动
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
