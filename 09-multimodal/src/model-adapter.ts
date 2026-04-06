/**
 * model-adapter.ts — 多模型统一适配层
 *
 * 核心价值：封装 Vercel AI SDK 的多模型切换逻辑，后续模块可直接复用。
 * 支持 deepseek / openai / anthropic 三个 provider。
 *
 * 复用自 07-mcp，去掉了 main() demo。
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

/** 获取 OpenAI provider 实例（用于图片生成、TTS、STT 等多模态功能） */
export function getOpenAIProvider() {
  return createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
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

/** 检测 OpenAI Key 是否可用（多模态功能大多需要 OpenAI） */
export function requireOpenAI(): void {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-") {
    throw new Error(
      "❌ 此 demo 需要 OPENAI_API_KEY！DALL-E / Whisper / TTS 均为 OpenAI 专属功能。"
    );
  }
}

/** 获取支持 Vision 的 provider（优先 OpenAI，其次 Anthropic） */
export function getVisionProvider(): Provider {
  const available = getAvailableProviders();
  if (available.includes("openai")) return "openai";
  if (available.includes("anthropic")) return "anthropic";
  throw new Error(
    "❌ Vision 功能需要 OpenAI 或 Anthropic 的 API Key！DeepSeek 暂不支持 Vision。"
  );
}
