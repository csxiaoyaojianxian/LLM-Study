/**
 * rag-optimize.ts — RAG 效果优化对比实验
 *
 * 通过可运行的对比实验，直观展示不同优化手段对 RAG 效果的影响：
 * 1. 分块大小对比：chunkSize=100 vs 300 vs 500
 * 2. 距离函数对比：cosine vs L2
 * 3. Prompt 优化对比：弱指令 vs 强指令
 *
 * 前置条件：需要先启动 ChromaDB 服务端
 *   方式1: docker run -d -p 8000:8000 chromadb/chroma
 *   方式2: pip install chromadb && chroma run --path ./chroma-data
 *
 * 运行: npm run rag-optimize
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ChromaClient } from "chromadb";
import { LocalEmbedding } from "./embeddings.js";
import { recursiveCharacterChunk } from "./chunking.js";
import { chatWithModel, getDefaultProvider, type Provider } from "./model-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 工具：ChromaDB Embedding 适配器（复用 embeddings.ts 的 LocalEmbedding）
// ============================================================

class EmbeddingAdapter {
  private embedder: LocalEmbedding;
  constructor(embedder: LocalEmbedding) {
    this.embedder = embedder;
  }
  async generate(texts: string[]): Promise<number[][]> {
    return this.embedder.embedBatch(texts);
  }
}

// ============================================================
// 实验 1: 分块大小对检索效果的影响
// ============================================================

async function experiment1_chunkSize(
  text: string,
  embedder: LocalEmbedding,
  client: ChromaClient
) {
  console.log("=".repeat(70));
  console.log("📊 实验1: 分块大小对检索效果的影响");
  console.log("=".repeat(70));
  console.log("同一个问题，不同 chunkSize 检索出的内容差异\n");

  const query = "RAG 的完整工作流程是什么？";
  const embeddingFn = new EmbeddingAdapter(embedder);

  const configs = [
    { chunkSize: 100, overlap: 20, label: "小块 (100/20)" },
    { chunkSize: 300, overlap: 50, label: "中块 (300/50)" },
    { chunkSize: 600, overlap: 80, label: "大块 (600/80)" },
  ];

  for (const config of configs) {
    const collectionName = `exp1-chunk-${config.chunkSize}`;

    // 清理 + 创建
    try { await client.deleteCollection({ name: collectionName }); } catch {}
    const collection = await client.createCollection({
      name: collectionName,
      embeddingFunction: embeddingFn,
      metadata: { "hnsw:space": "cosine" },
    });

    // 分块 + 存储
    const chunks = recursiveCharacterChunk(text, {
      chunkSize: config.chunkSize,
      overlap: config.overlap,
    });
    await collection.add({
      ids: chunks.map((_, i) => `doc_${i}`),
      documents: chunks,
    });

    // 检索
    const results = await collection.query({ queryTexts: [query], nResults: 2 });

    console.log(`📦 ${config.label} — 共 ${chunks.length} 块`);
    if (results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        const doc = results.documents[0][i] ?? "";
        const dist = results.distances?.[0]?.[i] ?? 0;
        const similarity = (1 - dist).toFixed(3);
        const preview = doc.replace(/\n/g, " ").slice(0, 70);
        const hasAnswer = doc.includes("离线阶段") || doc.includes("在线阶段") || doc.includes("Indexing");
        console.log(`  [${i + 1}] 相关度: ${similarity} ${hasAnswer ? "✅ 含答案" : "❌ 不含答案"}`);
        console.log(`      ${preview}...`);
      }
    }
    console.log();

    // 清理
    try { await client.deleteCollection({ name: collectionName }); } catch {}
  }

  console.log("💡 结论: 块太小 → 答案被切断在多个块中；块太大 → 噪声多但上下文完整");
  console.log("   推荐: 中文通用场景 chunkSize=300-500，overlap=50-80\n");
}

// ============================================================
// 实验 2: 距离函数对比（cosine vs L2）
// ============================================================

async function experiment2_distanceFunction(
  text: string,
  embedder: LocalEmbedding,
  client: ChromaClient
) {
  console.log("=".repeat(70));
  console.log("📊 实验2: 距离函数对比 (cosine vs L2)");
  console.log("=".repeat(70));
  console.log("同一批文档、同一个查询，不同距离函数的检索排序差异\n");

  const query = "什么是文本分块？";
  const embeddingFn = new EmbeddingAdapter(embedder);

  const chunks = recursiveCharacterChunk(text, { chunkSize: 300, overlap: 50 });

  const spaces = [
    { space: "cosine", label: "余弦距离 (cosine)" },
    { space: "l2", label: "欧氏距离 (L2)" },
  ];

  for (const { space, label } of spaces) {
    const collectionName = `exp2-${space}`;

    try { await client.deleteCollection({ name: collectionName }); } catch {}
    const collection = await client.createCollection({
      name: collectionName,
      embeddingFunction: embeddingFn,
      metadata: { "hnsw:space": space },
    });

    await collection.add({
      ids: chunks.map((_, i) => `doc_${i}`),
      documents: chunks,
    });

    const results = await collection.query({ queryTexts: [query], nResults: 3 });

    console.log(`📐 ${label}`);
    if (results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        const doc = results.documents[0][i] ?? "";
        const dist = results.distances?.[0]?.[i] ?? 0;
        const preview = doc.replace(/\n/g, " ").slice(0, 60);
        console.log(`  [${i + 1}] 距离: ${dist.toFixed(4).padStart(8)} | ${preview}...`);
      }
    }
    console.log();

    try { await client.deleteCollection({ name: collectionName }); } catch {}
  }

  console.log("💡 结论: cosine 距离值域 [0,2]，更直观（越小越相似）；L2 距离受向量模长影响");
  console.log("   推荐: 归一化的 Embedding 向量使用 cosine（本模块默认）\n");
}

// ============================================================
// 实验 3: Prompt 优化对比（弱指令 vs 强指令）
// ============================================================

async function experiment3_promptOptimization(
  text: string,
  embedder: LocalEmbedding,
  client: ChromaClient,
  provider: Provider
) {
  console.log("=".repeat(70));
  console.log("📊 实验3: Prompt 优化对比 (弱指令 vs 强指令)");
  console.log("=".repeat(70));
  console.log("同样的检索结果，不同 Prompt 指令下 LLM 的回答差异\n");

  // 先检索获取上下文
  const embeddingFn = new EmbeddingAdapter(embedder);
  const chunks = recursiveCharacterChunk(text, { chunkSize: 300, overlap: 50 });

  const collectionName = "exp3-prompt";
  try { await client.deleteCollection({ name: collectionName }); } catch {}
  const collection = await client.createCollection({
    name: collectionName,
    embeddingFunction: embeddingFn,
    metadata: { "hnsw:space": "cosine" },
  });
  await collection.add({
    ids: chunks.map((_, i) => `doc_${i}`),
    documents: chunks,
  });

  // 故意用一个知识库中不完全覆盖的问题，看 LLM 是否会编造
  const query = "RAG 系统中如何实现实时数据更新？";
  const results = await collection.query({ queryTexts: [query], nResults: 3 });

  const contextText = (results.documents[0] ?? [])
    .map((doc, i) => `[参考资料 ${i + 1}]\n${doc}`)
    .join("\n\n");

  console.log(`❓ 问题: ${query}`);
  console.log(`🔍 检索到 ${results.documents[0]?.length ?? 0} 条参考资料\n`);

  // 弱指令
  const weakPrompt = `请根据参考资料回答问题。\n\n参考资料：\n${contextText}`;

  // 强指令
  const strongPrompt = `你是一个严谨的知识库问答助手。请严格遵守以下规则：

1. 仅根据以下参考资料回答问题，不要使用任何外部知识
2. 如果参考资料中没有相关信息，必须明确回复："根据现有资料未找到相关信息"
3. 回答时用 [1][2][3] 标注信息来源的参考资料编号
4. 如果只能部分回答，明确说明哪些是来自资料的，哪些是资料中未提及的

参考资料：
${contextText}`;

  const prompts = [
    { system: weakPrompt, label: "弱指令（简单提示）" },
    { system: strongPrompt, label: "强指令（严格约束）" },
  ];

  for (const { system, label } of prompts) {
    console.log(`--- ${label} ---`);
    try {
      const answer = await chatWithModel(
        provider,
        [{ role: "user", content: query }],
        { system, maxOutputTokens: 300, temperature: 0.3 }
      );
      console.log(answer.trim());
    } catch (error) {
      console.log(`⚠️ 调用失败: ${(error as Error).message}`);
    }
    console.log();
  }

  console.log("💡 结论: 弱指令下 LLM 容易编造资料中没有的内容；强指令能有效约束 LLM 只用参考资料");
  console.log("   推荐: 生产环境务必使用强指令，明确要求'不知道就说不知道'\n");

  try { await client.deleteCollection({ name: collectionName }); } catch {}
}

// ============================================================
// Demo 入口
// ============================================================

async function main() {
  console.log("🔬 rag-optimize.ts — RAG 效果优化对比实验\n");

  const provider = getDefaultProvider();
  console.log(`🤖 使用模型 Provider: ${provider}`);

  // 加载知识库
  const knowledgePath = resolve(__dirname, "../data/knowledge.md");
  const text = readFileSync(knowledgePath, "utf-8");
  console.log(`📄 加载文档: knowledge.md（${text.length} 字符）\n`);

  // 初始化
  const embedder = new LocalEmbedding();
  const client = new ChromaClient();

  // 预热 Embedding 模型
  await embedder.embed("预热");

  // 运行三组实验
  await experiment1_chunkSize(text, embedder, client);
  await experiment2_distanceFunction(text, embedder, client);
  await experiment3_promptOptimization(text, embedder, client, provider);

  console.log("=".repeat(70));
  console.log("✅ 所有优化对比实验完成！");
  console.log("\n📋 优化优先级总结：");
  console.log("  1. 分块策略调参 — 改几个数字，效果立竿见影");
  console.log("  2. 换中文 Embedding — 改一行代码，中文检索质量飞跃");
  console.log("  3. 距离函数选 cosine — 改一行配置，排序更合理");
  console.log("  4. Prompt 强指令约束 — 改文本，减少幻觉");
  console.log("  5. MMR/混合检索/Reranker — 需引入额外库，进阶优化");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("rag-optimize.ts");

if (isMainModule) {
  main().catch(console.error);
}
