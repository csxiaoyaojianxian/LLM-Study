/**
 * mcp-tools.ts — MCP Tools 深入
 *
 * Demo 1: 多工具注册 — 展示 tools-server 的工具
 * Demo 2: Client 调用 — listTools → callTool
 * Demo 3: LLM + MCP Tools — 让 LLM 决定调哪个 Tool
 *
 * 运行: npm run mcp-tools
 */

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { generateText, tool, stepCountIs, zodSchema } from "ai";
import { z } from "zod";
import { getModel, getDefaultProvider, getAvailableProviders } from "./model-adapter.js";

// ============================================================
// 辅助: 创建连接到 tools-server 的 Client
// ============================================================

async function createToolsClient(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/servers/tools-server.ts"],
  });

  const client = new Client({
    name: "tools-demo-client",
    version: "1.0.0",
  });

  await client.connect(transport);
  return client;
}

// ============================================================
// Demo 1: 多工具注册与发现
// ============================================================

async function demo1_toolDiscovery() {
  console.log("📖 Demo 1: MCP Tools 发现与详情\n");

  const client = await createToolsClient();

  try {
    const { tools } = await client.listTools();

    console.log(`发现 ${tools.length} 个工具:\n`);

    for (const t of tools) {
      console.log(`🔧 ${t.name}`);
      console.log(`   描述: ${t.description}`);
      console.log(`   参数 Schema:`);
      console.log(`   ${JSON.stringify(t.inputSchema, null, 2).split("\n").join("\n   ")}`);
      console.log();
    }
  } finally {
    await client.close();
  }
}

// ============================================================
// Demo 2: Client 调用工具
// ============================================================

async function demo2_toolCalls() {
  console.log("🔧 Demo 2: Client 直接调用 MCP Tools\n");

  const client = await createToolsClient();

  try {
    // 调用计算器
    console.log("1️⃣ 计算器: 123 + 456");
    const calcResult = await client.callTool({
      name: "calculator",
      arguments: { operation: "add", a: 123, b: 456 },
    });
    console.log(`   → ${(calcResult.content as Array<{ text: string }>)[0].text}\n`);

    // 调用天气
    console.log("2️⃣ 天气查询: 上海");
    const weatherResult = await client.callTool({
      name: "get_weather",
      arguments: { city: "上海" },
    });
    console.log(`   → ${(weatherResult.content as Array<{ text: string }>)[0].text}\n`);

    // 调用翻译
    console.log("3️⃣ 翻译: hello → 中文");
    const translateResult = await client.callTool({
      name: "translate",
      arguments: { text: "hello", targetLang: "zh" },
    });
    console.log(`   → ${(translateResult.content as Array<{ text: string }>)[0].text}\n`);

    // 错误处理: 除以零
    console.log("4️⃣ 错误处理: 10 ÷ 0");
    const errorResult = await client.callTool({
      name: "calculator",
      arguments: { operation: "divide", a: 10, b: 0 },
    });
    console.log(`   → ${(errorResult.content as Array<{ text: string }>)[0].text}\n`);
  } finally {
    await client.close();
  }
}

// ============================================================
// Demo 3: LLM + MCP Tools（让 LLM 自动选择工具）
// ============================================================

async function demo3_llmWithTools() {
  console.log("🤖 Demo 3: LLM + MCP Tools（自动工具选择）\n");

  const available = getAvailableProviders();
  if (available.length === 0) {
    console.log("⚠️ 未配置 API Key，跳过 LLM 集成 Demo");
    console.log("   请在 .env 中配置至少一个 API Key\n");
    return;
  }

  const provider = getDefaultProvider();
  console.log(`📡 使用 Provider: ${provider}\n`);

  // 连接 MCP Server 获取工具列表
  const client = await createToolsClient();

  try {
    const { tools: mcpTools } = await client.listTools();

    // 将 MCP Tools 转换为 Vercel AI SDK 的 tool 格式
    // 这里我们手动创建对应的 AI SDK tools，让 LLM 调用后再转发给 MCP Server
    const aiTools = {
      calculator: tool({
        description: "执行基础数学运算（加减乘除）",
        inputSchema: zodSchema(z.object({
          operation: z.enum(["add", "subtract", "multiply", "divide"]),
          a: z.number(),
          b: z.number(),
        })),
        execute: async (args: { operation: string; a: number; b: number }) => {
          const result = await client.callTool({
            name: "calculator",
            arguments: args,
          });
          return (result.content as Array<{ text: string }>)[0].text;
        },
      }),
      get_weather: tool({
        description: "查询指定城市的天气信息",
        inputSchema: zodSchema(z.object({
          city: z.string(),
        })),
        execute: async (args: { city: string }) => {
          const result = await client.callTool({
            name: "get_weather",
            arguments: args,
          });
          return (result.content as Array<{ text: string }>)[0].text;
        },
      }),
      translate: tool({
        description: "简单的中英互译",
        inputSchema: zodSchema(z.object({
          text: z.string(),
          targetLang: z.enum(["zh", "en"]),
        })),
        execute: async (args: { text: string; targetLang: string }) => {
          const result = await client.callTool({
            name: "translate",
            arguments: args,
          });
          return (result.content as Array<{ text: string }>)[0].text;
        },
      }),
    };

    // 测试用例
    const testQuestions = [
      "请帮我计算 99 乘以 88 等于多少？",
      "深圳今天天气怎么样？",
      "帮我把 'thank you' 翻译成中文",
    ];

    for (const question of testQuestions) {
      console.log(`❓ 用户: ${question}`);

      try {
        const result = await generateText({
          model: getModel(provider),
          tools: aiTools,
          stopWhen: stepCountIs(3),
          messages: [{ role: "user", content: question }],
          system: "你是一个有用的助手。根据用户问题选择合适的工具来回答。请用中文回答。",
        });

        console.log(`🤖 回答: ${result.text}`);

        if (result.steps) {
          for (const step of result.steps) {
            if (step.toolCalls?.length) {
              for (const tc of step.toolCalls) {
                console.log(`   🔧 调用工具: ${tc.toolName}(${JSON.stringify((tc as Record<string, unknown>).input || (tc as Record<string, unknown>).args)})`);
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️ 调用失败: ${(error as Error).message}`);
      }
      console.log();
    }
  } finally {
    await client.close();
  }
}

// ============================================================
// 主入口
// ============================================================

async function main() {
  console.log("🚀 MCP Tools 深入 Demo\n");
  console.log("=".repeat(60));
  console.log();

  await demo1_toolDiscovery();

  console.log("=".repeat(60));
  console.log();

  await demo2_toolCalls();

  console.log("=".repeat(60));
  console.log();

  await demo3_llmWithTools();

  console.log("=".repeat(60));
  console.log("✅ MCP Tools Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("mcp-tools.ts");

if (isMainModule) {
  main().catch(console.error);
}
