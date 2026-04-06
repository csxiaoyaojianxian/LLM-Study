/**
 * transcription.ts — 语音识别（STT / Whisper）
 *
 * 演示如何通过 AI SDK 调用 OpenAI Whisper 模型将语音转换为文字。
 * 包含 TTS→STT 闭环验证。
 *
 * 运行: npm run transcription
 * 需要: OpenAI API Key
 */

import "dotenv/config";
import { experimental_transcribe as transcribe, experimental_generateSpeech as generateSpeech } from "ai";
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
  console.log("║          Demo 1: 语音识别（STT / ASR）概念讲解            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 STT / ASR 技术：");
  console.log("─────────────────────────────────────────");
  console.log("  STT (Speech-to-Text) / ASR (Automatic Speech Recognition)");
  console.log("  将语音音频转换为文字的技术。\n");

  console.log("🎯 OpenAI Whisper 模型：");
  console.log("─────────────────────────────────────────");
  console.log("  • 模型: whisper-1（基于 Whisper large-v2）");
  console.log("  • 支持 90+ 种语言（含中文）");
  console.log("  • 自动语言检测");
  console.log("  • 支持 mp3/mp4/wav/webm 等格式");
  console.log("  • 最大文件大小: 25MB\n");

  console.log("🛠️  AI SDK 调用方式：");
  console.log("─────────────────────────────────────────");
  console.log(`  const result = await transcribe({
    model: openai.transcription('whisper-1'),
    audio: audioBuffer,  // Buffer / Uint8Array
  });
  // result.text — 完整转录文本
  // result.segments — [{text, startTime, endTime}, ...]`);
  console.log("");
}

/** Demo 2: TTS → STT 闭环验证 */
async function demo2_roundTrip(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: TTS→STT 闭环验证                       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const originalText = "Hello, this is a round trip test. We first synthesize speech, then transcribe it back to text.";

  console.log("🔄 闭环流程: 文字 → TTS 合成语音 → Whisper 识别文字");
  console.log(`📝 原始文本: "${originalText}"\n`);

  // Step 1: TTS 合成
  console.log("⏳ Step 1: TTS 合成语音...");
  const { audio } = await generateSpeech({
    model: openai.speech("tts-1"),
    text: originalText,
    voice: "alloy",
  });
  console.log(`  ✅ 合成完成，音频大小: ${audio.uint8Array.length} bytes`);

  // 保存音频
  const audioPath = path.join(OUTPUT_DIR, "roundtrip-audio.mp3");
  await fs.writeFile(audioPath, audio.uint8Array);
  console.log(`  💾 音频已保存: ${audioPath}\n`);

  // Step 2: Whisper 识别
  console.log("⏳ Step 2: Whisper 语音识别...");
  const result = await transcribe({
    model: openai.transcription("whisper-1"),
    audio: audio.uint8Array,
  });

  console.log(`  ✅ 识别完成！\n`);

  // Step 3: 对比
  console.log("📊 结果对比：");
  console.log("─────────────────────────────────────────");
  console.log(`  原始文本: "${originalText}"`);
  console.log(`  识别结果: "${result.text}"`);

  // 简单相似度比较
  const originalLower = originalText.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const resultLower = result.text.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const match = originalLower === resultLower;
  console.log(`  完全匹配: ${match ? "✅ 是" : "❌ 否（可能存在标点/大小写差异）"}`);
  console.log("");
}

/** Demo 3: 转录结果分析（segments 时间戳） */
async function demo3_segmentAnalysis(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 转录结果详细分析                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 合成一段较长的文本
  const text = "Welcome to the AI tutorial. Today we cover three topics. First, text to speech. Second, speech recognition. Third, multimodal applications. Let us get started.";

  console.log("📝 合成较长文本用于 segment 分析...");
  console.log(`   "${text}"\n`);

  // TTS
  console.log("⏳ 合成语音...");
  const { audio } = await generateSpeech({
    model: openai.speech("tts-1"),
    text,
    voice: "echo",
  });
  console.log(`  ✅ 音频大小: ${audio.uint8Array.length} bytes\n`);

  // 转录
  console.log("⏳ Whisper 识别 + segment 分析...");
  const result = await transcribe({
    model: openai.transcription("whisper-1"),
    audio: audio.uint8Array,
  });

  console.log(`\n📋 完整转录文本:`);
  console.log(`   "${result.text}"\n`);

  if (result.segments && result.segments.length > 0) {
    console.log("⏱️  Segments 时间戳：");
    console.log("─────────────────────────────────────────");
    for (const seg of result.segments) {
      const start = seg.startSecond?.toFixed(1) ?? "?";
      const end = seg.endSecond?.toFixed(1) ?? "?";
      console.log(`  [${start}s → ${end}s] ${seg.text}`);
    }
  } else {
    console.log("ℹ️  未返回 segments 信息（Whisper API 可能未包含）");
    console.log("💡 segments 包含每段的起止时间，可用于字幕生成");
  }
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n🎤 ===== 09-multimodal: 语音识别 (Whisper) =====\n");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Demo 1: 概念（无需 API）
  demo1_concepts();

  // Demo 2-3: 需要 OpenAI Key
  try {
    requireOpenAI();
    console.log("✅ 检测到 OpenAI API Key\n");

    await demo2_roundTrip();
    await demo3_segmentAnalysis();
  } catch (error: any) {
    console.log(`\n⚠️  ${error.message}`);
    console.log("💡 STT Demo 2-3 需要 OpenAI API Key（Whisper 为 OpenAI 专属）\n");
  }

  console.log("🎉 语音识别演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("transcription.ts");
if (isMainModule) {
  main().catch(console.error);
}
