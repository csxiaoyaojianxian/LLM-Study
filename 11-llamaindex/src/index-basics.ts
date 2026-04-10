/**
 * index-basics.ts — LlamaIndex 核心概念
 *
 * 本文件介绍 LlamaIndex.TS 的基础概念：
 * - Document 对象创建与元数据
 * - Node 解析（文本切分）
 * - VectorStoreIndex 构建流程
 * - 与 Module 04 chunking.ts 的概念对比
 *
 * 无需 API Key 即可运行（核心概念展示部分）
 */

import {
  Document,
  SentenceSplitter,
  MetadataMode,
} from "llamaindex";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. Document — LlamaIndex 的基本数据单元
// ============================================================

/**
 * Document 是 LlamaIndex 中最基础的数据抽象
 * 类比 Module 04：相当于原始文本文件读取后的内容
 */
function demonstrateDocument(): void {
  console.log("=".repeat(60));
  console.log("📄 1. Document — LlamaIndex 基本数据单元");
  console.log("=".repeat(60));

  // 方式一：直接从文本创建
  const doc1 = new Document({
    text: "TypeScript 是 JavaScript 的超集，添加了静态类型系统。",
    metadata: {
      source: "manual",
      topic: "TypeScript",
      language: "zh",
    },
  });

  console.log("\n📌 方式一：直接从文本创建 Document");
  console.log(`  文本内容: ${doc1.text.substring(0, 50)}...`);
  console.log(`  元数据: ${JSON.stringify(doc1.metadata)}`);
  console.log(`  文档 ID: ${doc1.id_}`);

  // 方式二：从文件读取创建
  const knowledgeDir = path.join(__dirname, "..", "data", "knowledge");
  const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

  console.log("\n📌 方式二：从文件批量创建 Document");
  const documents: Document[] = [];

  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const doc = new Document({
      text: content,
      metadata: {
        source: file,
        filePath: filePath,
        fileSize: content.length,
        createdAt: new Date().toISOString(),
      },
    });
    documents.push(doc);
    console.log(`  ✅ 加载: ${file} (${content.length} 字符)`);
  }

  console.log(`\n📊 共创建 ${documents.length} 个 Document 对象`);

  // 对比 Module 04
  console.log("\n💡 概念对比 — Module 04 (RAG) vs LlamaIndex:");
  console.log("  Module 04: fs.readFileSync() 读取原始文本，手动管理元数据");
  console.log("  LlamaIndex: Document 对象封装文本 + 元数据，统一管理");
  console.log("  优势: Document 提供标准化的数据接口，方便后续索引和查询");
}

// ============================================================
// 2. Node — 文档切分后的基本单元
// ============================================================

/**
 * Node（TextNode）是 Document 经过切分后的片段
 * 类比 Module 04：相当于 chunking.ts 中的 Chunk
 */
function demonstrateNodes(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔪 2. Node — 文档切分（对比 Module 04 Chunking）");
  console.log("=".repeat(60));

  // 准备示例文档
  const sampleText = fs.readFileSync(
    path.join(__dirname, "..", "data", "knowledge", "typescript.md"),
    "utf-8"
  );

  const doc = new Document({
    text: sampleText,
    metadata: { source: "typescript.md" },
  });

  // 使用 SentenceSplitter（类似 Module 04 的 RecursiveCharacterSplitter）
  console.log("\n📌 SentenceSplitter — 句子级切分器");

  const splitter = new SentenceSplitter({
    chunkSize: 256,
    chunkOverlap: 30,
  });

  const nodes = splitter.getNodesFromDocuments([doc]);

  console.log(`  原始文档: ${sampleText.length} 字符`);
  console.log(`  切分参数: chunkSize=256, chunkOverlap=30`);
  console.log(`  生成节点数: ${nodes.length}`);

  // 展示前3个节点
  console.log("\n📋 前 3 个节点预览:");
  for (let i = 0; i < Math.min(3, nodes.length); i++) {
    const node = nodes[i];
    const text = node.getContent(MetadataMode.NONE);
    console.log(`\n  --- 节点 ${i + 1} ---`);
    console.log(`  ID: ${node.id_}`);
    console.log(`  长度: ${text.length} 字符`);
    console.log(`  内容: ${text.substring(0, 80)}...`);
    console.log(`  元数据: ${JSON.stringify(node.metadata)}`);
  }

  // 对比不同切分参数
  console.log("\n📊 不同切分参数对比:");
  const configs = [
    { chunkSize: 128, chunkOverlap: 20 },
    { chunkSize: 256, chunkOverlap: 30 },
    { chunkSize: 512, chunkOverlap: 50 },
  ];

  for (const config of configs) {
    const s = new SentenceSplitter(config);
    const n = s.getNodesFromDocuments([doc]);
    console.log(
      `  chunkSize=${config.chunkSize}, overlap=${config.chunkOverlap} → ${n.length} 个节点`
    );
  }

  // 概念对比
  console.log("\n💡 概念对比 — Module 04 Chunking vs LlamaIndex Node:");
  console.log("  Module 04: 手动实现 fixedSizeChunk / recursiveCharacterChunk");
  console.log("  LlamaIndex: 内置 SentenceSplitter，自动处理句子边界");
  console.log("  共同点: 都支持 chunkSize 和 overlap 参数");
  console.log("  LlamaIndex 优势: Node 自动维护与 Document 的引用关系");
}

// ============================================================
// 3. Index — 索引构建流程
// ============================================================

/**
 * Index 是 LlamaIndex 的核心抽象，负责组织和存储 Node
 * 这里展示索引的概念和构建流程（不实际调用向量化，无需 API Key）
 */
function demonstrateIndexConcepts(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🏗️  3. Index — 索引构建流程");
  console.log("=".repeat(60));

  console.log("\n📌 LlamaIndex 的三种主要索引类型:");

  console.log("\n  1️⃣  VectorStoreIndex（向量索引）");
  console.log("     - 将文档向量化后存入向量数据库");
  console.log("     - 通过语义相似度检索相关片段");
  console.log("     - 对应 Module 04: VectorStore + ChromaDB");
  console.log("     - 适用场景: 语义搜索、知识问答");

  console.log("\n  2️⃣  SummaryIndex（摘要索引）");
  console.log("     - 存储所有节点，查询时遍历生成摘要");
  console.log("     - 无需向量化，但查询成本较高");
  console.log("     - Module 04 无对应实现");
  console.log("     - 适用场景: 全文总结、文档概览");

  console.log("\n  3️⃣  KeywordTableIndex（关键词索引）");
  console.log("     - 从节点中提取关键词构建倒排索引");
  console.log("     - 通过关键词匹配检索相关节点");
  console.log("     - Module 04 无对应实现");
  console.log("     - 适用场景: 关键词搜索、精确匹配");

  // 索引构建流程示意
  console.log("\n📌 VectorStoreIndex 构建流程:");
  console.log("  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐");
  console.log("  │ Document │ →  │  Node    │ →  │ Embedding│ →  │  Index   │");
  console.log("  │ (原始文档)│    │ (切分片段)│    │ (向量化) │    │ (向量存储)│");
  console.log("  └──────────┘    └──────────┘    └──────────┘    └──────────┘");

  console.log("\n💡 与 Module 04 RAG Pipeline 的对比:");
  console.log("  Module 04 流程: 读文件 → chunking → embedding → ChromaDB 存储");
  console.log("  LlamaIndex:    Document → Node → Embedding → VectorStoreIndex");
  console.log("  核心差异: LlamaIndex 封装了完整的 Index → Query 链路，开箱即用");
}

// ============================================================
// 4. 查询流程概述
// ============================================================

function demonstrateQueryConcepts(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 4. 查询引擎概念");
  console.log("=".repeat(60));

  console.log("\n📌 LlamaIndex 查询流程:");
  console.log("  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐");
  console.log("  │  Query   │ →  │ Retriever│ →  │ Context  │ →  │   LLM    │");
  console.log("  │ (用户问题)│    │ (检索器) │    │ (上下文) │    │ (生成答案)│");
  console.log("  └──────────┘    └──────────┘    └──────────┘    └──────────┘");

  console.log("\n📌 QueryEngine 的组成:");
  console.log("  - Retriever: 从 Index 中检索相关节点");
  console.log("  - Response Synthesizer: 将检索结果合成为最终回答");
  console.log("  - Node Postprocessors: 对检索结果进行后处理（重排序、过滤等）");

  console.log("\n📌 与 Module 04/05 的对应关系:");
  console.log("  ┌────────────────────┬────────────────────┬────────────────────┐");
  console.log("  │     LlamaIndex     │     Module 04      │     Module 05      │");
  console.log("  ├────────────────────┼────────────────────┼────────────────────┤");
  console.log("  │ Document           │ 原始文本文件        │ Document           │");
  console.log("  │ SentenceSplitter   │ recursiveChunk     │ RecursiveCharacter  │");
  console.log("  │ VectorStoreIndex   │ VectorStore+Chroma │ ChromaVectorStore  │");
  console.log("  │ QueryEngine        │ RAGPipeline.query  │ RetrievalQAChain   │");
  console.log("  │ ResponseSynthesizer│ System Prompt 拼接  │ StuffDocumentsChain│");
  console.log("  └────────────────────┴────────────────────┴────────────────────┘");

  console.log("\n✅ 总结:");
  console.log("  LlamaIndex 将 RAG 的每个环节都封装为标准组件");
  console.log("  相比手动实现（Module 04），代码更简洁但灵活性略低");
  console.log("  相比 LangChain（Module 05），LlamaIndex 更专注于数据索引和检索");
  console.log("  下一步: 运行 query-engine.ts 查看实际的查询引擎效果 →");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 LlamaIndex 核心概念教程");
  console.log("本教程演示 LlamaIndex.TS 的基础概念，无需 API Key\n");

  demonstrateDocument();
  demonstrateNodes();
  demonstrateIndexConcepts();
  demonstrateQueryConcepts();

  console.log("\n" + "=".repeat(60));
  console.log("🎓 教程完成！");
  console.log("=".repeat(60));
  console.log("📚 下一步学习:");
  console.log("  npm run query-engine     → 查询引擎实战");
  console.log("  npm run rag-llamaindex   → LlamaIndex RAG vs LangChain RAG");
  console.log("  npm run advanced-rag     → 高级 RAG 技术");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("index-basics.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { demonstrateDocument, demonstrateNodes, demonstrateIndexConcepts };
