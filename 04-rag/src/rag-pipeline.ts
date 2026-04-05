/**
 * rag-pipeline.ts — 完整 RAG Pipeline
 *
 * 组合 chunking + vector-store + LLM，实现完整的 RAG 流程：
 * 1. 文档摄入（Ingest）：加载 → 分块 → 向量化 → 存储
 * 2. RAG 查询（Query）：检索 → 上下文构建 → LLM 生成
 * 3. 对比实验：纯 LLM 回答 vs RAG 增强回答
 *
 * 前置条件：需要先启动 ChromaDB 服务端
 *   方式1: docker run -d -p 8000:8000 chromadb/chroma
 *   方式2: pip install chromadb && chroma run --path ./chroma-data
 *
 * 运行: npm run rag-pipeline
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { VectorStore, type SearchResult } from "./vector-store.js";
import { recursiveCharacterChunk } from "./chunking.js";
import { chatWithModel, getDefaultProvider, type Provider } from "./model-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. RAGPipeline 类
// ============================================================

export interface RAGQueryResult {
  answer: string;
  contexts: SearchResult[];
  query: string;
}

export class RAGPipeline {
  // 向量存储 + LLM 提供者
  private store: VectorStore;
  // LLM 提供者
  private provider: Provider;
  // 向量存储集合名称
  private collectionName: string;

  constructor(options?: { provider?: Provider; collectionName?: string }) {
    this.store = new VectorStore();
    this.provider = options?.provider ?? getDefaultProvider();
    this.collectionName = options?.collectionName ?? "rag-knowledge";
  }

  /**
   * 文档摄入：加载文件 → 分块 → 向量化 → 存入 ChromaDB
   * @param filePath - 文档路径
   * @param chunkSize - 分块大小（默认 300）
   * @param overlap - 重叠大小（默认 50）
   */
  async ingest(filePath: string, chunkSize = 300, overlap = 50): Promise<number> {
    console.log(`\n📥 文档摄入: ${filePath}`);

    // 1. 加载文档
    const text = readFileSync(filePath, "utf-8");
    console.log(`  📄 文档大小: ${text.length} 字符`);

    // 2. 分块
    const chunks = recursiveCharacterChunk(text, { chunkSize, overlap });
    console.log(`  ✂️  分块数量: ${chunks.length} 块（chunkSize=${chunkSize}, overlap=${overlap}）`);

    // 3. 初始化向量存储
    await this.store.init(this.collectionName);

    // 4. 添加文档（向量化在 ChromaDB 内部通过 embeddingFunction 完成）
    const metadatas = chunks.map((_, i) => ({
      source: filePath,
      chunkIndex: i,
    }));
    await this.store.addDocuments(chunks, metadatas);

    console.log(`  ✅ 摄入完成！\n`);
    return chunks.length;
  }

  /**
   * RAG 查询：检索相关文档 → 构建上下文 → LLM 生成回答
   * @param question - 用户问题
   * @param topK - 检索结果数（默认 3）
   */
  async query(question: string, topK = 3): Promise<RAGQueryResult> {
    // 1. 检索相关文档
    const contexts = await this.store.search(question, topK);

    // 2. 构建增强 Prompt
    const contextText = contexts
      .map((c, i) => `[参考资料 ${i + 1}]（相关度: ${(1 - c.distance).toFixed(2)}）\n${c.document}`)
      .join("\n\n");

    const systemPrompt = `你是一个基于知识库的问答助手。请根据以下参考资料回答用户的问题。

要求：
- 优先使用参考资料中的信息来回答
- 如果参考资料中没有相关信息，请明确说明"根据现有资料未找到相关信息"
- 回答要准确、简洁、有条理
- 可以适当补充通用知识，但需标注哪些是来自参考资料的信息

参考资料：
${contextText}`;

    // 3. 调用 LLM 生成回答
    const answer = await chatWithModel(
      this.provider,
      [{ role: "user", content: question }],
      {
        system: systemPrompt,
        maxOutputTokens: 500,
        temperature: 0.3,
      }
    );

    return { answer, contexts, query: question };
  }

  /**
   * 纯 LLM 查询（不使用 RAG，用于对比）
   */
  async queryWithoutRAG(question: string): Promise<string> {
    return chatWithModel(
      this.provider,
      [{ role: "user", content: question }],
      {
        system: "请简洁准确地回答用户的问题。",
        maxOutputTokens: 500,
        temperature: 0.3,
      }
    );
  }

  /** 获取当前 provider */
  getProvider(): Provider {
    return this.provider;
  }

  /** 获取底层 VectorStore */
  getStore(): VectorStore {
    return this.store;
  }
}

// ============================================================
// 2. Demo 入口
// ============================================================

async function main() {
  console.log("🔗 rag-pipeline.ts — 完整 RAG Pipeline Demo\n");
  console.log("=".repeat(60));

  // 初始化 RAG Pipeline
  const rag = new RAGPipeline();
  console.log(`🤖 使用模型 Provider: ${rag.getProvider()}`);

  // Step 1: 文档摄入
  console.log("\n📌 Step 1: 文档摄入");
  const knowledgePath = resolve(__dirname, "../data/knowledge.md");
  await rag.ingest(knowledgePath);

  // Step 2: RAG 查询 vs 纯 LLM 查询
  console.log("📌 Step 2: RAG 增强 vs 纯 LLM 对比\n");

  const questions = [
    "RAG 的完整工作流程是什么？分为哪些阶段？",
    "常用的 Embedding 模型有哪些？各有什么特点？",
    "文本分块时推荐的块大小和重叠大小是多少？",
  ];

  for (const question of questions) {
    console.log("=".repeat(60));
    console.log(`\n❓ 问题: ${question}\n`);

    // 纯 LLM 回答
    console.log("--- 🤖 纯 LLM 回答（无 RAG）---");
    try {
      const plainAnswer = await rag.queryWithoutRAG(question);
      console.log(plainAnswer.trim());
    } catch (error) {
      console.log(`⚠️ 调用失败: ${(error as Error).message}`);
    }

    console.log();

    // RAG 增强回答
    console.log("--- 📚 RAG 增强回答 ---");
    try {
      const result = await rag.query(question);

      // 显示检索到的上下文
      console.log("🔍 检索到的参考资料:");
      for (let i = 0; i < result.contexts.length; i++) {
        const ctx = result.contexts[i];
        const preview = ctx.document.replace(/\n/g, " ").slice(0, 60);
        console.log(`  [${i + 1}] (相关度: ${(1 - ctx.distance).toFixed(2)}) ${preview}...`);
      }
      console.log();

      console.log("💬 RAG 回答:");
      console.log(result.answer.trim());
    } catch (error) {
      console.log(`⚠️ 调用失败: ${(error as Error).message}`);
    }

    console.log();
  }

  console.log("=".repeat(60));
  console.log("✅ RAG Pipeline Demo 完成！");
  console.log("\n💡 对比观察：RAG 回答通常更准确、更具体，且减少了幻觉（编造信息）的现象。");
}

// 仅当直接运行时执行 demo
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("rag-pipeline.ts");

if (isMainModule) {
  main().catch(console.error);
}
