# AI应用开发实践系列(第7期)—MCP协议与工具集成

本系列面向传统web应用开发者，聚焦AI应用开发的实战技能。
本期带你从零理解和实现 MCP（Model Context Protocol）——AI 工具生态的"USB 接口"，让你的 AI 应用即插即用地连接任何外部能力。
技术栈：TypeScript / Node.js / MCP SDK / Vercel AI SDK
源代码：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/07-mcp](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/07-mcp)

> 📚 **系列导航（共8期）**
>
> [第1期 — 从零构建智能聊天应用](./AI应用开发实践系列(第1期)—从零构建智能聊天应用.md)
> [第2期 — Prompt工程与模板化](./AI应用开发实践系列(第2期)—Prompt工程与模板化.md)
> [第3期 — RAG检索增强生成](./AI应用开发实践系列(第3期)—RAG检索增强生成.md)
> [第4期 — LangChain应用框架](./AI应用开发实践系列(第4期)—LangChain应用框架.md)
> [第5期 — AI Agent智能体](./AI应用开发实践系列(第5期)—AI Agent智能体.md)
> [第6期 — 多模态与语音交互](./AI应用开发实践系列(第6期)—多模态与语音交互.md)
> **第7期 — MCP协议与工具集成** 👈 当前
> [第8期 — Claude Code Skills定制体系](./AI应用开发实践系列(第8期)—Claude%20Code%20Skills定制体系.md)

## 一、MCP 是什么

### 1.1 问题：AI 工具集成的"万国插头"困境

回顾本系列前面的内容，我们已经学会了用 Function Calling 让 AI 调用外部工具（第1期），用 RAG 让 AI 访问私有知识库（第3期），用 Agent 让 AI 自主规划任务（第5期）。

但你有没有发现一个问题？**每接入一个新工具，都需要手动对接**：

- 接天气 API → 写一套对接代码
- 接数据库查询 → 再写一套
- 接文件系统 → 又写一套
- 换一个 AI 应用 → 以上全部重写...

这就像早期的手机充电器——每个品牌一种接口，出门得带一堆线。

```
❌ 传统方式：每个工具单独对接

  ┌────────┐     自定义代码     ┌──────────┐
  │ AI App │────────────────→│ 天气 API  │
  │        │────────────────→│ 数据库    │
  │        │────────────────→│ 文件系统  │
  │        │────────────────→│ 搜索引擎  │
  └────────┘   每个都不一样     └──────────┘
```

### 1.2 MCP = AI 工具的"USB 接口"

2024 年底，Anthropic 提出了 **MCP（Model Context Protocol，模型上下文协议）**——一个开放标准，旨在统一 AI 应用与外部工具/数据源的连接方式。

**一句话理解：USB 之于外设 = MCP 之于 AI 工具。**

```
✅ MCP 方式：统一协议，即插即用

  ┌────────┐                  ┌──────────────┐
  │ AI App │    MCP 协议      │ 天气 Server   │
  │        │◄═══════════════►│              │
  │        │    MCP 协议      │ 数据库 Server │
  │        │◄═══════════════►│              │
  │        │    MCP 协议      │ 文件 Server   │
  │        │◄═══════════════►│              │
  └────────┘  统一标准接口     └──────────────┘
```

这个类比非常准确：

| 对比维度 | USB | MCP |
| --- | --- | --- |
| 解决的问题 | 每个外设一种接口 | 每个 AI 工具一种对接方式 |
| 核心价值 | 插上就能用 | 连上就能用 |
| 标准化内容 | 物理接口 + 通信协议 | 传输协议 + 能力描述 |
| 发现机制 | 即插即识别设备类型 | 连接即发现 Tools/Resources |
| 谁在推动 | USB-IF 联盟 | Anthropic（开放标准） |

有了 MCP，工具开发者只需实现一次 MCP Server，就能被所有支持 MCP 的 AI 应用（Claude Desktop、VS Code Copilot、自定义应用）直接使用——真正的"写一次，到处用"。



## 二、MCP 架构

### 2.1 三层架构：Host / Client / Server

MCP 采用经典的三层架构，每一层各司其职：

```
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
   │ • Tools       │ │ • Tools       │
   │ • Resources   │ │ • Prompts     │
   │ • Prompts     │ │ • Resources   │
   └───────────────┘ └───────────────┘
```

三层角色的职责：

| 层 | 角色 | 类比 | 示例 |
| --- | --- | --- | --- |
| **Host** | 宿主应用 | 电脑主机 | Claude Desktop、VS Code、自定义 App |
| **Client** | 协议连接层 | USB 控制器 | Host 内部组件，1:1 对应一个 Server |
| **Server** | 能力提供方 | USB 外设 | 天气服务、数据库服务、知识库服务 |

关键理解：
- 一个 Host 可以有**多个 Client**，每个 Client 连接一个 Server
- Client 是 Host 的内部组件，开发者通常不需要单独实现
- Server 是独立进程/服务，可以用任何语言实现

### 2.2 通信方式

MCP 底层使用 **JSON-RPC 2.0** 协议，支持两种传输方式：

| 传输方式 | 适用场景 | 原理 |
| --- | --- | --- |
| **stdio** | 本地工具 | Client spawn 子进程，通过 stdin/stdout 交换消息 |
| **HTTP+SSE** | 远程服务 | Client 通过 HTTP 发送请求，Server 通过 SSE 推送响应 |

本文的所有示例都使用 **stdio** 模式——Client 启动 Server 子进程，通过标准输入输出通信。这也是目前最常用的方式。

> 💡 **重要细节**：因为 stdout 被 MCP 占用来传输 JSON-RPC 消息，所以 Server 端的日志必须用 `console.error`（stderr），而不是 `console.log`（stdout），否则会干扰协议通信。

### 2.3 连接生命周期

一次完整的 MCP 交互流程：

```
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
```

### 2.4 代码示例：创建最简 Server

用 `@modelcontextprotocol/sdk` 创建一个 MCP Server 只需几行代码：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 1. 创建 Server 实例
const server = new McpServer({
  name: "my-first-server",
  version: "1.0.0",
});

// 2. 注册一个工具（Zod 定义参数 Schema）
server.tool(
  "calculator",                         // 工具名
  "执行基础数学运算（加减乘除）",          // 描述（LLM 据此判断何时调用）
  {                                      // 参数 Schema
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number(),
  },
  async ({ operation, a, b }) => {       // 执行函数
    let result: number;
    switch (operation) {
      case "add": result = a + b; break;
      case "subtract": result = a - b; break;
      case "multiply": result = a * b; break;
      case "divide":
        if (b === 0) return { content: [{ type: "text", text: "错误：除数不能为零" }] };
        result = a / b; break;
    }
    return { content: [{ type: "text", text: `${a} ${operation} ${b} = ${result}` }] };
  }
);

// 3. 通过 stdio 启动
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("🔧 Server 已启动"); // 注意：必须用 console.error！
```

对应的 Client 连接代码：

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// 1. 创建传输通道（spawn Server 子进程）
const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "src/servers/tools-server.ts"],
});

// 2. 创建 Client 并连接（自动完成 initialize 握手）
const client = new Client({ name: "my-client", version: "1.0.0" });
await client.connect(transport);

// 3. 发现 Server 的工具
const { tools } = await client.listTools();
console.log(`发现 ${tools.length} 个工具`);

// 4. 调用工具
const result = await client.callTool({
  name: "calculator",
  arguments: { operation: "multiply", a: 6, b: 7 },
});
console.log(result.content[0].text); // "6 multiply 7 = 42"

// 5. 关闭连接
await client.close();
```

这就是 MCP 的核心流程：**connect → discover → call → close**。就像 USB 设备插上后自动识别、使用、拔出。



## 三、MCP 三大能力

MCP Server 可以暴露三种能力：**Tools（工具）**、**Resources（资源）**、**Prompts（提示模板）**。如果说 MCP 是 USB 接口，那这三种能力就是 USB 设备可以提供的三种服务。

| 能力 | 作用 | 类比 | 控制方 |
| --- | --- | --- | --- |
| 🔧 **Tools** | LLM 可调用的函数 | Function Calling | LLM 自主决定 |
| 📂 **Resources** | 向 LLM 暴露数据 | REST GET 端点 | 应用/用户选择 |
| 📋 **Prompts** | 可复用的提示模板 | API 请求模板 | 应用/用户选择 |

### 3.1 Tools — 工具调用

Tools 是 MCP 中最常用的能力，等同于标准化的 Function Calling。

**核心流程**：LLM 在推理时自主判断"我需要调用某个工具"→ 返回 tool_calls → 框架执行 callTool → 结果返回给 LLM。

**Server 端注册工具**：

```typescript
// tools-server.ts — 注册三个工具

// 工具 1: 计算器
server.tool(
  "calculator",
  "执行基础数学运算（加减乘除）",
  {
    operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("运算类型"),
    a: z.number().describe("第一个数"),
    b: z.number().describe("第二个数"),
  },
  async ({ operation, a, b }) => {
    let result: number;
    switch (operation) {
      case "add": result = a + b; break;
      case "subtract": result = a - b; break;
      case "multiply": result = a * b; break;
      case "divide":
        if (b === 0) return { content: [{ type: "text", text: "错误：除数不能为零" }] };
        result = a / b; break;
    }
    return { content: [{ type: "text", text: `${a} ${operation} ${b} = ${result}` }] };
  }
);

// 工具 2: 天气查询（模拟）
server.tool(
  "get_weather",
  "查询指定城市的天气信息（模拟数据）",
  { city: z.string().describe("城市名称") },
  async ({ city }) => {
    const weatherData: Record<string, { temp: number; condition: string; humidity: number }> = {
      北京: { temp: 22, condition: "晴", humidity: 45 },
      上海: { temp: 26, condition: "多云", humidity: 72 },
      深圳: { temp: 30, condition: "阵雨", humidity: 85 },
    };
    const weather = weatherData[city];
    if (!weather) {
      return { content: [{ type: "text", text: `未找到城市「${city}」的天气数据` }] };
    }
    return {
      content: [{ type: "text", text: `${city}天气: ${weather.condition}, ${weather.temp}°C, 湿度 ${weather.humidity}%` }],
    };
  }
);

// 工具 3: 翻译
server.tool(
  "translate",
  "简单的中英互译（模拟）",
  {
    text: z.string().describe("要翻译的文本"),
    targetLang: z.enum(["zh", "en"]).describe("目标语言"),
  },
  async ({ text, targetLang }) => {
    const translations: Record<string, Record<string, string>> = {
      zh: { "hello": "你好", "thank you": "谢谢" },
      en: { "你好": "hello", "谢谢": "thank you" },
    };
    const translated = translations[targetLang]?.[text.toLowerCase()] || `[模拟翻译] ${text}`;
    return { content: [{ type: "text", text: `翻译结果 (→${targetLang}): ${translated}` }] };
  }
);
```

注册工具的四个要素：**name**（唯一名称）、**description**（LLM 据此判断何时调用）、**inputSchema**（Zod 定义参数）、**execute**（实际执行函数）。

**Client 端调用**：

```typescript
// 直接调用
const calcResult = await client.callTool({
  name: "calculator",
  arguments: { operation: "add", a: 123, b: 456 },
});
console.log(calcResult.content[0].text); // "123 add 456 = 579"

// 让 LLM 自动选择调用哪个工具
const result = await generateText({
  model: getModel(provider),
  tools: aiTools, // MCP Tools 转换为 AI SDK 格式
  stopWhen: stepCountIs(3),
  messages: [{ role: "user", content: "请帮我计算 99 乘以 88 等于多少？" }],
  system: "你是一个有用的助手。根据用户问题选择合适的工具来回答。",
});
// LLM 自动选择 calculator → callTool → 得到结果 → 组织回答
```

**🔑 MCP Tools 与 AI SDK 的桥接**：

MCP Tools 需要转换为 AI SDK 格式才能让 LLM 自动调用。核心思路是：把 MCP Server 的工具列表封装为 AI SDK 的 `tool()` 对象，`execute` 中转发给 MCP Client：

```typescript
import { tool, zodSchema } from "ai";
import { z } from "zod";

// 将 MCP Tools 转换为 AI SDK tool 格式
const aiTools = {
  calculator: tool({
    description: "执行基础数学运算（加减乘除）",
    inputSchema: zodSchema(z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      a: z.number(),
      b: z.number(),
    })),
    execute: async (args: { operation: string; a: number; b: number }) => {
      // 转发给 MCP Server
      const result = await client.callTool({ name: "calculator", arguments: args });
      return (result.content as Array<{ text: string }>)[0].text;
    },
  }),
  get_weather: tool({
    description: "查询指定城市的天气信息",
    inputSchema: zodSchema(z.object({ city: z.string() })),
    execute: async (args: { city: string }) => {
      const result = await client.callTool({ name: "get_weather", arguments: args });
      return (result.content as Array<{ text: string }>)[0].text;
    },
  }),
};
```

### 3.2 Resources — 资源暴露

Resources 是 MCP 的第二大能力，用于向应用暴露数据。**注意：Resources 不是给 LLM 直接用的，而是由应用/用户读取后拼入 prompt 作为上下文。**

这是 Resources 与 Tools 最关键的区别——**控制方不同**：

```
🔧 Tools（LLM 主导）：
   把 tool 列表传给 LLM → LLM 推理时自主决定要不要调用 → 自动 callTool

📂 Resources（应用/用户主导）：
   应用/用户选择读取某个 Resource → readResource 获取内容 → 拼入 prompt → 发给 LLM
```

通俗理解：**Tools = 给 LLM 的「工具箱」，LLM 自己拿工具用；Resources = 给应用的「资料库」，你选资料喂给 LLM 当上下文。**

Resources 分为两种：

| 类型 | URI 格式 | 发现方式 | 示例 |
| --- | --- | --- | --- |
| 静态资源 | 固定 URI | `listResources()` | `info://project`、`config://app` |
| 动态资源 | URI 含模板变量 | `listResourceTemplates()` | `file:///{path}` |

**Server 端注册资源**：

```typescript
// resources-server.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

// 静态资源 1: 项目说明（text/plain）
server.resource(
  "project-info",       // 资源名
  "info://project",     // URI
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: [
        "📦 项目名称: LLM-Study",
        "📝 描述: 大语言模型学习实践",
        "🛠️ 技术栈: TypeScript / Node.js / Vercel AI SDK",
      ].join("\n"),
    }],
  })
);

// 静态资源 2: 配置信息（application/json）
server.resource(
  "config",
  "config://app",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({
        supportedProviders: ["deepseek", "openai", "anthropic"],
        defaultProvider: "deepseek",
      }, null, 2),
    }],
  })
);

// 动态资源: 文件读取（URI 模板）
server.resource(
  "file-reader",
  new ResourceTemplate("file:///{path}", { list: undefined }),
  async (uri) => {
    const filePath = decodeURIComponent(uri.pathname).replace(/^\//, "");
    const projectRoot = path.resolve(__dirname, "../..");
    const fullPath = path.resolve(projectRoot, filePath);
    // 安全检查：只允许读取项目目录下的文件
    if (!fullPath.startsWith(projectRoot)) {
      return { contents: [{ uri: uri.href, mimeType: "text/plain", text: "❌ 安全限制" }] };
    }
    const content = await fs.readFile(fullPath, "utf-8");
    return { contents: [{ uri: uri.href, mimeType: "text/plain", text: content }] };
  }
);
```

**Client 端读取**：

```typescript
// 发现静态资源
const { resources } = await client.listResources();
// → [{ name: "project-info", uri: "info://project" }, { name: "config", uri: "config://app" }]

// 读取静态资源
const projectInfo = await client.readResource({ uri: "info://project" });
console.log(projectInfo.contents[0].text);

// 发现动态模板
const { resourceTemplates } = await client.listResourceTemplates();
// → [{ name: "file-reader", uriTemplate: "file:///{path}" }]

// 读取动态资源（客户端自行替换模板变量）
const fileContent = await client.readResource({ uri: "file:///package.json" });
```

### 3.3 Prompts — 提示模板

Prompts 是 MCP 的第三大能力，提供可复用的参数化 Prompt 模板。

传统方式：每个应用自己管理 prompt 字符串，各写各的，难以复用。
MCP 方式：Server 统一管理模板，Client 即取即用，支持参数验证和版本管理。

**Server 端注册模板**：

```typescript
// prompts-server.ts

// Prompt 1: 代码审查模板
server.prompt(
  "code-review",
  "对代码进行专业审查，给出改进建议",
  {
    code: z.string().describe("要审查的代码"),
    language: z.string().optional().describe("编程语言（可选）"),
  },
  ({ code, language }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `请对以下${language ? ` ${language} ` : ""}代码进行专业审查：`,
          "",
          "```",
          code,
          "```",
          "",
          "请从以下角度分析：",
          "1. 🐛 潜在 Bug 和错误",
          "2. ⚡ 性能优化建议",
          "3. 📖 代码可读性和规范",
          "4. 🔒 安全性问题",
          "5. ✨ 最佳实践建议",
        ].join("\n"),
      },
    }],
  })
);

// Prompt 2: 翻译模板
server.prompt(
  "translate",
  "将文本翻译为指定语言",
  {
    text: z.string().describe("要翻译的文本"),
    targetLang: z.string().describe("目标语言"),
    style: z.enum(["formal", "casual", "technical"]).optional().describe("翻译风格"),
  },
  ({ text, targetLang, style }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `请将以下文本翻译为${targetLang}：`,
          `"${text}"`,
          style ? `翻译风格: ${style === "formal" ? "正式" : style === "casual" ? "口语化" : "技术文档"}` : "",
        ].filter(Boolean).join("\n"),
      },
    }],
  })
);
```

**Client 端获取并使用**：

```typescript
// 发现所有模板
const { prompts } = await client.listPrompts();
// → [{ name: "code-review", description: "...", arguments: [...] }, ...]

// 获取渲染后的 Prompt（传入参数）
const reviewPrompt = await client.getPrompt({
  name: "code-review",
  arguments: {
    code: `function add(a, b) { return a + b }`,
    language: "TypeScript",
  },
});

// 渲染后的 messages 可以直接发给 LLM
const messages = reviewPrompt.messages.map(msg => ({
  role: msg.role as "user" | "assistant",
  content: msg.content.type === "text" ? msg.content.text : "",
}));

const result = await generateText({
  model: getModel(provider),
  messages,
});
console.log(result.text); // LLM 的代码审查结果
```

### 三大能力总结

```
  ┌─────────────────────────────────────────────────────────┐
  │                    MCP Server                            │
  │                                                          │
  │  🔧 Tools          📂 Resources        📋 Prompts       │
  │  ┌────────────┐   ┌────────────┐      ┌────────────┐   │
  │  │ calculator  │   │ info://    │      │ code-review│   │
  │  │ get_weather │   │ config://  │      │ translate  │   │
  │  │ translate   │   │ file:///   │      │ gen-docs   │   │
  │  └────────────┘   └────────────┘      └────────────┘   │
  │                                                          │
  │  LLM 自己决定调    应用/用户选择读       应用/用户选择用   │
  └─────────────────────────────────────────────────────────┘
```



## 四、构建通用 MCP Client

有了 MCP 的标准化协议，我们可以构建一个**万能调试工具**——连接任意 MCP Server，自动发现它的全部能力。这就像 USB 设备管理器，插上任何设备都能看到它的信息。

```typescript
// mcp-client.ts — 通用 MCP Client 调试器

interface ServerConfig {
  name: string;
  command: string;
  args: string[];
}

class MCPClientDebugger {
  private client: Client | null = null;

  constructor(private config: ServerConfig) {}

  /** 连接到 Server */
  async connect(): Promise<void> {
    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
    });
    this.client = new Client({ name: "mcp-debugger", version: "1.0.0" });
    await this.client.connect(transport);
  }

  /** 完整能力探测 — 一次列出 Tools / Resources / Prompts */
  async inspect(): Promise<void> {
    if (!this.client) throw new Error("未连接到 Server");

    // 探测 Tools
    try {
      const { tools } = await this.client.listTools();
      console.log(`🔧 Tools (${tools.length}):`);
      for (const t of tools) {
        console.log(`   • ${t.name} — ${t.description}`);
        // 打印参数 Schema
        if (t.inputSchema && "properties" in t.inputSchema) {
          const props = t.inputSchema.properties as Record<string, { type?: string }>;
          for (const [key, val] of Object.entries(props)) {
            console.log(`     - ${key}: ${val.type || "any"}`);
          }
        }
      }
    } catch { console.log("🔧 Tools: Server 不支持"); }

    // 探测 Resources
    try {
      const { resources } = await this.client.listResources();
      console.log(`📂 Resources (${resources.length}):`);
      for (const r of resources) console.log(`   • ${r.name} — ${r.uri}`);
      const { resourceTemplates } = await this.client.listResourceTemplates();
      if (resourceTemplates.length > 0) {
        console.log(`📋 Resource Templates (${resourceTemplates.length}):`);
        for (const t of resourceTemplates) console.log(`   • ${t.name} — ${t.uriTemplate}`);
      }
    } catch { console.log("📂 Resources: Server 不支持"); }

    // 探测 Prompts
    try {
      const { prompts } = await this.client.listPrompts();
      console.log(`📋 Prompts (${prompts.length}):`);
      for (const p of prompts) {
        console.log(`   • ${p.name} — ${p.description}`);
        if (p.arguments) {
          for (const arg of p.arguments) {
            console.log(`     - ${arg.name} ${arg.required ? "(必填)" : "(可选)"}`);
          }
        }
      }
    } catch { console.log("📋 Prompts: Server 不支持"); }
  }

  async disconnect(): Promise<void> {
    if (this.client) { await this.client.close(); this.client = null; }
  }
}
```

**批量探测所有 Server**：

```typescript
const servers: ServerConfig[] = [
  { name: "tools-server", command: "npx", args: ["tsx", "src/servers/tools-server.ts"] },
  { name: "resources-server", command: "npx", args: ["tsx", "src/servers/resources-server.ts"] },
  { name: "prompts-server", command: "npx", args: ["tsx", "src/servers/prompts-server.ts"] },
  { name: "knowledge-server", command: "npx", args: ["tsx", "src/servers/knowledge-server.ts"] },
];

for (const config of servers) {
  const debugger_ = new MCPClientDebugger(config);
  await debugger_.connect();
  await debugger_.inspect();    // 自动列出所有能力
  await debugger_.disconnect();
}
```

运行 `npm run mcp-client` 即可一键探测所有 Server 的能力，输出类似：

```
🔍 探测 Server: tools-server
🔧 Tools (3):
   • calculator — 执行基础数学运算（加减乘除）
   • get_weather — 查询指定城市的天气信息（模拟数据）
   • translate — 简单的中英互译（模拟）

🔍 探测 Server: knowledge-server
🔧 Tools (2):
   • search_knowledge — 在知识库中搜索相关内容
   • list_sections — 列出知识库的所有章节标题
📂 Resources (1):
   • knowledge-base — knowledge://base
📋 Prompts (1):
   • knowledge-qa — 基于知识库内容回答问题
```

这就是 MCP "即插即识别" 的魅力——Client 无需预先知道 Server 有什么能力，连上就能自动发现。



## 五、实战：MCP 知识库

本节用 MCP 实现一个知识库问答服务，综合运用 Tools + Resources + Prompts 三大能力。

### 5.1 与第3期 RAG 的对比

第3期我们手写了一套 RAG 流程：文本分块 → Embedding 向量化 → ChromaDB 存储 → 向量相似度搜索 → 拼入 prompt → LLM 回答。那是为了学习**检索技术**。

本期用 MCP 实现同样的事情，但重点是**标准化接入层**：

| 对比维度 | 第3期 手写 RAG | 第7期 MCP 知识库 |
| --- | --- | --- |
| **教学重点** | 语义检索技术 | MCP 协议与标准化 |
| **检索方式** | Embedding 向量搜索 | 简单关键词匹配 |
| **依赖** | Embedding 模型 + ChromaDB | 仅 MCP SDK |
| **可复用性** | 代码耦合在应用内 | 任何 MCP Host 即插即用 |
| **升级路径** | 需改应用代码 | 只改 Server 实现，Client 无感 |

> 💡 关键洞察：如果把 knowledge-server 的 `search_knowledge` 实现从关键词匹配替换为向量搜索，就是一个完整的 "MCP 版 RAG Server"——任何 MCP Host 都能即插即用，而调用方代码**无需任何改动**。这就是标准化的价值。

### 5.2 Knowledge Server — 综合三大能力

```typescript
// knowledge-server.ts — 同时提供 Tools + Resources + Prompts

const server = new McpServer({ name: "knowledge-server", version: "1.0.0" });

// ==================== 📂 Resources ====================
// 暴露知识库文档（应用可读取作为上下文）
server.resource(
  "knowledge-base",
  "knowledge://base",
  async (uri) => {
    const content = await fs.readFile(path.join(KNOWLEDGE_DIR, "knowledge.md"), "utf-8");
    return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: content }] };
  }
);

// ==================== 🔧 Tools ====================
// 工具 1: 知识库搜索（关键词匹配）
server.tool(
  "search_knowledge",
  "在知识库中搜索相关内容",
  { query: z.string().describe("搜索关键词") },
  async ({ query }) => {
    const content = await fs.readFile(path.join(KNOWLEDGE_DIR, "knowledge.md"), "utf-8");
    // 按 ## 分割章节，逐章节匹配关键词
    const sections = content.split(/\n## /);
    const results = sections
      .filter(s => s.toLowerCase().includes(query.toLowerCase()))
      .map(s => s.length > 500 ? s.substring(0, 500) + "..." : s);

    if (results.length === 0) {
      return { content: [{ type: "text", text: `未找到与「${query}」相关的内容。` }] };
    }
    return { content: [{ type: "text", text: `找到 ${results.length} 个相关段落:\n\n${results.join("\n\n---\n\n")}` }] };
  }
);

// 工具 2: 列出章节目录
server.tool(
  "list_sections",
  "列出知识库的所有章节标题",
  {},
  async () => {
    const content = await fs.readFile(path.join(KNOWLEDGE_DIR, "knowledge.md"), "utf-8");
    const headings = content.split("\n").filter(l => l.startsWith("## ")).map(l => l.replace("## ", ""));
    return { content: [{ type: "text", text: `知识库章节:\n${headings.map((h, i) => `${i + 1}. ${h}`).join("\n")}` }] };
  }
);

// ==================== 📋 Prompts ====================
// 知识库问答模板
server.prompt(
  "knowledge-qa",
  "基于知识库内容回答问题",
  {
    question: z.string().describe("用户的问题"),
    context: z.string().describe("从知识库检索到的相关内容"),
  },
  ({ question, context }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          "请基于以下知识库内容回答问题。",
          "",
          "## 知识库内容",
          context,
          "",
          "## 问题",
          question,
          "",
          "## 要求",
          "1. 仅基于提供的知识库内容回答",
          "2. 如果知识库中没有相关信息，请明确告知",
          "3. 用中文回答，条理清晰",
        ].join("\n"),
      },
    }],
  })
);
```

### 5.3 Client 端：三大原语协作完成一次问答

```typescript
// mcp-knowledge.ts — MCP 版 RAG 问答流程

const client = await createKnowledgeClient();
const question = "什么是 MCP？它有哪些核心能力？";

// Step 1 — 🔧 Tool: 搜索知识库（关键词匹配）
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

// 搜索无结果时 — 📂 Resource: 读取整个知识库兜底
if (!context) {
  const resource = await client.readResource({ uri: "knowledge://base" });
  if ("text" in resource.contents[0]) {
    context = resource.contents[0].text;
  }
}

// Step 2 — 📋 Prompt: 获取知识库问答模板
const promptResult = await client.getPrompt({
  name: "knowledge-qa",
  arguments: { question, context: context.substring(0, 2000) },
});

// Step 3 — 🤖 LLM: 发送渲染后的 messages 给 LLM
const messages = promptResult.messages.map(msg => ({
  role: msg.role as "user" | "assistant",
  content: msg.content.type === "text" ? msg.content.text : "",
}));

const result = await generateText({
  model: getModel(provider),
  messages,
  maxOutputTokens: 500,
});

console.log(`🤖 回答: ${result.text}`);
```

**一次问答同时用到 MCP 全部三个原语**：

```
❓ 用户提问
    │
    ▼
🔧 Tool: search_knowledge("MCP")     ← LLM 可调用的搜索工具
    │
    ▼  搜索无结果？
📂 Resource: readResource("knowledge://base")  ← 兜底读全文
    │
    ▼
📋 Prompt: getPrompt("knowledge-qa", { question, context })  ← 问答模板
    │
    ▼
🤖 LLM: generateText(messages)       ← 生成回答
    │
    ▼
✅ 返回答案
```



## 六、与 Claude Desktop 集成

MCP 最令人兴奋的应用场景之一是与 Claude Desktop 集成。只需一个配置文件，你自定义的 MCP Server 就能在 Claude Desktop 中使用——真正的"即插即用"。

### 6.1 配置文件

找到 Claude Desktop 的配置文件 `claude_desktop_config.json`：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

添加如下配置：

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/07-mcp/src/servers/knowledge-server.ts"]
    },
    "tools-demo": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/07-mcp/src/servers/tools-server.ts"]
    }
  }
}
```

> ⚠️ 替换 `/absolute/path/to/` 为你的实际项目路径，然后重启 Claude Desktop。

### 6.2 效果

重启后，Claude Desktop 会自动：

1. **启动 Server** — spawn 子进程运行你的 MCP Server
2. **发现能力** — 自动调用 listTools/listResources/listPrompts
3. **展示给用户** — Tools 显示为 LLM 可调用的工具，Resources 显示为可附加的上下文

现在你可以在 Claude Desktop 中直接：
- 问 "帮我算 99 × 88" → Claude 自动调用 calculator 工具
- 问 "深圳天气怎么样" → Claude 自动调用 get_weather 工具
- 问 "知识库里有什么内容" → Claude 搜索你的 knowledge.md

这就是 MCP 的终极价值：**写一次 Server，所有支持 MCP 的 Host 都能用**。就像你买了一个 USB 键盘，插到任何电脑上都能工作。



## 七、总结与下期预告

### 本期回顾

MCP 用一个统一的"USB 接口"标准解决了 AI 工具集成的碎片化问题：

| 要点 | 说明 |
| --- | --- |
| **核心理念** | AI 工具的 USB 接口 — 统一协议，即插即用 |
| **三层架构** | Host（应用）→ Client（连接层）→ Server（能力方） |
| **三大能力** | Tools（LLM 调函数）、Resources（暴露数据）、Prompts（模板复用） |
| **通信方式** | stdio（本地子进程）/ HTTP+SSE（远程服务） |
| **核心价值** | 写一次 Server，所有 MCP Host 即插即用 |

项目文件一览：

```
07-mcp/src/
├── servers/
│   ├── tools-server.ts         ← 计算器/天气/翻译 Server
│   ├── resources-server.ts     ← 项目信息/配置/文件读取 Server
│   ├── prompts-server.ts       ← 代码审查/翻译/文档模板 Server
│   └── knowledge-server.ts     ← 知识库综合 Server（三大能力齐全）
├── mcp-basics.ts               ← 核心概念 + 最小交互 + 生命周期
├── mcp-tools.ts                ← Tools 发现/调用/LLM 集成
├── mcp-resources.ts            ← Resources 静态/动态资源
├── mcp-prompts.ts              ← Prompts 模板获取与 LLM 执行
├── mcp-client.ts               ← 通用调试工具
└── mcp-knowledge.ts            ← 知识库问答实战
```

### 下期预告

**第8期 — Claude Code Skills 定制体系**

如果说 MCP 是给 AI 工具的"USB 接口"，那 Skills 就是给 Claude Code 的"快捷方式"。下期我们将学习如何通过 Skill 机制定制 Claude Code 的行为模式——用 Markdown 文件定义可复用的工作流，让 AI 编码助手更懂你的项目。

**官方文档：**
- [MCP 官方文档](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
