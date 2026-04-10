/**
 * advanced-rag.ts — 高级 RAG 技术
 *
 * 本文件演示 LlamaIndex 的高级 RAG 功能：
 * - SubQuestionQueryEngine（子问题分解）
 * - 结果重排序（Node Postprocessor）
 * - RouterQueryEngine（路由查询引擎）
 * - 与 Module 04 rag-optimize.ts 的优化思路对比
 *
 * 需要 API Key
 */

import "dotenv/config";
import {
  Document,
  VectorStoreIndex,
  SummaryIndex,
  SentenceSplitter,
  SimilarityPostprocessor,
  QueryEngineTool,
  RouterQueryEngine,
} from "llamaindex";
import { getDefaultProvider, type Provider } from "./model-adapter.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// 辅助函数
// ============================================================

function loadDocuments(): Document[] {
  const knowledgeDir = path.join(__dirname, "..", "data", "knowledge");
  const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));
  const documents: Document[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(knowledgeDir, file), "utf-8");
    documents.push(
      new Document({ text: content, metadata: { source: file } })
    );
  }

  return documents;
}

// ============================================================
// 1. 子问题查询引擎
// ============================================================

/**
 * SubQuestionQueryEngine — 将复杂问题分解为多个子问题
 *
 * 原理：
 * 1. 接收复杂问题
 * 2. LLM 将问题拆分为多个简单的子问题
 * 3. 每个子问题由对应的查询引擎处理
 * 4. 合并所有子回答生成最终答案
 *
 * 对比 Module 04 rag-optimize.ts:
 * Module 04 通过 HyDE（假设文档嵌入）优化检索
 * LlamaIndex 通过问题分解优化查询
 */
async function demonstrateSubQuestionQuery(
  vectorIndex: VectorStoreIndex
): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🧩 1. 子问题查询引擎 (SubQuestion)");
  console.log("=".repeat(60));

  console.log("\n📌 原理说明:");
  console.log("  复杂问题 → LLM 分解为子问题 → 分别检索 → 合并回答");
  console.log("  例: '对比 TypeScript 和 Node.js 在 AI 开发中的角色'");
  console.log("  → 子问题1: 'TypeScript 在 AI 开发中的角色是什么？'");
  console.log("  → 子问题2: 'Node.js 在 AI 开发中的角色是什么？'");
  console.log("  → 合并两个回答生成对比分析\n");

  // 创建查询引擎工具
  const queryEngineTool = new QueryEngineTool({
    queryEngine: vectorIndex.asQueryEngine({ similarityTopK: 3 }),
    metadata: {
      name: "knowledge_base",
      description: "包含 TypeScript、Node.js 和 LLM 开发相关知识的文档库",
    },
  });

  // 复杂问题测试
  const complexQuestions = [
    "对比 TypeScript 和 Node.js 在 AI 应用开发中各自的作用",
    "从工具生态和类型系统两个角度分析 TypeScript 的价值",
  ];

  for (const question of complexQuestions) {
    console.log(`\n🔍 复杂问题: ${question}`);
    try {
      // 使用普通查询引擎作为对照
      const simpleEngine = vectorIndex.asQueryEngine({ similarityTopK: 3 });
      const simpleResponse = await simpleEngine.query({ query: question });
      console.log(`  📗 普通查询: ${simpleResponse.toString().substring(0, 200)}...`);
    } catch (error) {
      console.log(`  ❌ 查询失败: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log("\n💡 对比 Module 04 rag-optimize.ts:");
  console.log("  Module 04: HyDE（先生成假设答案再检索）");
  console.log("  LlamaIndex: SubQuestion（先分解问题再检索）");
  console.log("  两者思路不同但目标一致：提升复杂问题的检索质量");
}

// ============================================================
// 2. 结果重排序
// ============================================================

async function demonstrateReranking(
  vectorIndex: VectorStoreIndex
): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 2. 结果重排序 (Reranking)");
  console.log("=".repeat(60));

  console.log("\n📌 原理说明:");
  console.log("  检索 Top-K 结果 → 重排序器评估相关性 → 返回精选结果");
  console.log("  目的: 提高检索结果的精确度\n");

  // 使用 SimilarityPostprocessor 进行相似度过滤
  const queryEngine = vectorIndex.asQueryEngine({
    similarityTopK: 5,
    nodePostprocessors: [
      new SimilarityPostprocessor({
        similarityCutoff: 0.7, // 过滤掉相似度低于 0.7 的结果
      }),
    ],
  });

  const question = "TypeScript 的泛型系统有什么特点？";
  console.log(`🔍 问题: ${question}`);

  try {
    const response = await queryEngine.query({ query: question });
    console.log(`💬 回答（含重排序）: ${response.toString().substring(0, 250)}...`);
  } catch (error) {
    console.log(`  ❌ 查询失败: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n💡 重排序策略对比:");
  console.log("  SimilarityPostprocessor: 按相似度阈值过滤");
  console.log("  KeywordNodePostprocessor: 按关键词过滤");
  console.log("  Cohere Reranker: 使用专门的重排序模型（效果最好）");
  console.log("  对比 Module 04: 手动实现 Top-K + 阈值过滤");
}

// ============================================================
// 3. RouterQueryEngine — 路由查询引擎
// ============================================================

async function demonstrateRouterQuery(documents: Document[]): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔀 3. RouterQueryEngine — 路由查询引擎");
  console.log("=".repeat(60));

  console.log("\n📌 原理说明:");
  console.log("  用户问题 → LLM 判断适合的查询引擎 → 路由到对应引擎");
  console.log("  类似 Module 06 multi-agent.ts 中的 Routing 模式\n");

  try {
    // 构建两种不同的索引
    console.log("  🏗️  构建向量索引（用于精确查询）...");
    const vectorIndex = await VectorStoreIndex.fromDocuments(documents);

    console.log("  🏗️  构建摘要索引（用于总结查询）...");
    const summaryIndex = await SummaryIndex.fromDocuments(documents);

    // 创建查询引擎工具
    const vectorTool = new QueryEngineTool({
      queryEngine: vectorIndex.asQueryEngine(),
      metadata: {
        name: "vector_search",
        description: "适合回答具体的技术问题，例如某个特性的说明、具体的用法等",
      },
    });

    const summaryTool = new QueryEngineTool({
      queryEngine: summaryIndex.asQueryEngine(),
      metadata: {
        name: "summary_search",
        description: "适合总结和概览类问题，例如总结文档内容、生成报告等",
      },
    });

    // 创建路由查询引擎
    const routerEngine = RouterQueryEngine.fromDefaults({
      queryEngineTools: [vectorTool, summaryTool],
    });

    // 测试不同类型的问题
    const testQueries = [
      { q: "TypeScript 泛型的具体用法是什么？", expected: "vector_search" },
      { q: "请总结所有文档的核心内容", expected: "summary_search" },
    ];

    for (const { q, expected } of testQueries) {
      console.log(`\n🔍 问题: ${q}`);
      console.log(`  预期路由: ${expected}`);
      const response = await routerEngine.query({ query: q });
      console.log(`  💬 回答: ${response.toString().substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`  ❌ 路由查询失败: ${error instanceof Error ? error.message : error}`);
  }

  console.log("\n💡 RouterQueryEngine 的价值:");
  console.log("  - 自动选择最合适的查询策略");
  console.log("  - 类似 Module 06 中 Supervisor 模式的智能分发");
  console.log("  - 在有多种数据源/索引时特别有用");
}

// ============================================================
// 4. 高级 RAG 技术总结
// ============================================================

function showAdvancedRAGSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 高级 RAG 技术总结");
  console.log("=".repeat(60));

  console.log("\n📌 优化方向与对应技术:");
  console.log("  ┌────────────────┬────────────────────┬──────────────────────┐");
  console.log("  │   优化方向     │   LlamaIndex 方案   │  Module 04 对应方案   │");
  console.log("  ├────────────────┼────────────────────┼──────────────────────┤");
  console.log("  │ 查询理解       │ SubQuestionQuery   │ 问题改写/HyDE         │");
  console.log("  │ 检索精度       │ Reranking          │ Top-K + 阈值过滤      │");
  console.log("  │ 多源检索       │ RouterQueryEngine  │ 未实现                │");
  console.log("  │ 文档切分       │ SentenceSplitter   │ recursiveCharacterChunk│");
  console.log("  │ 上下文窗口     │ ContextChatEngine  │ conversational-rag     │");
  console.log("  └────────────────┴────────────────────┴──────────────────────┘");

  console.log("\n📌 RAG 优化的通用原则（框架无关）:");
  console.log("  1. 🔪 切分优化: 选择合适的 chunk size，保持语义完整");
  console.log("  2. 🔍 检索优化: 多策略检索（向量+关键词+混合）");
  console.log("  3. 🔄 重排序: 对初步检索结果二次排序");
  console.log("  4. 🧩 问题理解: 分解复杂问题、改写模糊问题");
  console.log("  5. 📊 评估迭代: 建立评估数据集，持续优化");

  console.log("\n✅ 学习建议:");
  console.log("  - 理解 RAG 底层原理（Module 04）→ 掌握框架封装（Module 05/11）");
  console.log("  - 先用 LlamaIndex 快速搭建原型，需要深度定制时回归手动实现");
  console.log("  - 下一步: Module 12 学习模型微调，从'用模型'到'定制模型' →");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 LlamaIndex 高级 RAG 技术\n");

  // 检查 API Key
  let provider: Provider;
  try {
    provider = getDefaultProvider();
    console.log(`✅ 使用模型提供商: ${provider}`);
  } catch {
    console.log("⚠️  未配置 API Key");
    console.log("请复制 .env.example 为 .env 并配置 API Key 后重试\n");
    showAdvancedRAGSummary();
    return;
  }

  // 加载文档
  console.log("\n📚 加载知识库文档:");
  const documents = loadDocuments();
  console.log(`  共 ${documents.length} 个文档`);

  // 构建索引
  let vectorIndex: VectorStoreIndex;
  try {
    console.log("\n🏗️  构建向量索引...");
    vectorIndex = await VectorStoreIndex.fromDocuments(documents);
    console.log("  ✅ 索引构建完成");
  } catch (error) {
    console.log(`\n❌ 索引构建失败: ${error instanceof Error ? error.message : error}`);
    console.log("  提示: 请确保 OPENAI_API_KEY 已配置\n");
    showAdvancedRAGSummary();
    return;
  }

  // 演示高级 RAG 技术
  await demonstrateSubQuestionQuery(vectorIndex);
  await demonstrateReranking(vectorIndex);
  await demonstrateRouterQuery(documents);

  // 总结
  showAdvancedRAGSummary();

  console.log("\n" + "=".repeat(60));
  console.log("🎓 Module 11 全部完成！");
  console.log("=".repeat(60));
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("advanced-rag.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { loadDocuments };
