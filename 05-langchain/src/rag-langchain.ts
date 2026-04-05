/**
 * rag-langchain.ts — 用 LangChain 重构 RAG Pipeline
 *
 * 用 LangChain 的原生组件重新实现 04-rag 中手写的 RAG 流程，
 * 体验框架级开发效率。
 *
 * 核心知识点：
 * - 自定义 Embeddings 类（封装 @xenova/transformers 为 LangChain 接口）
 * - RecursiveCharacterTextSplitter（中文分隔符）
 * - Chroma vectorstore + asRetriever()
 * - LCEL RAG Chain: retriever → prompt → model → parser
 *
 * 依赖: ChromaDB 服务端运行中（docker run -d -p 8000:8000 chromadb/chroma）
 *
 * 运行: npm run rag-langchain
 */

import "dotenv/config";
import { pipeline, env } from "@xenova/transformers";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { createChatModel } from "./model-chat.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// 配置 HuggingFace 镜像源（解决国内访问超时问题）
env.remoteHost = "https://hf-mirror.com/";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// 1. 自定义 LocalEmbeddings — 封装 @xenova/transformers 为 LangChain 接口
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeatureExtractionPipeline = any;

/**
 * 本地 Embedding 封装，实现 LangChain 的 Embeddings 抽象类。
 * 底层使用 @xenova/transformers 的 bge-small-zh-v1.5 模型（512维，中文优化）。
 */
export class LocalEmbeddings extends Embeddings {
  private extractor: FeatureExtractionPipeline | null = null;
  private modelName: string;

  constructor(modelName = "Xenova/bge-small-zh-v1.5") {
    super({});
    this.modelName = modelName;
  }

  /** 懒加载模型 */
  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractor) {
      console.log(`📦 加载 Embedding 模型: ${this.modelName}（首次运行需下载 ~90MB）...`);
      this.extractor = await pipeline("feature-extraction", this.modelName);
      console.log("✅ Embedding 模型加载完成！");
    }
    return this.extractor;
  }

  /** 实现 embedDocuments — 批量文本向量化 */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const doc of documents) {
      results.push(await this.embedSingle(doc));
    }
    return results;
  }

  /** 实现 embedQuery — 单条查询向量化 */
  async embedQuery(query: string): Promise<number[]> {
    return this.embedSingle(query);
  }

  private async embedSingle(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  }
}

// ============================================================
// 2. Demo 入口
// ============================================================

async function main() {
  console.log("📚 rag-langchain.ts — LangChain 重构 RAG Pipeline Demo\n");

  // --- Part 1: 文本分块 ---
  console.log("=".repeat(60));
  console.log("📌 Part 1: RecursiveCharacterTextSplitter（中文分隔符）\n");

  // 读取知识库
  const knowledgePath = join(__dirname, "..", "data", "knowledge.md");
  const rawText = readFileSync(knowledgePath, "utf-8");
  console.log(`知识库文件: ${knowledgePath}`);
  console.log(`原始文本长度: ${rawText.length} 字符\n`);

  // ────────────────────────────────────────────────────────
  // 🔑 RecursiveCharacterTextSplitter — 递归字符分块器
  //
  // RAG 的第一步是把长文档切成小块。为什么不能直接把整篇文档塞给 LLM？
  //   1. LLM 有 Token 上限，长文档可能超限
  //   2. 向量检索需要小块才能精准匹配
  //   3. 小块作为上下文，LLM 回答更聚焦
  //
  // "递归"的含义：按分隔符优先级从高到低逐级尝试切分
  //
  //   separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""]
  //                段落    换行   句号  感叹  问号  分号  逗号  空格  单字符
  //                ← 优先级从高到低，先尝试大粒度，切不动再用小粒度 →
  //
  //   第1轮: 按 "\n\n"（段落）切 → 块够小？✅ 放入结果 ❌ 太大→进入第2轮
  //   第2轮: 按 "\n"（换行）切   → 块够小？✅ 放入结果 ❌ 太大→进入第3轮
  //   第3轮: 按 "。"（句号）切   → ...逐级递归，直到每块 ≤ chunkSize
  //   兜底:  "" 按单字符切（保证一定能切到目标大小）
  //
  //   好处：尽可能在语义边界（段落→句子）断开，而不是从句子中间劈开。
  //
  // 中文适配：默认分隔符是英文的（\n\n, \n, " ", ""），这里加入了中文标点
  //   （。！？；，），让切分优先在中文句子边界断开。
  //
  // 04-rag 中我们手写了三种分块策略（固定大小、递归字符、段落），~120 行代码。
  // LangChain 这里一行搞定，效果等价。
  // ────────────────────────────────────────────────────────

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,      // 每块最大 500 字符
    chunkOverlap: 50,    // 相邻块重叠 50 字符（避免关键信息在边界被截断）
    separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
  });

  const docs = await splitter.createDocuments([rawText]);
  console.log(`分块结果: ${docs.length} 个文本块`);
  console.log(`前3个文本块预览:`);
  for (let i = 0; i < Math.min(3, docs.length); i++) {
    const preview = docs[i].pageContent.slice(0, 80).replace(/\n/g, " ");
    console.log(`  [${i}] (${docs[i].pageContent.length}字) ${preview}...`);
  }
  console.log();

  // --- Part 2: Chroma VectorStore ---
  console.log("=".repeat(60));
  console.log("📌 Part 2: Chroma VectorStore + 文档入库\n");

  const embeddings = new LocalEmbeddings();
  const collectionName = "langchain-rag-demo";

  let vectorStore: Chroma;
  try {
    // 先尝试删除旧 collection（避免重复数据）
    vectorStore = new Chroma(embeddings, {
      collectionName,
      url: "http://localhost:8000",
    });
    try {
      await Chroma.fromDocuments([], embeddings, {
        collectionName,
        url: "http://localhost:8000",
        collectionMetadata: { "hnsw:space": "cosine" },
      });
    } catch {
      // collection 可能不存在，忽略
    }

    // 入库文档
    console.log("📥 正在将文档入库到 ChromaDB...");
    vectorStore = await Chroma.fromDocuments(docs, embeddings, {
      collectionName,
      url: "http://localhost:8000",
      collectionMetadata: { "hnsw:space": "cosine" },
    });
    console.log(`✅ 成功入库 ${docs.length} 个文本块\n`);
  } catch (error) {
    console.log("❌ ChromaDB 连接失败！请确保 ChromaDB 服务端正在运行：");
    console.log("   docker run -d -p 8000:8000 chromadb/chroma\n");
    console.log("错误:", (error as Error).message);
    return;
  }

  // --- Part 3: Retriever + LCEL RAG Chain ---
  console.log("=".repeat(60));
  console.log("📌 Part 3: LCEL RAG Chain — retriever → prompt → model → parser\n");

  const model = createChatModel({ temperature: 0 });
  const parser = new StringOutputParser();

  // ────────────────────────────────────────────────────────
  // 🔑 VectorStore vs Retriever
  //
  // vectorStore — 向量数据库的完整封装，提供入库、删除、搜索等所有操作
  //   vectorStore.addDocuments(docs)         // 入库
  //   vectorStore.similaritySearch(query, k) // 搜索（返回 Document[]）
  //   vectorStore.delete(...)                // 删除
  //
  // retriever — 从 vectorStore 派生的"只读检索器"，只做一件事：给问题→返回相关文档
  //   retriever.invoke("什么是RAG？")  // → Document[]（最相似的 k 个文本块）
  //
  // 为什么要多封装一层 Retriever？
  //   因为 Retriever 实现了 Runnable 接口，可以用 .pipe() 接入 LCEL 链：
  //     retriever.pipe(formatDocs).pipe(prompt).pipe(model)  ✅ 可以
  //     vectorStore.pipe(...)                                 ❌ 不行，没有 pipe
  //
  // retriever.invoke(question) 内部自动做两步：
  //   1. 调用 Embedding 模型将 question 向量化
  //   2. 在向量数据库中找最相似的 k 个文档块
  //
  // 一句话：Retriever 是 VectorStore 的 LCEL 友好包装，
  //         让"检索"可以像积木一样拼进链里。
  // ────────────────────────────────────────────────────────

  const retriever = vectorStore.asRetriever({
    k: 3, // 返回最相似的 3 个文本块
  });

  // 格式化检索结果：把 Document[] 拼成可读文本，注入到 Prompt 的 {context} 中
  const formatDocs = (docs: Document[]): string => {
    return docs.map((doc, i) => `[${i + 1}] ${doc.pageContent}`).join("\n\n");
  };

  // RAG Prompt
  const ragPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `你是一个知识问答助手。请根据以下参考资料回答用户问题。
如果参考资料中没有相关信息，请诚实地说"根据现有资料无法回答"。

参考资料：
{context}`,
    ],
    ["human", "{question}"],
  ]);

  // ────────────────────────────────────────────────────────
  // 🔑 LCEL RAG Chain — 这是 LangChain RAG 的标准写法
  //
  // 数据流：
  //   "什么是RAG？"（用户问题）
  //       ↓
  //   并行执行两个分支：
  //     context: retriever.invoke("什么是RAG？") → Document[] → formatDocs → 文本
  //     question: RunnablePassthrough → "什么是RAG？"（原样透传）
  //       ↓
  //   { context: "检索到的文本...", question: "什么是RAG？" }
  //       ↓ ragPrompt — 注入到模板的 {context} 和 {question}
  //       ↓ model — LLM 基于检索内容生成回答
  //       ↓ parser — 提取纯文本
  //   "RAG 是一种结合检索和生成的技术..."
  // ────────────────────────────────────────────────────────

  const ragChain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocs),
      question: new RunnablePassthrough(),
    },
    ragPrompt,
    model,
    parser,
  ]);

  // --- Part 4: 查询对比 ---
  console.log("=".repeat(60));
  console.log("📌 Part 4: RAG 查询（与 04-rag 相同问题）\n");

  const questions = [
    "什么是大语言模型？它的核心架构是什么？",
    "RAG 的工作流程是怎样的？",
    "有哪些常见的文本分块策略？",
    "向量数据库有哪些，各有什么特点？",
  ];

  for (const question of questions) {
    console.log(`❓ 问题: ${question}`);

    // 先展示检索到的文档
    const retrievedDocs = await retriever.invoke(question);
    console.log(`🔍 检索到 ${retrievedDocs.length} 个相关文本块:`);
    for (let i = 0; i < retrievedDocs.length; i++) {
      const preview = retrievedDocs[i].pageContent.slice(0, 60).replace(/\n/g, " ");
      console.log(`   [${i + 1}] ${preview}...`);
    }

    // RAG 回答
    const answer = await ragChain.invoke(question);
    console.log(`💡 RAG 回答: ${answer}`);
    console.log("-".repeat(60) + "\n");
  }

  // --- Part 5: 手写 vs LangChain 代码量对比 ---
  console.log("=".repeat(60));
  console.log("📌 Part 5: 手写 vs LangChain 代码量对比\n");

  console.log("┌──────────────────────┬──────────────┬──────────────┐");
  console.log("│ 功能                 │ 04-rag 手写  │ LangChain    │");
  console.log("├──────────────────────┼──────────────┼──────────────┤");
  console.log("│ Embedding 封装       │ ~70 行       │ ~40 行       │");
  console.log("│ 文本分块             │ ~120 行      │ ~5 行        │");
  console.log("│ 向量存储 + 检索      │ ~100 行      │ ~10 行       │");
  console.log("│ RAG Pipeline         │ ~150 行      │ ~20 行       │");
  console.log("├──────────────────────┼──────────────┼──────────────┤");
  console.log("│ 合计                 │ ~440 行      │ ~75 行       │");
  console.log("└──────────────────────┴──────────────┴──────────────┘");
  console.log();
  console.log("💡 结论：");
  console.log("  - LangChain 通过高级抽象大幅减少代码量（约 80% 缩减）");
  console.log("  - 文本分块、向量存储等通用能力直接复用社区实现");
  console.log("  - LCEL 链式调用让数据流清晰可读");
  console.log("  - 但理解底层原理（04-rag）对调试和优化至关重要");

  // 清理
  try {
    const chromaClient = new (await import("chromadb")).ChromaClient({
      path: "http://localhost:8000",
    });
    await chromaClient.deleteCollection({ name: collectionName });
    console.log("\n🗑️  已清理 ChromaDB collection");
  } catch {
    // 清理失败不影响 demo
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ LangChain RAG Pipeline Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("rag-langchain.ts");

if (isMainModule) {
  main().catch(console.error);
}
