/**
 * mcp-basics.ts — MCP 核心概念
 *
 * 本文件是 MCP 模块的入门文件，由浅入深分为 3 个 Demo：
 *
 * Demo 1: [纯概念] MCP 架构图（Host/Client/Server 三层）+ 传统 API vs MCP 协议对比
 * Demo 2: [实操]   最小 MCP 交互 — Client spawn Server 子进程，listTools → callTool
 * Demo 3: [实操]   完整生命周期 — initialize → listResources → readResource → close
 *
 * 核心知识点：
 * - MCP (Model Context Protocol) 是 Anthropic 提出的开放协议，让 LLM 标准化连接外部能力
 * - 三大原语：Tools（LLM 调用函数）、Resources（LLM 读取数据）、Prompts（参数化模板）
 * - 传输层基于 stdio（子进程模式）或 SSE（HTTP 模式），底层使用 JSON-RPC 2.0
 * - Client 无需预先知道 Server 能力，通过 listTools/listResources 自动发现
 *
 * 运行: npm run mcp-basics（无需 API Key）
 */

// ============================================================
// 依赖导入
// ============================================================

/**
 * MCP SDK 分为 client 和 server 两个子包：
 * - Client: 连接 Server、发现能力、调用工具/读取资源
 * - StdioClientTransport: 通过 spawn 子进程建立 stdio 通道
 *
 * Server 端（McpServer / StdioServerTransport）在本文件中不直接使用，
 * 它们在 src/servers/ 下的独立 Server 文件中使用，见 tools-server.ts / resources-server.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ============================================================
// Demo 1: MCP 核心概念
// ============================================================

/**
 * Demo 1: 纯概念输出，帮助建立 MCP 的心智模型
 *
 * MCP 三层架构：
 *   Host（宿主应用，如 Claude Desktop、VS Code、自定义应用）
 *     └── Client（MCP 客户端，Host 内部组件，一个 Host 可有多个 Client）
 *           └── Server（MCP 服务端，独立进程，暴露 Tools/Resources/Prompts）
 *
 * 与传统 API 的核心区别：
 *   - 传统方式：每个 API 手动写对接代码、读文档、处理认证
 *   - MCP 方式：统一协议，Client 连上 Server 后自动发现能力（listTools），即插即用
 */
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

/**
 * Demo 2: 最小 MCP 交互示例
 *
 * 核心流程：
 *   1. Client 通过 StdioClientTransport spawn 一个 Server 子进程
 *   2. connect() 自动完成 initialize 握手（协议版本协商 + 能力声明）
 *   3. listTools() 发现 Server 注册了哪些工具 — 这就是"自动发现"
 *   4. callTool() 传入工具名 + 参数，获取结果
 *   5. close() 断开连接，终止子进程
 *
 * 关键理解：
 * - MCP 通信走 stdio（标准输入输出），不是 HTTP！
 *   Client spawn 子进程运行 Server，通过 stdin/stdout 交换 JSON-RPC 消息
 *   这意味着 MCP Server 可以用任何语言实现——只要能读写 stdio
 * - 返回值统一格式: { content: [{ type: "text", text: "..." }] }
 * - Server 端用 Zod schema 定义参数，和 AI SDK 的 tool 定义一致
 *
 * 对应的 Server 代码见: src/servers/tools-server.ts
 *   server.tool("calculator", "描述", { 参数schema }, async (args) => { 处理逻辑 })
 */
async function demo2_minimalExample() {
  console.log("🔧 Demo 2: 最小 MCP 交互示例\n");

  console.log("💡 MCP 的最小交互流程:");
  console.log("   Client —[initialize]→ Server");
  console.log("   Client —[listTools]→ Server  (发现能力)");
  console.log("   Client —[callTool]→ Server   (调用工具)");
  console.log("   Client —[close]→ Server      (断开连接)");
  console.log();

  /**
   * StdioClientTransport: 创建 stdio 传输通道
   * 内部会 spawn 子进程执行指定的命令（这里是 tools-server.ts）
   * Client 通过子进程的 stdin 发送请求，从 stdout 接收响应
   * 这就是为什么 Server 端的日志要用 console.error（stderr）而非 console.log（stdout）
   */
  console.log("📡 启动 tools-server 作为子进程...");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/servers/tools-server.ts"],
  });

  /**
   * 创建 MCP Client 实例
   * name/version 用于 initialize 握手时向 Server 自我介绍
   */
  const client = new Client({
    name: "basics-demo-client",
    version: "1.0.0",
  });

  try {
    /**
     * connect() 背后自动完成 initialize 握手：
     * Client → Server: { method: "initialize", params: { clientInfo, capabilities } }
     * Server → Client: { result: { serverInfo, capabilities } }
     * Client → Server: { method: "initialized" }  // 确认完成
     */
    await client.connect(transport);
    console.log("✅ 连接成功！\n");

    /**
     * listTools(): 自动发现 Server 注册的所有工具
     * 返回每个 tool 的 name、description、inputSchema（JSON Schema 格式的参数定义）
     * LLM 正是通过这些信息来理解何时以及如何调用工具的
     */
    console.log("📋 Step 1: 列出所有可用工具 (listTools)");
    const { tools } = await client.listTools();
    console.log(`   发现 ${tools.length} 个工具:`);
    for (const tool of tools) {
      console.log(`   • ${tool.name} — ${tool.description}`);
    }
    console.log();

    /**
     * callTool(): 调用具体工具
     * 传入工具名 + 参数对象（需符合该工具的 inputSchema）
     * 返回统一格式: { content: [{ type: "text"|"image"|"resource", ... }] }
     */
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

    // 关闭连接，终止 Server 子进程
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

/**
 * Demo 3: 完整生命周期演示
 *
 * 本 Demo 连接 resources-server，演示 MCP 的另一大能力 —— Resources（资源）
 *
 * Resources vs Tools 的区别：
 *   ┌──────────┬──────────────────────┬──────────────────────┐
 *   │          │ Tools                │ Resources            │
 *   ├──────────┼──────────────────────┼──────────────────────┤
 *   │ 方向     │ LLM 主动调用          │ LLM 被动读取          │
 *   │ 类比     │ 函数调用              │ 文件/数据库读取        │
 *   │ 用途     │ 执行操作（计算/搜索）  │ 提供上下文（文档/配置） │
 *   └──────────┴──────────────────────┴──────────────────────┘
 *
 * resources-server.ts 中注册了三种资源：
 *   1. 静态资源 info://project — 固定的项目描述文本
 *   2. 静态资源 config://app   — JSON 格式的配置信息
 *   3. 动态资源 file:///{path} — 模板 URI，根据路径参数动态读取文件（带安全检查）
 *
 * 对应的 Server 代码见: src/servers/resources-server.ts
 *   server.resource("名称", "URI模式", async (uri) => ({ contents: [...] }))
 */
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

  // 实际演示：连接 resources-server（与 Demo 2 类似的 spawn 方式）
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
    // Step 1: initialize — 自动协议握手
    await client.connect(transport);
    console.log("✅ 1/7 initialize — 连接建立");

    /**
     * listResources(): 发现 Server 暴露的所有资源
     * 每个 resource 有 name（显示名）和 uri（资源地址，如 info://project）
     * 动态资源使用 URI 模板（如 file:///{path}），需客户端填入参数
     */
    const { resources } = await client.listResources();
    console.log(`✅ 2/7 listResources — 发现 ${resources.length} 个资源:`);
    for (const res of resources) {
      console.log(`   • ${res.name} (${res.uri})`);
    }

    /**
     * readResource(): 通过 URI 读取具体资源内容
     * 返回 { contents: [{ uri, mimeType, text }] }
     * 支持多种 mimeType: text/plain, application/json, text/markdown 等
     *
     * 三种资源的调用方式完全一样，都是传 { uri }，只是 URI scheme 不同：
     *   - info://project   — 静态资源，返回纯文本
     *   - config://app     — 静态资源，返回 JSON
     *   - file:///xxx      — 动态资源（URI 模板），路径部分由客户端填入
     */

    // --- 读取静态资源 1: info://project（纯文本） ---
    const projectInfo = await client.readResource({ uri: "info://project" });
    console.log("\n✅ 3/7 readResource — 读取 info://project (text/plain):");
    const content = projectInfo.contents[0];
    if ("text" in content) {
      console.log(content.text.split("\n").map(l => `   ${l}`).join("\n"));
    }

    // --- 读取静态资源 2: config://app（JSON 格式） ---
    const configInfo = await client.readResource({ uri: "config://app" });
    console.log("\n✅ 4/7 readResource — 读取 config://app (application/json):");
    const configContent = configInfo.contents[0];
    if ("text" in configContent) {
      // Server 返回的 mimeType 是 application/json，内容是 JSON 字符串
      const json = JSON.parse(configContent.text);
      console.log(`   默认 Provider: ${json.defaultProvider}`);
      console.log(`   支持的 Providers: ${json.supportedProviders.join(", ")}`);
      console.log(`   模块数: ${json.modules.length} 个`);
    }

    // --- 读取动态资源 3: file:///package.json（URI 模板，路径由客户端传入） ---
    /**
     * 动态资源（URI 中含 {占位符}）不在 listResources() 结果中，
     * 需要通过 listResourceTemplates() 发现模板，客户端自行替换占位符拼出完整 URI。
     *
     * 模板: file:///{path}  →  实际 URI: file:///package.json
     *
     * 这体现了 MCP 资源的两种模式：
     *   - 静态资源（listResources）— URI 固定，如 info://project
     *   - 动态资源（listResourceTemplates）— URI 含模板变量，如 file:///{path}
     */
    const { resourceTemplates } = await client.listResourceTemplates();
    console.log(`\n✅ 5/7 listResourceTemplates — 发现 ${resourceTemplates.length} 个资源模板:`);
    for (const tmpl of resourceTemplates) {
      console.log(`   • ${tmpl.name} (${tmpl.uriTemplate})`);
    }

    // 客户端将模板中的 {path} 替换为实际路径
    const fileInfo = await client.readResource({ uri: "file:///package.json" });
    console.log("\n✅ 6/7 readResource — 读取 file:///package.json (动态资源):");
    const fileContent = fileInfo.contents[0];
    if ("text" in fileContent) {
      const pkg = JSON.parse(fileContent.text);
      console.log(`   项目名: ${pkg.name}`);
      console.log(`   版本: ${pkg.version}`);
      console.log(`   脚本数: ${Object.keys(pkg.scripts || {}).length} 个`);
    }

    // Step 7: close — 断开连接
    await client.close();
    console.log("\n✅ 7/7 close — 连接关闭");
  } catch (error) {
    console.error(`❌ 错误: ${(error as Error).message}`);
    await client.close();
  }
}

// ============================================================
// 主入口
// ============================================================

/**
 * 按顺序执行三个 Demo：
 * 1. 概念讲解（纯打印，无需任何服务）
 * 2. 最小交互（spawn tools-server 子进程）
 * 3. 生命周期（spawn resources-server 子进程）
 *
 * 整个文件无需 API Key，演示的是 MCP 协议本身的机制。
 * LLM 集成（让 LLM 自动调用 MCP Tools）见 mcp-tools.ts。
 */
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

/**
 * CLI 入口检测：判断是否直接运行本文件
 * 如果是 import 引用则不执行 main()，如果是 `tsx src/mcp-basics.ts` 则执行
 */
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("mcp-basics.ts");

if (isMainModule) {
  main().catch(console.error);
}
