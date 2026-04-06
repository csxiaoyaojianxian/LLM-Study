/**
 * mcp-resources.ts — MCP Resources 深入
 *
 * Demo 1: 静态 Resource（项目说明、配置信息）
 * Demo 2: 动态 Resource（读取文件系统）
 * Demo 3: Client listResources → readResource
 *
 * 运行: npm run mcp-resources
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ============================================================
// 辅助: 创建连接到 resources-server 的 Client
// ============================================================

async function createResourcesClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/servers/resources-server.ts"],
  });

  const client = new Client({
    name: "resources-demo-client",
    version: "1.0.0",
  });

  await client.connect(transport);
  return client;
}

// ============================================================
// Demo 1: Resources 概念讲解
// ============================================================

function demo1_concepts() {
  console.log("📖 Demo 1: MCP Resources 概念\n");

  console.log("📂 Resources 是 MCP Server 向 Client 暴露的数据/文件");
  console.log("   类似 REST API 的 GET 端点，但使用 URI 寻址\n");

  console.log("   资源类型:");
  console.log("   • 静态资源 — 固定内容（项目说明、配置）");
  console.log("   • 动态资源 — 运行时生成（文件内容、数据库查询）");
  console.log("   • 模板资源 — URI 包含参数（file:///{path}）");
  console.log();

  console.log("   URI 格式示例:");
  console.log("   • info://project        — 自定义协议");
  console.log("   • config://app          — 应用配置");
  console.log("   • file:///src/index.ts   — 文件路径");
  console.log();

  console.log("   与 Tools 的区别:");
  console.log("   ┌──────────┬──────────────────┬─────────────────┐");
  console.log("   │          │ Resources         │ Tools           │");
  console.log("   ├──────────┼──────────────────┼─────────────────┤");
  console.log("   │ 方向     │ Server → Client   │ Client → Server │");
  console.log("   │ 用途     │ 提供数据/上下文   │ 执行操作/计算    │");
  console.log("   │ 类比     │ GET 请求          │ POST 请求       │");
  console.log("   │ 控制方   │ 用户/应用选择     │ LLM 自动调用    │");
  console.log("   └──────────┴──────────────────┴─────────────────┘");
  console.log();
}

// ============================================================
// Demo 2: 列出并读取所有资源
// ============================================================

async function demo2_listAndRead() {
  console.log("📂 Demo 2: 列出并读取 Resources\n");

  const client = await createResourcesClient();

  try {
    // 列出所有资源
    const { resources } = await client.listResources();
    console.log(`发现 ${resources.length} 个资源:\n`);

    for (const res of resources) {
      console.log(`📦 ${res.name}`);
      console.log(`   URI: ${res.uri}`);
      if (res.description) console.log(`   描述: ${res.description}`);
      console.log();
    }

    // 读取每个静态资源
    console.log("-".repeat(40));
    console.log("📖 读取静态资源内容:\n");

    for (const res of resources) {
      // 跳过模板资源（URI 包含 {}）
      if (res.uri.includes("{")) continue;

      console.log(`--- ${res.name} (${res.uri}) ---`);
      const result = await client.readResource({ uri: res.uri });

      for (const content of result.contents) {
        if ("text" in content) {
          const text = content.text;
          // 格式化输出
          if (content.mimeType === "application/json") {
            console.log(text);
          } else {
            console.log(text);
          }
        }
      }
      console.log();
    }
  } finally {
    await client.close();
  }
}

// ============================================================
// Demo 3: 动态资源 — 读取文件
// ============================================================

async function demo3_dynamicResource() {
  console.log("📂 Demo 3: 动态资源 — 文件读取\n");

  const client = await createResourcesClient();

  try {
    // 列出资源模板
    const { resourceTemplates } = await client.listResourceTemplates();
    console.log(`发现 ${resourceTemplates.length} 个资源模板:\n`);
    for (const tpl of resourceTemplates) {
      console.log(`📋 ${tpl.name}`);
      console.log(`   URI 模板: ${tpl.uriTemplate}`);
      if (tpl.description) console.log(`   描述: ${tpl.description}`);
      console.log();
    }

    // 通过模板读取文件
    console.log("-".repeat(40));
    console.log("📖 通过模板读取 package.json:\n");

    const result = await client.readResource({
      uri: "file:///package.json",
    });

    for (const content of result.contents) {
      if ("text" in content) {
        console.log(`MIME 类型: ${content.mimeType}`);
        console.log("内容:");
        // 只显示前 20 行
        const lines = content.text.split("\n");
        const preview = lines.slice(0, 20);
        console.log(preview.join("\n"));
        if (lines.length > 20) {
          console.log(`... (共 ${lines.length} 行)`);
        }
      }
    }
  } finally {
    await client.close();
  }
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 MCP Resources 深入 Demo\n");
  console.log("=".repeat(60));
  console.log();

  demo1_concepts();

  console.log("=".repeat(60));
  console.log();

  await demo2_listAndRead();

  console.log("=".repeat(60));
  console.log();

  await demo3_dynamicResource();

  console.log("\n" + "=".repeat(60));
  console.log("✅ MCP Resources Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("mcp-resources.ts");

if (isMainModule) {
  main().catch(console.error);
}
