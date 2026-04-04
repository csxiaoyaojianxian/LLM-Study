/**
 * structured-output.ts — 结构化输出实验
 *
 * 使用 Vercel AI SDK 的 generateObject() + Zod Schema 实现强类型 JSON 输出。
 *
 * 实验内容：
 * 1. 提取文章结构化信息（标题、摘要、关键词、情感）
 * 2. 生成符合 Schema 的 JSON 数据（商品信息）
 * 3. 枚举分类任务（情感分析）
 * 4. 对比 generateObject vs generateText + JSON.parse 的可靠性
 *
 * 运行: npm run structured-output
 */

import "dotenv/config";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel, getDefaultProvider, type Provider } from "./model-adapter.js";

// ============================================================
// 1. Schema 定义
// ============================================================

/** 文章信息 Schema */
const ArticleInfoSchema = z.object({
  title: z.string().describe("文章标题"),
  summary: z.string().describe("文章摘要，不超过100字"),
  keywords: z.array(z.string()).describe("3-5个关键词"),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("文章整体情感倾向"),
  readingTimeMinutes: z.number().describe("预估阅读时间（分钟）"),
});

/** 商品信息 Schema */
const ProductSchema = z.object({
  name: z.string().describe("商品名称"),
  description: z.string().describe("商品描述，50字以内"),
  price: z.number().describe("价格（元）"),
  category: z.enum(["electronics", "clothing", "food", "books", "other"]).describe("商品分类"),
  tags: z.array(z.string()).describe("商品标签"),
  inStock: z.boolean().describe("是否有库存"),
});

/** 情感分析 Schema */
const SentimentSchema = z.object({
  text: z.string().describe("原始文本"),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("情感分类"),
  confidence: z.number().min(0).max(1).describe("置信度 0-1"),
  reason: z.string().describe("判断依据，一句话解释"),
});

// ============================================================
// 2. 实验函数
// ============================================================

/** 实验1：提取文章结构化信息 */
async function experiment1_ArticleExtraction(provider: Provider) {
  console.log("=".repeat(60));
  console.log("📌 实验1: 提取文章结构化信息 (generateObject + Zod)");
  console.log("=".repeat(60));

  const article = `
近日，OpenAI 发布了 GPT-4o 模型的重大更新，带来了更快的响应速度和更低的使用成本。
新模型在多语言理解、代码生成和逻辑推理方面都有显著提升。
开发者社区对此反应热烈，纷纷表示这将大大降低 AI 应用的开发门槛。
不过也有部分研究者担忧，模型能力的快速提升可能带来安全和伦理方面的挑战。
业内人士预计，这一更新将加速 AI 在教育、医疗和金融等领域的落地应用。
  `.trim();

  console.log(`\n📄 输入文章:\n${article}\n`);

  const model = getModel(provider);
  const { object } = await generateObject({
    model,
    schema: ArticleInfoSchema,
    prompt: `请分析以下文章，提取结构化信息：\n\n${article}`,
  });

  console.log("📊 提取结果:");
  console.log(JSON.stringify(object, null, 2));
  console.log();
}

/** 实验2：生成符合 Schema 的商品信息 */
async function experiment2_ProductGeneration(provider: Provider) {
  console.log("=".repeat(60));
  console.log("📌 实验2: 生成结构化商品信息");
  console.log("=".repeat(60));

  const model = getModel(provider);
  const { object } = await generateObject({
    model,
    schema: z.object({
      products: z.array(ProductSchema).describe("商品列表"),
    }),
    prompt: "请生成3个虚构的科技类商品信息，包含不同价位段（100元以下、100-1000元、1000元以上）。",
  });

  console.log("\n📦 生成的商品列表:");
  for (const product of object.products) {
    console.log(`\n  📱 ${product.name}`);
    console.log(`     描述: ${product.description}`);
    console.log(`     价格: ¥${product.price}`);
    console.log(`     分类: ${product.category}`);
    console.log(`     标签: ${product.tags.join(", ")}`);
    console.log(`     库存: ${product.inStock ? "✅ 有" : "❌ 无"}`);
  }
  console.log();
}

/** 实验3：枚举分类 — 批量情感分析 */
async function experiment3_SentimentClassification(provider: Provider) {
  console.log("=".repeat(60));
  console.log("📌 实验3: 枚举分类 — 批量情感分析");
  console.log("=".repeat(60));

  const texts = [
    "这款产品太棒了，完全超出我的期望！强烈推荐给大家！",
    "发货速度很慢，客服态度也很差，再也不会买了。",
    "产品质量一般，价格还行，中规中矩吧。",
    "今天天气不错，适合出去走走。",
  ];

  const model = getModel(provider);
  console.log("\n🎭 情感分析结果:\n");
  console.log(
    "┌─────────────────────────────────────┬───────────┬────────┬──────────────────────────┐"
  );
  console.log(
    "│ 文本                                │ 情感      │ 置信度 │ 依据                     │"
  );
  console.log(
    "├─────────────────────────────────────┼───────────┼────────┼──────────────────────────┤"
  );

  for (const text of texts) {
    const { object } = await generateObject({
      model,
      schema: SentimentSchema,
      prompt: `请对以下文本进行情感分析：\n"${text}"`,
    });

    const sentimentMap: Record<string, string> = {
      positive: "😊 积极",
      negative: "😞 消极",
      neutral: "😐 中性",
    };

    const truncatedText = text.length > 30 ? text.substring(0, 30) + "…" : text;
    const truncatedReason =
      object.reason.length > 20 ? object.reason.substring(0, 20) + "…" : object.reason;

    console.log(
      `│ ${truncatedText.padEnd(36)}│ ${(sentimentMap[object.sentiment] || object.sentiment).padEnd(10)}│ ${object.confidence.toFixed(2).padEnd(7)}│ ${truncatedReason.padEnd(25)}│`
    );
  }

  console.log(
    "└─────────────────────────────────────┴───────────┴────────┴──────────────────────────┘"
  );
  console.log();
}

/** 实验4：对比 generateObject vs generateText + JSON.parse */
async function experiment4_Comparison(provider: Provider) {
  console.log("=".repeat(60));
  console.log("📌 实验4: generateObject vs generateText + JSON.parse 对比");
  console.log("=".repeat(60));

  const model = getModel(provider);
  const testPrompt =
    '请分析文本"这家餐厅的菜品很好吃，但是价格偏贵"的情感，' +
    '返回 JSON 格式：{"sentiment": "positive/negative/neutral", "score": 0-1}';

  // 方法 A: generateObject（类型安全）
  console.log("\n🅰️  方法 A: generateObject (推荐)");
  try {
    const schema = z.object({
      sentiment: z.enum(["positive", "negative", "neutral"]),
      score: z.number().min(0).max(1),
    });

    const { object } = await generateObject({
      model,
      schema,
      prompt: testPrompt,
    });
    console.log(`   结果: ${JSON.stringify(object)}`);
    console.log(`   类型安全: ✅ TypeScript 类型推断正常`);
    console.log(`   sentiment 类型: ${typeof object.sentiment}`);
    console.log(`   score 类型: ${typeof object.score}`);
  } catch (error) {
    console.error(`   ⚠️ 失败: ${(error as Error).message}`);
  }

  // 方法 B: generateText + JSON.parse（传统方式）
  console.log("\n🅱️  方法 B: generateText + JSON.parse (传统方式)");
  try {
    const { text } = await generateText({
      model,
      prompt: testPrompt + "\n\n注意：只返回 JSON，不要返回其他内容。",
      maxOutputTokens: 200,
    });

    console.log(`   原始输出: ${text.trim()}`);

    // 尝试提取 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`   解析结果: ${JSON.stringify(parsed)}`);
      console.log(`   类型安全: ❌ 需要手动校验`);
      console.log(`   sentiment 类型: ${typeof parsed.sentiment} (无法保证枚举值)`);
      console.log(`   score 类型: ${typeof parsed.score} (无法保证范围)`);
    } else {
      console.log(`   ⚠️ 无法从输出中提取 JSON`);
    }
  } catch (error) {
    console.error(`   ⚠️ 失败: ${(error as Error).message}`);
  }

  console.log("\n📋 对比总结:");
  console.log("  ┌──────────────────┬─────────────────────┬─────────────────────┐");
  console.log("  │ 维度             │ generateObject      │ generateText+parse  │");
  console.log("  ├──────────────────┼─────────────────────┼─────────────────────┤");
  console.log("  │ 类型安全         │ ✅ Zod 自动校验     │ ❌ 需手动校验       │");
  console.log("  │ 输出可靠性       │ ✅ 始终符合 Schema  │ ⚠️ 可能格式异常     │");
  console.log("  │ 错误处理         │ ✅ SDK 内置重试     │ ❌ 需自行处理       │");
  console.log("  │ 开发体验         │ ✅ TypeScript 推断  │ ❌ any 类型         │");
  console.log("  │ 灵活性           │ ⚠️ 需定义 Schema   │ ✅ 自由格式         │");
  console.log("  └──────────────────┴─────────────────────┴─────────────────────┘");
  console.log();
}

// ============================================================
// 3. Main
// ============================================================

async function main() {
  console.log("🏗️  structured-output.ts — 结构化输出实验\n");

  const provider = getDefaultProvider();
  console.log(`使用 Provider: ${provider}\n`);

  await experiment1_ArticleExtraction(provider);
  await experiment2_ProductGeneration(provider);
  await experiment3_SentimentClassification(provider);
  await experiment4_Comparison(provider);

  console.log("=".repeat(60));
  console.log("✅ 全部实验完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("structured-output.ts");

if (isMainModule) {
  main().catch(console.error);
}
