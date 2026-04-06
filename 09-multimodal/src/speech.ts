/**
 * speech.ts — 语音合成（TTS）
 *
 * 演示如何通过 AI SDK 调用 OpenAI TTS 模型将文本转换为语音。
 * 支持多种音色、中英文文本。
 *
 * 运行: npm run speech
 * 需要: OpenAI API Key
 */

import "dotenv/config";
import { experimental_generateSpeech as generateSpeech } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireOpenAI } from "./model-adapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: 概念讲解 */
function demo1_concepts(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: 语音合成（TTS）概念讲解                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 TTS (Text-to-Speech) 技术：");
  console.log("─────────────────────────────────────────");
  console.log("  将文本转换为自然语音的技术。现代 TTS 基于深度学习，");
  console.log("  能生成接近真人的语音效果。\n");

  console.log("🎙️  OpenAI TTS 模型：");
  console.log("─────────────────────────────────────────");
  console.log("  ┌────────────┬──────────────────────────┐");
  console.log("  │ 模型        │ 特点                      │");
  console.log("  ├────────────┼──────────────────────────┤");
  console.log("  │ tts-1      │ 速度快，适合实时场景       │");
  console.log("  │ tts-1-hd   │ 音质高，适合内容制作       │");
  console.log("  └────────────┴──────────────────────────┘\n");

  console.log("🗣️  可用音色 (Voice)：");
  console.log("─────────────────────────────────────────");
  console.log("  • alloy   — 中性、平衡");
  console.log("  • echo    — 温暖、自然");
  console.log("  • fable   — 富有表现力");
  console.log("  • nova    — 年轻、活力");
  console.log("  • onyx    — 沉稳、深沉");
  console.log("  • shimmer — 清晰、明亮\n");

  console.log("🛠️  AI SDK 调用方式：");
  console.log("─────────────────────────────────────────");
  console.log(`  const { audio } = await generateSpeech({
    model: openai.speech('tts-1'),
    text: '你好，世界！',
    voice: 'alloy',
  });
  // audio — Uint8Array (MP3 格式)
  fs.writeFile('output.mp3', audio);`);
  console.log("");
}

/** Demo 2: 基础语音合成 */
async function demo2_basicTTS(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: 基础语音合成                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const text = "Hello! Welcome to the multimodal AI tutorial. Today we will explore text to speech technology.";

  console.log(`📝 文本: "${text}"`);
  console.log("🎙️  音色: alloy");
  console.log("⏳ 正在合成语音...\n");

  try {
    const { audio } = await generateSpeech({
      model: openai.speech("tts-1"),
      text,
      voice: "alloy",
    });

    const filePath = path.join(OUTPUT_DIR, "basic-tts.mp3");
    await fs.writeFile(filePath, audio.uint8Array);
    console.log("✅ 语音合成成功！");
    console.log(`📐 音频大小: ${audio.uint8Array.length} bytes`);
    console.log(`💾 已保存到: ${filePath}`);
  } catch (error: any) {
    console.log(`⚠️  合成失败: ${error.message}`);
  }
  console.log("");
}

/** Demo 3: 不同音色对比 */
async function demo3_voiceComparison(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 不同音色对比                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const text = "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.";
  const voices = ["alloy", "echo", "nova"] as const;

  console.log(`📝 统一文本: "${text}"`);
  console.log(`🎙️  对比音色: ${voices.join(" / ")}\n`);

  for (const voice of voices) {
    console.log(`⏳ 合成 ${voice} 音色...`);
    try {
      const { audio } = await generateSpeech({
        model: openai.speech("tts-1"),
        text,
        voice,
      });

      const fileName = `voice-${voice}.mp3`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      await fs.writeFile(filePath, audio.uint8Array);
      console.log(`  ✅ ${voice} — ${audio.uint8Array.length} bytes → ${fileName}`);
    } catch (error: any) {
      console.log(`  ⚠️  ${voice} 合成失败: ${error.message}`);
    }
  }
  console.log("");
}

/** Demo 4: 中文语音合成 */
async function demo4_chineseTTS(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 4: 中文语音合成                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const text = "你好！欢迎来到多模态 AI 教程。今天我们将一起探索语音合成技术，让机器学会说话。";

  console.log(`📝 中文文本: "${text}"`);
  console.log("🎙️  音色: nova");
  console.log("⏳ 正在合成中文语音...\n");

  try {
    const { audio } = await generateSpeech({
      model: openai.speech("tts-1"),
      text,
      voice: "nova",
    });

    const filePath = path.join(OUTPUT_DIR, "chinese-tts.mp3");
    await fs.writeFile(filePath, audio.uint8Array);
    console.log("✅ 中文语音合成成功！");
    console.log(`📐 音频大小: ${audio.uint8Array.length} bytes`);
    console.log(`💾 已保存到: ${filePath}`);
    console.log("\n💡 OpenAI TTS 对中文支持良好，自动识别语言，无需额外参数。");
  } catch (error: any) {
    console.log(`⚠️  合成失败: ${error.message}`);
  }
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n🎙️  ===== 09-multimodal: 语音合成 (TTS) =====\n");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Demo 1: 概念（无需 API）
  demo1_concepts();

  // Demo 2-4: 需要 OpenAI Key
  try {
    requireOpenAI();
    console.log("✅ 检测到 OpenAI API Key\n");

    await demo2_basicTTS();
    await demo3_voiceComparison();
    await demo4_chineseTTS();
  } catch (error: any) {
    console.log(`\n⚠️  ${error.message}`);
    console.log("💡 TTS Demo 2-4 需要 OpenAI API Key\n");
  }

  console.log("🎉 语音合成演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("speech.ts");
if (isMainModule) {
  main().catch(console.error);
}
