# AI应用实践(11)—AI应用平台Coze与Dify实战

前面 12 个模块走完了从底层到框架、从调用到微调的完整链路。最后这篇换个视角——不再自己造轮子，而是看看市面上的 AI 应用平台是怎么把这些技术封装成产品的，以及什么时候该用平台、什么时候该自研。有了前面的底子，你看平台的视角会完全不同。

技术栈：Dify API + Coze API + TypeScript / Vercel AI SDK
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/13-ai-platform](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/13-ai-platform)

## 一、AI 应用平台是什么

### 1.1 从"手工作坊"到"工厂流水线"

回顾前面的学习路径，每个模块都在解决具体的技术问题——Module 03 教你写 Prompt、Module 04 手写 RAG、Module 06 构建 Agent、Module 07 对接 MCP……但对于很多业务场景，手写全套代码可能太"重"了。

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
| 🔄 工作流编排 | 可视化拖拽编排处理流程 | Module 06 StateGraph | 拖拽 UI + 条件分支可视化 |
| 📚 知识库管理 | 上传文档自动 RAG | Module 04 RAG + Module 11 LlamaIndex | 自动切分 + 向量化 + 检索 |
| 🔧 插件/工具 | 扩展 LLM 外部能力 | Module 06 Agent + Module 07 MCP | 插件市场 + 一键启用 |

```
  ┌────────────────────────────────────────────────┐
  │              AI 应用平台 ≈ 三大支柱              │
  │                                                 │
  │   🔄 工作流         📚 知识库         🔧 插件    │
  │   ┌──────────┐    ┌──────────┐    ┌──────────┐ │
  │   │ StateGraph│    │   RAG    │    │  Agent   │ │
  │   │ 条件分支  │    │ Chunking │    │ Tool Call│ │
  │   │ 循环节点  │    │ Embedding│    │ MCP Tool │ │
  │   └──────────┘    └──────────┘    └──────────┘ │
  │         +                +               +      │
  │      可视化 UI        一键上传        插件市场    │
  └────────────────────────────────────────────────┘
```

运行 `npm run platform-concepts` 可以看到完整的概念讲解：

```bash
cd 13-ai-platform && npm install
npm run platform-concepts
```

```
🚀 AI 应用平台核心概念
本教程对比分析主流 AI 平台，无需 API Key

============================================================
🏗️  1. AI 应用平台概述
============================================================

📌 什么是 AI 应用平台？
  AI 应用平台是一种低代码/无代码工具，让用户无需编写代码
  即可构建 AI 应用。核心能力是将 LLM 的复杂技术封装为
  可视化的工作流，降低 AI 应用的开发门槛。

📌 主流平台:
  🔵 Coze（扣子）— 字节跳动出品
     - 国内版: coze.cn / 国际版: coze.com
     - 特点: 免费额度大、插件生态丰富、一键发布到多渠道

  🟢 Dify — 开源 AI 应用平台
     - 开源: github.com/langgenius/dify
     - 特点: 可本地部署、完全可控、API 完善、社区活跃

  🟡 其他平台:
     - FastGPT — 开源知识库问答平台
     - Flowise — 开源 LangChain 可视化编排
     - MaxKB — 开源知识库管理平台

...（后续输出三大支柱、特性对比、架构解析、场景分析、知识映射）

============================================================
🎓 概念教程完成！
============================================================
📚 下一步:
  npm run dify-api  → Dify API 集成实战
  npm run coze-api  → Coze API 集成实战
  npm run platform-vs-custom → 平台 vs 自研对比
```



## 二、揭秘——平台底层都是什么

这是本篇最核心的观点——**AI 应用平台的底层，就是你在 Module 01-12 中学过的全部技术**。平台没有发明新技术，只是加了一层 UI。

### 2.1 架构分层

```
┌─────────────────────────────────────────────────────┐
│                   AI 应用平台                        │
├─────────────────────────────────────────────────────┤
│  可视化编排层（拖拽式 UI，无代码操作）                  │
├──────────┬──────────┬──────────┬────────────────────┤
│ Prompt   │   RAG    │  Agent   │  Workflow Engine   │
│ 提示词模板│ 检索增强  │ 工具调用 │  工作流引擎         │
│ Module03 │ Module04 │ Module06 │  Module06          │
├──────────┴──────────┴──────────┴────────────────────┤
│  LLM 调用层（多模型适配）                              │
│  model-adapter.ts（Module 03）                       │
├─────────────────────────────────────────────────────┤
│  基础设施层（向量数据库、缓存、监控、限流）              │
│  Module 04 VectorStore + Module 10 缓存/监控/限流     │
└─────────────────────────────────────────────────────┘
```

### 2.2 完整映射表

| 平台功能 | 对应自研模块 | 你学到了什么 |
|---------|-------------|-------------|
| 对话应用 | Module 02 (Next.js Chat) | `useChat()` + `streamText()` 全栈流式 |
| 提示词模板 | Module 03 (Prompt Engineering) | Few-shot、CoT、结构化输出 |
| 知识库 | Module 04 (RAG) + Module 11 (LlamaIndex) | Chunking → Embedding → 向量检索 |
| 工作流 | Module 06 (StateGraph) | 条件分支、循环、人工审批 |
| 插件/工具 | Module 06 (Agent) + Module 07 (MCP) | Function Calling + MCP 标准协议 |
| 多模型切换 | Module 03 (model-adapter.ts) | DeepSeek/OpenAI/Anthropic 统一适配 |
| 对话记忆 | Module 05 (Memory) + Module 06 (Memory) | MemorySaver + 会话管理 |
| 多模态 | Module 09 (Vision/Speech) | 图像理解、语音转文字、TTS |
| 本地部署 | Module 10 (Ollama) | 本地推理、云端对比 |
| 模型微调 | Module 12 (Fine-tuning) | 数据准备、训练、评估 |

> 💡 **关键洞察**：理解底层后用平台会事半功倍——你知道知识库"高质量索引"背后是 Embedding + 向量检索，知道工作流的"条件分支"就是 StateGraph 的 `conditionalEdge`，知道插件系统本质是 Function Calling。遇到平台功能不满足的场景，你也知道该怎么自研替代。



## 三、Dify——开源 AI 应用平台

### 3.1 Docker 部署架构

Dify 推荐使用 Docker Compose 部署，一条命令启动包含多个服务的完整集群：

```bash
# 克隆源码
git clone https://github.com/langgenius/dify.git
cd dify/docker

# 复制环境变量
cp .env.example .env

# 启动所有服务
docker compose up -d
```

启动后，Docker 会拉起以下服务：

```
┌─────────────────────────────────────────────────────┐
│              Dify Docker Compose 集群                 │
│                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │  Nginx  │  │   Web   │  │   API   │              │
│  │  :80    │→ │  :3000  │  │  :5001  │              │
│  │ 反向代理 │  │ 前端 UI  │  │ 后端服务 │              │
│  └─────────┘  └─────────┘  └────┬────┘              │
│                                  │                    │
│  ┌─────────┐  ┌─────────┐  ┌───▼─────┐             │
│  │  Redis  │  │PostgreSQL│  │ Worker  │             │
│  │  :6379  │  │  :5432  │  │ 异步任务 │             │
│  │ 缓存/队列│  │ 主数据库 │  │ Celery  │             │
│  └─────────┘  └─────────┘  └─────────┘             │
│                                                       │
│  ┌─────────┐  ┌──────────┐                           │
│  │ Weaviate│  │ Sandbox  │                           │
│  │  :8080  │  │ 代码沙箱  │                           │
│  │ 向量数据库│  │ 安全执行  │                           │
│  └─────────┘  └──────────┘                           │
└─────────────────────────────────────────────────────┘
```

| 服务 | 作用 | 对应自研模块 |
|------|------|-------------|
| **API** | 后端核心，处理 LLM 调用/RAG/工作流 | Module 03 model-adapter + Module 06 |
| **Worker** | Celery 异步任务（文档解析、向量化） | Module 04 Chunking + Embedding |
| **Weaviate** | 向量数据库（也支持切换为 Qdrant/Milvus） | Module 04 ChromaDB |
| **PostgreSQL** | 存储应用配置、对话记录、用户数据 | 业务数据库 |
| **Redis** | 缓存 + 消息队列 | Module 10 缓存策略 |
| **Sandbox** | 代码执行沙箱（工作流中的代码节点） | 安全隔离执行 |

> 💡 对比 Module 04 的 `docker run chromadb/chroma`——Dify 把整条 RAG 流水线（切分 → 向量化 → 存储 → 检索）全部封装进了这套微服务集群。

启动后访问 `http://localhost` 即可使用。首次访问需要设置管理员账号。也可以使用云端版本 [cloud.dify.ai](https://cloud.dify.ai) 免部署体验。

### 3.2 Chat API——对话型应用

Dify 的 Chat API 对应平台中的"聊天助手"应用类型。核心参数：

```typescript
interface DifyConfig {
  baseUrl: string;   // Dify API 地址（默认 http://localhost/v1）
  apiKey: string;    // 应用 API Key（格式: app-xxxx）
}

class DifyClient {
  private config: DifyConfig;

  /**
   * Chat API — 对话型应用
   * @param message - 用户消息
   * @param conversationId - 对话 ID（传空字符串开启新对话）
   * @param user - 用户标识（用于区分不同用户的对话历史）
   */
  async chat(
    message: string,
    conversationId?: string,
    user: string = "demo-user"
  ): Promise<DifyResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},                          // 模板变量（如果 Prompt 模板中有变量）
        query: message,                      // 用户问题
        response_mode: "blocking",           // "blocking" 等待完整回复 / "streaming" 流式
        conversation_id: conversationId || "",// 空字符串 = 新对话
        user,                                // 用户标识，必填
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dify API 错误 (${response.status}): ${error}`);
    }

    return response.json() as Promise<DifyResponse>;
  }
}
```

参数详解：

| 参数 | 必填 | 说明 |
|------|------|------|
| `query` | ✅ | 用户的问题内容 |
| `inputs` | ✅ | Prompt 模板变量，例如 `{ "language": "中文" }`，没有变量传 `{}` |
| `response_mode` | ✅ | `"blocking"` 同步等待 / `"streaming"` SSE 流式 |
| `conversation_id` | ❌ | 传入则继续上一次对话（多轮），空字符串开启新对话 |
| `user` | ✅ | 用户唯一标识，Dify 用它隔离不同用户的会话 |

### 3.3 流式响应——SSE 处理

流式模式下，Dify 通过 Server-Sent Events（SSE）逐字返回结果，与 Module 02 中 Next.js 的 `streamText()` 原理一致：

```typescript
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
      response_mode: "streaming",  // 关键：切换为流式
      conversation_id: conversationId || "",
      user: "demo-user",
    }),
  });

  // 处理 SSE 流（与 Module 02 的 EventSource 思路相同）
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

    for (const line of lines) {
      const jsonStr = line.slice(6);   // 移除 "data: " 前缀
      if (jsonStr === "[DONE]") continue;

      const data = JSON.parse(jsonStr);
      if (data.event === "message" && data.answer) {
        process.stdout.write(data.answer);  // 逐字输出
      }
    }
  }
}
```

### 3.4 Workflow API——运行工作流

Dify 的工作流对应 Module 06 的 StateGraph——可视化编排的处理流程：

```typescript
/**
 * Workflow API — 运行工作流
 * 对应 Dify 中的 "工作流" 应用类型
 */
async runWorkflow(
  inputs: Record<string, string>,
  user: string = "demo-user"
): Promise<Record<string, unknown>> {
  const response = await fetch(`${this.config.baseUrl}/workflows/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs,                  // 工作流输入变量
      response_mode: "blocking",
      user,
    }),
  });

  return (await response.json()) as Record<string, unknown>;
}

// 使用示例
const result = await client.runWorkflow({
  input_text: "需要处理的文本",
  target_language: "英文",
});
```

> 🎒 **类比**：
> Dify Workflow API 的 `inputs` 就像 Module 06 StateGraph 的初始 State——你定义好输入变量，工作流引擎按照编排的节点逐步处理，最终输出结果。区别在于 StateGraph 用代码定义节点和边，Dify 用拖拽 UI。

### 3.5 知识库 API——一键 RAG

这是 Dify 最省心的功能。回忆 Module 04 手写 RAG 的完整流程：

```
Module 04 手写 RAG（~200 行代码）:
  fs.readFileSync("doc.md")
  → RecursiveChunker.chunk(text, { size: 500 })
  → LocalEmbedding.embed(chunks)
  → chromaDB.add(embeddings)
  → chromaDB.query(questionEmbedding, topK: 3)
  → 拼入 Prompt → chatWithModel()

Dify 知识库 API（一步到位）:
  POST /datasets/{id}/document/create_by_file
  （上传文件，Dify 自动完成切分 → 向量化 → 存储）
```

知识库管理的核心 API：

```typescript
// 1. 创建知识库
// POST /datasets
// { "name": "产品文档", "permission": "only_me" }

// 2. 上传文档到知识库（自动切分 + 向量化）
// POST /datasets/{dataset_id}/document/create_by_file
// Content-Type: multipart/form-data
// file: <文件内容>
// data: {
//   "indexing_technique": "high_quality",   ← 高质量=Embedding向量检索
//   "process_rule": {
//     "mode": "automatic"                   ← 自动切分（也可手动配置大小）
//   }
// }

// 3. 在知识库中检索
// POST /datasets/{dataset_id}/retrieve
// { "query": "用户问题", "top_k": 3, "score_threshold": 0.5 }
```

> 💡 `indexing_technique` 有两个选项：`"high_quality"` 使用 Embedding 模型做向量检索（即 Module 04 的方式），`"economy"` 使用关键词倒排索引（更快更省但精度低）。底层技术完全一样，Dify 只是包成了 REST API。

### 3.6 运行 Dify API 示例

```bash
npm run dify-api
```

```
🚀 Dify API 集成教程

============================================================
🐳 1. Dify 本地部署指南
============================================================

📌 方式一：Docker Compose（推荐）
  ```bash
  # 克隆 Dify 源码
  git clone https://github.com/langgenius/dify.git
  cd dify/docker

  # 复制环境变量配置
  cp .env.example .env

  # 启动所有服务
  docker compose up -d
  ```
  启动后访问: http://localhost（默认端口 80）
  首次访问需要设置管理员账号

📌 方式二：Dify 云端（免部署）
  访问 https://cloud.dify.ai 注册账号
  免费版有一定额度限制

📌 获取 API Key:
  1. 在 Dify 中创建一个应用
  2. 进入应用设置 → API 密钥
  3. 生成 API Key（格式: app-xxxx）
  4. 填入 .env 的 DIFY_API_KEY

============================================================
🔧 2. Dify API 使用演示
============================================================

⚠️  未配置 DIFY_API_KEY，展示 API 调用代码示例

📌 Chat API 调用示例:
  const client = new DifyClient({
    baseUrl: "http://localhost/v1",
    apiKey: "app-xxxx"
  });
  const response = await client.chat("你好");
  console.log(response.answer);

📌 Workflow API 调用示例:
  const result = await client.runWorkflow({
    input_text: "需要处理的文本"
  });
  console.log(result);

📌 流式响应示例:
  await client.chatStream("讲个故事");
  // 输出会逐字显示在终端

============================================================
📚 3. Dify 知识库 API
============================================================

📌 知识库管理（需要使用 Dataset API Key）:

  创建知识库:
  POST /datasets
  { "name": "产品文档", "permission": "only_me" }

  上传文档:
  POST /datasets/{dataset_id}/document/create_by_file
  Content-Type: multipart/form-data

  查询知识库:
  POST /datasets/{dataset_id}/retrieve
  { "query": "用户问题", "top_k": 3 }

💡 对比 Module 04 RAG:
  Module 04: 手动 chunking → embedding → ChromaDB → 检索
  Dify: 上传文件 → 自动处理 → API 查询
  Dify 底层也是同样的 RAG 流程，只是封装为了 API

============================================================
💡 4. Dify 集成最佳实践
============================================================

📌 API 调用优化:
  - 使用流式响应（streaming）提升用户体验
  - 实现重试机制和超时处理
  - 缓存常见问题的回答（参考 Module 10 缓存策略）

📌 安全建议:
  - API Key 只在服务端使用，不要暴露给前端
  - 设置 IP 白名单限制 API 访问
  - 监控 API 调用量，防止滥用

============================================================
🎓 Dify 教程完成！
============================================================
📚 下一步:
  npm run coze-api → Coze API 集成
  npm run platform-vs-custom → 平台 vs 自研对比
```



## 四、Coze——字节跳动的 AI 应用平台

### 4.1 核心概念映射

Coze 的概念体系可以直接映射到你已经学过的技术：

| Coze 概念 | 含义 | 对应自研模块 |
|-----------|------|-------------|
| **Bot** | AI 应用（含模型 + 提示词 + 知识库 + 插件） | Module 02 整个 Chat App |
| **Plugin** | 扩展 Bot 的外部能力（API 调用等） | Module 06 Agent Tool / Module 07 MCP Tool |
| **Workflow** | 多步骤自动化流程 | Module 06 StateGraph |
| **Knowledge** | 知识库（文档 RAG） | Module 04 VectorStore |
| **Memory** | 长期记忆（跨会话） | Module 06 MemorySaver |

### 4.2 Chat API——异步轮询机制

Coze 的 API 设计与 Dify 有个关键区别——**非流式模式下采用异步轮询**，而不是同步阻塞。这是理解 Coze API 的核心：

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

完整的 Coze Client 实现：

```typescript
interface CozeConfig {
  baseUrl: string;       // API 地址（https://api.coze.cn/v1）
  accessToken: string;   // 个人访问令牌
  botId: string;         // Bot ID
}

class CozeClient {
  private config: CozeConfig;

  /**
   * Chat API — 发送对话消息（非流式，需轮询）
   */
  async chat(
    message: string,
    conversationId?: string,
    userId: string = "demo_user"
  ): Promise<{ answer: string; conversationId: string }> {

    const body: Record<string, unknown> = {
      bot_id: this.config.botId,        // 目标 Bot
      user_id: userId,                   // 用户标识
      stream: false,                     // false=异步轮询模式
      auto_save_history: true,           // 自动保存到对话历史
      additional_messages: [{            // 消息数组
        role: "user",
        content: message,
        content_type: "text",            // 也支持 "object_string" 传富文本
      }],
    };

    if (conversationId) {
      body.conversation_id = conversationId;  // 继续已有对话
    }

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

    // 第二步：轮询等待完成
    const answer = await this.pollChatResult(convId, chatId, userId);
    return { answer, conversationId: convId };
  }

  /**
   * 轮询获取对话结果
   * 最多等待 30 秒（每秒查询一次）
   */
  private async pollChatResult(
    conversationId: string,
    chatId: string,
    userId: string
  ): Promise<string> {
    const maxRetries = 30;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise(r => setTimeout(r, 1000));  // 等 1 秒

      // 查询对话状态
      const response = await fetch(
        `${this.config.baseUrl}/chat/retrieve` +
        `?conversation_id=${conversationId}&chat_id=${chatId}`,
        {
          headers: { Authorization: `Bearer ${this.config.accessToken}` },
        }
      );

      const data = await response.json();

      if (data.data?.status === "completed") {
        // 状态完成 → 获取消息列表
        const msgResponse = await fetch(
          `${this.config.baseUrl}/chat/message/list` +
          `?conversation_id=${conversationId}&chat_id=${chatId}`,
          {
            headers: { Authorization: `Bearer ${this.config.accessToken}` },
          }
        );
        const msgData = await msgResponse.json();

        // 从消息列表中找到 assistant 的 answer 类型消息
        const assistantMsg = msgData.data?.find(
          (m: { role: string; type: string }) =>
            m.role === "assistant" && m.type === "answer"
        );
        return assistantMsg?.content || "";
      }

      if (data.data?.status === "failed") {
        throw new Error("对话处理失败");
      }

      // status === "in_progress" → 继续轮询
    }

    throw new Error("对话超时（30秒）");
  }
}
```

### 4.3 流式响应——SSE 事件

Coze 的流式模式使用 SSE，事件名与 Dify 不同：

```typescript
async chatStream(message: string, conversationId?: string): Promise<void> {
  const response = await fetch(`${this.config.baseUrl}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bot_id: this.config.botId,
      user_id: "demo_user",
      stream: true,                    // 关键：开启流式
      auto_save_history: true,
      additional_messages: [{
        role: "user",
        content: message,
        content_type: "text",
      }],
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      const data = JSON.parse(jsonStr);
      // Coze SSE 事件类型：conversation.message.delta
      if (
        data.event === "conversation.message.delta" &&
        data.message?.role === "assistant" &&
        data.message?.type === "answer"
      ) {
        process.stdout.write(data.message.content);  // 逐字输出
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

### 4.4 插件开发——三种工具定义方式对比

Coze 的插件系统是 AI 平台版的 Function Calling。对比三种工具定义方式，底层思想完全一致——**让 LLM 知道有哪些工具，以及如何调用**：

```
Module 06 Agent（代码定义）:
  tool({
    description: "查询天气",
    parameters: z.object({
      city: z.string().describe("城市名")
    }),
    execute: async ({ city }) => fetchWeather(city)
  })

Module 07 MCP（JSON-RPC Server 定义）:
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

Coze 自定义插件开发的完整流程：

```
1. 定义 API 端点（你的 HTTP 服务）
   POST https://your-api.com/weather
   Body: { "city": "北京" }
   Response: { "temperature": 22, "condition": "晴" }

2. 编写 JSON Schema 描述（让 LLM 知道怎么调用）
   name + description + parameters

3. 在 Coze 平台注册插件
   填入端点 URL + Schema

4. 在 Bot 中启用插件
   Bot 对话时 LLM 会自动判断是否需要调用
```

> 💡 如果你的服务已经实现了 MCP Server，理论上可以通过一个 HTTP 网关把 MCP Tool 暴露为 HTTP API，然后注册到 Coze——这就是标准化协议的价值。

### 4.5 工作流 API

Coze 的工作流节点类型可以直接映射到 Module 06 的概念：

| Coze 节点 | 功能 | 对应自研概念 |
|-----------|------|-------------|
| LLM 节点 | 调用大模型生成 | `chatWithModel()` |
| 知识库检索节点 | 从知识库检索 | `RAGPipeline.query()` |
| 代码节点 | 执行自定义代码 | 自定义函数 |
| 条件分支节点 | 根据条件选择路径 | `StateGraph.addConditionalEdges()` |
| 循环节点 | 重复执行 | StateGraph 循环边 |
| 插件调用节点 | 调用外部插件 | Agent `callTool()` |

工作流 API 调用：

```typescript
// 触发工作流执行
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

### 4.6 运行 Coze API 示例

```bash
npm run coze-api
```

```
🚀 Coze API 集成教程

============================================================
🤖 1. Coze（扣子）平台介绍
============================================================

📌 Coze 是字节跳动推出的 AI 应用开发平台:
  - 国内版: https://www.coze.cn
  - 国际版: https://www.coze.com
  - API 文档: https://www.coze.cn/docs/developer_guides/coze_api_overview

📌 核心概念:
  - Bot（机器人）: AI 应用的基本单元
  - Plugin（插件）: 扩展 Bot 能力的工具
  - Workflow（工作流）: 多步骤自动化流程
  - Knowledge（知识库）: RAG 数据源

📌 获取 API 凭证:
  1. 访问 https://www.coze.cn 登录账号
  2. 创建一个 Bot 并配置好提示词
  3. 发布 Bot（选择 API 渠道）
  4. 在个人设置中生成 Access Token
  5. 记录 Bot ID 和 Access Token 填入 .env

============================================================
🔧 5. Coze API 调用演示
============================================================

⚠️  未配置 COZE_ACCESS_TOKEN 或 COZE_BOT_ID
  请在 .env 中配置后重试
  以下展示代码调用示例:

  ```typescript
  const client = new CozeClient({
    baseUrl: "https://api.coze.cn/v1",
    accessToken: "your_token",
    botId: "your_bot_id"
  });

  // 非流式对话
  const result = await client.chat("你好");
  console.log(result.answer);

  // 流式对话
  await client.chatStream("讲一个故事");
  ```

============================================================
🔌 3. Coze 插件开发
============================================================

📌 Coze 插件 = 对应 Module 06 的 Agent Tools
  插件让 Bot 可以调用外部能力（API、数据库等）

📌 插件类型:
  1. 预置插件: Coze 提供的现成插件（搜索、天气、新闻等）
  2. 自定义插件: 开发者自己编写的插件
  3. 工作流插件: 将工作流封装为可复用的插件

💡 对比:
  Module 06 Agent: 代码中定义 tool function
  Module 07 MCP: 标准化的 Tool 协议
  Coze Plugin: HTTP API + Schema 注册
  底层思想一致: 让 LLM 知道有哪些工具，以及如何调用

============================================================
⚡ 4. Coze 工作流 API
============================================================

📌 工作流 = 对应 Module 06 的 StateGraph
  Coze 的可视化工作流编排 ↔ LangGraph 的代码编排

============================================================
🎓 Coze 教程完成！
============================================================
📚 下一步: npm run platform-vs-custom → 平台 vs 自研对比
```



## 五、同一场景三种实现——客服知识库问答

以一个具体场景——"客服知识库问答"——来对比三种实现方式的差异。

### 5.1 场景定义

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

### 5.2 方案一：Dify API（~10 行核心代码）

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

### 5.3 方案二：Coze API（~10 行核心代码 + 轮询逻辑）

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

### 5.4 方案三：自研 RAG（~200 行核心代码）

```typescript
// 完整版参见 Module 04 rag-pipeline.ts

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

### 5.5 综合对比

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

### 5.6 运行对比示例

```bash
npm run platform-vs-custom
```

```
🚀 平台方案 vs 自研方案对比实战

============================================================
🎯 场景：客服知识库问答系统
============================================================

📌 需求描述:
  构建一个客服问答系统，能够:
  1. 理解用户的自然语言问题
  2. 从产品知识库中检索相关信息
  3. 生成准确、友好的回答
  4. 支持多轮对话（上下文理解）

📌 测试问题:
  Q1: "你们的产品有什么功能？"
  Q2: "价格是多少？"
  Q3: "怎么开始使用？"

============================================================
🟢 方案一：Dify API
============================================================

  ⚠️  未配置 DIFY_API_KEY，展示实现思路:

  📌 Dify 实现步骤:
  1. 在 Dify 中创建'聊天助手'应用
  2. 创建知识库，上传产品文档
  3. 在应用中关联知识库
  4. 配置提示词模板
  5. 通过 API 调用

  📌 代码量: ~10 行（仅 API 调用）
  📌 开发时间: ~30 分钟（含平台配置）

============================================================
🔵 方案二：Coze API
============================================================

  ⚠️  未配置 Coze 凭证，展示实现思路:

  📌 Coze 实现步骤:
  1. 在 Coze 中创建 Bot
  2. 上传知识库文档
  3. 配置提示词和技能
  4. 发布为 API
  5. 调用 Chat API

  📌 代码量: ~10 行（仅 API 调用）
  📌 开发时间: ~20 分钟（平台操作更简单）

============================================================
🔴 方案三：自研 RAG（Module 04 方案）
============================================================

  📌 使用 deepseek 模型
  ❓ 问题: 你们的产品有什么功能？
  🔍 检索知识库...
  📄 找到 2 个相关文档
  🤖 LLM 生成回答...
  💬 回答: 我们的 AI 助手产品支持以下功能：智能问答、文档分析...

============================================================
📊 综合对比
============================================================

┌──────────────────┬──────────────┬──────────────┬──────────────┐
│       维度       │   Dify API   │   Coze API   │   自研 RAG   │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 开发时间         │ ~30 分钟     │ ~20 分钟     │ 1-3 天       │
│ 代码量           │ ~10 行       │ ~10 行       │ ~200 行      │
│ 灵活性           │ 中           │ 中           │ 高           │
│ 数据安全         │ 可私部署     │ 云端         │ 完全可控     │
│ 维护成本         │ 低           │ 最低         │ 中-高        │
│ 扩展性           │ API/Workflow │ Plugin       │ 无限         │
│ 学习曲线         │ 低           │ 最低         │ 高           │
└──────────────────┴──────────────┴──────────────┴──────────────┘

📌 决策树:
  快速验证 / 非核心功能 → Coze（最快上线）
  企业级 / 需要私部署  → Dify（开源可控）
  核心业务 / 深度定制  → 自研（完全掌控）
  混合方案（推荐）     → 核心自研 + 边缘用平台

============================================================
🎓 Module 13 全部完成！
============================================================

🎉 恭喜！你已完成 LLM-Study 全部 13 个模块的学习！
```



## 六、选型策略

### 6.1 决策树

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
│   └── → 自研（Module 04-12 的技术全用上）
│
└── 不确定 / 需要逐步演进
    └── → 渐进式策略（见 6.2）
```

### 6.2 渐进式策略（推荐）

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

### 6.3 混合架构

生产环境中最常见的是混合架构——核心自研 + 边缘用平台：

```
┌──────────────────────────────────────────────┐
│                 你的应用系统                    │
├──────────┬──────────────────┬────────────────┤
│ 核心功能 │   辅助功能        │  运营工具       │
│ 自研     │   Dify API       │  Coze Bot      │
│          │                  │                │
│ 定制 RAG │   知识库问答      │  内部答疑       │
│ 定制Agent│   工作流自动化    │  客服助手       │
│ 模型微调 │   文档处理        │  数据报表       │
│          │                  │                │
│ Module   │   HTTP API       │  多渠道发布     │
│ 04-12    │   调用           │  微信/飞书      │
└──────────┴──────────────────┴────────────────┘
```

> 💡 这种架构的好处：核心业务保持完全控制权（性能、安全、定制），非核心功能享受平台的低成本和快速迭代。



## 七、全系列回顾

### 7.1 知识图谱

13 个模块形成了一张完整的 AI 应用开发知识图谱：

```
基础层（入门必修）
├── Module 01  LLM 基础概念 + 模型调用
├── Module 02  Next.js 全栈聊天应用（useChat + streamText）
├── Module 03  Prompt Engineering（模板、Few-shot、CoT、结构化输出）
└── Module 09  多模态（Vision、DALL-E、TTS、Whisper）

增强层（RAG + 框架）
├── Module 04  RAG 手动实现（Chunking → Embedding → ChromaDB → 检索）
├── Module 05  LangChain.js 框架（LCEL 链式组合、Memory、OutputParser）
└── Module 11  LlamaIndex 知识管理（文档索引、查询引擎）

智能层（Agent + 工具）
├── Module 06  Agent + StateGraph（ReAct、多步规划、Multi-Agent）
├── Module 07  MCP 协议（Tools/Resources/Prompts 标准化）
└── Module 08  Claude Code Skills（定制化、Hooks、配置体系）

生产层（部署 + 优化）
├── Module 10  部署优化（Ollama 本地、缓存、限流、监控）
├── Module 12  Fine-tuning 模型微调（数据准备、训练、评估）
└── Module 13  AI 平台（Coze/Dify 集成、选型策略）← 你在这里
```

### 7.2 学习路径

```
入门（Module 01-03）
  目标: 能调用模型、写好 Prompt、构建简单聊天应用
  关键技能: streamText, Prompt 模板, 结构化输出

进阶（Module 04-07）
  目标: 掌握 RAG、框架、Agent、MCP 四大核心技术
  关键技能: 向量检索, LCEL 链, ReAct Agent, MCP Server

高级（Module 08-10）
  目标: Skills 定制、多模态、生产级部署
  关键技能: Hooks, Vision/TTS, 缓存/限流/监控

专家（Module 11-13）
  目标: 高级知识管理、模型定制、平台集成与选型
  关键技能: LlamaIndex, Fine-tuning, 平台 API, 架构决策
```

### 7.3 核心技术串联

回顾整个系列，有一条贯穿始终的技术主线——**model-adapter.ts**：

```
Module 03  创建 model-adapter.ts（DeepSeek/OpenAI/Anthropic 统一适配）
    ↓ 复制到各模块（保持独立可运行）
Module 04  用于 RAG 的 LLM 生成环节
Module 05  用于 LangChain 的模型层
Module 06  用于 Agent 的推理引擎
Module 07  用于 MCP Client 的 LLM 集成
Module 09  扩展 getVisionProvider()
Module 10  扩展 Ollama 支持 + getOllamaModels()
Module 13  用于自研 RAG 方案的 LLM 调用 ← 最终版
```

这也是 AI 应用平台在做的事——**多模型适配层**。Dify 支持接入数十个模型提供商，底层就是一个更完善的 model-adapter。

### 7.4 从学习到实战

学完全部模块后，面对任何 AI 应用需求，你可以：

| 需求 | 你的技术储备 | 实现方式 |
|------|-------------|---------|
| 搭建 AI 聊天机器人 | Module 02 + 03 | Next.js + streamText |
| 企业知识库问答 | Module 04 + 11 | RAG Pipeline / LlamaIndex |
| 智能客服（多工具） | Module 06 + 07 | Agent + MCP Tools |
| 文档翻译/摘要 | Module 03 + 09 | Prompt + 多模态 |
| 快速原型验证 | Module 13 | Coze / Dify 平台 |
| 性能优化上线 | Module 10 | 缓存 + 限流 + 监控 |
| 垂直领域定制 | Module 12 | Fine-tuning |
| 混合架构 | 全部 | 核心自研 + 平台辅助 |

## 八、总结

1. **AI 平台底层 = 你学过的全部技术**（Prompt + RAG + Agent + Workflow），平台只是加了一层可视化 UI
2. **Dify** 适合企业级私有部署——开源可控、API 完善、支持 Docker 一键部署
3. **Coze** 适合快速验证和多渠道发布——免费额度大、插件生态丰富、支持微信/飞书等
4. **自研**适合核心业务深度定制——完全的技术控制权、极致的性能优化
5. **渐进式策略**是最务实的选择——先平台验证需求，核心功能再自研
6. **混合架构**是生产环境的常态——核心自研 + 边缘用平台

> 学技术的目的不是技术本身，而是解决问题。理解了底层原理、掌握了框架工具、学会了定制优化、了解了平台方案——你就具备了面对任何 AI 应用需求时做出正确技术选择的能力。

🎉 **全系列完结！**

## 九、参考资料

**官方文档：**
- [Dify 官方文档](https://docs.dify.ai)
- [Dify GitHub 仓库](https://github.com/langgenius/dify)
- [Coze 官方文档](https://www.coze.cn/docs/developer_guides/coze_api_overview)
- [Coze 平台（国内版）](https://www.coze.cn)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

**相关代码：**
- [13-ai-platform](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/13-ai-platform)

