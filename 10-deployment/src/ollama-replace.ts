/**
 * ollama-replace.ts — 本地模型替换云端模型
 *
 * 演示云端 vs 本地模型对比、混合路由策略。
 *
 * 运行: npm run ollama-replace
 * 需要: Ollama 在线 + 至少一个云端 API Key
 */

import "dotenv/config";
import { generateText } from "ai";
import {
  getModel,
  getDefaultProvider,
  getAvailableProviders,
  isOllamaAvailable,
  getOllamaModels,
  type Provider,
} from "./model-adapter.js";

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: 云端 vs 本地对比表 */
function demo1_comparison(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: 云端 vs 本地模型对比                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("  ┌──────────────┬─────────────────┬─────────────────┐");
  console.log("  │ 维度          │ 云端模型         │ 本地模型 (Ollama) │");
  console.log("  ├──────────────┼─────────────────┼─────────────────┤");
  console.log("  │ 质量          │ ⭐⭐⭐⭐⭐ 最佳    │ ⭐⭐⭐ 看模型大小    │");
  console.log("  │ 延迟          │ 200-2000ms      │ 50-500ms        │");
  console.log("  │ 成本          │ 按 Token 计费    │ 零（电费除外）   │");
  console.log("  │ 隐私          │ 数据上传云端      │ 数据留本地       │");
  console.log("  │ 可用性        │ 依赖网络         │ 离线可用         │");
  console.log("  │ 扩展性        │ 无限并发          │ 受限于硬件       │");
  console.log("  │ 维护          │ 零运维            │ 需管理模型/硬件  │");
  console.log("  └──────────────┴─────────────────┴─────────────────┘\n");

  console.log("💡 最佳策略：混合部署");
  console.log("  • 简单任务 → 本地模型（快、免费）");
  console.log("  • 复杂任务 → 云端模型（质量高）");
  console.log("  • 敏感数据 → 本地模型（隐私）");
  console.log("  • 高峰期 → 本地分流 + 云端兜底");
  console.log("");
}

/** Demo 2: 同一问题对比 */
async function demo2_sameQuestion(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: 同一问题云端 vs 本地对比                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const questions = [
    "用一句话解释什么是机器学习。",
    "计算 17 * 23 = ?",
  ];

  const cloudProvider = getDefaultProvider();
  const ollamaModels = await getOllamaModels();
  const ollamaModel = ollamaModels.find((m) => m.startsWith("qwen2.5")) ?? ollamaModels[0];

  if (!ollamaModel) {
    console.log("⚠️  Ollama 无可用模型，跳过对比\n");
    return;
  }

  console.log(`☁️  云端: ${cloudProvider}`);
  console.log(`🦙 本地: ollama/${ollamaModel}\n`);

  for (const question of questions) {
    console.log(`📝 问题: "${question}"`);
    console.log("─────────────────────────────────────────");

    // 云端
    const cloudStart = Date.now();
    try {
      const cloudResult = await generateText({
        model: getModel(cloudProvider),
        prompt: question,
        maxOutputTokens: 200,
      });
      const cloudTime = Date.now() - cloudStart;
      console.log(`  ☁️  云端 (${cloudTime}ms): ${cloudResult.text.trim().slice(0, 150)}`);
    } catch (error: any) {
      console.log(`  ☁️  云端失败: ${error.message}`);
    }

    // 本地
    const localStart = Date.now();
    try {
      const localResult = await generateText({
        model: getModel("ollama", ollamaModel),
        prompt: question,
        maxOutputTokens: 200,
      });
      const localTime = Date.now() - localStart;
      console.log(`  🦙 本地 (${localTime}ms): ${localResult.text.trim().slice(0, 150)}`);
    } catch (error: any) {
      console.log(`  🦙 本地失败: ${error.message}`);
    }
    console.log("");
  }
}

/** Demo 3: 混合路由策略 */
async function demo3_hybridRouter(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 混合路由策略                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const ollamaModels = await getOllamaModels();
  const ollamaModel = ollamaModels.find((m) => m.startsWith("qwen2.5")) ?? ollamaModels[0];
  const cloudProvider = getDefaultProvider();

  /** 简单的任务分类路由器 */
  function classifyTask(input: string): "simple" | "complex" {
    // 简单规则：长度短、包含简单关键词 → 简单任务
    if (input.length < 50) return "simple";
    if (/翻译|计算|定义|解释/.test(input)) return "simple";
    if (/分析|策略|对比|设计|规划|详细|多步/.test(input)) return "complex";
    return input.length > 100 ? "complex" : "simple";
  }

  /** 路由执行 */
  async function hybridChat(input: string): Promise<{ text: string; route: string; time: number }> {
    const taskType = classifyTask(input);
    const start = Date.now();

    if (taskType === "simple" && ollamaModel) {
      // 简单任务 → 本地
      try {
        const result = await generateText({
          model: getModel("ollama", ollamaModel),
          prompt: input,
          maxOutputTokens: 200,
        });
        return { text: result.text, route: `🦙 本地 (${ollamaModel})`, time: Date.now() - start };
      } catch {
        // 本地失败，fallback 到云端
      }
    }

    // 复杂任务或本地失败 → 云端
    const result = await generateText({
      model: getModel(cloudProvider),
      prompt: input,
      maxOutputTokens: 300,
    });
    return { text: result.text, route: `☁️  云端 (${cloudProvider})`, time: Date.now() - start };
  }

  console.log("🔀 路由规则：");
  console.log("  • 短文本 / 简单任务 → 🦙 本地模型");
  console.log("  • 长文本 / 复杂任务 → ☁️  云端模型");
  console.log("  • 本地失败 → ☁️  自动 fallback 到云端\n");

  const testInputs = [
    "你好",
    "翻译：Hello World",
    "请详细分析人工智能对教育行业的影响，从教学方式、学习效率、教育公平三个维度展开讨论，并给出具体建议。",
  ];

  for (const input of testInputs) {
    const displayInput = input.length > 60 ? input.slice(0, 60) + "..." : input;
    console.log(`📝 输入: "${displayInput}"`);

    const taskType = classifyTask(input);
    console.log(`   分类: ${taskType === "simple" ? "🟢 简单" : "🔴 复杂"}`);

    try {
      const { text, route, time } = await hybridChat(input);
      console.log(`   路由: ${route}`);
      console.log(`   耗时: ${time}ms`);
      console.log(`   回答: ${text.trim().slice(0, 100)}${text.length > 100 ? "..." : ""}`);
    } catch (error: any) {
      console.log(`   ⚠️  执行失败: ${error.message}`);
    }
    console.log("");
  }
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n🔄 ===== 10-deployment: 本地模型替换云端模型 =====\n");

  // Demo 1: 对比表（无需 API）
  demo1_comparison();

  // 检查前提条件
  const ollamaOk = await isOllamaAvailable();
  let cloudOk = false;
  try {
    getDefaultProvider();
    cloudOk = true;
  } catch {}

  if (!ollamaOk) {
    console.log("⚠️  Ollama 未启动，部分 Demo 将跳过");
    console.log("💡 请启动 Ollama 并拉取模型: ollama pull qwen3.5:9b\n");
  }
  if (!cloudOk) {
    console.log("⚠️  未配置云端 API Key，部分 Demo 将跳过\n");
  }

  // Demo 2-3: 需要 Ollama + 云端
  if (ollamaOk && cloudOk) {
    await demo2_sameQuestion();
    await demo3_hybridRouter();
  } else if (ollamaOk) {
    console.log("💡 仅 Ollama 可用，可运行 ollama-basics.ts 体验本地模型\n");
  } else if (cloudOk) {
    console.log("💡 仅云端可用，请安装 Ollama 后重试对比 Demo\n");
  }

  console.log("🎉 本地模型替换演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("ollama-replace.ts");
if (isMainModule) {
  main().catch(console.error);
}
