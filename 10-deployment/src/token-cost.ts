/**
 * token-cost.ts — Token 计费与成本控制
 *
 * 演示如何统计 Token 使用量、计算费用、实现预算控制。
 *
 * 运行: npm run token-cost
 * 可模拟运行（无需 API Key），也支持真实 API 调用。
 */

import "dotenv/config";
import { generateText } from "ai";
import { getModel, getDefaultProvider, getAvailableProviders } from "./model-adapter.js";

// ============================================================
// 1. 定价表
// ============================================================

interface ModelPricing {
  name: string;
  provider: string;
  inputPer1M: number;  // $ per 1M input tokens
  outputPer1M: number; // $ per 1M output tokens
}

const PRICING_TABLE: ModelPricing[] = [
  { name: "deepseek-chat", provider: "deepseek", inputPer1M: 0.14, outputPer1M: 0.28 },
  { name: "gpt-4o-mini", provider: "openai", inputPer1M: 0.15, outputPer1M: 0.60 },
  { name: "gpt-4o", provider: "openai", inputPer1M: 2.50, outputPer1M: 10.00 },
  { name: "gpt-4-turbo", provider: "openai", inputPer1M: 10.00, outputPer1M: 30.00 },
  { name: "claude-3-5-haiku-latest", provider: "anthropic", inputPer1M: 0.80, outputPer1M: 4.00 },
  { name: "claude-3-5-sonnet-latest", provider: "anthropic", inputPer1M: 3.00, outputPer1M: 15.00 },
  { name: "qwen2.5:0.5b (Ollama)", provider: "ollama", inputPer1M: 0, outputPer1M: 0 },
];

/** 计算成本 */
function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = PRICING_TABLE.find((p) => model.includes(p.name) || p.name.includes(model));
  if (!pricing) {
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

// ============================================================
// 2. 预算控制器
// ============================================================

class BudgetController {
  private totalSpent = 0;
  private callCount = 0;
  private tokenLog: Array<{ model: string; prompt: number; completion: number; cost: number }> = [];

  constructor(
    private budgetLimit: number, // 美元
    private warningThreshold = 0.8 // 80% 时告警
  ) {}

  /** 记录一次调用 */
  record(model: string, promptTokens: number, completionTokens: number): void {
    const { totalCost } = calculateCost(model, promptTokens, completionTokens);
    this.totalSpent += totalCost;
    this.callCount++;
    this.tokenLog.push({ model, prompt: promptTokens, completion: completionTokens, cost: totalCost });
  }

  /** 检查是否超预算 */
  isOverBudget(): boolean {
    return this.totalSpent >= this.budgetLimit;
  }

  /** 检查是否接近预算 */
  isNearBudget(): boolean {
    return this.totalSpent >= this.budgetLimit * this.warningThreshold;
  }

  /** 获取报告 */
  getReport(): string {
    const lines = [
      `💰 预算报告`,
      `─────────────────────────────────────────`,
      `  预算上限: $${this.budgetLimit.toFixed(4)}`,
      `  已花费: $${this.totalSpent.toFixed(6)}`,
      `  剩余: $${(this.budgetLimit - this.totalSpent).toFixed(6)}`,
      `  使用率: ${((this.totalSpent / this.budgetLimit) * 100).toFixed(1)}%`,
      `  调用次数: ${this.callCount}`,
    ];
    return lines.join("\n");
  }

  get spent(): number {
    return this.totalSpent;
  }

  get calls(): number {
    return this.callCount;
  }
}

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: Token 计算原理 & 定价表 */
function demo1_concepts(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: Token 计费原理与模型定价                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 什么是 Token？");
  console.log("─────────────────────────────────────────");
  console.log("  Token 是 LLM 处理文本的最小单位：");
  console.log("  • 英文: ~4 字符 = 1 token (\"hello\" ≈ 1 token)");
  console.log("  • 中文: ~1-2 字符 = 1 token (\"你好\" ≈ 2 tokens)");
  console.log("  • 代码: 变量名/运算符各占 token\n");

  console.log("💵 各模型定价对比 ($ / 1M tokens)：");
  console.log("  ┌──────────────────────────┬──────────┬──────────┐");
  console.log("  │ 模型                      │ 输入      │ 输出      │");
  console.log("  ├──────────────────────────┼──────────┼──────────┤");
  for (const p of PRICING_TABLE) {
    const input = p.inputPer1M === 0 ? "免费" : `$${p.inputPer1M.toFixed(2)}`;
    const output = p.outputPer1M === 0 ? "免费" : `$${p.outputPer1M.toFixed(2)}`;
    console.log(`  │ ${p.name.padEnd(24)} │ ${input.padStart(8)} │ ${output.padStart(8)} │`);
  }
  console.log("  └──────────────────────────┴──────────┴──────────┘\n");

  console.log("📊 AI SDK 获取 usage 信息：");
  console.log(`  const result = await generateText({ model, prompt });
  console.log(result.usage);
  // { promptTokens: 50, completionTokens: 120, totalTokens: 170 }`);
  console.log("");
}

/** Demo 2: 真实 API 调用的 usage 统计 */
async function demo2_usageTracking(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: usage 字段统计                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  let provider: string;
  try {
    provider = getDefaultProvider();
  } catch {
    console.log("⚠️  无可用 API Key，使用模拟数据\n");
    // 模拟数据
    const simUsage = [
      { prompt: "什么是 AI？", promptTokens: 12, completionTokens: 85 },
      { prompt: "写一个排序算法", promptTokens: 15, completionTokens: 230 },
      { prompt: "翻译：Hello World", promptTokens: 18, completionTokens: 8 },
    ];

    for (const u of simUsage) {
      const cost = calculateCost("gpt-4o-mini", u.promptTokens, u.completionTokens);
      console.log(`  📝 "${u.prompt}"`);
      console.log(`     Token: input=${u.promptTokens}, output=${u.completionTokens}`);
      console.log(`     成本: $${cost.totalCost.toFixed(6)}\n`);
    }
    return;
  }

  const prompts = [
    "用一句话解释人工智能",
    "写一个 JavaScript 冒泡排序函数",
    "翻译成英文：今天天气真好",
  ];

  console.log(`📦 使用 Provider: ${provider}\n`);

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (const prompt of prompts) {
    try {
      const result = await generateText({
        model: getModel(provider as any),
        prompt,
        maxOutputTokens: 200,
      });

      const pt = result.usage?.inputTokens ?? 0;
      const ct = result.usage?.outputTokens ?? 0;
      totalPromptTokens += pt;
      totalCompletionTokens += ct;

      const cost = calculateCost(provider, pt, ct);
      console.log(`  📝 "${prompt}"`);
      console.log(`     Token: input=${pt}, output=${ct}`);
      console.log(`     成本: $${cost.totalCost.toFixed(6)}`);
      console.log(`     回答: ${result.text.trim().slice(0, 60)}...\n`);
    } catch (error: any) {
      console.log(`  ⚠️  "${prompt}" 调用失败: ${error.message}\n`);
    }
  }

  const totalCost = calculateCost(provider, totalPromptTokens, totalCompletionTokens);
  console.log("📊 本轮总计：");
  console.log(`  总 Input Token: ${totalPromptTokens}`);
  console.log(`  总 Output Token: ${totalCompletionTokens}`);
  console.log(`  总成本: $${totalCost.totalCost.toFixed(6)}`);
  console.log("");
}

/** Demo 3: 成本计算器 */
function demo3_costCalculator(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 成本计算器                              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📱 场景模拟：一个 AI 客服应用");
  console.log("  • 日均 1000 次对话");
  console.log("  • 平均每次: 输入 200 tokens, 输出 300 tokens\n");

  const dailyCalls = 1000;
  const avgInput = 200;
  const avgOutput = 300;

  console.log("💰 各模型月成本预估：");
  console.log("  ┌──────────────────────────┬──────────────┐");
  console.log("  │ 模型                      │ 月成本        │");
  console.log("  ├──────────────────────────┼──────────────┤");

  for (const pricing of PRICING_TABLE) {
    const dailyInputCost = (dailyCalls * avgInput / 1_000_000) * pricing.inputPer1M;
    const dailyOutputCost = (dailyCalls * avgOutput / 1_000_000) * pricing.outputPer1M;
    const monthlyCost = (dailyInputCost + dailyOutputCost) * 30;
    const costStr = monthlyCost === 0 ? "免费" : `$${monthlyCost.toFixed(2)}`;
    console.log(`  │ ${pricing.name.padEnd(24)} │ ${costStr.padStart(12)} │`);
  }
  console.log("  └──────────────────────────┴──────────────┘\n");

  console.log("💡 成本优化建议：");
  console.log("  1. 选择性价比高的模型（DeepSeek / GPT-4o-mini）");
  console.log("  2. 使用缓存减少重复调用（见 caching.ts）");
  console.log("  3. 控制 maxTokens 避免过长输出");
  console.log("  4. 简单任务用小模型，复杂任务用大模型");
  console.log("  5. 本地模型处理不涉密的高频简单任务");
  console.log("");
}

/** Demo 4: 预算控制 */
function demo4_budgetControl(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 4: 预算控制演示                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const budget = new BudgetController(0.01); // $0.01 预算

  console.log("🎯 模拟预算控制（预算: $0.01）\n");

  // 模拟多次调用
  const calls = [
    { model: "gpt-4o-mini", input: 100, output: 200 },
    { model: "gpt-4o-mini", input: 150, output: 300 },
    { model: "gpt-4o-mini", input: 200, output: 500 },
    { model: "gpt-4o", input: 100, output: 200 },  // 贵模型
    { model: "gpt-4o", input: 200, output: 400 },
  ];

  for (let i = 0; i < calls.length; i++) {
    const { model, input, output } = calls[i];

    if (budget.isOverBudget()) {
      console.log(`  ❌ 第${i + 1}次调用被拒绝 — 超出预算！`);
      console.log(`     → 降级策略: 切换到 deepseek-chat 或本地模型`);
      // 模拟降级
      budget.record("deepseek-chat", input, output);
      console.log(`     → 已降级到 deepseek-chat`);
      continue;
    }

    if (budget.isNearBudget()) {
      console.log(`  ⚠️  第${i + 1}次调用 — 接近预算上限！(${model})`);
    } else {
      console.log(`  ✅ 第${i + 1}次调用 (${model}, in=${input}, out=${output})`);
    }

    budget.record(model, input, output);
    console.log(`     累计花费: $${budget.spent.toFixed(6)}`);
  }

  console.log(`\n${budget.getReport()}`);
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n💰 ===== 10-deployment: Token 计费与成本控制 =====\n");

  demo1_concepts();
  await demo2_usageTracking();
  demo3_costCalculator();
  demo4_budgetControl();

  console.log("🎉 Token 计费演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("token-cost.ts");
if (isMainModule) {
  main().catch(console.error);
}

export { calculateCost, BudgetController, PRICING_TABLE };
