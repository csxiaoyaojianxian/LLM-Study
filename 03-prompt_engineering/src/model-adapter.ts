/**
 * model-adapter.ts — 多模型统一适配层
 *
 * 核心价值：封装 Vercel AI SDK 的多模型切换逻辑，后续模块可直接复用。
 * 支持 deepseek / openai / anthropic 三个 provider。
 *
 * 运行: npm run model-adapter
 */

import "dotenv/config";
import { generateText, type LanguageModel, type ModelMessage } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

// ============================================================
// 1. Provider 类型定义
// ============================================================

export type Provider = "deepseek" | "openai" | "anthropic";

/** 各 provider 的默认模型 */
const DEFAULT_MODELS: Record<Provider, string> = {
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
};

// ============================================================
// 2. getModel — 根据 provider 返回模型实例
// ============================================================

/**
 * 根据 provider 名称返回对应的 AI SDK 模型实例
 * @param provider - 模型提供商（deepseek / openai / anthropic）
 * @param modelName - 可选的模型名称，默认使用各 provider 的推荐模型
 * @returns LanguageModel 实例
 */
export function getModel(provider: Provider, modelName?: string): LanguageModel {
  const model = modelName ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "deepseek": {
      const deepseek = createDeepSeek({
        apiKey: process.env.DEEPSEEK_API_KEY,
      });
      return deepseek(model);
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(model);
    }
    default:
      throw new Error(`不支持的 provider: ${provider}`);
  }
}

// ============================================================
// 3. chatWithModel — 便捷调用函数
// ============================================================

export interface ChatOptions {
  temperature?: number;
  maxOutputTokens?: number;
  system?: string;
}

/**
 * 一步完成：选择模型 → 发送消息 → 返回文本结果
 */
export async function chatWithModel(
  provider: Provider,
  messages: ModelMessage[],
  options?: ChatOptions
): Promise<string> {
  const model = getModel(provider);

  const result = await generateText({
    model,
    messages,
    temperature: options?.temperature,
    maxOutputTokens: options?.maxOutputTokens,
    system: options?.system,
  });

  return result.text;
}

// ============================================================
// 4. 辅助工具
// ============================================================

/** 检测哪些 provider 已配置 API Key */
export function getAvailableProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== "sk-") {
    providers.push("deepseek");
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-") {
    providers.push("openai");
  }
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-") {
    providers.push("anthropic");
  }
  return providers;
}

/** 获取第一个可用的 provider，用于 demo 兜底 */
export function getDefaultProvider(): Provider {
  const available = getAvailableProviders();
  if (available.length === 0) {
    throw new Error(
      "❌ 未找到任何可用的 API Key！请复制 .env.example 为 .env 并填入至少一个 Key。"
    );
  }
  return available[0];
}

// ============================================================
// 5. Demo 入口 — 多模型对比
// ============================================================

async function main() {
  console.log("🔌 model-adapter.ts — 多模型统一适配层 Demo\n");

  const available = getAvailableProviders();
  if (available.length === 0) {
    console.error(
      "❌ 未找到任何可用的 API Key！请复制 .env.example 为 .env 并填入至少一个 Key。"
    );
    process.exit(1);
  }

  console.log(`✅ 已配置的 Provider: ${available.join(", ")}\n`);

  const question = "用一句话解释什么是 Prompt Engineering（提示工程）？";
  console.log(`📝 测试问题: ${question}\n`);
  console.log("=".repeat(60));

  for (const provider of available) {
    console.log(`\n🤖 [${provider}] (${DEFAULT_MODELS[provider]})`);
    console.log("-".repeat(40));

    try {
      const answer = await chatWithModel(provider, [
        { role: "user", content: question },
      ], {
        maxOutputTokens: 200,
      });
      console.log(answer.trim());
    } catch (error) {
      console.error(`  ⚠️ 调用失败: ${(error as Error).message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Demo 完成！");
}

// 仅当直接运行时执行 demo
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("model-adapter.ts");

if (isMainModule) {
  main().catch(console.error);
}
