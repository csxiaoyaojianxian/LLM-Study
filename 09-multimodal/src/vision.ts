/**
 * vision.ts — 图片理解（Vision）
 *
 * 演示如何通过 Vercel AI SDK 向多模态 LLM 发送图片并获取分析结果。
 * 支持 OpenAI gpt-4o / Anthropic claude-3.5-sonnet 等支持 Vision 的模型。
 *
 * 运行: npm run vision
 * 需要: OpenAI 或 Anthropic API Key
 */

import "dotenv/config";
import { generateText } from "ai";
import { getModel, getVisionProvider } from "./model-adapter.js";

// ============================================================
// 辅助函数：生成简单的测试 PNG 图片（纯代码生成，无需外部文件）
// ============================================================

/**
 * 生成一张简单的纯色 PNG 图片（最小有效 PNG）
 * PNG 格式：Signature + IHDR + IDAT + IEND
 */
function generateSimplePNG(r: number, g: number, b: number, width = 8, height = 8): Buffer {
  // 使用最简单的方式：创建一个 BMP-like 的 raw RGBA 数据，然后手动构建 PNG
  // 为了简洁，我们生成一个 base64 编码的 1x1 像素 PNG
  const { createCanvas } = (() => {
    // 不依赖 canvas 库，直接构造最小 PNG 二进制
    return { createCanvas: null };
  })();

  // 手动构造一个有效的 PNG 文件（未压缩，使用 zlib stored block）
  // 这里使用预构建的小图片方式
  const pixels: number[] = [];
  for (let y = 0; y < height; y++) {
    pixels.push(0); // filter byte: None
    for (let x = 0; x < width; x++) {
      pixels.push(r, g, b); // RGB
    }
  }

  // 简化方案：构造 PPM 格式然后描述它
  // 实际上更实用的方案是使用 Data URL
  return Buffer.from(pixels);
}

/**
 * 创建一个简单的 SVG 图片并转为 base64
 * SVG 被大多数 Vision 模型支持
 */
function createTestImageBase64(): string {
  // 创建一个包含彩色方块的 SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect x="0" y="0" width="100" height="100" fill="#FF6B6B"/>
    <rect x="100" y="0" width="100" height="100" fill="#4ECDC4"/>
    <rect x="0" y="100" width="100" height="100" fill="#45B7D1"/>
    <rect x="100" y="100" width="100" height="100" fill="#96CEB4"/>
    <text x="100" y="105" text-anchor="middle" font-size="20" fill="white" font-family="Arial">Test</text>
  </svg>`;
  return Buffer.from(svg).toString("base64");
}

function createGradientImageBase64(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="url(#grad)"/>
    <circle cx="100" cy="100" r="50" fill="rgba(255,255,255,0.3)"/>
    <text x="100" y="108" text-anchor="middle" font-size="16" fill="white" font-family="Arial">Gradient</text>
  </svg>`;
  return Buffer.from(svg).toString("base64");
}

// ============================================================
// Demo 函数
// ============================================================

/** Demo 1: 概念讲解 */
function demo1_concepts(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 1: 多模态 LLM 与 Vision 概念讲解            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 什么是多模态 LLM？");
  console.log("─────────────────────────────────────────");
  console.log("传统 LLM 只能处理文本，多模态 LLM 可以同时理解：");
  console.log("  📝 文本 (Text)");
  console.log("  🖼️  图片 (Image/Vision)");
  console.log("  🎵 音频 (Audio)");
  console.log("  🎬 视频 (Video)\n");

  console.log("🔍 Vision 功能支持的模型：");
  console.log("─────────────────────────────────────────");
  console.log("  ┌─────────────┬────────────────────────────────┐");
  console.log("  │ Provider    │ 支持 Vision 的模型              │");
  console.log("  ├─────────────┼────────────────────────────────┤");
  console.log("  │ OpenAI      │ gpt-4o, gpt-4o-mini, gpt-4-turbo │");
  console.log("  │ Anthropic   │ claude-3.5-sonnet, claude-3-opus │");
  console.log("  │ DeepSeek    │ ❌ 暂不支持                     │");
  console.log("  └─────────────┴────────────────────────────────┘\n");

  console.log("🛠️  AI SDK 中的 Vision 用法：");
  console.log("─────────────────────────────────────────");
  console.log(`  generateText({
    model: openai('gpt-4o'),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '描述这张图片' },
        { type: 'image', image: base64String }  // base64 或 URL
      ]
    }]
  })`);
  console.log("");
}

/** Demo 2: 本地图片分析（代码生成图片 → base64 → LLM 分析） */
async function demo2_localImage(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: 本地图片分析（Base64 编码）              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const provider = getVisionProvider();
  const modelName = provider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-latest";
  console.log(`📦 使用模型: ${provider} / ${modelName}`);
  console.log("🎨 生成测试图片（SVG 彩色方块）...\n");

  const imageBase64 = createTestImageBase64();
  console.log(`📐 图片 Base64 长度: ${imageBase64.length} 字符`);
  console.log("📤 发送图片给 LLM 分析...\n");

  try {
    const result = await generateText({
      model: getModel(provider, modelName),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "请详细描述这张图片的内容，包括颜色、形状和布局。用中文回答。" },
            { type: "image", image: imageBase64, mediaType: "image/svg+xml" },
          ],
        },
      ],
    });

    console.log("🤖 LLM 分析结果：");
    console.log("─────────────────────────────────────────");
    console.log(result.text);
    console.log(`\n📊 Token 使用: input=${result.usage?.inputTokens}, output=${result.usage?.outputTokens}`);
  } catch (error: any) {
    console.log(`⚠️  API 调用失败: ${error.message}`);
    console.log("💡 请确保已配置 OpenAI 或 Anthropic API Key");
  }
  console.log("");
}

/** Demo 3: URL 图片分析 */
async function demo3_urlImage(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: URL 图片分析（网络图片）                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const provider = getVisionProvider();
  const modelName = provider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-latest";
  console.log(`📦 使用模型: ${provider} / ${modelName}`);

  // 使用一个公开的免费图片 URL
  const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png";
  console.log(`🌐 图片 URL: ${imageUrl}`);
  console.log("📤 发送 URL 给 LLM 分析...\n");

  try {
    const result = await generateText({
      model: getModel(provider, modelName),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "这是什么图片？请简要描述你看到的内容。用中文回答。" },
            { type: "image", image: new URL(imageUrl) },
          ],
        },
      ],
    });

    console.log("🤖 LLM 分析结果：");
    console.log("─────────────────────────────────────────");
    console.log(result.text);
    console.log(`\n📊 Token 使用: input=${result.usage?.inputTokens}, output=${result.usage?.outputTokens}`);
  } catch (error: any) {
    console.log(`⚠️  API 调用失败: ${error.message}`);
    console.log("💡 部分模型可能不支持 URL 方式，请尝试 base64 方式");
  }
  console.log("");
}

/** Demo 4: 多图对比 */
async function demo4_multiImage(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 4: 多图对比分析                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const provider = getVisionProvider();
  const modelName = provider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-latest";
  console.log(`📦 使用模型: ${provider} / ${modelName}`);

  const image1 = createTestImageBase64();
  const image2 = createGradientImageBase64();
  console.log("🎨 生成两张测试图片：");
  console.log("  图片1: 四色方块 (红/青/蓝/绿)");
  console.log("  图片2: 紫色渐变 + 圆形");
  console.log("📤 同时发送两张图片给 LLM 对比...\n");

  try {
    const result = await generateText({
      model: getModel(provider, modelName),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "请对比这两张图片的差异，从颜色、构图、元素等方面分析。用中文回答。" },
            { type: "image", image: image1, mediaType: "image/svg+xml" },
            { type: "image", image: image2, mediaType: "image/svg+xml" },
          ],
        },
      ],
    });

    console.log("🤖 LLM 对比分析：");
    console.log("─────────────────────────────────────────");
    console.log(result.text);
    console.log(`\n📊 Token 使用: input=${result.usage?.inputTokens}, output=${result.usage?.outputTokens}`);
  } catch (error: any) {
    console.log(`⚠️  API 调用失败: ${error.message}`);
  }
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n🖼️  ===== 09-multimodal: Vision 图片理解 =====\n");

  // Demo 1: 概念讲解（无需 API）
  demo1_concepts();

  // Demo 2-4: 需要 API Key
  try {
    const provider = getVisionProvider();
    console.log(`✅ 检测到 Vision 可用的 Provider: ${provider}\n`);

    await demo2_localImage();
    await demo3_urlImage();
    await demo4_multiImage();
  } catch (error: any) {
    console.log(`\n⚠️  ${error.message}`);
    console.log("💡 Vision Demo 2-4 需要 OpenAI 或 Anthropic API Key");
  }

  console.log("🎉 Vision 演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("vision.ts");
if (isMainModule) {
  main().catch(console.error);
}

export { createTestImageBase64, createGradientImageBase64 };
