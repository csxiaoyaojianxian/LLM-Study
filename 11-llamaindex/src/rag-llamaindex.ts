/**
 * rag-llamaindex.ts — 用 LlamaIndex 重建 RAG（对比 Module 04/05）
 *
 * 本文件用 LlamaIndex 实现完整的 RAG 流水线，并与之前的实现进行对比：
 * - Module 04: 手动实现 chunking + embedding + ChromaDB + LLM
 * - Module 05: LangChain.js 的 RetrievalQAChain
 * - Module 11: LlamaIndex 的 VectorStoreIndex + QueryEngine
 *
 * 需要 API Key
 */

import "dotenv/config";
import {
  Document,
  VectorStoreIndex,
  SentenceSplitter,
  Settings,
  ContextChatEngine,
} from "llamaindex";
import { getDefaultProvider, chatWithModel } from "./model-adapter.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. LlamaIndex RAG 实现
// ============================================================

/**
 * 用 LlamaIndex 实现 RAG 流水线
 * 对比 Module 04 的 RAGPipeline 类
 */
class LlamaIndexRAG {
  private index: VectorStoreIndex | null = null;
  private documents: Document[] = [];

  /**
   * 加载文档
   * Module 04 对应: RAGPipeline.ingest()
   */
  async loadDocuments(dirPath: string): Promise<number> {
    console.log(`\n📂 加载文档目录: ${dirPath}`);

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      this.documents.push(
        new Document({
          text: content,
          metadata: {
            source: file,
            fileSize: content.length,
          },
        })
      );
      console.log(`  ✅ ${file} (${content.length} 字符)`);
    }

    return this.documents.length;
  }

  /**
   * 构建索引
   * Module 04 对应: chunking → embedding → vectorStore.addDocuments()
   * LlamaIndex 一步到位！
   */
  async buildIndex(): Promise<void> {
    console.log("\n🏗️  构建向量索引...");
    const startTime = Date.now();

    // LlamaIndex 自动完成: 切分 → 向量化 → 存储
    // 相比 Module 04 需要分别调用 chunk(), embed(), store()
    this.index = await VectorStoreIndex.fromDocuments(this.documents);

    const buildTime = Date.now() - startTime;
    console.log(`  ✅ 索引构建完成 (${buildTime}ms)`);
  }

  /**
   * RAG 查询
   * Module 04 对应: RAGPipeline.query()
   */
  async query(question: string): Promise<string> {
    if (!this.index) throw new Error("请先调用 buildIndex() 构建索引");

    const queryEngine = this.index.asQueryEngine({
      similarityTopK: 3,
    });

    const response = await queryEngine.query({ query: question });
    return response.toString();
  }

  /**
   * 创建对话引擎（支持多轮对话）
   * Module 04 对应: conversational-rag.ts 的问题改写方案
   * LlamaIndex 的 ContextChatEngine 内置了对话上下文管理
   */
  createChatEngine(): ContextChatEngine | null {
    if (!this.index) return null;

    const retriever = this.index.asRetriever({ similarityTopK: 3 });
    return new ContextChatEngine({ retriever });
  }
}

// ============================================================
// 2. 不使用 RAG 的对照组
// ============================================================

async function queryWithoutRAG(question: string): Promise<string> {
  const provider = getDefaultProvider();
  return chatWithModel(provider, [{ role: "user", content: question }], {
    system: "你是一个知识丰富的助手。请回答用户的问题。",
  });
}

// ============================================================
// 3. 代码量和实现对比
// ============================================================

function showCodeComparison(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 三种 RAG 实现方式代码量对比");
  console.log("=".repeat(60));

  console.log("\n┌────────────────────┬────────┬────────────────────────────────┐");
  console.log("│       实现方式     │ 代码量 │         关键步骤               │");
  console.log("├────────────────────┼────────┼────────────────────────────────┤");
  console.log("│ Module 04 手动实现  │ ~200行 │ chunk→embed→store→retrieve→LLM│");
  console.log("│ Module 05 LangChain │ ~100行 │ splitter→vectorStore→chain     │");
  console.log("│ Module 11 LlamaIndex│ ~50行  │ Document→Index→QueryEngine     │");
  console.log("└────────────────────┴────────┴────────────────────────────────┘");

  console.log("\n📌 灵活性对比:");
  console.log("  手动实现: ⭐⭐⭐⭐⭐ — 完全可控，但开发成本高");
  console.log("  LangChain: ⭐⭐⭐⭐ — LCEL 组合灵活，生态丰富");
  console.log("  LlamaIndex: ⭐⭐⭐ — 开箱即用，但定制较复杂");

  console.log("\n📌 适用场景:");
  console.log("  手动实现: 需要深度定制、特殊优化、学习底层原理");
  console.log("  LangChain: 通用 LLM 应用（Agent、Chain、Memory 等）");
  console.log("  LlamaIndex: 以数据索引和检索为核心的应用");
}

// ============================================================
// 4. RAG vs 无 RAG 效果对比
// ============================================================

async function compareRAGvsNoRAG(rag: LlamaIndexRAG): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔬 RAG vs 无 RAG 效果对比");
  console.log("=".repeat(60));

  const questions = [
    "TypeScript 在 LLM 开发中有什么优势？",
    "LlamaIndex 和 LangChain 的区别是什么？",
  ];

  for (const question of questions) {
    console.log(`\n❓ 问题: ${question}`);
    console.log("-".repeat(40));

    // 使用 RAG
    try {
      console.log("\n📗 LlamaIndex RAG 回答:");
      const ragStart = Date.now();
      const ragAnswer = await rag.query(question);
      const ragTime = Date.now() - ragStart;
      console.log(`  ${ragAnswer.substring(0, 250)}...`);
      console.log(`  ⏱️  耗时: ${ragTime}ms`);
    } catch (error) {
      console.log(`  ❌ RAG 查询失败: ${error instanceof Error ? error.message : error}`);
    }

    // 不使用 RAG
    try {
      console.log("\n📕 无 RAG（纯 LLM）回答:");
      const plainStart = Date.now();
      const plainAnswer = await queryWithoutRAG(question);
      const plainTime = Date.now() - plainStart;
      console.log(`  ${plainAnswer.substring(0, 250)}...`);
      console.log(`  ⏱️  耗时: ${plainTime}ms`);
    } catch (error) {
      console.log(`  ❌ 纯 LLM 查询失败: ${error instanceof Error ? error.message : error}`);
    }
  }
}

// ============================================================
// 5. 多轮对话 RAG
// ============================================================

async function demonstrateChatRAG(rag: LlamaIndexRAG): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("💬 多轮对话 RAG（ContextChatEngine）");
  console.log("=".repeat(60));

  const chatEngine = rag.createChatEngine();
  if (!chatEngine) {
    console.log("  ❌ 索引未构建，跳过多轮对话演示");
    return;
  }

  const conversations = [
    "TypeScript 有哪些核心特性？",
    "它的泛型有什么用？",             // 代词"它"指代 TypeScript
    "这些特性在 AI 开发中怎么用？",    // "这些特性"需要上下文理解
  ];

  console.log("\n📌 对比 Module 04 conversational-rag.ts:");
  console.log("  Module 04: 手动实现问题改写（将代词替换为实际指代）");
  console.log("  LlamaIndex: ContextChatEngine 自动管理对话上下文\n");

  for (const message of conversations) {
    console.log(`\n👤 用户: ${message}`);
    try {
      const response = await chatEngine.chat({ message });
      console.log(`🤖 助手: ${response.toString().substring(0, 200)}...`);
    } catch (error) {
      console.log(`  ❌ 对话失败: ${error instanceof Error ? error.message : error}`);
    }
  }
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 LlamaIndex RAG 实战 — 对比 Module 04/05\n");

  // 检查 API Key
  try {
    const provider = getDefaultProvider();
    console.log(`✅ 使用模型提供商: ${provider}`);
  } catch {
    console.log("⚠️  未配置 API Key");
    console.log("请复制 .env.example 为 .env 并配置 API Key 后重试\n");
    showCodeComparison();
    return;
  }

  // 构建 RAG
  const rag = new LlamaIndexRAG();
  const knowledgeDir = path.join(__dirname, "..", "data", "knowledge");
  await rag.loadDocuments(knowledgeDir);

  try {
    await rag.buildIndex();
  } catch (error) {
    console.log(`\n❌ 索引构建失败: ${error instanceof Error ? error.message : error}`);
    console.log("  提示: LlamaIndex 默认使用 OpenAI Embedding");
    console.log("  请确保 OPENAI_API_KEY 已配置\n");
    showCodeComparison();
    return;
  }

  // RAG vs 无 RAG 对比
  await compareRAGvsNoRAG(rag);

  // 多轮对话
  await demonstrateChatRAG(rag);

  // 代码量对比
  showCodeComparison();

  console.log("\n" + "=".repeat(60));
  console.log("🎓 教程完成！");
  console.log("=".repeat(60));
  console.log("📚 下一步: npm run advanced-rag → 高级 RAG 技术");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("rag-llamaindex.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { LlamaIndexRAG };
