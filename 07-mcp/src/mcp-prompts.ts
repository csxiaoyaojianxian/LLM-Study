/**
 * mcp-prompts.ts — MCP Prompts 深入
 *
 * Demo 1: Prompt 模板注册（代码审查、翻译），带参数
 * Demo 2: Client listPrompts → getPrompt
 * Demo 3: 获取 Prompt 后发送给 LLM 执行
 *
 * 运行: npm run mcp-prompts
 */

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { generateText } from "ai";
import { getModel, getDefaultProvider, getAvailableProviders } from "./model-adapter.js";

// ============================================================
// 辅助: 创建连接到 prompts-server 的 Client
// ============================================================

async function createPromptsClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/servers/prompts-server.ts"],
  });

  const client = new Client({
    name: "prompts-demo-client",
    version: "1.0.0",
  });

  await client.connect(transport);
  return client;
}

// ============================================================
// Demo 1: Prompts 概念讲解
// ============================================================

function demo1_concepts() {
  console.log("📖 Demo 1: MCP Prompts 概念\n");

  console.log("📋 Prompts 是 MCP Server 提供的可复用提示模板");
  console.log("   类似后端的「接口模板」，支持参数化\n");

  console.log("   工作流程:");
  console.log("   1. Server 注册 Prompt 模板（名称 + 参数 Schema + 生成函数）");
  console.log("   2. Client 通过 listPrompts 发现可用模板");
  console.log("   3. Client 通过 getPrompt(name, args) 获取渲染后的消息");
  console.log("   4. 渲染后的消息可以直接发送给 LLM\n");

  console.log("   与传统 Prompt 模板的区别:");
  console.log("   • 传统方式: 每个应用自己管理模板字符串");
  console.log("   • MCP 方式: Server 统一管理模板，Client 即取即用");
  console.log("   • 好处: 模板复用、版本管理、参数验证\n");
}

// ============================================================
// Demo 2: 列出并获取 Prompts
// ============================================================

async function demo2_listAndGet() {
  console.log("📋 Demo 2: 列出并获取 Prompts\n");

  const client = await createPromptsClient();

  try {
    // 列出所有 Prompts
    const { prompts } = await client.listPrompts();
    console.log(`发现 ${prompts.length} 个 Prompt 模板:\n`);

    for (const p of prompts) {
      console.log(`📋 ${p.name}`);
      if (p.description) console.log(`   描述: ${p.description}`);
      if (p.arguments) {
        console.log(`   参数:`);
        for (const arg of p.arguments) {
          const required = arg.required ? "(必填)" : "(可选)";
          console.log(`     • ${arg.name} ${required} — ${arg.description || ""}`);
        }
      }
      console.log();
    }

    // 获取具体 Prompt
    console.log("-".repeat(40));
    console.log("📖 获取 code-review Prompt（带参数）:\n");

    const codeReviewPrompt = await client.getPrompt({
      name: "code-review",
      arguments: {
        code: `function add(a, b) {
  return a + b
}`,
        language: "TypeScript",
      },
    });

    for (const msg of codeReviewPrompt.messages) {
      console.log(`   角色: ${msg.role}`);
      if (msg.content.type === "text") {
        console.log(`   内容:\n${msg.content.text.split("\n").map(l => `   ${l}`).join("\n")}`);
      }
      console.log();
    }

    // 获取翻译 Prompt
    console.log("-".repeat(40));
    console.log("📖 获取 translate Prompt:\n");

    const translatePrompt = await client.getPrompt({
      name: "translate",
      arguments: {
        text: "大语言模型正在改变软件开发的方式",
        targetLang: "英文",
        style: "technical",
      },
    });

    for (const msg of translatePrompt.messages) {
      console.log(`   角色: ${msg.role}`);
      if (msg.content.type === "text") {
        console.log(`   内容:\n${msg.content.text.split("\n").map(l => `   ${l}`).join("\n")}`);
      }
    }
  } finally {
    await client.close();
  }
}

// ============================================================
// Demo 3: 获取 Prompt 后发送给 LLM 执行
// ============================================================

async function demo3_promptWithLLM() {
  console.log("🤖 Demo 3: MCP Prompt + LLM 执行\n");

  const available = getAvailableProviders();
  if (available.length === 0) {
    console.log("⚠️ 未配置 API Key，跳过 LLM 集成 Demo");
    console.log("   请在 .env 中配置至少一个 API Key\n");
    return;
  }

  const provider = getDefaultProvider();
  console.log(`📡 使用 Provider: ${provider}\n`);

  const client = await createPromptsClient();

  try {
    // 使用 code-review Prompt
    console.log("📋 使用 code-review 模板审查代码:\n");

    const reviewPrompt = await client.getPrompt({
      name: "code-review",
      arguments: {
        code: `async function fetchData(url) {
  const res = await fetch(url);
  const data = res.json();
  return data;
}

function processItems(items) {
  let result = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].active == true) {
      result.push(items[i].name);
    }
  }
  return result;
}`,
        language: "TypeScript",
      },
    });

    // 将 MCP Prompt 转换为 AI SDK 消息格式
    const messages = reviewPrompt.messages.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content.type === "text" ? msg.content.text : "",
    }));

    const result = await generateText({
      model: getModel(provider),
      messages,
      maxOutputTokens: 1000,
    });

    console.log("🤖 LLM 审查结果:");
    console.log(result.text);
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
  console.log("🚀 MCP Prompts 深入 Demo\n");
  console.log("=".repeat(60));
  console.log();

  demo1_concepts();

  console.log("=".repeat(60));
  console.log();

  await demo2_listAndGet();

  console.log("\n" + "=".repeat(60));
  console.log();

  await demo3_promptWithLLM();

  console.log("\n" + "=".repeat(60));
  console.log("✅ MCP Prompts Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("mcp-prompts.ts");

if (isMainModule) {
  main().catch(console.error);
}
