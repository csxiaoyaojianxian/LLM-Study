/**
 * multimodal-chat.ts — 多模态综合对话
 *
 * 综合演示：图文问答、语音对话闭环，展示多模态应用的完整流程。
 *
 * 运行: npm run multimodal-chat
 * 需要: OpenAI API Key（DALL-E + Whisper + TTS + Vision）
 */

import "dotenv/config";
import { generateText, generateImage, experimental_generateSpeech as generateSpeech, experimental_transcribe as transcribe } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getModel, getVisionProvider, requireOpenAI, getAvailableProviders } from "./model-adapter.js";
import { createTestImageBase64 } from "./vision.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "output");

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: 多模态应用架构概览 */
function demo1_architecture(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: 多模态应用架构概览                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 多模态 AI 应用的核心能力：");
  console.log("─────────────────────────────────────────");
  console.log("  ┌─────────────────────────────────────────────────┐");
  console.log("  │                 多模态 AI 应用                    │");
  console.log("  │                                                  │");
  console.log("  │   输入层          处理层          输出层          │");
  console.log("  │  ┌──────┐     ┌──────────┐    ┌──────────┐     │");
  console.log("  │  │ 文本  │────→│          │───→│ 文本回答  │     │");
  console.log("  │  │ 图片  │────→│  LLM +   │───→│ 生成图片  │     │");
  console.log("  │  │ 语音  │────→│ 多模态API │───→│ 合成语音  │     │");
  console.log("  │  └──────┘     └──────────┘    └──────────┘     │");
  console.log("  └─────────────────────────────────────────────────┘\n");

  console.log("🔗 典型应用场景：");
  console.log("  1️⃣  图文问答 — 上传图片 → Vision 分析 → 文字回答");
  console.log("  2️⃣  语音助手 — 语音输入 → STT → LLM → TTS → 语音回答");
  console.log("  3️⃣  创意工具 — 文字描述 → 生成图片 → Vision 验证");
  console.log("  4️⃣  内容制作 — 文章 → TTS 朗读 → 音频内容\n");

  console.log("🛠️  本模块用到的 API 总览：");
  console.log("  ┌────────────────┬──────────────────────────────────┐");
  console.log("  │ 能力            │ AI SDK 方法                      │");
  console.log("  ├────────────────┼──────────────────────────────────┤");
  console.log("  │ 文本理解/生成   │ generateText()                   │");
  console.log("  │ 图片理解 Vision │ generateText() + ImagePart       │");
  console.log("  │ 图片生成 DALL-E │ generateImage()                  │");
  console.log("  │ 语音合成 TTS    │ generateSpeech()                 │");
  console.log("  │ 语音识别 STT    │ transcribe()                     │");
  console.log("  └────────────────┴──────────────────────────────────┘");
  console.log("");
}

/** Demo 2: 图文问答 — 生成图片 → Vision 分析 → 文字总结 */
async function demo2_imageQA(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: 图文问答闭环                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Step 1: 生成一张图片
  const genPrompt = "A simple infographic showing 3 steps of making coffee: grind beans, brew, serve. Flat design, minimal colors.";
  console.log("🎨 Step 1: DALL-E 生成信息图...");
  console.log(`   Prompt: "${genPrompt}"\n`);

  try {
    const { image } = await generateImage({
      model: openai.image("dall-e-3"),
      prompt: genPrompt,
      size: "1024x1024",
    });

    const imgPath = path.join(OUTPUT_DIR, "multimodal-qa.png");
    await fs.writeFile(imgPath, image.uint8Array);
    console.log(`  ✅ 图片生成完成 → ${imgPath}`);
    console.log(`  📐 大小: ${image.uint8Array.length} bytes\n`);

    // Step 2: Vision 分析这张图片
    console.log("🔍 Step 2: Vision 分析生成的图片...\n");

    const visionProvider = getVisionProvider();
    const visionModel = visionProvider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-latest";

    const visionResult = await generateText({
      model: getModel(visionProvider, visionModel),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "请用中文详细描述这张信息图的内容，包括它展示了什么步骤，以及设计风格。" },
            { type: "image", image: image.base64 },
          ],
        },
      ],
    });

    console.log("🤖 Vision 分析结果：");
    console.log("─────────────────────────────────────────");
    console.log(visionResult.text);

    // Step 3: 基于分析结果生成总结
    console.log("\n📝 Step 3: LLM 生成总结...\n");

    const summaryResult = await generateText({
      model: getModel(visionProvider, visionModel),
      messages: [
        {
          role: "user",
          content: `基于以下图片分析，用一句话总结这张图片的主题：\n\n${visionResult.text}`,
        },
      ],
    });

    console.log(`✨ 一句话总结: ${summaryResult.text}`);
  } catch (error: any) {
    console.log(`⚠️  图文问答失败: ${error.message}`);
  }
  console.log("");
}

/** Demo 3: 语音对话闭环 — TTS → STT → LLM → TTS */
async function demo3_voiceChat(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 语音对话闭环                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log("🔄 流程: 用户文本 → TTS → STT → LLM 回答 → TTS 输出\n");

  // Step 1: 模拟用户输入，先 TTS
  const userText = "What are three benefits of learning artificial intelligence?";
  console.log(`👤 模拟用户输入: "${userText}"`);
  console.log("⏳ Step 1: TTS 将用户输入合成为语音...");

  const { audio: userAudio } = await generateSpeech({
    model: openai.speech("tts-1"),
    text: userText,
    voice: "nova",
  });
  await fs.writeFile(path.join(OUTPUT_DIR, "voice-chat-input.mp3"), userAudio.uint8Array);
  console.log(`  ✅ 用户语音合成完成 (${userAudio.uint8Array.length} bytes)\n`);

  // Step 2: STT 识别
  console.log("⏳ Step 2: Whisper 识别用户语音...");
  const sttResult = await transcribe({
    model: openai.transcription("whisper-1"),
    audio: userAudio.uint8Array,
  });
  console.log(`  ✅ 识别结果: "${sttResult.text}"\n`);

  // Step 3: LLM 回答
  console.log("⏳ Step 3: LLM 生成回答...");
  const provider = getVisionProvider();
  const llmResult = await generateText({
    model: getModel(provider),
    messages: [
      { role: "user", content: sttResult.text },
    ],
    system: "你是一个友好的 AI 助手。请用简洁的英文回答问题，控制在3句话以内。",
  });
  console.log(`  🤖 LLM 回答: "${llmResult.text}"\n`);

  // Step 4: TTS 朗读回答
  console.log("⏳ Step 4: TTS 将回答合成为语音...");
  const { audio: responseAudio } = await generateSpeech({
    model: openai.speech("tts-1"),
    text: llmResult.text,
    voice: "alloy",
  });

  const outputPath = path.join(OUTPUT_DIR, "voice-chat-response.mp3");
  await fs.writeFile(outputPath, responseAudio.uint8Array);
  console.log(`  ✅ 回答语音合成完成 (${responseAudio.uint8Array.length} bytes)`);
  console.log(`  💾 已保存到: ${outputPath}\n`);

  console.log("🎉 语音对话闭环完成！");
  console.log("  👤 用户文本 → 🎙️ TTS → 📻 音频 → 🎤 STT → 🤖 LLM → 🎙️ TTS → 🔊 回答语音");
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n🌐 ===== 09-multimodal: 多模态综合对话 =====\n");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Demo 1: 架构概览（无需 API）
  demo1_architecture();

  // Demo 2-3: 需要 API Key
  try {
    requireOpenAI();
    const providers = getAvailableProviders();
    console.log(`✅ 可用 Providers: ${providers.join(", ")}\n`);

    await demo2_imageQA();
    await demo3_voiceChat();
  } catch (error: any) {
    console.log(`\n⚠️  ${error.message}`);
    console.log("💡 多模态综合演示需要 OpenAI API Key\n");
  }

  console.log("🎉 多模态综合演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("multimodal-chat.ts");
if (isMainModule) {
  main().catch(console.error);
}
