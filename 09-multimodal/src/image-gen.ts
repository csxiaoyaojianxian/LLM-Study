/**
 * image-gen.ts — 图片生成（DALL-E）
 *
 * 演示如何通过 AI SDK 调用 DALL-E 3 生成图片。
 * 支持不同尺寸、保存到本地文件。
 *
 * 运行: npm run image-gen
 * 需要: OpenAI API Key
 */

import "dotenv/config";
import { generateImage } from "ai";
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
  console.log("║          Demo 1: 文生图（Text-to-Image）概念讲解          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("📚 文生图技术原理：");
  console.log("─────────────────────────────────────────");
  console.log("  1️⃣  扩散模型 (Diffusion Model)");
  console.log("     从纯噪声图像逐步去噪，生成清晰图片");
  console.log("  2️⃣  CLIP 文本编码");
  console.log("     将文字描述转换为向量，引导图像生成方向");
  console.log("  3️⃣  U-Net 架构");
  console.log("     预测每步应去除的噪声\n");

  console.log("🎨 DALL-E 3 特点：");
  console.log("─────────────────────────────────────────");
  console.log("  • 内置 Prompt 改写 — 自动优化你的描述");
  console.log("  • 高质量输出 — 1024×1024 / 1792×1024 / 1024×1792");
  console.log("  • 安全过滤 — 自动拒绝不当内容");
  console.log("  • 单次生成 — 每次请求生成 1 张图片\n");

  console.log("🛠️  AI SDK 调用方式：");
  console.log("─────────────────────────────────────────");
  console.log(`  import { generateImage } from 'ai';
  import { createOpenAI } from '@ai-sdk/openai';

  const openai = createOpenAI({ apiKey });
  const { image } = await generateImage({
    model: openai.image('dall-e-3'),
    prompt: '一只戴着太阳镜的柯基在海边冲浪',
    size: '1024x1024',
  });
  // image.base64 — Base64 编码
  // image.uint8Array — 二进制数据`);
  console.log("");
}

/** Demo 2: 基础图片生成 */
async function demo2_basicGeneration(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 2: 基础图片生成                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = "A cute cartoon robot reading a book in a cozy library, warm lighting, digital art style";

  console.log(`📝 Prompt: "${prompt}"`);
  console.log("⏳ 正在生成图片（DALL-E 3）...\n");

  try {
    const { image } = await generateImage({
      model: openai.image("dall-e-3"),
      prompt,
      size: "1024x1024",
    });

    console.log("✅ 图片生成成功！");
    console.log(`📐 数据大小: ${image.uint8Array.length} bytes`);
    console.log(`📐 Base64 长度: ${image.base64.length} 字符`);

    // 保存到文件
    const filePath = path.join(OUTPUT_DIR, "basic-generation.png");
    await fs.writeFile(filePath, image.uint8Array);
    console.log(`💾 已保存到: ${filePath}`);
  } catch (error: any) {
    console.log(`⚠️  生成失败: ${error.message}`);
    if (error.message.includes("safety")) {
      console.log("💡 内容被安全系统过滤，请修改 prompt");
    }
  }
  console.log("");
}

/** Demo 3: 不同尺寸对比 */
async function demo3_differentSizes(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 3: 不同尺寸图片生成                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  requireOpenAI();

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = "A minimalist mountain landscape at sunset, flat design, pastel colors";

  const sizes: Array<{ size: "1024x1024" | "1792x1024" | "1024x1792"; label: string }> = [
    { size: "1024x1024", label: "正方形 (1024×1024)" },
    { size: "1792x1024", label: "横版 (1792×1024)" },
    { size: "1024x1792", label: "竖版 (1024×1792)" },
  ];

  console.log(`📝 统一 Prompt: "${prompt}"`);
  console.log("📐 将生成 3 种尺寸的图片：\n");

  for (const { size, label } of sizes) {
    console.log(`⏳ 生成 ${label}...`);
    try {
      const { image } = await generateImage({
        model: openai.image("dall-e-3"),
        prompt,
        size,
      });

      const fileName = `size-${size}.png`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      await fs.writeFile(filePath, image.uint8Array);
      console.log(`  ✅ ${label} — ${image.uint8Array.length} bytes → ${fileName}`);
    } catch (error: any) {
      console.log(`  ⚠️  ${label} 生成失败: ${error.message}`);
    }
  }
  console.log("");
}

/** Demo 4: 保存图片示例 + 提示 */
function demo4_saveGuide(): void {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          Demo 4: 图片保存与使用指南                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("💾 保存方式对比：");
  console.log("─────────────────────────────────────────");
  console.log("  ┌─────────────┬─────────────────────────────────┐");
  console.log("  │ 方式        │ 代码                             │");
  console.log("  ├─────────────┼─────────────────────────────────┤");
  console.log("  │ Uint8Array  │ fs.writeFile(path, image.uint8Array) │");
  console.log("  │ Base64      │ Buffer.from(image.base64, 'base64') │");
  console.log("  │ Data URL    │ `data:image/png;base64,${base64}`   │");
  console.log("  └─────────────┴─────────────────────────────────┘\n");

  console.log("💰 DALL-E 3 定价参考：");
  console.log("─────────────────────────────────────────");
  console.log("  ┌──────────────┬───────────┬──────────┐");
  console.log("  │ 尺寸          │ 标准质量   │ HD 质量   │");
  console.log("  ├──────────────┼───────────┼──────────┤");
  console.log("  │ 1024×1024    │ $0.040    │ $0.080   │");
  console.log("  │ 1792×1024    │ $0.080    │ $0.120   │");
  console.log("  │ 1024×1792    │ $0.080    │ $0.120   │");
  console.log("  └──────────────┴───────────┴──────────┘\n");

  console.log("💡 最佳实践：");
  console.log("  • 英文 prompt 效果通常优于中文");
  console.log("  • DALL-E 3 会自动改写 prompt，实际 prompt 可能与输入不同");
  console.log("  • 生成的图片均为 PNG 格式");
  console.log("  • 建议在前端展示时进行压缩/缩放");
  console.log("");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("\n🎨 ===== 09-multimodal: 图片生成 (DALL-E) =====\n");

  // 确保 output 目录存在
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Demo 1: 概念（无需 API）
  demo1_concepts();

  // Demo 2-3: 需要 OpenAI Key
  try {
    requireOpenAI();
    console.log("✅ 检测到 OpenAI API Key\n");

    await demo2_basicGeneration();
    await demo3_differentSizes();
  } catch (error: any) {
    console.log(`\n⚠️  ${error.message}`);
    console.log("💡 图片生成 Demo 2-3 需要 OpenAI API Key（DALL-E 为 OpenAI 专属）\n");
  }

  // Demo 4: 指南（无需 API）
  demo4_saveGuide();

  console.log("🎉 图片生成演示完成！\n");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("image-gen.ts");
if (isMainModule) {
  main().catch(console.error);
}
