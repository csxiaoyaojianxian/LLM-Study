/**
 * mcp-client.ts — 通用 MCP Client 调试工具
 *
 * Demo 1: 连接管理 + 错误处理
 * Demo 2: Server 能力探测（一次列出全部 Tools/Resources/Prompts）
 *
 * 运行: npm run mcp-client
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ============================================================
// 通用 MCP Client 封装
// ============================================================

interface ServerConfig {
  name: string;
  command: string;
  args: string[];
}

/**
 * 通用 MCP Client — 连接任意 Server 并探测其能力
 */
class MCPClientDebugger {
  private client: Client | null = null;
  private serverName: string;

  constructor(private config: ServerConfig) {
    this.serverName = config.name;
  }

  /** 连接到 Server */
  async connect(): Promise<void> {
    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
    });

    this.client = new Client({
      name: "mcp-debugger",
      version: "1.0.0",
    });

    await this.client.connect(transport);
  }

  /** 断开连接 */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  /** 完整能力探测 */
  async inspect(): Promise<void> {
    if (!this.client) throw new Error("未连接到 Server");

    console.log(`\n🔍 探测 Server: ${this.serverName}`);
    console.log("=".repeat(50));

    // 探测 Tools
    try {
      const { tools } = await this.client.listTools();
      console.log(`\n🔧 Tools (${tools.length}):`);
      if (tools.length === 0) {
        console.log("   (无)");
      }
      for (const t of tools) {
        console.log(`   • ${t.name} — ${t.description || "(无描述)"}`);
        if (t.inputSchema && typeof t.inputSchema === "object" && "properties" in t.inputSchema) {
          const props = t.inputSchema.properties as Record<string, { type?: string; description?: string }>;
          for (const [key, val] of Object.entries(props)) {
            console.log(`     - ${key}: ${val.type || "any"} ${val.description ? `(${val.description})` : ""}`);
          }
        }
      }
    } catch {
      console.log("\n🔧 Tools: Server 不支持 Tools");
    }

    // 探测 Resources
    try {
      const { resources } = await this.client.listResources();
      console.log(`\n📂 Resources (${resources.length}):`);
      if (resources.length === 0) {
        console.log("   (无)");
      }
      for (const r of resources) {
        console.log(`   • ${r.name} — ${r.uri}`);
        if (r.description) console.log(`     ${r.description}`);
      }

      const { resourceTemplates } = await this.client.listResourceTemplates();
      if (resourceTemplates.length > 0) {
        console.log(`\n📋 Resource Templates (${resourceTemplates.length}):`);
        for (const t of resourceTemplates) {
          console.log(`   • ${t.name} — ${t.uriTemplate}`);
        }
      }
    } catch {
      console.log("\n📂 Resources: Server 不支持 Resources");
    }

    // 探测 Prompts
    try {
      const { prompts } = await this.client.listPrompts();
      console.log(`\n📋 Prompts (${prompts.length}):`);
      if (prompts.length === 0) {
        console.log("   (无)");
      }
      for (const p of prompts) {
        console.log(`   • ${p.name} — ${p.description || "(无描述)"}`);
        if (p.arguments) {
          for (const arg of p.arguments) {
            console.log(`     - ${arg.name} ${arg.required ? "(必填)" : "(可选)"}`);
          }
        }
      }
    } catch {
      console.log("\n📋 Prompts: Server 不支持 Prompts");
    }

    console.log();
  }
}

// ============================================================
// Demo 1: 连接管理与错误处理
// ============================================================

async function demo1_connectionManagement() {
  console.log("📡 Demo 1: 连接管理与错误处理\n");

  // 正常连接
  console.log("1️⃣ 正常连接 tools-server:");
  const debugger1 = new MCPClientDebugger({
    name: "tools-server",
    command: "npx",
    args: ["tsx", "src/servers/tools-server.ts"],
  });

  try {
    await debugger1.connect();
    console.log("   ✅ 连接成功");
    await debugger1.disconnect();
    console.log("   ✅ 断开成功\n");
  } catch (error) {
    console.log(`   ❌ 连接失败: ${(error as Error).message}\n`);
  }

  // 错误处理: 不存在的 Server
  console.log("2️⃣ 错误处理 — 连接不存在的 Server:");
  const debugger2 = new MCPClientDebugger({
    name: "nonexistent-server",
    command: "npx",
    args: ["tsx", "src/servers/nonexistent-server.ts"],
  });

  try {
    await debugger2.connect();
    console.log("   ✅ 连接成功（意外）");
    await debugger2.disconnect();
  } catch (error) {
    console.log(`   ✅ 正确捕获错误: ${(error as Error).message.substring(0, 80)}...`);
  }
  console.log();
}

// ============================================================
// Demo 2: 探测所有 Server 能力
// ============================================================

async function demo2_inspectAll() {
  console.log("🔍 Demo 2: Server 能力探测\n");

  const servers: ServerConfig[] = [
    { name: "tools-server", command: "npx", args: ["tsx", "src/servers/tools-server.ts"] },
    { name: "resources-server", command: "npx", args: ["tsx", "src/servers/resources-server.ts"] },
    { name: "prompts-server", command: "npx", args: ["tsx", "src/servers/prompts-server.ts"] },
    { name: "knowledge-server", command: "npx", args: ["tsx", "src/servers/knowledge-server.ts"] },
  ];

  for (const config of servers) {
    const debugger_ = new MCPClientDebugger(config);
    try {
      await debugger_.connect();
      await debugger_.inspect();
      await debugger_.disconnect();
    } catch (error) {
      console.log(`\n❌ ${config.name}: ${(error as Error).message}\n`);
    }
  }
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 MCP Client 调试工具 Demo\n");
  console.log("=".repeat(60));
  console.log();

  await demo1_connectionManagement();

  console.log("=".repeat(60));
  console.log();

  await demo2_inspectAll();

  console.log("=".repeat(60));
  console.log("✅ MCP Client 调试 Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("mcp-client.ts");

if (isMainModule) {
  main().catch(console.error);
}
