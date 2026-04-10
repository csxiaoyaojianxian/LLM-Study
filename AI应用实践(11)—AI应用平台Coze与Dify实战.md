# AI应用实践(11)—AI应用平台Coze与Dify实战

学到这里，你已经从底层到框架、从调用到微调，把 LLM 应用开发的整条链路走了一遍。最后这篇换个视角——不再自己造轮子，而是看看市面上的 AI 应用平台是怎么把这些技术封装成产品的。

重点不是教你用平台（官方文档写得够好了），而是搞清楚三件事：平台底层到底是什么、什么时候该用平台、什么时候该自研。有了前面 12 个模块的底子，你看平台的视角会完全不同。

技术栈：Dify API + Coze API + TypeScript
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/13-ai-platform](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/13-ai-platform)

## 一、AI 应用平台是什么

### 1.1 从"手工作坊"到"工厂流水线"

回顾前面的学习路径，每个模块都在解决具体的技术问题。但对于很多业务场景，手写全套代码可能太"重"了。

> 🎒 **类比**：
> - 想做个公司官网 → 你不会从零手写 HTTP 服务器，你用 WordPress
> - 想做个在线表单 → 你不会写数据库 CRUD，你用金数据
> - 想做个 AI 客服 → 你会手写 RAG + Agent？**看情况。**
>
> AI 应用平台就像 WordPress 之于网站——把复杂技术封装成可视化操作。

### 1.2 主流平台

| 平台 | 出品方 | 特色 |
|------|--------|------|
| **Coze（扣子）** | 字节跳动 | 免费额度大、一键发布多渠道 |
| **Dify** | 开源社区 | 可私部署、API 完善、可控性高 |
| FastGPT | 开源社区 | 专注知识库问答 |
| Flowise | 开源社区 | LangChain 可视化编排 |

### 1.3 三大支柱

所有 AI 平台底层都围绕三大支柱：

| 支柱 | 功能 | 对应自研模块 |
|------|------|-------------|
| 🔄 工作流编排 | 可视化拖拽编排处理流程 | Module 06 StateGraph |
| 📚 知识库管理 | 上传文档自动 RAG | Module 04 RAG + Module 11 LlamaIndex |
| 🔧 插件/工具 | 扩展 LLM 外部能力 | Module 06 Agent + Module 07 MCP |

## 二、揭秘——平台底层都是什么

这是本篇最核心的观点——**AI 应用平台的底层，就是你在 Module 01-12 中学过的全部技术**：

```
┌─────────────────────────────────────────────────────┐
│                   AI 应用平台                        │
├─────────────────────────────────────────────────────┤
│  可视化编排层（拖拽式 UI，无代码操作）                  │
├──────────┬──────────┬──────────┬────────────────────┤
│ Prompt   │   RAG    │  Agent   │  Workflow Engine   │
│ Module03 │ Module04 │ Module06 │  Module06          │
├──────────┴──────────┴──────────┴────────────────────┤
│  LLM 调用层（多模型适配）                              │
│  model-adapter.ts（Module 03）                       │
├─────────────────────────────────────────────────────┤
│  基础设施层（向量数据库、缓存、监控）                    │
│  Module 04 + Module 10                              │
└─────────────────────────────────────────────────────┘
```

完整映射表：

| 平台功能 | 对应自研模块 |
|---------|-------------|
| 对话应用 | Module 02 (Next.js Chat) |
| 提示词模板 | Module 03 (Prompt Engineering) |
| 知识库 | Module 04 (RAG) + Module 11 (LlamaIndex) |
| 工作流 | Module 06 (StateGraph) |
| 插件/工具 | Module 06 (Agent) + Module 07 (MCP) |
| 多模型切换 | Module 03 (model-adapter.ts) |
| 多模态 | Module 09 (Vision/Speech) |
| 本地部署 | Module 10 (Ollama) |
| 模型微调 | Module 12 (Fine-tuning) |

> 💡 **关键洞察**：平台没有发明新技术，只是加了一层 UI。理解底层后用平台会事半功倍。

## 三、Dify API 集成

### 3.1 部署

```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker && cp .env.example .env && docker compose up -d
```

### 3.2 Chat API

```typescript
class DifyClient {
  async chat(message: string, conversationId?: string): Promise<DifyResponse> {
    const response = await fetch(`${this.baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: message,
        response_mode: "blocking", // 或 "streaming"
        conversation_id: conversationId || "",
        user: "demo-user",
      }),
    });
    return response.json();
  }
}
```

### 3.3 知识库 API

```
Module 04 流程: fs.readFileSync() → chunk() → embed() → chromaDB.add()
Dify 流程:     POST /datasets/{id}/document/create_by_file（一步到位）
```

底层完全相同的 RAG 流程，Dify 只是包成了 REST API。

## 四、Coze API 集成

### 4.1 核心概念

- **Bot** = AI 应用（含模型 + 提示词 + 知识库 + 插件）
- **Plugin** = Module 06 的 Agent Tool / Module 07 的 MCP Tool
- **Workflow** = Module 06 的 StateGraph
- **Knowledge** = Module 04 的 VectorStore

### 4.2 Chat API

```typescript
class CozeClient {
  async chat(message: string): Promise<{ answer: string }> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bot_id: this.botId,
        stream: false,
        additional_messages: [{
          role: "user",
          content: message,
          content_type: "text",
        }],
      }),
    });
    // Coze 是异步模式，需要轮询获取结果
  }
}
```

### 4.3 插件开发对比

```
Module 06 Agent: 代码中定义 tool function → Zod Schema
Module 07 MCP:   JSON-RPC Server → JSON Schema
Coze Plugin:     HTTP API 端点 → JSON Schema → 平台注册

底层思想一致：让 LLM 知道有哪些工具，以及如何调用。
```

## 五、同一场景三种实现

以"客服知识库问答"为例（`platform-vs-custom.ts`）：

| 维度 | Dify API | Coze API | 自研 RAG |
|------|---------|---------|---------|
| 代码量 | ~10 行 | ~10 行 | ~200 行 |
| 开发时间 | ~30 分钟 | ~20 分钟 | 1-3 天 |
| 灵活性 | 中 | 中 | 高 |
| 数据安全 | 可私部署 | 云端 | 完全可控 |
| 维护成本 | 低 | 最低 | 中-高 |

## 六、选型策略

### 6.1 决策树

```
├── 快速验证想法 / MVP → Coze（最快，免费）
├── 企业级 / 数据安全 → Dify 私有部署
├── 核心业务 / 深度定制 → 自研
└── 不确定 → 渐进式策略
```

### 6.2 渐进式策略（推荐）

```
阶段一（1-2天）：Coze/Dify 搭建原型 → 验证需求
阶段二（1-2周）：Dify API 集成到系统 → 正式上线
阶段三（持续）：核心功能自研 + 边缘功能继续用平台
```

### 6.3 混合架构

```
┌──────────────────────────────────────────────┐
│                 你的应用系统                    │
├──────────┬──────────────────┬────────────────┤
│ 核心功能 │   辅助功能        │  运营工具       │
│ 自研     │   Dify API       │  Coze Bot      │
│ Module   │   知识库问答      │  内部答疑       │
│ 04-12    │   工作流自动化    │  客服助手       │
└──────────┴──────────────────┴────────────────┘
```

## 七、全系列回顾

### 知识图谱

```
基础层
├── Module 01-02  模型调用 + 聊天应用
├── Module 03     Prompt Engineering
└── Module 09     多模态

增强层
├── Module 04     RAG 手动实现
├── Module 05     LangChain.js 框架
└── Module 11     LlamaIndex 知识管理

智能层
├── Module 06     Agent + StateGraph
├── Module 07     MCP 工具协议
└── Module 08     Claude Code Skills

生产层
├── Module 10     部署 + 性能优化
├── Module 12     Fine-tuning 微调
└── Module 13     AI 平台（Coze/Dify）
```

### 学习路径

```
入门（Module 01-03）→ 调用模型、写好 Prompt
进阶（Module 04-07）→ RAG、框架、Agent、MCP
高级（Module 08-10）→ Skills 定制、多模态、生产部署
专家（Module 11-13）→ LlamaIndex、Fine-tuning、平台集成
```

## 八、总结

1. **AI 平台底层 = 你学过的全部技术**（Prompt + RAG + Agent + Workflow）
2. **Coze** 适合快速验证和多渠道发布
3. **Dify** 适合企业级私有部署
4. **自研**适合核心业务深度定制
5. **渐进式策略**是最务实的选择——先平台验证，核心功能再自研

> 学技术的目的不是技术本身，而是解决问题。理解了底层原理、掌握了框架工具、学会了定制优化、了解了平台方案——你就具备了面对任何 AI 应用需求时做出正确技术选择的能力。

🎉 **全系列完结！**
