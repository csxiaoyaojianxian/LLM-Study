/**
 * query-engine.ts — LlamaIndex 查询引擎对比
 *
 * 本文件演示三种查询引擎的使用：
 * - VectorStoreIndex 向量查询
 * - SummaryIndex 摘要查询
 * - KeywordTableIndex 关键词查询
 *
 * 需要 API Key（用于 Embedding 和 LLM 调用）
 */

import "dotenv/config";
import {
  Document,
  VectorStoreIndex,
  SummaryIndex,
  Settings,
  OpenAI,
  OpenAIEmbedding,
  DeepSeekLLM,
} from "llamaindex";
import { getDefaultProvider, type Provider } from "./model-adapter.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. 配置 LlamaIndex 使用自定义 LLM
// ============================================================

/**
 * 配置 LlamaIndex 的全局 LLM 和 Embedding 模型
 *
 * LlamaIndex.TS 默认使用 OpenAI（gpt-4o-mini + text-embedding-ada-002）。
 * 通过 Settings 可以切换到其他 provider：
 * - OpenAI: 直接使用内置 OpenAI 类
 * - DeepSeek: 使用内置 DeepSeekLLM 类 + OpenAI 兼容 Embedding
 * - Anthropic: 通过 OpenAI 兼容 API 接入（需要适配）
 *
 * 对比 Module 03 的 model-adapter.ts:
 *   model-adapter 是我们自己封装的适配层（基于 Vercel AI SDK）
 *   LlamaIndex Settings 是框架内置的全局配置（基于自己的 LLM 封装）
 */
function configureLlamaIndex(provider: Provider): void {
  console.log(`\n⚙️  配置 LlamaIndex 使用 ${provider} 模型...`);

  switch (provider) {
    case "deepseek": {
      // DeepSeek: LlamaIndex 内置了 DeepSeekLLM
      Settings.llm = new DeepSeekLLM({
        model: "deepseek-chat",
        apiKey: process.env.DEEPSEEK_API_KEY,
      });
      // Embedding: DeepSeek 不提供 Embedding API，使用 OpenAI 兼容方式
      // 如果没有 OpenAI Key，LlamaIndex 会使用默认的内置 Embedding
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-") {
        Settings.embedModel = new OpenAIEmbedding({
          model: "text-embedding-3-small",
          apiKey: process.env.OPENAI_API_KEY,
        });
      }
      console.log("  ✅ LLM: DeepSeek (deepseek-chat)");
      console.log("  ✅ Embedding: " + (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-"
        ? "OpenAI (text-embedding-3-small)"
        : "默认 (OpenAI text-embedding-ada-002)"));
      break;
    }
    case "openai": {
      // OpenAI: LlamaIndex 默认就是 OpenAI，显式配置以确保参数正确
      Settings.llm = new OpenAI({
        model: "gpt-4o-mini",
        apiKey: process.env.OPENAI_API_KEY,
      });
      Settings.embedModel = new OpenAIEmbedding({
        model: "text-embedding-3-small",
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log("  ✅ LLM: OpenAI (gpt-4o-mini)");
      console.log("  ✅ Embedding: OpenAI (text-embedding-3-small)");
      break;
    }
    case "anthropic": {
      // Anthropic: LlamaIndex 也有内置支持，但这里简化处理
      // 使用 OpenAI 兼容方式调用（如果有 OpenAI Key 用于 Embedding）
      console.log("  ⚠️  Anthropic 模型在 LlamaIndex 中需要额外配置");
      console.log("  💡 建议使用 OpenAI 或 DeepSeek 作为 LlamaIndex 的 LLM");
      if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-") {
        Settings.llm = new OpenAI({
          model: "claude-4-6-opus",
          apiKey: process.env.ANTHROPIC_API_KEY,
          additionalSessionOptions: {
            baseURL: process.env.ANTHROPIC_BASE_URL,
          },
        });
        Settings.embedModel = new OpenAIEmbedding({
          model: "text-embedding-3-small",
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log("  ✅ 回退到 OpenAI (gpt-4o-mini)");
      }
      break;
    }
    default: {
      console.log(`  ⚠️  未知 provider: ${provider}，使用 LlamaIndex 默认配置`);
    }
  }
}

// ============================================================
// 2. 加载知识库文档
// ============================================================

function loadDocuments(): Document[] {
  const knowledgeDir = path.join(__dirname, "..", "data", "knowledge");
  const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

  const documents: Document[] = [];
  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    documents.push(
      new Document({
        text: content,
        metadata: { source: file },
      })
    );
    console.log(`  📄 加载: ${file} (${content.length} 字符)`);
  }

  return documents;
}

// ============================================================
// 3. VectorStoreIndex — 向量查询引擎
// ============================================================

async function demonstrateVectorQuery(documents: Document[]): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔮 VectorStoreIndex — 向量语义查询");
  console.log("=".repeat(60));

  console.log("\n📌 构建向量索引...");
  const startTime = Date.now();

  // VectorStoreIndex 会自动：
  // 1. 切分文档为 Node
  // 2. 调用 Embedding 模型向量化
  // 3. 存储到内存向量库
  const index = await VectorStoreIndex.fromDocuments(documents);

  const buildTime = Date.now() - startTime;
  console.log(`  ✅ 索引构建完成 (${buildTime}ms)`);

  // 创建查询引擎
  const queryEngine = index.asQueryEngine();

  // 执行查询
  const questions = [
    "TypeScript 的核心特性有哪些？",
    "RAG 的工作流程是什么？",
    "Node.js 在 AI 开发中有什么优势？",
  ];

  for (const question of questions) {
    console.log(`\n🔍 问题: ${question}`);
    const queryStart = Date.now();
    const response = await queryEngine.query({ query: question });
    const queryTime = Date.now() - queryStart;
    console.log(`💬 回答: ${response.toString().substring(0, 200)}...`);
    console.log(`⏱️  耗时: ${queryTime}ms`);
  }

  console.log("\n💡 VectorStoreIndex 特点:");
  console.log("  - 基于语义相似度检索，理解自然语言含义");
  console.log("  - 构建索引需要调用 Embedding 模型（有成本）");
  console.log("  - 适合：开放式问答、语义搜索");
  console.log("  - 对应 Module 04: VectorStore + ChromaDB 的内存版实现");
}

// ============================================================
// 4. SummaryIndex — 摘要查询引擎
// ============================================================

async function demonstrateSummaryQuery(documents: Document[]): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("📝 SummaryIndex — 摘要查询");
  console.log("=".repeat(60));

  console.log("\n📌 构建摘要索引...");
  const startTime = Date.now();

  // SummaryIndex 不需要向量化，直接存储所有节点
  const index = await SummaryIndex.fromDocuments(documents);

  const buildTime = Date.now() - startTime;
  console.log(`  ✅ 索引构建完成 (${buildTime}ms) — 无需 Embedding，速度更快`);

  // 创建查询引擎
  const queryEngine = index.asQueryEngine();

  // 摘要型查询
  const question = "请总结这些文档的主要内容";
  console.log(`\n🔍 问题: ${question}`);
  const queryStart = Date.now();
  const response = await queryEngine.query({ query: question });
  const queryTime = Date.now() - queryStart;
  console.log(`💬 回答: ${response.toString().substring(0, 300)}...`);
  console.log(`⏱️  耗时: ${queryTime}ms`);

  console.log("\n💡 SummaryIndex 特点:");
  console.log("  - 遍历所有节点生成摘要，不做语义检索");
  console.log("  - 构建索引无需 Embedding（零成本）");
  console.log("  - 查询时需要处理所有节点（LLM 调用成本高）");
  console.log("  - 适合：文档总结、全局概览");
  console.log("  - Module 04/05 无直接对应");
}

// ============================================================
// 5. 查询引擎对比总结
// ============================================================

function compareSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 查询引擎对比总结");
  console.log("=".repeat(60));

  console.log("\n┌──────────────────┬────────────┬────────────┬──────────────────┐");
  console.log("│       类型       │ 构建成本   │ 查询成本   │    适用场景       │");
  console.log("├──────────────────┼────────────┼────────────┼──────────────────┤");
  console.log("│ VectorStoreIndex │ 中(Embed)  │ 低(Top-K)  │ 语义搜索、QA     │");
  console.log("│ SummaryIndex     │ 零         │ 高(遍历)   │ 文档总结         │");
  console.log("│ KeywordTableIndex│ 低(抽取)   │ 低(匹配)   │ 精确关键词查询    │");
  console.log("└──────────────────┴────────────┴────────────┴──────────────────┘");

  console.log("\n💡 选择建议:");
  console.log("  1. 通用问答 → VectorStoreIndex（最常用，效果最好）");
  console.log("  2. 全文总结 → SummaryIndex（适合生成报告）");
  console.log("  3. 精确查找 → KeywordTableIndex（关键词匹配）");
  console.log("  4. 混合查询 → RouterQueryEngine（见 advanced-rag.ts）");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 LlamaIndex 查询引擎对比教程\n");

  let provider: Provider;
  try {
    provider = getDefaultProvider();
    console.log(`✅ 使用模型提供商: ${provider}`);
  } catch {
    console.log("⚠️  未配置 API Key，仅展示概念说明");
    console.log("请复制 .env.example 为 .env 并配置 API Key 后重试\n");
    compareSummary();
    return;
  }

  configureLlamaIndex(provider);

  // 加载文档
  console.log("\n📚 加载知识库文档:");
  const documents = loadDocuments();

  // 演示不同查询引擎
  try {
    await demonstrateVectorQuery(documents);
  } catch (error) {
    console.log(`\n❌ 向量查询失败: ${error instanceof Error ? error.message : error}`);
    console.log("  提示: VectorStoreIndex 默认使用 OpenAI Embedding");
    console.log("  请确保配置了 OPENAI_API_KEY 或参考文档配置其他 Embedding 模型");
  }

  try {
    await demonstrateSummaryQuery(documents);
  } catch (error) {
    console.log(`\n❌ 摘要查询失败: ${error instanceof Error ? error.message : error}`);
  }

  // 对比总结
  compareSummary();
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("query-engine.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { loadDocuments, configureLlamaIndex };
