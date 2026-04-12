# AI应用实践(11)—AI应用平台Coze与Dify实战

前面 12 个模块走完了从底层到框架、从调用到微调的完整链路。最后这篇换个视角——不再自己造轮子，而是看看市面上的 AI 应用平台是怎么把这些技术封装成产品的，以及什么时候该用平台、什么时候该自研。有了前面的底子，你看平台的视角会完全不同。

技术栈：Dify API + Coze API + TypeScript / Vercel AI SDK
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/13-ai-platform](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/13-ai-platform)

## 一、AI 应用平台是什么

### 1.1 从"手工作坊"到"工厂流水线"

回顾前面的学习路径，每个模块都在解决具体的技术问题——第 2 篇写 Prompt、第 3 篇手写 RAG、第 5-6 篇构建 Agent、第 7 篇对接 MCP……但对于很多业务场景，手写全套代码可能太"重"了。

> 🎒 **类比**：
> - 想做个公司官网 → 你不会从零手写 HTTP 服务器，你用 WordPress
> - 想做个 AI 客服 → 你会手写 RAG + Agent？**看情况。**
>
> AI 应用平台就像 WordPress 之于网站——把复杂技术封装成可视化操作。不同的是，你已经学过底层原理，所以你知道平台在帮你做什么、什么时候该脱离平台自己来。

### 1.2 主流平台一览

| 平台 | 出品方 | 开源 | 特色 | 适合场景 |
|------|--------|------|------|---------|
| **Coze（扣子）** | 字节跳动 | ❌ | 免费额度大、一键发布多渠道 | 快速 MVP、C 端应用 |
| **Dify** | 开源社区 | ✅ | 可私部署、API 完善、可控性高 | 企业级、数据敏感场景 |
| FastGPT | 开源社区 | ✅ | 专注知识库问答 | 纯问答场景 |
| Flowise | 开源社区 | ✅ | LangChain 可视化编排 | LangChain 用户 |
| MaxKB | 开源社区 | ✅ | 知识库管理 + 多模型支持 | 文档问答 |

> 💡 本文聚焦 **Coze** 和 **Dify** 两个最具代表性的平台——前者是国内最大的云端 AI 应用平台，后者是最流行的开源自部署方案。

### 1.3 三大支柱

所有 AI 平台底层都围绕三大支柱展开。如果你学过前面的模块，会发现全是老朋友：

| 支柱 | 平台功能 | 对应自研模块 | 平台加了什么 |
|------|---------|-------------|-------------|
| 🔄 工作流编排 | 可视化拖拽编排处理流程 | 第 5-6 篇 StateGraph | 拖拽 UI + 条件分支可视化 |
| 📚 知识库管理 | 上传文档自动 RAG | 第 3 篇 RAG + 第 9 篇 LlamaIndex | 自动切分 + 向量化 + 检索 |
| 🔧 插件/工具 | 扩展 LLM 外部能力 | 第 5-6 篇 Agent + 第 7 篇 MCP | 插件市场 + 一键启用 |

```
                AI 应用平台 ≈ 三大支柱

  🔄 工作流              📚 知识库              🔧 插件
  +-----------+         +-----------+         +-----------+
  | StateGraph|         |   RAG     |         |  Agent    |
  | 条件分支  |         | Chunking  |         | Tool Call |
  | 循环节点  |         | Embedding |         | MCP Tool  |
  +-----------+         +-----------+         +-----------+
       +                      +                     +
    可视化 UI              一键上传              插件市场
```

### 1.4 平台底层 = 你学过的全部技术

这是本篇最核心的观点——**AI 应用平台的底层，就是你在第 1-10 篇中学过的全部技术**。平台没有发明新技术，只是加了一层 UI。

```
                      AI 应用平台
=====================================================
  可视化编排层（拖拽式 UI，无代码操作）
-----------------------------------------------------
  Prompt       RAG         Agent        Workflow Engine
  提示词模板   检索增强    工具调用     工作流引擎
  第2篇        第3篇       第5-6篇      第5-6篇
-----------------------------------------------------
  LLM 调用层（多模型适配）
  model-adapter.ts（第 2 篇）
-----------------------------------------------------
  基础设施层（向量数据库、缓存、监控、限流）
  第 3 篇 VectorStore + 部署优化模块 缓存/监控/限流
```

| 平台功能 | 对应自研模块 | 你学到了什么 |
|---------|-------------|-------------|
| 对话应用 | 第 1 篇 (Next.js Chat) | `useChat()` + `streamText()` 全栈流式 |
| 提示词模板 | 第 2 篇 (Prompt Engineering) | Few-shot、CoT、结构化输出 |
| 知识库 | 第 3 篇 (RAG) + 第 9 篇 (LlamaIndex) | Chunking → Embedding → 向量检索 |
| 工作流 | 第 5-6 篇 (StateGraph) | 条件分支、循环、人工审批 |
| 插件/工具 | 第 5-6 篇 (Agent) + 第 7 篇 (MCP) | Function Calling + MCP 标准协议 |
| 多模型切换 | 第 2 篇 (model-adapter.ts) | DeepSeek/OpenAI/Anthropic 统一适配 |
| 对话记忆 | 第 4 篇 (Memory) + 第 5-6 篇 (Memory) | MemorySaver + 会话管理 |
| 多模态 | 多模态模块 (Vision/Speech) | 图像理解、语音转文字、TTS |
| 本地部署 | 部署优化模块 (Ollama) | 本地推理、云端对比 |
| 模型微调 | 第 10 篇 (Fine-tuning) | 数据准备、训练、评估 |



## 二、Dify 实战

### 2.1 部署与架构

Dify 推荐使用 Docker Compose 部署，一条命令启动完整集群：

```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env
docker compose up -d
```

启动后的服务架构：

```
              Dify Docker Compose 集群

  +---------+  +---------+  +---------+
  |  Nginx  |  |   Web   |  |   API   |
  |  :80    |->|  :3000  |  |  :5001  |
  | 反向代理 |  | 前端 UI  |  | 后端服务 |
  +---------+  +---------+  +----+----+
                                  |
  +---------+  +---------+  +----v----+
  |  Redis  |  |PostgreSQL|  | Worker  |
  |  :6379  |  |  :5432  |  | 异步任务 |
  | 缓存/队列|  | 主数据库 |  | Celery  |
  +---------+  +---------+  +---------+

  +---------+  +----------+
  | Weaviate|  | Sandbox  |
  |  :8080  |  | 代码沙箱  |
  | 向量数据库|  | 安全执行  |
  +---------+  +----------+
```

| 服务 | 作用 | 对应自研模块 |
|------|------|-------------|
| **API** | 后端核心，处理 LLM 调用/RAG/工作流 | 第 2 篇 model-adapter + 第 5-6 篇 |
| **Worker** | Celery 异步任务（文档解析、向量化） | 第 3 篇 Chunking + Embedding |
| **Weaviate** | 向量数据库（也支持切换为 Qdrant/Milvus） | 第 3 篇 ChromaDB |
| **PostgreSQL** | 存储应用配置、对话记录、用户数据 | 业务数据库 |
| **Redis** | 缓存 + 消息队列 | 部署优化模块 缓存策略 |
| **Sandbox** | 代码执行沙箱（工作流中的代码节点） | 安全隔离执行 |

> 💡 对比第 3 篇的 `docker run chromadb/chroma`——Dify 把整条 RAG 流水线（切分 → 向量化 → 存储 → 检索）全部封装进了这套微服务集群。

启动后访问 `http://localhost` 即可使用。首次访问需要设置管理员账号。也可以使用云端版本 [cloud.dify.ai](https://cloud.dify.ai) 免部署体验。

### 2.2 核心 API

Dify 提供四类核心 API，统一使用 `Authorization: Bearer app-xxxx` 鉴权。

**Chat API**——对话型应用，支持阻塞和流式两种模式：

```typescript
class DifyClient {
  // 阻塞模式：等待完整回复
  async chat(message: string, conversationId?: string): Promise<DifyResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},                           // Prompt 模板变量
        query: message,
        response_mode: "blocking",            // "blocking" | "streaming"
        conversation_id: conversationId || "",// 空字符串 = 新对话
        user: "demo-user",
      }),
    });
    return response.json() as Promise<DifyResponse>;
  }

  // 流式模式：SSE 逐字返回（与第 1 篇 streamText 原理一致）
  async chatStream(message: string, conversationId?: string): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: "streaming",
        conversation_id: conversationId || "",
        user: "demo-user",
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

      for (const line of lines) {
        const jsonStr = line.slice(6);
        if (jsonStr === "[DONE]") continue;

        const data = JSON.parse(jsonStr);
        if (data.event === "message" && data.answer) {
          process.stdout.write(data.answer);
        }
      }
    }
  }
}
```

**Workflow API**——运行可视化编排的工作流，对应第 5-6 篇 StateGraph：

```typescript
async runWorkflow(inputs: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(`${this.config.baseUrl}/workflows/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs, response_mode: "blocking", user: "demo-user" }),
  });
  return (await response.json()) as Record<string, unknown>;
}
```

> 🎒 **类比**：Workflow API 的 `inputs` 就像 StateGraph 的初始 State——你定义好输入变量，工作流引擎按编排的节点逐步处理。区别在于 StateGraph 用代码定义节点和边，Dify 用拖拽 UI。

**知识库 API**——一键完成 RAG 全流程。回忆第 3 篇手写 RAG 需要 ~200 行代码（读文件 → 切分 → 向量化 → 存储 → 检索 → 生成），Dify 把这一切封装为 REST API：

```typescript
// 1. 创建知识库
// POST /datasets  →  { "name": "产品文档", "permission": "only_me" }

// 2. 上传文档（自动切分 + 向量化）
// POST /datasets/{id}/document/create_by_file
// Content-Type: multipart/form-data
// data: { "indexing_technique": "high_quality", "process_rule": { "mode": "automatic" } }

// 3. 检索
// POST /datasets/{id}/retrieve  →  { "query": "用户问题", "top_k": 3, "score_threshold": 0.5 }
```

> 💡 `indexing_technique` 有两个选项：`"high_quality"` 使用 Embedding 向量检索（即第 3 篇的方式），`"economy"` 使用关键词倒排索引（更快更省但精度低）。底层技术完全一样，Dify 只是包成了 REST API。



## 三、Coze 实战

### 3.1 核心概念映射

Coze 的概念体系可以直接映射到你已经学过的技术：

| Coze 概念 | 含义 | 对应自研模块 |
|-----------|------|-------------|
| **Bot** | AI 应用（含模型 + 提示词 + 知识库 + 插件） | 第 1 篇整个 Chat App |
| **Plugin** | 扩展 Bot 的外部能力（API 调用等） | 第 5-6 篇 Agent Tool / 第 7 篇 MCP Tool |
| **Workflow** | 多步骤自动化流程 | 第 5-6 篇 StateGraph |
| **Knowledge** | 知识库（文档 RAG） | 第 3 篇 VectorStore |
| **Memory** | 长期记忆（跨会话） | 第 5-6 篇 MemorySaver |

### 3.2 核心 API

Coze 的 API 设计与 Dify 有个关键区别——**非流式模式下采用异步轮询**，而不是同步阻塞：

```
Dify 非流式（同步阻塞）:
  POST /chat-messages → 等待 → 直接返回 { answer: "..." }

Coze 非流式（异步轮询）:
  POST /chat → 立即返回 { chat_id, conversation_id }
       ↓
  GET /chat/retrieve?chat_id=xxx → 轮询状态
       ↓  status: "in_progress" → 继续等
       ↓  status: "completed" → 获取结果
  GET /chat/message/list?chat_id=xxx → 获取消息列表
```

> 🎒 **类比**：
> - Dify 像餐厅**堂食**——你点菜后坐着等，服务员做好直接端给你
> - Coze 像**外卖**——你下单后立刻得到一个订单号，然后不断刷新查看配送状态

**Chat API**——异步轮询模式的完整实现：

```typescript
class CozeClient {
  async chat(message: string, conversationId?: string): Promise<{ answer: string; conversationId: string }> {
    const body: Record<string, unknown> = {
      bot_id: this.config.botId,
      user_id: "demo_user",
      stream: false,
      auto_save_history: true,
      additional_messages: [{ role: "user", content: message, content_type: "text" }],
    };
    if (conversationId) body.conversation_id = conversationId;

    // 第一步：发送请求，获取 chat_id
    const response = await fetch(`${this.config.baseUrl}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const chatId = data.data?.id;
    const convId = data.data?.conversation_id;

    // 第二步：轮询等待完成（最多 30 秒）
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));

      const status = await fetch(
        `${this.config.baseUrl}/chat/retrieve?conversation_id=${convId}&chat_id=${chatId}`,
        { headers: { Authorization: `Bearer ${this.config.accessToken}` } }
      );
      const statusData = await status.json();

      if (statusData.data?.status === "completed") {
        // 第三步：获取消息列表，找到 assistant 的回答
        const msgRes = await fetch(
          `${this.config.baseUrl}/chat/message/list?conversation_id=${convId}&chat_id=${chatId}`,
          { headers: { Authorization: `Bearer ${this.config.accessToken}` } }
        );
        const msgData = await msgRes.json();
        const answer = msgData.data?.find(
          (m: { role: string; type: string }) => m.role === "assistant" && m.type === "answer"
        )?.content || "";
        return { answer, conversationId: convId };
      }
      if (statusData.data?.status === "failed") throw new Error("对话处理失败");
    }
    throw new Error("对话超时（30秒）");
  }
}
```

**流式模式**——Coze 同样支持 SSE，事件名与 Dify 不同：

```typescript
async chatStream(message: string): Promise<void> {
  const response = await fetch(`${this.config.baseUrl}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bot_id: this.config.botId,
      user_id: "demo_user",
      stream: true,                    // 开启流式
      auto_save_history: true,
      additional_messages: [{ role: "user", content: message, content_type: "text" }],
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      const data = JSON.parse(jsonStr);
      if (data.event === "conversation.message.delta" &&
          data.message?.role === "assistant" &&
          data.message?.type === "answer") {
        process.stdout.write(data.message.content);
      }
    }
  }
}
```

Dify 与 Coze 的 SSE 事件对比：

| 功能 | Dify SSE 事件 | Coze SSE 事件 |
|------|--------------|--------------|
| 文本增量 | `event: "message"` | `event: "conversation.message.delta"` |
| 完成标记 | `data: [DONE]` | `event: "conversation.chat.completed"` |
| 错误通知 | `event: "error"` | `event: "error"` |

**Workflow API**——与 Dify 类似，输入参数由工作流定义：

```typescript
const response = await fetch("https://api.coze.cn/v1/workflow/run", {
  method: "POST",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    workflow_id: "<workflow_id>",
    parameters: { input_text: "需要处理的内容" },
  }),
});
```

Coze 的工作流节点可以直接映射到第 5-6 篇的概念：

| Coze 节点 | 功能 | 对应自研概念 |
|-----------|------|-------------|
| LLM 节点 | 调用大模型生成 | `chatWithModel()` |
| 知识库检索节点 | 从知识库检索 | `RAGPipeline.query()` |
| 条件分支节点 | 根据条件选择路径 | `StateGraph.addConditionalEdges()` |
| 循环节点 | 重复执行 | StateGraph 循环边 |
| 插件调用节点 | 调用外部插件 | Agent `callTool()` |

### 3.3 插件开发——三种工具定义方式对比

Coze 的插件系统是 AI 平台版的 Function Calling。对比三种工具定义方式，底层思想完全一致——**让 LLM 知道有哪些工具，以及如何调用**：

```
第 5-6 篇 Agent（代码定义）:
  tool({
    description: "查询天气",
    parameters: z.object({
      city: z.string().describe("城市名")
    }),
    execute: async ({ city }) => fetchWeather(city)
  })

第 7 篇 MCP（JSON-RPC Server 定义）:
  server.tool(
    "get_weather",
    "查询天气",
    { city: z.string() },
    async ({ city }) => ({ content: [{ type: "text", text: ... }] })
  )

Coze Plugin（HTTP API + JSON Schema 注册）:
  {
    "name": "weather_query",
    "description": "查询指定城市的天气",
    "parameters": {
      "type": "object",
      "properties": {
        "city": { "type": "string", "description": "城市名" }
      },
      "required": ["city"]
    }
  }
  → 对应 HTTP 端点: POST https://your-api.com/weather?city=xxx
```

Coze 自定义插件的开发流程：定义 HTTP API 端点 → 编写 JSON Schema 描述 → 在平台注册插件 → 在 Bot 中启用。Bot 对话时 LLM 会自动判断是否需要调用。

> 💡 如果你的服务已经实现了 MCP Server，理论上可以通过一个 HTTP 网关把 MCP Tool 暴露为 HTTP API，然后注册到 Coze——这就是标准化协议的价值。



## 四、同一场景三种实现——客服知识库问答

以一个具体场景——"客服知识库问答"——来对比三种实现方式的差异。

### 4.1 场景定义

```
需求：构建一个客服问答系统
  1. 理解用户的自然语言问题
  2. 从产品知识库中检索相关信息
  3. 生成准确、友好的回答
  4. 支持多轮对话

测试问题：
  Q1: "你们的产品有什么功能？"
  Q2: "价格是多少？"
  Q3: "怎么开始使用？"
```

### 4.2 方案一：Dify API（~10 行核心代码）

```typescript
// 前提：在 Dify 平台上创建应用 + 上传知识库（约 30 分钟平台操作）
const response = await fetch(`${apiUrl}/chat-messages`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    inputs: {},
    query: "你们的产品有什么功能？",
    response_mode: "blocking",
    user: "test",
  }),
});
const data = await response.json();
console.log(data.answer);
```

### 4.3 方案二：Coze API（~10 行核心代码 + 轮询逻辑）

```typescript
// 前提：在 Coze 平台上创建 Bot + 上传知识库（约 20 分钟平台操作）
const response = await fetch("https://api.coze.cn/v1/chat", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    bot_id: botId,
    user_id: "test",
    stream: false,
    auto_save_history: false,
    additional_messages: [{
      role: "user",
      content: "你们的产品有什么功能？",
      content_type: "text",
    }],
  }),
});
// → 异步返回 chat_id，需要轮询获取结果
```

### 4.4 方案三：自研 RAG（~200 行核心代码）

```typescript
// 完整版参见第 3 篇 rag-pipeline.ts

// 1. 准备知识库（离线阶段）
const KNOWLEDGE_BASE = [
  { title: "产品功能", content: "我们的 AI 助手产品支持..." },
  { title: "定价方案", content: "我们提供三种定价方案..." },
  { title: "快速开始", content: "开始使用只需3步..." },
];

// 2. 检索（实际应使用向量检索，此处为简化版关键词匹配）
const question = "你们的产品有什么功能？";
const relevantDocs = KNOWLEDGE_BASE.filter(
  doc => doc.content.includes("功能")
).slice(0, 2);

// 3. 组装上下文
const context = relevantDocs
  .map(doc => `【${doc.title}】${doc.content}`)
  .join("\n\n");

// 4. LLM 生成
const answer = await chatWithModel(provider, [
  { role: "user", content: question }
], {
  system: `你是一个友好的客服助手。请根据以下知识库内容回答用户问题。
如果知识库中没有相关信息，请诚实告知。

知识库内容：
${context}`,
});
```

### 4.5 综合对比

| 维度 | Dify API | Coze API | 自研 RAG |
|------|---------|---------|---------|
| **核心代码量** | ~10 行 | ~10 行 + 轮询逻辑 | ~150-200 行 |
| **总开发时间** | ~30 分钟（含平台配置） | ~20 分钟（平台操作更简） | 1-3 天 |
| **灵活性** | 中（受限于平台功能） | 中（受限于平台功能） | 高（完全自定义） |
| **数据安全** | ⭐⭐⭐⭐⭐ 可私部署 | ⭐⭐ 云端托管 | ⭐⭐⭐⭐⭐ 完全可控 |
| **维护成本** | 低（平台托管） | 最低（零运维） | 中-高（需自建监控） |
| **扩展性** | API + Workflow | Plugin 生态 | 无限 |
| **多渠道发布** | API 集成 | 微信/飞书/Discord 一键发布 | 需自建 |
| **成本（月/千次）** | 服务器 + 模型 API | 免费额度内免费 | 服务器 + 模型 API + 人力 |



## 五、选型策略

### 5.1 决策树

面对一个具体的 AI 应用需求，按以下路径决策：

```
├── 快速验证想法 / MVP / 非技术团队
│   └── → Coze（最快，免费额度大，多渠道发布）
│
├── 企业级应用 / 数据安全要求高
│   ├── 有运维能力 → Dify 私有部署
│   └── 无运维能力 → Dify 云端
│
├── 核心业务系统 / 深度定制需求
│   └── → 自研（第 3-10 篇的技术全用上）
│
└── 不确定 / 需要逐步演进
    └── → 渐进式策略（见 5.2）
```

### 5.2 渐进式策略（推荐）

大多数真实项目的最佳路径不是一步到位，而是渐进演进：

```
阶段一（1-2 天）: Coze/Dify 搭建原型
  → 验证 AI 是否真的能解决这个问题
  → 收集用户反馈，确认需求

阶段二（1-2 周）: Dify API 集成到系统
  → 正式上线，接入现有业务
  → 用 Dify Workflow 处理复杂逻辑

阶段三（持续迭代）: 核心功能自研 + 边缘功能继续用平台
  → 核心 RAG 自研（更好的切分策略、更精准的检索）
  → 核心 Agent 自研（更稳定的工具调用、更好的错误处理）
  → 辅助功能（内部问答、运营工具）继续用平台
```

### 5.3 混合架构

生产环境中最常见的是混合架构——核心自研 + 边缘用平台：

```
                    你的应用系统
=====================================================
  核心功能(自研)     辅助功能(Dify API)   运营工具(Coze Bot)

  定制 RAG           知识库问答           内部答疑
  定制 Agent         工作流自动化         客服助手
  模型微调           文档处理             数据报表

  第3-10篇技术栈     HTTP API 调用        多渠道发布(微信/飞书)
```

> 💡 这种架构的好处：核心业务保持完全控制权（性能、安全、定制），非核心功能享受平台的低成本和快速迭代。



## 六、全系列回顾

### 6.1 知识图谱

13 个模块形成了一张完整的 AI 应用开发知识图谱：

```
基础层（入门必修）
├── 第 1 篇  LLM 基础 + Next.js 全栈聊天应用
├── 第 2 篇  Prompt Engineering（Few-shot、CoT、结构化输出）
└── 多模态模块  Vision、DALL-E、TTS、Whisper

增强层（RAG + 框架）
├── 第 3 篇  RAG 手动实现（Chunking → Embedding → ChromaDB）
├── 第 4 篇  LangChain.js（LCEL 链式组合、Memory）
└── 第 9 篇  LlamaIndex 知识管理（文档索引、查询引擎）

智能层（Agent + 工具）
├── 第 5-6 篇  Agent + StateGraph（ReAct、Multi-Agent）
├── 第 7 篇  MCP 协议（Tools/Resources/Prompts 标准化）
└── 第 8 篇  Claude Code Skills（定制化、Hooks）

生产层（部署 + 优化）
├── 部署优化模块  Ollama 本地部署、缓存、限流、监控
├── 第 10 篇  Fine-tuning 模型微调
└── 本篇  AI 平台集成与选型 ← 你在这里
```

### 6.2 从学习到实战

学完全部模块后，面对任何 AI 应用需求，你可以：

| 需求 | 你的技术储备 | 实现方式 |
|------|-------------|---------|
| 搭建 AI 聊天机器人 | 第 1-2 篇 | Next.js + streamText |
| 企业知识库问答 | 第 3 篇 + 第 9 篇 | RAG Pipeline / LlamaIndex |
| 智能客服（多工具） | 第 5-6 篇 + 第 7 篇 | Agent + MCP Tools |
| 文档翻译/摘要 | 第 2 篇 + 多模态模块 | Prompt + 多模态 |
| 快速原型验证 | 本篇 | Coze / Dify 平台 |
| 性能优化上线 | 部署优化模块 | 缓存 + 限流 + 监控 |
| 垂直领域定制 | 第 10 篇 | Fine-tuning |
| 混合架构 | 全部 | 核心自研 + 平台辅助 |

## 七、总结

1. **AI 平台底层 = 你学过的全部技术**（Prompt + RAG + Agent + Workflow），平台只是加了一层可视化 UI
2. **Dify** 适合企业级私有部署——开源可控、API 完善、支持 Docker 一键部署
3. **Coze** 适合快速验证和多渠道发布——免费额度大、插件生态丰富、支持微信/飞书等
4. **自研**适合核心业务深度定制——完全的技术控制权、极致的性能优化
5. **渐进式策略**是最务实的选择——先平台验证需求，核心功能再自研
6. **混合架构**是生产环境的常态——核心自研 + 边缘用平台

> 学技术的目的不是技术本身，而是解决问题。理解了底层原理、掌握了框架工具、学会了定制优化、了解了平台方案——你就具备了面对任何 AI 应用需求时做出正确技术选择的能力。

🎉 **全系列完结！**

## 八、参考资料

**官方文档：**
- [Dify 官方文档](https://docs.dify.ai)
- [Dify GitHub 仓库](https://github.com/langgenius/dify)
- [Coze 官方文档](https://www.coze.cn/docs/developer_guides/coze_api_overview)
- [Coze 平台（国内版）](https://www.coze.cn)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
