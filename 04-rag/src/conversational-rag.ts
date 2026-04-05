/**
 * conversational-rag.ts — 对话式 RAG
 *
 * 在 RAG Pipeline 基础上加入多轮对话能力：
 * 1. 对话历史管理
 * 2. 问题改写（解决代词指代问题）
 * 3. 基于改写后的问题进行检索
 *
 * 前置条件：需要先启动 ChromaDB 服务端
 *   docker run -d -p 8000:8000 chromadb/chroma
 *
 * 运行: npm run conversational-rag
 */

import "dotenv/config";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { RAGPipeline, type RAGQueryResult } from "./rag-pipeline.js";
import { chatWithModel, getDefaultProvider, type Provider } from "./model-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. 对话历史管理
// ============================================================

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ============================================================
// 2. ConversationalRAG 类
// ============================================================

export class ConversationalRAG {
  private ragPipeline: RAGPipeline;
  private history: ChatMessage[] = [];
  private provider: Provider;
  private maxHistory: number;

  constructor(options?: {
    provider?: Provider;
    collectionName?: string;
    maxHistory?: number;
  }) {
    this.provider = options?.provider ?? getDefaultProvider();
    this.ragPipeline = new RAGPipeline({
      provider: this.provider,
      collectionName: options?.collectionName ?? "conversational-rag",
    });
    this.maxHistory = options?.maxHistory ?? 10;
  }

  /**
   * 文档摄入（委托给底层 RAGPipeline）
   */
  async ingest(filePath: string): Promise<number> {
    return this.ragPipeline.ingest(filePath);
  }

  /**
   * 问题改写：根据对话历史，将可能含有代词指代的问题改写为独立问题
   *
   * 例如：
   * 历史: "什么是 RAG？" → "RAG 是检索增强生成..."
   * 当前: "它有什么优势？"
   * 改写: "RAG 有什么优势？"
   */
  private async rewriteQuestion(question: string): Promise<string> {
    // 如果没有历史对话，无需改写
    if (this.history.length === 0) {
      return question;
    }

    // 构建历史摘要
    const recentHistory = this.history.slice(-6); // 最近 3 轮
    const historyText = recentHistory
      .map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content.slice(0, 100)}`)
      .join("\n");

    const rewritePrompt = `你是一个问题改写助手。根据对话历史，将用户的当前问题改写为一个独立的、完整的问题（不依赖上下文也能理解）。

规则：
- 如果当前问题已经是独立的，直接返回原问题
- 解决代词指代（"它"、"这个"、"那种方法"等）
- 只返回改写后的问题，不要任何解释

对话历史：
${historyText}

当前问题：${question}

改写后的问题：`;

    try {
      const rewritten = await chatWithModel(
        this.provider,
        [{ role: "user", content: rewritePrompt }],
        { maxOutputTokens: 100, temperature: 0 }
      );
      return rewritten.trim();
    } catch {
      // 改写失败，使用原问题
      return question;
    }
  }

  /**
   * 对话式查询：改写问题 → RAG 检索 → 生成回答 → 更新历史
   */
  async chat(question: string): Promise<{
    answer: string;
    rewrittenQuestion: string;
    contexts: RAGQueryResult["contexts"];
  }> {
    // 1. 问题改写
    const rewrittenQuestion = await this.rewriteQuestion(question);

    // 2. 使用改写后的问题进行 RAG 查询
    const result = await this.ragPipeline.query(rewrittenQuestion);

    // 3. 更新对话历史
    this.history.push({ role: "user", content: question });
    this.history.push({ role: "assistant", content: result.answer });

    // 保持历史长度限制
    if (this.history.length > this.maxHistory * 2) {
      this.history = this.history.slice(-this.maxHistory * 2);
    }

    return {
      answer: result.answer,
      rewrittenQuestion,
      contexts: result.contexts,
    };
  }

  /** 获取对话历史 */
  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  /** 清空对话历史 */
  clearHistory(): void {
    this.history = [];
    console.log("🗑️  对话历史已清空");
  }

  /** 获取底层 RAGPipeline */
  getPipeline(): RAGPipeline {
    return this.ragPipeline;
  }
}

// ============================================================
// 3. Demo 入口 — 模拟多轮对话
// ============================================================

async function main() {
  console.log("💬 conversational-rag.ts — 对话式 RAG Demo\n");
  console.log("=".repeat(60));

  // 初始化
  const crag = new ConversationalRAG();
  console.log(`🤖 使用模型 Provider: ${getDefaultProvider()}`);

  // 文档摄入
  const knowledgePath = resolve(__dirname, "../data/knowledge.md");
  await crag.ingest(knowledgePath);

  // 模拟 3 轮对话（展示问题改写的效果）
  const conversations = [
    "什么是 RAG？它解决了什么问题？",
    "它的完整工作流程是怎样的？",           // "它" 指代 RAG
    "在第一个阶段中，分块策略有哪些选择？",  // "第一个阶段" 指代离线阶段
  ];

  console.log("\n📌 模拟多轮对话（注意问题改写效果）\n");

  for (let i = 0; i < conversations.length; i++) {
    const question = conversations[i];

    console.log("=".repeat(60));
    console.log(`\n🔄 第 ${i + 1} 轮对话`);
    console.log(`👤 用户原始问题: ${question}`);

    const result = await crag.chat(question);

    // 显示改写效果
    if (result.rewrittenQuestion !== question) {
      console.log(`✏️  改写后的问题: ${result.rewrittenQuestion}`);
    } else {
      console.log(`✏️  问题无需改写`);
    }

    // 显示检索结果
    console.log("\n🔍 检索到的参考资料:");
    for (let j = 0; j < result.contexts.length; j++) {
      const ctx = result.contexts[j];
      const preview = ctx.document.replace(/\n/g, " ").slice(0, 60);
      console.log(`  [${j + 1}] (相关度: ${(1 - ctx.distance).toFixed(2)}) ${preview}...`);
    }

    // 显示回答
    console.log(`\n🤖 助手回答:\n${result.answer.trim()}`);
    console.log();
  }

  // 显示完整对话历史
  console.log("=".repeat(60));
  console.log("\n📜 完整对话历史:\n");
  const history = crag.getHistory();
  for (const msg of history) {
    const icon = msg.role === "user" ? "👤" : "🤖";
    const preview = msg.content.slice(0, 80).replace(/\n/g, " ");
    console.log(`${icon} ${preview}${msg.content.length > 80 ? "..." : ""}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ 对话式 RAG Demo 完成！");
  console.log("\n💡 核心要点：");
  console.log("  1. 问题改写解决了多轮对话中的代词指代问题");
  console.log("  2. 改写后的独立问题能更准确地检索到相关文档");
  console.log("  3. 对话历史管理避免了上下文窗口溢出");
}

// 仅当直接运行时执行 demo
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("conversational-rag.ts");

if (isMainModule) {
  main().catch(console.error);
}
