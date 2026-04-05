/**
 * model-chat.ts — LangChain Model 工厂函数
 *
 * 复用自 05-langchain/src/model-chat.ts，统一接入 DeepSeek / OpenAI / Anthropic。
 * - DeepSeek 通过 ChatOpenAI + baseURL 适配
 * - Anthropic 通过 ChatOpenAI + baseURL 适配
 *
 * 本文件仅保留 createChatModel 工厂函数，供 06-agent 各 demo 导入使用。
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

// ============================================================
// createChatModel — 模型工厂函数
// ============================================================

/**
 * 创建 Chat Model 实例，自动检测可用的 API Key
 * 优先级：Anthropic > DeepSeek > OpenAI
 */
export function createChatModel(options?: {
  temperature?: number;
  modelName?: string;
}): BaseChatModel {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropicBaseUrl = process.env.ANTHROPIC_API_BASE_URL;

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
