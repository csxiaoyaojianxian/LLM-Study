/**
 * vector-store.ts — ChromaDB 向量存储封装
 *
 * 封装 ChromaDB 的基本操作：创建 collection、添加文档、相似度检索、清空。
 * 使用 LocalEmbedding（@xenova/transformers）作为 embedding function。
 *
 * 前置条件：需要先启动 ChromaDB 服务端（默认 http://localhost:8000）
 *   docker run -d -p 8000:8000 chromadb/chroma
 *
 * 运行: 此模块被 rag-pipeline.ts 和 conversational-rag.ts 引用
 */

import { ChromaClient, type Collection, type IEmbeddingFunction } from "chromadb";
import { LocalEmbedding } from "./embeddings.js";
import { recursiveCharacterChunk } from "./chunking.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. ChromaDB Embedding Function 适配器
// ============================================================

/**
 * 将 LocalEmbedding 适配为 ChromaDB 的 IEmbeddingFunction 接口
 */
class TransformersEmbeddingFunction implements IEmbeddingFunction {
  private embedder: LocalEmbedding;

  constructor(embedder: LocalEmbedding) {
    this.embedder = embedder;
  }

  async generate(texts: string[]): Promise<number[][]> {
    return this.embedder.generate(texts);
  }
}

// ============================================================
// 2. VectorStore 类 — ChromaDB 封装
// ============================================================

export interface SearchResult {
  document: string;
  distance: number;
  metadata?: Record<string, unknown>;
  id: string;
}

export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private embedder: LocalEmbedding;
  private embeddingFunction: TransformersEmbeddingFunction;

  constructor(embedder?: LocalEmbedding) {
    this.client = new ChromaClient();
    this.embedder = embedder ?? new LocalEmbedding();
    this.embeddingFunction = new TransformersEmbeddingFunction(this.embedder);
  }

  /**
   * 初始化 collection（如果已存在则先删除重建）
   * @param collectionName - collection 名称
   */
  async init(collectionName: string): Promise<void> {
    // 删除已存在的同名 collection
    try {
      await this.client.deleteCollection({ name: collectionName });
    } catch {
      // collection 不存在，忽略
    }

    this.collection = await this.client.createCollection({
      name: collectionName,
      embeddingFunction: this.embeddingFunction,
      metadata: { "hnsw:space": "cosine" }, // 使用余弦距离（适合归一化的 Embedding 向量）
    });

    console.log(`📦 Collection "${collectionName}" 已创建`);
  }

  /**
   * 批量添加文档到 collection
   * @param docs - 文档数组（文本内容）
   * @param metadatas - 可选的元数据数组
   */
  async addDocuments(
    docs: string[],
    metadatas?: Record<string, unknown>[]
  ): Promise<void> {
    if (!this.collection) throw new Error("请先调用 init() 初始化 collection");

    const ids = docs.map((_, i) => `doc_${i}`);

    await this.collection.add({
      ids,
      documents: docs,
      metadatas: metadatas as Record<string, string | number | boolean>[] | undefined,
    });

    console.log(`✅ 已添加 ${docs.length} 条文档`);
  }

  /**
   * 相似度检索
   * @param query - 查询文本
   * @param topK - 返回结果数
   * @returns 最相似的文档列表
   */
  async search(query: string, topK = 3): Promise<SearchResult[]> {
    if (!this.collection) throw new Error("请先调用 init() 初始化 collection");

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: topK,
    });

    const searchResults: SearchResult[] = [];

    if (results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        searchResults.push({
          document: results.documents[0][i] ?? "",
          distance: results.distances?.[0]?.[i] ?? 0,
          metadata: results.metadatas?.[0]?.[i] as Record<string, unknown> | undefined,
          id: results.ids[0][i],
        });
      }
    }

    return searchResults;
  }

  /**
   * 清空 collection 中的所有文档
   */
  async clear(): Promise<void> {
    if (!this.collection) return;
    const name = this.collection.name;
    try {
      await this.client.deleteCollection({ name });
    } catch {
      // 忽略
    }
    this.collection = await this.client.createCollection({
      name,
      embeddingFunction: this.embeddingFunction,
      metadata: { "hnsw:space": "cosine" },
    });
    console.log(`🗑️  Collection "${name}" 已清空`);
  }

  /** 获取 embedding 实例（供外部使用） */
  getEmbedder(): LocalEmbedding {
    return this.embedder;
  }
}

// ============================================================
// 3. Demo 入口 — 文档加载 → 分块 → 存储 → 检索
// ============================================================

async function main() {
  console.log("🗄️  vector-store.ts — ChromaDB 向量存储 Demo\n");

  // 初始化
  const store = new VectorStore();
  await store.init("knowledge-demo");

  // 加载知识库文档
  const knowledgePath = resolve(__dirname, "../data/knowledge.md");
  const text = readFileSync(knowledgePath, "utf-8");
  console.log(`📄 加载文档: knowledge.md（${text.length} 字符）\n`);

  // 分块
  const chunks = recursiveCharacterChunk(text, { chunkSize: 300, overlap: 50 });
  console.log(`✂️  分块完成: ${chunks.length} 个文本块\n`);

  // 添加到向量数据库
  const metadatas = chunks.map((_, i) => ({ source: "knowledge.md", chunkIndex: i }));
  await store.addDocuments(chunks, metadatas);

  // 检索测试
  console.log("\n" + "=".repeat(60));
  console.log("🔍 检索测试\n");

  const queries = [
    "什么是 RAG？",
    "文本分块有哪些策略？",
    "Embedding 模型有哪些选择？",
  ];

  for (const query of queries) {
    console.log(`\n❓ 查询: "${query}"`);
    console.log("-".repeat(50));

    const results = await store.search(query, 2);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const preview = r.document.replace(/\n/g, " ").slice(0, 80);
      console.log(`  [${i + 1}] 距离: ${r.distance.toFixed(4)} | ${preview}...`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ 向量存储 Demo 完成！");
}

// 仅当直接运行时执行 demo
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("vector-store.ts");

if (isMainModule) {
  main().catch(console.error);
}
