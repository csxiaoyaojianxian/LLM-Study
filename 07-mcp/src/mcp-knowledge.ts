/**
 * mcp-knowledge.ts — 个人知识库 MCP Server 实战（综合）
 *
 * 启动 knowledge-server：同时提供 Tools + Resources + Prompts
 * 知识库问答：Client → 读取文档 → LLM 回答（MCP 版 RAG）
 *
 * Demo 1: 探测知识库 Server 的全部能力（Tools / Resources / Prompts）
 * Demo 2: 知识库搜索与章节浏览
 * Demo 3: 知识库问答 — 同时使用 MCP 三大原语完成一次 RAG 式问答
 *
 * ⚠️ Demo 3 与 04-rag 模块的关系：
 *
 *   两者做的是同一件事 —— "检索相关资料 → 拼入上下文 → LLM 回答"
 *   但目的和实现完全不同：
 *
 *   04-rag 的重点是【检索技术】：
 *     问题 → Embedding 向量化 → 向量数据库相似度搜索 → Top-K → prompt → LLM
 *     核心价值：教语义搜索（"人工智能"能匹配"AI"）
 *     需要：Embedding 模型 + 向量数据库（ChromaDB）
 *
 *   本 Demo 的重点是【MCP 作为接入层】：
 *     问题 → MCP callTool 关键词搜索 → MCP readResource 兜底 → MCP getPrompt 模板 → LLM
 *     核心价值：展示 MCP 三大原语如何协作，标准化封装知识库
 *     检索只用了简单的关键词匹配（非语义搜索），因为这不是本模块的教学重点
 *
 *   换句话说：如果把 search_knowledge 的实现从关键词匹配换成向量搜索，
 *   就是一个完整的"MCP 版 RAG Server"—— 任何 MCP Host 都能即插即用。
 *
 * 运行: npm run mcp-knowledge
 */

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { generateText } from "ai";
import { getModel, getDefaultProvider, getAvailableProviders } from "./model-adapter.js";

// ============================================================
// 辅助: 创建连接到 knowledge-server 的 Client
// ============================================================

async function createKnowledgeClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/servers/knowledge-server.ts"],
  });

  const client = new Client({
    name: "knowledge-demo-client",
    version: "1.0.0",
  });

  await client.connect(transport);
  return client;
}

// ============================================================
// Demo 1: 探测知识库 Server 能力
// ============================================================

async function demo1_inspectKnowledgeServer() {
  console.log("🔍 Demo 1: 探测知识库 Server 能力\n");

  const client = await createKnowledgeClient();

  try {
    // Tools
    const { tools } = await client.listTools();
    console.log(`🔧 Tools (${tools.length}):`);
    for (const t of tools) {
      console.log(`   • ${t.name} — ${t.description}`);
    }
    console.log();

    // Resources
    const { resources } = await client.listResources();
    console.log(`📂 Resources (${resources.length}):`);
    for (const r of resources) {
      console.log(`   • ${r.name} — ${r.uri}`);
    }
    console.log();

    // Prompts
    const { prompts } = await client.listPrompts();
    console.log(`📋 Prompts (${prompts.length}):`);
    for (const p of prompts) {
      console.log(`   • ${p.name} — ${p.description}`);
    }
    console.log();
  } finally {
    await client.close();
  }
}

// ============================================================
// Demo 2: 知识库搜索与章节浏览
// ============================================================

async function demo2_browseKnowledge() {
  console.log("📚 Demo 2: 知识库搜索与浏览\n");

  const client = await createKnowledgeClient();

  try {
    // 列出所有章节
    console.log("📋 知识库章节:");
    const sectionsResult = await client.callTool({
      name: "list_sections",
      arguments: {},
    });
    console.log((sectionsResult.content as Array<{ text: string }>)[0].text);
    console.log();

    // 读取完整知识库
    console.log("-".repeat(40));
    console.log("📖 读取知识库内容（预览前 500 字）:\n");
    const resource = await client.readResource({ uri: "knowledge://base" });
    const content = resource.contents[0];
    if ("text" in content) {
      const preview = content.text.substring(0, 500);
      console.log(preview);
      if (content.text.length > 500) {
        console.log(`\n... (共 ${content.text.length} 字)`);
      }
    }
    console.log();

    // 搜索关键词
    console.log("-".repeat(40));
    console.log('🔍 搜索关键词 "MCP":');
    const searchResult = await client.callTool({
      name: "search_knowledge",
      arguments: { query: "MCP" },
    });
    console.log((searchResult.content as Array<{ text: string }>)[0].text);
    console.log();
  } finally {
    await client.close();
  }
}

// ============================================================
// Demo 3: 知识库问答（MCP 版 RAG）
// ============================================================

/**
 * Demo 3: 一次问答同时用到 MCP 全部三个原语：
 *
 * Step 1 — Tool:     callTool("search_knowledge") 搜索相关内容（关键词匹配）
 *           Resource: readResource("knowledge://base") 搜索无结果时兜底读全文
 * Step 2 — Prompt:   getPrompt("knowledge-qa") 获取问答 Prompt 模板
 * Step 3 — LLM:      将模板填充后的 messages 发给 LLM 生成回答
 *
 * 注意：这里的搜索是简单的关键词匹配，不是 04-rag 的向量语义搜索。
 * 本 Demo 的教学重点是 MCP 三原语的协作模式，而非检索精度。
 */

async function demo3_knowledgeQA() {
  console.log("🤖 Demo 3: 知识库问答（MCP 版 RAG）\n");

  const available = getAvailableProviders();
  if (available.length === 0) {
    console.log("⚠️ 未配置 API Key，跳过知识库问答 Demo");
    console.log("   请在 .env 中配置至少一个 API Key\n");
    return;
  }

  const provider = getDefaultProvider();
  console.log(`📡 使用 Provider: ${provider}\n`);

  const client = await createKnowledgeClient();

  try {
    const questions = [
      "什么是 MCP？它有哪些核心能力？",
      "MCP 和传统 REST API 有什么区别？",
    ];

    for (const question of questions) {
      console.log(`❓ 问题: ${question}\n`);

      // Step 1: 用 MCP Tool 搜索知识库（简单关键词匹配，非向量语义搜索）
      // 如果将 knowledge-server 中的 search_knowledge 实现替换为向量搜索，
      // 就能获得 04-rag 那样的语义检索能力，而调用方代码无需任何改动 — 这就是 MCP 标准化的价值
      const keywords = question.replace(/[？?，。！]/g, " ").split(/\s+/).filter(k => k.length > 1);
      let context = "";

      for (const keyword of keywords.slice(0, 3)) {
        const searchResult = await client.callTool({
          name: "search_knowledge",
          arguments: { query: keyword },
        });
        const text = (searchResult.content as Array<{ text: string }>)[0].text;
        if (!text.includes("未找到")) {
          context += text + "\n\n";
        }
      }

      if (!context) {
        // 搜索无结果时，用 MCP Resource 读取整个知识库作为兜底上下文
        // 这体现了 Resource 的用途：应用主动选择数据注入给 LLM
        const resource = await client.readResource({ uri: "knowledge://base" });
        if ("text" in resource.contents[0]) {
          context = resource.contents[0].text;
        }
      }

      // Step 2: 用 MCP Prompt 获取知识库问答的 Prompt 模板
      // Server 预定义了 "knowledge-qa" 模板，接受 question + context 参数
      // 这比在客户端硬编码 prompt 更灵活 — 模板由 Server 统一管理
      const promptResult = await client.getPrompt({
        name: "knowledge-qa",
        arguments: { question, context: context.substring(0, 2000) },
      });

      // Step 3: 将 MCP Prompt 模板返回的 messages 直接发给 LLM
      // 这一步和普通的 generateText 完全一样 — MCP 只负责"准备数据"，不干预 LLM 调用
      const messages = promptResult.messages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content.type === "text" ? msg.content.text : "",
      }));

      const result = await generateText({
        model: getModel(provider),
        messages,
        maxOutputTokens: 500,
      });

      console.log(`🤖 回答:\n${result.text}\n`);
      console.log("-".repeat(40));
      console.log();
    }
  } catch (error) {
    console.error(`❌ 错误: ${(error as Error).message}`);
  } finally {
    await client.close();
  }
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 个人知识库 MCP Server 实战\n");
  console.log("=".repeat(60));
  console.log();

  await demo1_inspectKnowledgeServer();

  console.log("=".repeat(60));
  console.log();

  await demo2_browseKnowledge();

  console.log("=".repeat(60));
  console.log();

  await demo3_knowledgeQA();

  console.log("=".repeat(60));
  console.log("✅ 知识库实战 Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("mcp-knowledge.ts");

if (isMainModule) {
  main().catch(console.error);
}
