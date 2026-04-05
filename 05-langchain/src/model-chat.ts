/**
 * model-chat.ts — LangChain Model 基础
 *
 * 使用 LangChain 的 Model 抽象统一接入 DeepSeek / OpenAI / Anthropic。
 * - DeepSeek 通过 ChatOpenAI + baseURL 适配
 * - Anthropic 使用独立的 @langchain/anthropic
 *
 * 核心知识点：
 * - ChatOpenAI / ChatAnthropic 创建与配置
 * - HumanMessage / SystemMessage 消息类型
 * - invoke() 基础调用
 * - stream() 流式输出
 * - 多模型统一接口（BaseChatModel）
 *
 * 运行: npm run model-chat
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// ============================================================
// 1. createChatModel — 模型工厂函数（供后续脚本复用）
// ============================================================

/**
 * 创建 Chat Model 实例，自动检测可用的 API Key
 * 优先级：Anthropic > DeepSeek > OpenAI
 *
 * ⚠️ v1 变更：参数名 openAIApiKey → apiKey, modelName → model
 */
export function createChatModel(options?: {
  /**
   * temperature — 控制 LLM 输出的随机性/创造性
   *
   * LLM 每一步预测下一个 Token 时会生成概率分布（如："晴"60%、"雨"30%、"阴"10%）
   * temperature 对该分布做缩放：
   *   0   → 几乎总选最高概率 Token，输出确定性最高（适合代码、数学、事实问答）
   *   0.7 → 默认值，平衡创造性和准确性
   *   1.0+→ 概率差距缩小，低概率 Token 也有机会被选中，输出更随机（适合写故事、头脑风暴）
   */
  temperature?: number;
  modelName?: string;
}): BaseChatModel {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropicBaseUrl = process.env.ANTHROPIC_API_BASE_URL;

  // 判断 key 是否有效（排除占位符 "sk-"、"sk-ant-" 等）
  const isValidKey = (key: string | undefined): key is string =>
    !!key && key.length > 10;

  if (isValidKey(anthropicKey)) {
    console.log("🔑 使用 Anthropic API Key");
    return new ChatOpenAI({
      apiKey: anthropicKey,
      model: options?.modelName ?? "claude-4-6-opus",
      temperature: options?.temperature ?? 0.7,
      configuration: {
        baseURL: anthropicBaseUrl,
      },
    });
  }

  if (isValidKey(deepseekKey)) {
    console.log("🔑 使用 DeepSeek API Key（通过 ChatOpenAI 适配）");
    return new ChatOpenAI({
      apiKey: deepseekKey,
      model: options?.modelName ?? "deepseek-chat",
      temperature: options?.temperature ?? 0.7,
      configuration: {
        baseURL: "https://api.deepseek.com/v1",
      },
    });
  }

  if (isValidKey(openaiKey)) {
    console.log("🔑 使用 OpenAI API Key");
    return new ChatOpenAI({
      apiKey: openaiKey,
      model: options?.modelName ?? "gpt-4o-mini",
      temperature: options?.temperature ?? 0.7,
    });
  }


  throw new Error(
    "❌ 未找到可用的 API Key！请在 .env 中配置 DEEPSEEK_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY"
  );
}

// ============================================================
// 2. Demo 入口
// ============================================================

async function main() {
  console.log("🤖 model-chat.ts — LangChain Model 基础 Demo\n");

  const model = createChatModel();

  // --- Demo 1: 基础调用 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 基础调用 model.invoke()\n");

  const response1 = await model.invoke([
    new HumanMessage("用一句话解释什么是 LangChain"),
  ]);
  console.log("回复:", response1.content);
  console.log();

  // --- Demo 2: SystemMessage + HumanMessage 多消息组合 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 2: System + Human 多消息组合\n");

  const response2 = await model.invoke([
    new SystemMessage("你是一位资深 TypeScript 开发者，回答简洁专业，使用中文。"),
    new HumanMessage("LangChain.js 和 Vercel AI SDK 的核心区别是什么？"),
  ]);
  console.log("回复:", response2.content);
  console.log();

  // --- Demo 3: 流式输出 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 3: 流式输出 model.stream()\n");

  const stream = await model.stream([
    new HumanMessage("用三个要点总结 RAG（检索增强生成）的核心原理"),
  ]);

  process.stdout.write("回复: ");
  for await (const chunk of stream) {
    process.stdout.write(chunk.content as string);
  }
  console.log("\n");

  // --- Demo 4: 验证 temperature 的效果 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 4: temperature 对比（temperature: 0）\n");

  // temperature: 0 → 每次都选概率最高的 Token，输出几乎完全确定
  const preciseModel = createChatModel({ temperature: 0 });

  // 同一问题调用两次，低温度下结果应完全一致
  const response4a = await preciseModel.invoke([
    new HumanMessage("1+1等于几？只回答数字。"),
  ]);
  const response4b = await preciseModel.invoke([
    new HumanMessage("1+1等于几？只回答数字。"),
  ]);
  console.log("第一次回复:", response4a.content);
  console.log("第二次回复:", response4b.content);
  console.log("（temperature=0 时，两次回复应完全一致）");

  console.log("\n" + "=".repeat(60));
  console.log("✅ Model 基础 Demo 完成！");
}

// 仅当直接运行时执行 demo
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("model-chat.ts");

if (isMainModule) {
  main().catch(console.error);
}
