/**
 * mcp-basics.ts — MCP 核心概念
 *
 * Demo 1: MCP 架构图（Host/Client/Server），对比传统 API vs MCP 协议
 * Demo 2: 最小 Server — 一个 hello tool，StdioClientTransport spawn 子进程测试
 * Demo 3: 完整生命周期 — initialize → listTools → callTool → close
 *
 * 运行: npm run mcp-basics
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ============================================================
// Demo 1: MCP 核心概念
// ============================================================

function demo1_concepts() {
  console.log("📖 Demo 1: MCP 核心概念\n");

  console.log("=".repeat(60));
  console.log("  MCP (Model Context Protocol) 架构");
  console.log("=".repeat(60));
  console.log(`
  ┌─────────────────────────────────────────────┐
  │                  Host                        │
  │  (Claude Desktop / IDE / 自定义应用)          │
  │                                              │
  │   ┌──────────┐   ┌──────────┐               │
  │   │ MCP      │   │ MCP      │  ...          │
  │   │ Client A │   │ Client B │               │
  │   └────┬─────┘   └────┬─────┘               │
  └────────┼──────────────┼──────────────────────┘
           │              │
   ┌───────▼───────┐ ┌───▼───────────┐
   │ MCP Server A  │ │ MCP Server B  │
   │ (本地文件)     │ │ (数据库/API) │
   │               │ │               │
   │ • Resources   │ │ • Tools       │
   │ • Tools       │ │ • Prompts     │
   │ • Prompts     │ │ • Resources   │
   └───────────────┘ └───────────────┘
  `);

  console.log("📌 MCP 三大核心能力:");
  console.log("  1. 🔧 Tools    — 让 LLM 可调用的函数（类似 Function Calling）");
  console.log("  2. 📂 Resources — 向 LLM 暴露数据/文件（类似 RAG 的数据源）");
  console.log("  3. 📋 Prompts   — 可复用的提示模板（参数化 Prompt）");
  console.log();

  console.log("📌 传统 API vs MCP 对比:");
  console.log("  ┌──────────────┬──────────────────┬──────────────────┐");
  console.log("  │              │ 传统 REST API     │ MCP 协议          │");
  console.log("  ├──────────────┼──────────────────┼──────────────────┤");
  console.log("  │ 通信方式     │ HTTP 请求/响应    │ JSON-RPC over    │");
  console.log("  │              │                  │ stdio/SSE        │");
  console.log("  ├──────────────┼──────────────────┼──────────────────┤");
  console.log("  │ 发现机制     │ API 文档/Swagger  │ 自动能力发现      │");
  console.log("  │              │ 需手动对接        │ listTools 等     │");
  console.log("  ├──────────────┼──────────────────┼──────────────────┤");
  console.log("  │ 适配成本     │ 每个 API 单独对接 │ 统一协议，即插即用 │");
  console.log("  ├──────────────┼──────────────────┼──────────────────┤");
  console.log("  │ LLM 友好     │ 需自行包装       │ 原生支持工具调用   │");
  console.log("  └──────────────┴──────────────────┴──────────────────┘");
  console.log();
}

// ============================================================
// Demo 2: 最小 MCP Server + Client（进程内演示概念）
// ============================================================

async function demo2_minimalExample() {
  console.log("🔧 Demo 2: 最小 MCP 交互示例\n");

  console.log("💡 MCP 的最小交互流程:");
  console.log("   Client —[initialize]→ Server");
  console.log("   Client —[listTools]→ Server  (发现能力)");
  console.log("   Client —[callTool]→ Server   (调用工具)");
  console.log("   Client —[close]→ Server      (断开连接)");
  console.log();

  // 使用 StdioClientTransport spawn tools-server 子进程
  console.log("📡 启动 tools-server 作为子进程...");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/servers/tools-server.ts"],
  });

  const client = new Client({
    name: "basics-demo-client",
    version: "1.0.0",
  });

  try {
    // 1. 连接（自动完成 initialize 握手）
    await client.connect(transport);
    console.log("✅ 连接成功！\n");

    // 2. 列出工具
    console.log("📋 Step 1: 列出所有可用工具 (listTools)");
    const { tools } = await client.listTools();
    console.log(`   发现 ${tools.length} 个工具:`);
    for (const tool of tools) {
      console.log(`   • ${tool.name} — ${tool.description}`);
    }
    console.log();

    // 3. 调用工具
    console.log("🔧 Step 2: 调用 calculator 工具 (callTool)");
    const calcResult = await client.callTool({
      name: "calculator",
      arguments: { operation: "multiply", a: 6, b: 7 },
    });
    console.log(`   请求: 6 × 7`);
    console.log(`   结果: ${(calcResult.content as Array<{ type: string; text: string }>)[0].text}`);
    console.log();

    console.log("🌤️ Step 3: 调用 get_weather 工具");
    const weatherResult = await client.callTool({
      name: "get_weather",
      arguments: { city: "北京" },
    });
    console.log(`   请求: 查询北京天气`);
    console.log(`   结果: ${(weatherResult.content as Array<{ type: string; text: string }>)[0].text}`);
    console.log();

    // 4. 关闭连接
    await client.close();
    console.log("🔌 连接已关闭\n");
  } catch (error) {
    console.error(`❌ 错误: ${(error as Error).message}`);
    await client.close();
  }
}

// ============================================================
// Demo 3: MCP 生命周期详解
// ============================================================

async function demo3_lifecycle() {
  console.log("🔄 Demo 3: MCP 完整生命周期\n");

  console.log("MCP 连接的完整生命周期:");
  console.log(`
  Client                          Server
    │                               │
    │──── initialize ──────────────→│  ← 协议版本协商 + 能力声明
    │←─── initializeResult ────────│
    │                               │
    │──── initialized ─────────────→│  ← 确认初始化完成
    │                               │
    │──── listTools ───────────────→│  ← 发现 Server 能力
    │←─── toolsList ───────────────│
    │                               │
    │──── callTool ────────────────→│  ← 调用具体工具
    │←─── toolResult ──────────────│
    │                               │
    │──── listResources ───────────→│  ← 发现可用资源
    │←─── resourcesList ───────────│
    │                               │
    │──── readResource ────────────→│  ← 读取资源内容
    │←─── resourceContent ─────────│
    │                               │
    │──── close ───────────────────→│  ← 断开连接
    │                               │
  `);

  // 实际演示：连接 resources-server
  console.log("📡 演示: 连接 resources-server 并读取资源...\n");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/servers/resources-server.ts"],
  });

  const client = new Client({
    name: "lifecycle-demo-client",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);
    console.log("✅ 1/4 initialize — 连接建立");

    const { resources } = await client.listResources();
    console.log(`✅ 2/4 listResources — 发现 ${resources.length} 个资源:`);
    for (const res of resources) {
      console.log(`   • ${res.name} (${res.uri})`);
    }

    // 读取项目信息资源
    const projectInfo = await client.readResource({ uri: "info://project" });
    console.log("\n✅ 3/4 readResource — 读取 info://project:");
    const content = projectInfo.contents[0];
    if ("text" in content) {
      console.log(content.text.split("\n").map(l => `   ${l}`).join("\n"));
    }

    await client.close();
    console.log("\n✅ 4/4 close — 连接关闭");
  } catch (error) {
    console.error(`❌ 错误: ${(error as Error).message}`);
    await client.close();
  }
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 MCP 核心概念 Demo\n");
  console.log("=".repeat(60));
  console.log();

  // Demo 1: 概念讲解（纯打印）
  demo1_concepts();

  console.log("=".repeat(60));
  console.log();

  // Demo 2: 最小交互
  await demo2_minimalExample();

  console.log("=".repeat(60));
  console.log();

  // Demo 3: 生命周期
  await demo3_lifecycle();

  console.log("\n" + "=".repeat(60));
  console.log("✅ MCP 核心概念 Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("mcp-basics.ts");

if (isMainModule) {
  main().catch(console.error);
}
