/**
 * embeddings.ts — 本地 Embedding 封装
 *
 * 使用 @xenova/transformers 加载 all-MiniLM-L6-v2 模型（384维）在本地生成 Embedding。
 * 无需额外 API Key，首次运行自动下载模型（~90MB）。
 *
 * 同时实现 ChromaDB 的 IEmbeddingFunction 接口，可直接用于 ChromaDB collection。
 *
 * 运行: npm run embeddings
 * 
  注意到一个问题：语义相似度的结果不太符合预期 — "今天天气真好" 和 "什么是大语言模型" 的相似度（0.60）竟然比 "LLM 
  是基于 Transformer 的深度学习模型"（0.30）还高。这是因为 all-MiniLM-L6-v2 是英文为主的模型，中文语义理解能力有限。这恰好印证了
  README 中提到的：生产环境中文场景建议使用 BGE 或 M3E 等中文模型。
 */

import { pipeline, env } from "@xenova/transformers";

// 配置 HuggingFace 镜像源（解决国内访问超时问题）
// 如果能直接访问 huggingface.co 则无需此配置
env.remoteHost = "https://hf-mirror.com/";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeatureExtractionPipeline = any;

// ============================================================
// 1. LocalEmbedding 类 — 本地 Embedding 封装
// ============================================================

export class LocalEmbedding {
  private extractor: FeatureExtractionPipeline | null = null;
  private modelName: string;

  constructor(modelName = "Xenova/bge-small-zh-v1.5") {
    this.modelName = modelName;
  }

  /** 懒加载模型（首次调用时下载并缓存） */
  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractor) {
      console.log(`📦 加载 Embedding 模型: ${this.modelName}（首次运行需下载 ~90MB）...`);
      this.extractor = await pipeline("feature-extraction", this.modelName);
      console.log("✅ Embedding 模型加载完成！");
    }
    return this.extractor;
  }

  /**
   * 生成单条文本的 Embedding 向量
   * @param text - 输入文本
   * @returns 384 维向量
   */
  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  }

  /**
   * 批量生成 Embedding 向量
   * @param texts - 输入文本数组
   * @returns 向量数组
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  /**
   * 实现 ChromaDB IEmbeddingFunction 接口
   * ChromaDB 在 addDocuments / query 时会调用此方法
   */
  async generate(texts: string[]): Promise<number[][]> {
    return this.embedBatch(texts);
  }
}

// ============================================================
// 2. 工具函数 — 余弦相似度计算
// ============================================================

/**
 * 计算两个向量的余弦相似度
 * @returns 相似度值 [-1, 1]，越大越相似
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("向量维度不一致");

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ============================================================
// 3. Demo 入口
// ============================================================

async function main() {
  console.log("🔢 embeddings.ts — 本地 Embedding 封装 Demo\n");

  // --- 语义相似度对比：两个模型 PK ---
  const sentences = [
    "什么是大语言模型？",                  // 查询
    "LLM 是基于 Transformer 的深度学习模型", // 语义相近
    "RAG 是检索增强生成技术",               // 相关但不同主题
    "今天天气真好，适合出去散步",            // 完全无关
  ];

  const models = [
    { name: "all-MiniLM-L6-v2（英文模型）", id: "Xenova/all-MiniLM-L6-v2" },
    { name: "bge-small-zh-v1.5（中文模型）", id: "Xenova/bge-small-zh-v1.5" },
  ];

  for (const model of models) {
    console.log("=".repeat(60));
    console.log(`📝 模型: ${model.name}\n`);

    const embedder = new LocalEmbedding(model.id);

    // 生成单条 Embedding
    const text = "大语言模型是一种基于深度学习的自然语言处理模型";
    const vector = await embedder.embed(text);
    console.log(`文本: "${text}"`);
    console.log(`维度: ${vector.length}`);
    console.log(`前5维: [${vector.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}]\n`);

    // 语义相似度对比
    const embeddings = await embedder.embedBatch(sentences);

    console.log(`基准查询: "${sentences[0]}"\n`);
    console.log("-".repeat(60));
    console.log(`${"文本".padEnd(40)}  余弦相似度`);
    console.log("-".repeat(60));

    for (let i = 1; i < sentences.length; i++) {
      const sim = cosineSimilarity(embeddings[0], embeddings[i]);
      const bar = "█".repeat(Math.round(Math.max(0, sim) * 20));
      console.log(`${sentences[i].padEnd(40)}  ${sim.toFixed(4)}  ${bar}`);
    }
    console.log();
  }

  // --- 结论 ---
  console.log("=".repeat(60));
  console.log("📊 对比结论：");
  console.log("  - 英文模型对中文语义区分度差，无关文本也可能得到较高相似度");
  console.log("  - 中文模型能正确识别语义相近 vs 无关内容，排序更合理");
  console.log("  - 生产环境中文场景建议使用 bge-small-zh / bge-base-zh 等中文模型");

  // --- 批量 Embedding 性能（使用默认中文模型） ---
  console.log("\n📝 批量 Embedding 性能（bge-small-zh-v1.5）\n");
  const embedder = new LocalEmbedding();
  const batchTexts = [
    "Prompt Engineering 是通过设计输入提示来引导模型生成输出的技术",
    "向量数据库用于存储和检索高维向量",
    "ChromaDB 是一个轻量级的向量数据库",
    "文本分块是 RAG 中的关键步骤",
    "余弦相似度衡量两个向量方向的一致性",
  ];

  const start = Date.now();
  const batchResults = await embedder.embedBatch(batchTexts);
  const elapsed = Date.now() - start;

  console.log(`批量处理 ${batchTexts.length} 条文本`);
  console.log(`耗时: ${elapsed}ms（平均 ${Math.round(elapsed / batchTexts.length)}ms/条）`);
  console.log(`每条向量维度: ${batchResults[0].length}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Embedding Demo 完成！");
}

// 仅当直接运行时执行 demo
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("embeddings.ts");

if (isMainModule) {
  main().catch(console.error);
}
