# 13-ai-platform — AI 应用平台（Coze & Dify）

> 学习主流 AI 应用平台的工作原理和 API 集成，理解平台化 vs 自研的取舍

## 学习目标

- 理解 AI 应用平台的三大支柱：工作流编排、知识库管理、插件/工具系统
- 掌握 Dify API 的 Chat/Completion/Workflow/Knowledge 调用方式
- 掌握 Coze API 的 Bot 对话、流式响应和插件开发概念
- 对同一需求分别用 Dify API、Coze API、自研 RAG 实现并对比
- 建立"何时用平台、何时自研"的选型判断能力

## 环境配置

### 1. 安装依赖

```bash
cd 13-ai-platform
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env
```

**各脚本所需凭证：**

| 脚本 | 需要的配置 |
|------|-----------|
| `platform-concepts` | 无需任何配置 |
| `dify-api` | `DIFY_API_URL` + `DIFY_API_KEY` |
| `coze-api` | `COZE_ACCESS_TOKEN` + `COZE_BOT_ID` |
| `platform-vs-custom` | 至少一个 LLM API Key（自研方案需要） |

### 3. Dify 部署（可选）

Dify 需要本地部署或使用云端服务：

**方式 1：Docker 本地部署（推荐）**
```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env
docker compose up -d
# 访问 http://localhost，首次需设置管理员账号
```

**方式 2：Dify 云端**
- 访问 https://cloud.dify.ai 注册
- 创建应用 → API 密钥 → 获取 `app-xxxx` 格式的 Key

### 4. Coze 配置（可选）

- 访问 https://www.coze.cn 登录
- 创建 Bot → 配置提示词和知识库 → 发布（选择 API 渠道）
- 个人设置 → 生成 Access Token
- 记录 Bot ID 和 Token 填入 `.env`



## Demo 脚本

### `npm run platform-concepts` — AI 平台核心概念（无需任何配置）

对比分析主流 AI 应用平台的架构、特性和适用场景：

- **平台概述**：Coze、Dify、FastGPT 等平台介绍
- **三大支柱**：工作流 / 知识库 / 插件，与自研模块的对应关系
- **特性矩阵**：Coze vs Dify vs 自研 的 8 维度对比
- **架构揭秘**：平台底层 = Module 01-12 学过的全部技术
- **适用场景**：何时 Coze / 何时 Dify / 何时自研
- **知识映射**：平台功能 ↔ 自研模块的完整对照表

```bash
npm run platform-concepts
```

```
🏗️  1. AI 应用平台概述

📌 主流平台:
  🔵 Coze（扣子）— 字节跳动出品
     - 特点: 免费额度大、插件生态丰富、一键发布到多渠道
  🟢 Dify — 开源 AI 应用平台
     - 特点: 可本地部署、完全可控、API 完善、社区活跃

🏛️  2. AI 应用平台的三大支柱

📌 支柱一：工作流编排（Workflow）
  对应自研: Module 06 StateGraph（LangGraph 状态图）
📌 支柱二：知识库管理（Knowledge Base）
  对应自研: Module 04 RAG Pipeline + Module 11 LlamaIndex
📌 支柱三：插件/工具系统（Plugins/Tools）
  对应自研: Module 06 Agent Tools + Module 07 MCP

📊 3. Coze vs Dify vs 自研 特性对比

┌──────────────────┬──────────────┬──────────────┬──────────────┐
│       维度       │     Coze     │     Dify     │    自研      │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 开发成本         │ ⭐ 最低      │ ⭐⭐ 低       │ ⭐⭐⭐⭐⭐ 高 │
│ 灵活性           │ ⭐⭐ 中等     │ ⭐⭐⭐ 较高   │ ⭐⭐⭐⭐⭐ 最高│
│ 数据安全         │ ⭐⭐ 云端     │ ⭐⭐⭐⭐⭐ 私部│ ⭐⭐⭐⭐⭐ 完控│
│ ...              │              │              │              │
└──────────────────┴──────────────┴──────────────┴──────────────┘

🗺️  6. 知识映射 — 平台功能 ↔ 自研模块

┌────────────────────┬─────────────────────────────────────────┐
│   平台功能         │         对应自研模块                     │
├────────────────────┼─────────────────────────────────────────┤
│ 对话应用           │ Module 02 (Next.js Chat)                │
│ 提示词模板         │ Module 03 (Prompt Engineering)           │
│ 知识库             │ Module 04 (RAG) + Module 11 (LlamaIndex)│
│ 工作流             │ Module 06 (StateGraph)                  │
│ 插件/工具          │ Module 06 (Agent) + Module 07 (MCP)     │
│ 模型微调           │ Module 12 (Fine-tuning)                 │
└────────────────────┴─────────────────────────────────────────┘
```



### `npm run dify-api` — Dify API 集成

演示 Dify 平台的 API 调用（需要部署 Dify + 配置 `DIFY_API_KEY`）：

- **部署指南**：Docker Compose 一键部署 / 云端使用
- **Chat API**：对话型应用的阻塞/流式调用
- **多轮对话**：通过 `conversation_id` 维护上下文
- **知识库 API**：创建知识库、上传文档、语义检索
- **最佳实践**：API 优化、知识库配置、安全建议

```bash
npm run dify-api
```

未配置 API Key 时展示部署指南和代码示例：

```
🐳 1. Dify 本地部署指南

📌 方式一：Docker Compose（推荐）
  git clone https://github.com/langgenius/dify.git
  cd dify/docker && cp .env.example .env && docker compose up -d
  启动后访问: http://localhost

📌 代码示例:
  const client = new DifyClient({
    baseUrl: "http://localhost/v1",
    apiKey: "app-xxxx"
  });
  const response = await client.chat("你好");
  console.log(response.answer);

📚 3. Dify 知识库 API

  POST /datasets                              → 创建知识库
  POST /datasets/{id}/document/create_by_file → 上传文档
  POST /datasets/{id}/retrieve                → 语义检索

💡 对比 Module 04 RAG:
  Module 04: 手动 chunking → embedding → ChromaDB → 检索
  Dify: 上传文件 → 自动处理 → API 查询
```



### `npm run coze-api` — Coze API 集成

演示 Coze（扣子）平台的 API 调用（需要配置 `COZE_ACCESS_TOKEN` + `COZE_BOT_ID`）：

- **平台介绍**：Coze 核心概念和凭证获取
- **Chat API**：非流式对话（异步轮询）和流式对话（SSE）
- **插件开发**：自定义插件的 Schema 定义，对比 Module 06 Agent Tool / Module 07 MCP
- **工作流 API**：触发工作流执行，对比 Module 06 StateGraph

```bash
npm run coze-api
```

```
🤖 1. Coze（扣子）平台介绍

📌 核心概念:
  - Bot（机器人）: AI 应用的基本单元
  - Plugin（插件）: 扩展 Bot 能力的工具
  - Workflow（工作流）: 多步骤自动化流程
  - Knowledge（知识库）: RAG 数据源

🔌 3. Coze 插件开发
📌 对比:
  Module 06 Agent: 代码中定义 tool function
  Module 07 MCP: 标准化的 Tool 协议
  Coze Plugin: HTTP API + Schema 注册
  底层思想一致: 让 LLM 知道有哪些工具，以及如何调用
```



### `npm run platform-vs-custom` — 平台 vs 自研对比实战

以"客服知识库问答"为实际场景，分别用三种方式实现并对比：

- **场景定义**：需求描述、知识库内容、测试问题
- **Dify API 方案**：~10 行代码，~30 分钟开发
- **Coze API 方案**：~10 行代码，~20 分钟开发
- **自研 RAG 方案**：~150 行代码，1-3 天开发（简化版 Module 04）
- **综合对比**：开发时间、代码量、灵活性、数据安全、维护成本

```bash
npm run platform-vs-custom
```

```
🎯 场景：客服知识库问答系统

📌 需求描述:
  1. 理解用户的自然语言问题
  2. 从产品知识库中检索相关信息
  3. 生成准确、友好的回答
  4. 支持多轮对话

📊 综合对比

┌──────────────────┬──────────────┬──────────────┬──────────────┐
│       维度       │   Dify API   │   Coze API   │   自研 RAG   │
├──────────────────┼──────────────┼──────────────┼──────────────┤
│ 开发时间         │ ~30 分钟     │ ~20 分钟     │ 1-3 天       │
│ 代码量           │ ~10 行       │ ~10 行       │ ~200 行      │
│ 灵活性           │ 中           │ 中           │ 高           │
│ 数据安全         │ 可私部署     │ 云端         │ 完全可控     │
│ 维护成本         │ 低           │ 最低         │ 中-高        │
└──────────────────┴──────────────┴──────────────┴──────────────┘

📌 决策树:
  快速验证 / 非核心功能 → Coze（最快上线）
  企业级 / 需要私部署   → Dify（开源可控）
  核心业务 / 深度定制   → 自研（完全掌控）
  混合方案（推荐）      → 核心自研 + 边缘用平台
```



## 核心知识点

### 一、AI 应用平台底层 = 你学过的全部技术

```
可视化编排层（平台 UI）
├── Prompt → Module 03 (Prompt Engineering)
├── RAG    → Module 04 (RAG) + Module 11 (LlamaIndex)
├── Agent  → Module 06 (Agent Tools)
├── Workflow → Module 06 (StateGraph)
└── 多模型  → Module 03 (model-adapter.ts)
```

平台没有发明新技术，只是加了一层 UI。理解底层后用平台事半功倍。

### 二、Coze vs Dify 选型

| 场景 | 推荐 |
|------|------|
| 快速验证想法 / MVP | Coze（最快，免费） |
| 需要发布到微信/飞书 | Coze（一键多渠道） |
| 企业级 / 数据安全要求高 | Dify 私有部署 |
| 需要完善 API 对接现有系统 | Dify（API 设计更规范） |
| 核心业务 / 需要极致定制 | 自研 |

### 三、渐进式策略（推荐）

```
阶段一（1-2天）：Coze/Dify 搭建原型 → 验证需求
阶段二（1-2周）：Dify API 集成到系统 → 正式上线
阶段三（持续）：核心功能自研 + 边缘功能继续用平台
```

### 四、与全系列的知识衔接

本模块是全系列的收官——回顾 Module 01-12 的所有技术如何在平台中落地：

- Module 02 → 对话应用
- Module 03 → 提示词模板 + 多模型适配
- Module 04/11 → 知识库管理
- Module 06 → 工作流编排 + 工具调用
- Module 07 → 插件系统（MCP 协议）
- Module 10 → 本地部署
- Module 12 → 模型微调



## 文件结构

```
13-ai-platform/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── model-adapter.ts       # 多模型适配（复制自 Module 10）
│   ├── platform-concepts.ts   # 平台核心概念对比（无需任何配置）
│   ├── dify-api.ts            # Dify API 集成（DifyClient 封装）
│   ├── coze-api.ts            # Coze API 集成（CozeClient 封装）
│   └── platform-vs-custom.ts  # 平台 vs 自研方案对比实战
└── docker/
    └── docker-compose.yml     # Dify 本地部署参考配置
```
