/**
 * mcp-knowledge.ts — 个人知识库 MCP Server 实战（综合）
 *
 * 启动 knowledge-server：同时提供 Tools + Resources + Prompts
 * 知识库问答：Client → 读取文档 → LLM 回答（MCP 版 RAG）
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

      // Step 1: 在知识库中搜索相关内容
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
        // 如果搜索没有结果，读取整个知识库
        const resource = await client.readResource({ uri: "knowledge://base" });
        if ("text" in resource.contents[0]) {
          context = resource.contents[0].text;
        }
      }

      // Step 2: 使用 knowledge-qa Prompt 模板
      const promptResult = await client.getPrompt({
        name: "knowledge-qa",
        arguments: { question, context: context.substring(0, 2000) },
      });

      // Step 3: 发送给 LLM
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
