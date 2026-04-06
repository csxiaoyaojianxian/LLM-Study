/**
 * caching.ts — 缓存策略
 *
 * 演示 LLM 请求的内存缓存和文件缓存策略，减少重复调用、节省成本。
 *
 * 运行: npm run caching
 * 可用模拟数据运行（无需 API Key），也支持真实 API 调用。
 */

import "dotenv/config";
import { generateText } from "ai";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getModel, getDefaultProvider, getAvailableProviders } from "./model-adapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", "data", "cache");

// ============================================================
// 1. 缓存实现
// ============================================================

/** 生成缓存 Key（基于 prompt + model 的哈希） */
function getCacheKey(prompt: string, model: string): string {
  return crypto.createHash("sha256").update(`${model}:${prompt}`).digest("hex").slice(0, 16);
}

// ——————————————— 内存 LRU 缓存 ———————————————

interface CacheEntry {
  result: string;
  timestamp: number;
}

class MemoryLRUCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number; // Time-to-live in milliseconds
  stats = { hits: 0, misses: 0 };

  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // 检查过期
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // LRU：访问时移到最后
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.stats.hits++;
    return entry.result;
  }

  set(key: string, result: string): void {
    // 超出大小限制时，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  get size(): number {
    return this.cache.size;
  }

  get hitRate(): string {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? "0%" : `${((this.stats.hits / total) * 100).toFixed(1)}%`;
  }
}

// ——————————————— 文件缓存 ———————————————

class FileCache {
  private dir: string;
  stats = { hits: 0, misses: 0 };

  constructor(dir: string) {
    this.dir = dir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private filePath(key: string): string {
    return path.join(this.dir, `${key}.json`);
  }

  async get(key: string): Promise<string | undefined> {
    try {
      const data = await fs.readFile(this.filePath(key), "utf-8");
      const entry = JSON.parse(data) as CacheEntry;
      this.stats.hits++;
      return entry.result;
    } catch {
      this.stats.misses++;
      return undefined;
    }
  }

  async set(key: string, result: string): Promise<void> {
    const entry: CacheEntry = { result, timestamp: Date.now() };
    await fs.writeFile(this.filePath(key), JSON.stringify(entry, null, 2));
  }

  get hitRate(): string {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? "0%" : `${((this.stats.hits / total) * 100).toFixed(1)}%`;
  }
}

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: 缓存原理讲解 */
function demo1_concepts(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: LLM 缓存策略概念讲解                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 为什么需要缓存 LLM 响应？");
  console.log("─────────────────────────────────────────");
  console.log("  • 💰 节省成本 — 相同问题不重复计费");
  console.log("  • ⚡ 提升速度 — 缓存命中几乎零延迟");
  console.log("  • 🛡️  降低限流风险 — 减少 API 调用次数\n");

  console.log("📦 缓存策略对比：");
  console.log("  ┌──────────────┬──────────────┬──────────────┐");
  console.log("  │ 策略          │ 内存 LRU      │ 文件缓存      │");
  console.log("  ├──────────────┼──────────────┼──────────────┤");
  console.log("  │ 速度          │ ⚡ 极快        │ 🚀 快         │");
  console.log("  │ 持久化        │ ❌ 重启丢失    │ ✅ 持久保存    │");
  console.log("  │ 容量          │ 受内存限制     │ 受磁盘限制     │");
  console.log("  │ 适合场景      │ 会话级缓存     │ 跨会话缓存     │");
  console.log("  └──────────────┴──────────────┴──────────────┘\n");

  console.log("🔑 缓存 Key 设计：");
  console.log("  key = SHA256(model + prompt).slice(0, 16)");
  console.log("  → 相同模型 + 相同 prompt = 相同 key = 缓存命中\n");

  console.log("⚠️  缓存注意事项：");
  console.log("  • 带 temperature > 0 的请求，相同 prompt 结果可能不同");
  console.log("  • 时效性内容（天气、新闻）不适合长期缓存");
  console.log("  • 建议设置 TTL（过期时间）");
  console.log("");
}

/** Demo 2: 内存 LRU 缓存 */
async function demo2_memoryCache(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: 内存 LRU 缓存                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const cache = new MemoryLRUCache(50, 60000); // 50 条，1分钟过期
  const model = "simulated-model";

  // 模拟 LLM 调用（用固定延迟模拟）
  async function cachedLLMCall(prompt: string): Promise<{ result: string; cached: boolean; time: number }> {
    const key = getCacheKey(prompt, model);
    const start = Date.now();

    const cached = cache.get(key);
    if (cached) {
      return { result: cached, cached: true, time: Date.now() - start };
    }

    // 模拟 API 调用延迟
    await new Promise((resolve) => setTimeout(resolve, 200));
    const result = `[模拟回答] ${prompt.slice(0, 30)}... 的答案`;
    cache.set(key, result);
    return { result, cached: false, time: Date.now() - start };
  }

  const prompts = [
    "什么是人工智能？",
    "解释机器学习",
    "什么是人工智能？",  // 重复 → 缓存命中
    "深度学习是什么？",
    "解释机器学习",      // 重复 → 缓存命中
    "什么是人工智能？",  // 重复 → 缓存命中
  ];

  console.log("📋 模拟 6 次 LLM 调用（其中 3 次重复）：\n");

  for (let i = 0; i < prompts.length; i++) {
    const { result, cached, time } = await cachedLLMCall(prompts[i]);
    const status = cached ? "✅ 缓存命中" : "🌐 API 调用";
    console.log(`  ${i + 1}. [${status}] (${time}ms) "${prompts[i]}"`);
  }

  console.log(`\n📊 缓存统计：`);
  console.log(`  缓存大小: ${cache.size} 条`);
  console.log(`  命中次数: ${cache.stats.hits}`);
  console.log(`  未命中: ${cache.stats.misses}`);
  console.log(`  命中率: ${cache.hitRate}`);
  console.log("");
}

/** Demo 3: 文件缓存 */
async function demo3_fileCache(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 文件缓存（JSON 持久化）                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const cache = new FileCache(CACHE_DIR);
  await cache.init();
  const model = "simulated-model";

  // 模拟调用
  async function cachedLLMCall(prompt: string): Promise<{ result: string; cached: boolean; time: number }> {
    const key = getCacheKey(prompt, model);
    const start = Date.now();

    const cached = await cache.get(key);
    if (cached) {
      return { result: cached, cached: true, time: Date.now() - start };
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
    const result = `[文件缓存回答] ${prompt.slice(0, 30)}...`;
    await cache.set(key, result);
    return { result, cached: false, time: Date.now() - start };
  }

  const prompts = ["TypeScript 和 JavaScript 的区别？", "React vs Vue？", "TypeScript 和 JavaScript 的区别？"];

  console.log(`💾 缓存目录: ${CACHE_DIR}`);
  console.log("📋 模拟 3 次调用（第 3 次重复）：\n");

  for (let i = 0; i < prompts.length; i++) {
    const { cached, time } = await cachedLLMCall(prompts[i]);
    const status = cached ? "✅ 文件命中" : "💾 写入文件";
    console.log(`  ${i + 1}. [${status}] (${time}ms) "${prompts[i]}"`);
  }

  // 显示缓存文件
  try {
    const files = await fs.readdir(CACHE_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    console.log(`\n📁 缓存文件 (${jsonFiles.length} 个):`);
    for (const f of jsonFiles) {
      console.log(`  • ${f}`);
    }
  } catch {}

  console.log(`\n📊 命中率: ${cache.hitRate}`);
  console.log("");
}

/** Demo 4: 缓存命中率统计 */
async function demo4_hitRateAnalysis(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 4: 缓存命中率分析                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const cache = new MemoryLRUCache(100);
  const model = "test";

  // 模拟真实场景：80% 热门问题（5个），20% 长尾问题
  const hotPrompts = ["你好", "今天天气", "帮我翻译", "写代码", "解释概念"];
  const totalRequests = 50;
  let totalSavedTime = 0;

  console.log(`📊 模拟 ${totalRequests} 次请求（80% 热门 + 20% 长尾）：\n`);

  for (let i = 0; i < totalRequests; i++) {
    const isHot = Math.random() < 0.8;
    const prompt = isHot
      ? hotPrompts[Math.floor(Math.random() * hotPrompts.length)]
      : `长尾问题-${Math.floor(Math.random() * 100)}`;

    const key = getCacheKey(prompt, model);
    const hit = cache.get(key);

    if (!hit) {
      cache.set(key, `回答-${prompt}`);
    } else {
      totalSavedTime += 200; // 假设每次缓存命中节省 200ms
    }
  }

  console.log("📈 统计结果：");
  console.log("─────────────────────────────────────────");
  console.log(`  总请求数: ${totalRequests}`);
  console.log(`  缓存命中: ${cache.stats.hits}`);
  console.log(`  缓存未命中: ${cache.stats.misses}`);
  console.log(`  命中率: ${cache.hitRate}`);
  console.log(`  节省时间: ~${totalSavedTime}ms`);

  // 成本计算
  const costPerCall = 0.001; // 假设每次调用 $0.001
  const savedCost = cache.stats.hits * costPerCall;
  console.log(`  节省成本: ~$${savedCost.toFixed(3)}`);

  console.log("\n💡 实际应用建议：");
  console.log("  • 高频场景（客服/FAQ）命中率可达 60%+");
  console.log("  • 个性化场景（创作/分析）命中率较低");
  console.log("  • 建议同时使用内存缓存（热数据） + 文件缓存（冷数据）");
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n💾 ===== 10-deployment: 缓存策略 =====\n");

  await fs.mkdir(CACHE_DIR, { recursive: true });

  demo1_concepts();
  await demo2_memoryCache();
  await demo3_fileCache();
  await demo4_hitRateAnalysis();

  console.log("🎉 缓存策略演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("caching.ts");
if (isMainModule) {
  main().catch(console.error);
}

export { MemoryLRUCache, FileCache, getCacheKey };
