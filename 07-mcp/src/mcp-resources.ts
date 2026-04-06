/**
 * mcp-resources.ts — MCP Resources 深入
 *
 * 本文件深入讲解 MCP 三大原语之一 ——  Resources（资源）。
 *
 * Demo 1: [概念] Resources 是什么、三种资源类型、与 Tools 的核心区别
 * Demo 2: [实操] listResources → readResource（静态资源）
 * Demo 3: [实操] listResourceTemplates → readResource（动态模板资源）
 *
 * 核心知识点：
 *
 * 1. Resources vs Tools —— 最关键的区别是"谁来决定调用"：
 *
 *    Tools:     LLM 在推理时自己决定 "我需要调 calculator"  → LLM 主导
 *    Resources: 应用代码/用户预先选择 "把这份文档喂给 LLM"   → 人/应用主导
 *
 *    具体流程对比：
 *    ┌─────── Tools（LLM 主导）───────┐   ┌─────── Resources（人/应用主导）──┐
 *    │ 1. 把 tool 列表传给 LLM        │   │ 1. 应用/用户选择读取某个 Resource │
 *    │ 2. LLM 推理时自主决定要不要调用 │   │ 2. readResource 获取内容         │
 *    │ 3. 返回 function_call          │   │ 3. 把内容拼入 prompt 当上下文    │
 *    │ 4. 框架执行 callTool           │   │ 4. 再把 prompt 发给 LLM         │
 *    └────────────────────────────────┘   └────────────────────────────────┘
 *
 *    代码示例：
 *    // Tools — LLM 自动调用:
 *    generateText({ model, tools: { calc: mcpTool }, prompt: "算 17*23" })
 *    // → LLM 自己判断需要计算器 → 自动 callTool
 *
 *    // Resources — 应用/用户预先注入:
 *    const doc = await client.readResource({ uri: "file:///README.md" }) // 你决定读这个
 *    generateText({ model, system: `参考：${doc.text}`, prompt: "项目支持哪些模型？" })
 *    // → LLM 不知道 Resource 的存在，它只看到你喂的文本
 *
 * 2. 三种资源类型：
 *    - 静态资源: URI 固定（info://project），listResources() 发现
 *    - 动态资源: URI 含模板变量（file:///{path}），listResourceTemplates() 发现
 *    - 两者的 readResource() 调用方式完全一样，只是 URI 不同
 *
 * 3. 在 Claude Desktop 等 Host 中的体现：
 *    - Resources 通常显示为可勾选的"附件"列表，用户手动选择要注入哪些
 *    - Tools 显示为 LLM 可自动调用的"能力"，用户无需手动触发
 *
 * 运行: npm run mcp-resources（无需 API Key）
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ============================================================
// 辅助: 创建连接到 resources-server 的 Client
// ============================================================

/**
 * 复用的工厂函数：spawn resources-server 子进程并建立连接
 * 每个 Demo 都调用此函数获取独立的 Client（避免共享状态）
 */
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

/**
 * Demo 1: 概念输出
 *
 * 重点解释 Resources 与 Tools 的"控制方"区别：
 * - Tools 的控制方是 LLM（它在推理中自主决定何时调用）
 * - Resources 的控制方是应用/用户（由代码或人预先选择要读哪些资源，注入给 LLM）
 * - LLM 本身看不到 Resource，只能看到你读出来拼进 prompt 的文本
 */
function demo1_concepts() {
  console.log("📖 Demo 1: MCP Resources 概念\n");

  console.log("📂 Resources 是 MCP Server 向 Client 暴露的数据/文件");
  console.log("   类似 REST API 的 GET 端点，但使用 URI 寻址\n");

  console.log("   资源类型:");
  console.log("   • 静态资源 — 固定内容（项目说明、配置），listResources() 发现");
  console.log("   • 动态资源 — URI 含模板变量，listResourceTemplates() 发现");
  console.log("   • 两者的 readResource({ uri }) 调用方式完全一样");
  console.log();

  console.log("   URI 格式示例:");
  console.log("   • info://project        — 自定义协议（静态）");
  console.log("   • config://app          — 应用配置（静态）");
  console.log("   • file:///{path}        — 模板变量（动态，客户端填入 path）");
  console.log();

  console.log("   与 Tools 的核心区别 —— 谁来决定调用？");
  console.log("   ┌──────────┬──────────────────┬─────────────────┐");
  console.log("   │          │ Resources         │ Tools           │");
  console.log("   ├──────────┼──────────────────┼─────────────────┤");
  console.log("   │ 用途     │ 提供数据/上下文   │ 执行操作/计算    │");
  console.log("   │ 类比     │ GET 请求          │ POST 请求       │");
  console.log("   │ 控制方   │ 应用/用户选择     │ LLM 自主决定    │");
  console.log("   │          │ 预先注入 prompt   │ 推理时自动调用   │");
  console.log("   │ LLM 感知 │ ❌ 不知道来源     │ ✅ 知道有哪些Tool│");
  console.log("   └──────────┴──────────────────┴─────────────────┘");
  console.log();

  console.log("   💡 通俗理解:");
  console.log("   • Tools  = 给 LLM 的「工具箱」— LLM 自己拿工具用");
  console.log("   • Resources = 给应用的「资料库」— 你选资料喂给 LLM 当上下文");
  console.log();

  console.log("   📋 典型流程对比:");
  console.log("   Tools:     传 tool 列表给 LLM → LLM 推理时自动 callTool");
  console.log("   Resources: 应用 readResource → 拼入 prompt → 再发给 LLM");
  console.log();
}

// ============================================================
// Demo 2: 列出并读取所有静态资源
// ============================================================

/**
 * Demo 2: 演示静态资源的发现和读取
 *
 * 流程：listResources() → 遍历 → readResource({ uri })
 *
 * listResources() 只返回静态资源（URI 固定的），
 * 动态模板资源需要用 listResourceTemplates() 发现（见 Demo 3）。
 *
 * readResource 返回值: { contents: [{ uri, mimeType, text }] }
 * - mimeType 标识内容类型（text/plain, application/json, text/markdown）
 * - text 是实际内容字符串
 */
async function demo2_listAndRead() {
  console.log("📂 Demo 2: 列出并读取 Resources\n");

  const client = await createResourcesClient();

  try {
    /**
     * listResources(): 发现所有静态资源
     * 返回的每个 resource 包含 name（显示名）和 uri（资源地址）
     */
    const { resources } = await client.listResources();
    console.log(`发现 ${resources.length} 个静态资源:\n`);

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
      // 跳过模板资源（URI 包含 {}）— 正常情况下 listResources 不会返回模板资源
      if (res.uri.includes("{")) continue;

      console.log(`--- ${res.name} (${res.uri}) ---`);
      /**
       * readResource({ uri }): 通过 URI 读取资源内容
       * 静态资源和动态资源的调用方式完全相同，区别只是 URI 的来源不同
       */
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

/**
 * Demo 3: 演示动态模板资源的发现和读取
 *
 * 动态资源与静态资源的区别：
 * - 注册方式: server.resource("name", new ResourceTemplate("file:///{path}", ...), callback)
 * - 发现方式: listResourceTemplates()（不是 listResources()）
 * - 调用方式: readResource({ uri }) — 与静态完全相同，只是 URI 由客户端根据模板拼出
 *
 * 模板 URI 遵循 RFC 6570 规范，如 "file:///{path}"
 * 客户端将 {path} 替换为实际值: "file:///package.json"
 */
async function demo3_dynamicResource() {
  console.log("📂 Demo 3: 动态资源 — 文件读取\n");

  const client = await createResourcesClient();

  try {
    /**
     * listResourceTemplates(): 发现动态模板资源
     * 与 listResources() 互补 — 前者返回静态资源，后者返回模板资源
     * 模板资源的 uriTemplate 包含占位符（如 {path}），客户端需替换后使用
     */
    const { resourceTemplates } = await client.listResourceTemplates();
    console.log(`发现 ${resourceTemplates.length} 个资源模板:\n`);
    for (const tpl of resourceTemplates) {
      console.log(`📋 ${tpl.name}`);
      console.log(`   URI 模板: ${tpl.uriTemplate}`);
      if (tpl.description) console.log(`   描述: ${tpl.description}`);
      console.log();
    }

    // 通过模板读取文件 — 将 {path} 替换为 "package.json"
    console.log("-".repeat(40));
    console.log("📖 通过模板读取 package.json:\n");

    /**
     * readResource 的调用方式与静态资源完全一样：传 { uri }
     * 唯一区别是 URI 由客户端根据模板自行拼出
     * Server 端根据 URI 匹配到模板后，提取变量执行回调
     */
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

/**
 * 按顺序执行三个 Demo：
 * 1. 概念讲解 — Resources 与 Tools 的控制方区别
 * 2. 静态资源 — listResources → readResource
 * 3. 动态资源 — listResourceTemplates → readResource（URI 模板）
 *
 * 无需 API Key，演示的是 MCP 资源机制本身。
 */
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
