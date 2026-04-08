/**
 * ollama-basics.ts — Ollama 本地部署基础
 *
 * 演示如何使用 Ollama 在本地运行开源 LLM，通过 AI SDK 接入。
 *
 * 运行: npm run ollama-basics
 * 需要: 本地安装并启动 Ollama，拉取模型 `ollama pull qwen3.5:9b`
 */

import "dotenv/config";
import { generateText, streamText } from "ai";
import {
  getModel,
  isOllamaAvailable,
  getOllamaModels,
  OLLAMA_BASE_URL,
} from "./model-adapter.js";

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: 概念讲解 */
function demo1_concepts(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: Ollama 本地部署概念讲解                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 为什么需要本地部署？");
  console.log("─────────────────────────────────────────");
  console.log("  🔒 数据隐私 — 敏感数据不出本机");
  console.log("  💰 零成本 — 无 API 调用费用");
  console.log("  ⚡ 低延迟 — 无网络往返开销");
  console.log("  🔌 离线可用 — 无需网络连接\n");

  console.log("🦙 Ollama 是什么？");
  console.log("─────────────────────────────────────────");
  console.log("  Ollama 是一个本地 LLM 运行框架，特点：");
  console.log("  • 一行命令安装和运行模型");
  console.log("  • 自动管理模型下载和缓存");
  console.log("  • 提供 OpenAI 兼容 API（/v1/chat/completions）");
  console.log("  • 支持 Mac / Linux / Windows\n");

  console.log("🏗️  架构原理：");
  console.log("─────────────────────────────────────────");
  console.log("  ┌──────────────┐    HTTP API    ┌──────────────┐");
  console.log("  │   AI SDK     │ ──────────────→ │   Ollama     │");
  console.log("  │  (你的代码)   │  localhost:11434│  (推理引擎)   │");
  console.log("  └──────────────┘                 └──────┬───────┘");
  console.log("                                          │");
  console.log("                                   ┌──────┴───────┐");
  console.log("                                   │  GGUF 模型    │");
  console.log("                                   │  (量化权重)    │");
  console.log("                                   └──────────────┘\n");

  console.log("📦 推荐模型（按大小排序）：");
  console.log("  ┌───────────────────┬──────────┬──────────────────┐");
  console.log("  │ 模型              │ 大小      │ 适合场景          │");
  console.log("  ├───────────────────┼──────────┼──────────────────┤");
  console.log("  │ qwen3.5:9b     │ ~400MB   │ 测试、学习        │");
  console.log("  │ qwen2.5:1.5b     │ ~1GB     │ 轻量任务          │");
  console.log("  │ qwen2.5:7b       │ ~4.5GB   │ 通用对话          │");
  console.log("  │ llama3.2:3b      │ ~2GB     │ 英文通用          │");
  console.log("  │ deepseek-r1:7b   │ ~4.7GB   │ 推理能力强        │");
  console.log("  │ codellama:7b     │ ~3.8GB   │ 代码生成          │");
  console.log("  └───────────────────┴──────────┴──────────────────┘\n");

  console.log("🛠️  快速开始：");
  console.log("  1. 安装: https://ollama.com/download");
  console.log("  2. 拉取: ollama pull qwen3.5:9b");
  console.log("  3. 测试: ollama run qwen3.5:9b");
  console.log("  4. 代码接入: 使用 AI SDK + OpenAI 兼容模式\n");

  console.log("🔗 AI SDK 接入代码：");
  console.log(`  import { createOpenAI } from '@ai-sdk/openai';
  const ollama = createOpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama',  // 占位符，Ollama 不校验
  });
  const model = ollama('qwen3.5:9b');`);
  console.log("");
}

/** Demo 2: Ollama 连接检测 */
async function demo2_connectionCheck(): Promise<boolean> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: Ollama 连接检测                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log(`🔍 检测 Ollama 服务: ${OLLAMA_BASE_URL}`);

  const available = await isOllamaAvailable();
  if (!available) {
    console.log("❌ Ollama 服务未启动或不可达！");
    console.log("\n💡 请确保：");
    console.log("  1. 已安装 Ollama: https://ollama.com/download");
    console.log("  2. Ollama 服务正在运行 (macOS 菜单栏图标 / ollama serve)");
    console.log("  3. 地址正确（默认 http://localhost:11434）\n");
    return false;
  }

  console.log("✅ Ollama 服务在线！\n");

  // 列出已安装模型
  const models = await getOllamaModels();
  if (models.length === 0) {
    console.log("⚠️  未找到已安装的模型！");
    console.log("💡 请运行: ollama pull qwen3.5:9b\n");
    return false;
  }

  console.log(`📦 已安装 ${models.length} 个模型：`);
  for (const name of models) {
    console.log(`  • ${name}`);
  }
  console.log("");
  return true;
}

/** Demo 3: 基础对话 */
async function demo3_basicChat(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: Ollama 基础对话                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const models = await getOllamaModels();
  const modelName = models.find((m) => m.startsWith("qwen2.5")) ?? models[0];
  if (!modelName) {
    console.log("⚠️  未找到可用模型，跳过此 Demo\n");
    return;
  }

  console.log(`📦 使用模型: ${modelName}`);
  const prompt = "用一句话解释什么是人工智能。";
  console.log(`📝 Prompt: "${prompt}"`);
  console.log("⏳ 等待本地模型响应...\n");

  const startTime = Date.now();

  try {
    const result = await generateText({
      model: getModel("ollama", modelName),
      prompt,
    });

    const elapsed = Date.now() - startTime;
    console.log("🤖 模型回答：");
    console.log("─────────────────────────────────────────");
    console.log(result.text);
    console.log(`\n⏱️  耗时: ${elapsed}ms`);
    if (result.usage) {
      console.log(`📊 Token: input=${result.usage.inputTokens}, output=${result.usage.outputTokens}`);
    }
  } catch (error: any) {
    console.log(`⚠️  调用失败: ${error.message}`);
    console.log("💡 确保模型已拉取: ollama pull " + modelName);
  }
  console.log("");
}

/** Demo 4: 流式输出 */
async function demo4_streaming(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 4: Ollama 流式输出                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const models = await getOllamaModels();
  const modelName = models.find((m) => m.startsWith("qwen2.5")) ?? models[0];
  if (!modelName) {
    console.log("⚠️  未找到可用模型，跳过此 Demo\n");
    return;
  }

  console.log(`📦 使用模型: ${modelName}`);
  const prompt = "列出学习编程的三个建议，每个用一句话。";
  console.log(`📝 Prompt: "${prompt}"`);
  console.log("⏳ 流式输出中...\n");
  console.log("─────────────────────────────────────────");

  const startTime = Date.now();

  try {
    const result = streamText({
      model: getModel("ollama", modelName),
      prompt,
    });

    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }

    const elapsed = Date.now() - startTime;
    console.log("\n─────────────────────────────────────────");
    console.log(`\n⏱️  流式输出完成，总耗时: ${elapsed}ms`);
  } catch (error: any) {
    console.log(`⚠️  流式调用失败: ${error.message}`);
  }
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n🦙 ===== 10-deployment: Ollama 本地部署基础 =====\n");

  // Demo 1: 概念（无需 Ollama）
  demo1_concepts();

  // Demo 2: 连接检测
  const isAvailable = await demo2_connectionCheck();

  // Demo 3-4: 需要 Ollama 在线
  if (isAvailable) {
    await demo3_basicChat();
    await demo4_streaming();
  } else {
    console.log("⏭️  跳过 Demo 3-4（需要 Ollama 在线）\n");
  }

  console.log("🎉 Ollama 基础演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("ollama-basics.ts");
if (isMainModule) {
  main().catch(console.error);
}
