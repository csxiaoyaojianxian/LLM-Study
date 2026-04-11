# 05-langchain — LangChain.js 框架

> 用 LangChain.js 重新实现之前手写的功能，体验框架级开发效率
>
> 📦 基于 **LangChain.js v1**（langchain@1.3 / @langchain/core@1.1 / @langchain/langgraph@1.2）

## 学习目标

- 掌握 LangChain.js 核心概念：Model / Prompt / Chain / Memory / Tool
- 理解 LCEL（LangChain Expression Language）链式调用范式
- 用 LangChain 重构 RAG Pipeline，对比手写实现
- 了解 Memory 对话记忆的演进方式
- 实现自定义 Tool + Agent 自动编排
- 了解 LangGraph 在 LangChain 生态中的角色，为 06-agent 模块的深入学习打基础

## 环境配置

### 1. 安装依赖

```bash
cd 05-langchain
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env，填入至少一个 API Key
```

**DeepSeek 适配说明：** 本模块不使用独立的 DeepSeek SDK，而是通过 `@langchain/openai` 的 `ChatOpenAI` + 自定义 `baseURL` 来适配 DeepSeek API。这是 LangChain 社区通用的适配方式。

### 3. ChromaDB（仅 rag-langchain 需要）

```bash
# Docker 方式（推荐）
docker run -d -p 8000:8000 chromadb/chroma

# 或 Python 方式
python3 -m venv .venv && .venv/bin/pip install chromadb && .venv/bin/chroma run --path ./chroma-data
```

## 运行 Demo

```bash
npm run model-chat        # Model 基础 — ChatOpenAI + 流式输出
npm run prompt-lcel       # LCEL 链式调用 — Prompt → Model → Parser
npm run output-parser     # 结构化输出 — Zod Schema + Output Parser
npm run memory-chat       # 对话记忆 — 多种 Memory 方式对比
npm run custom-tool       # 自定义 Tool + Agent（推荐使用 OpenAI Key）
npm run rag-langchain     # LangChain RAG（需要 ChromaDB）
```

## Demo 详解

### 1. model-chat.ts — Model 基础

使用 `ChatOpenAI` 统一接入 DeepSeek / OpenAI，演示：
- 基础调用 `model.invoke()`
- SystemMessage + HumanMessage 组合
- 流式输出 `model.stream()`
- 参数绑定 `model.bind()`

### 2. prompt-lcel.ts — Prompt + LCEL 链式调用

LangChain 的核心编程范式 — LCEL（LangChain Expression Language）：
- `ChatPromptTemplate` 模板与变量插值
- `prompt.pipe(model).pipe(parser)` 管道链式调用
- `RunnableSequence` 显式组合
- `RunnableLambda` — 自定义数据映射（上下游格式不匹配时做转换）
- `RunnablePassthrough.assign()` — 透传原始字段 + 附加计算字段
- `batch()` 批量 + `stream()` 流式

### 3. output-parser.ts — Output Parser 结构化输出

将 LLM 输出解析为结构化数据：
- `StringOutputParser` — 纯文本提取
- `CommaSeparatedListOutputParser` — 返回 `string[]`
- `StructuredOutputParser` + Zod Schema — 复杂 JSON 结构
- 自动生成 `format_instructions` 注入 Prompt

### 4. memory-chat.ts — Memory 对话记忆

多种记忆方式对比与演进：
- 手动维护消息历史（最基础）
- 滑动窗口记忆（仅保留最近 k 轮）
- `RunnableWithMessageHistory` + `InMemoryChatMessageHistory`（LCEL 方式）
- `LangGraph MemorySaver` + `createReactAgent`（**v1 推荐方式**）
- 有/无记忆对比实验

### 5. custom-tool.ts — 自定义 Tool + Agent

LLM 调用外部工具 + Agent 自动编排：
- `tool()` 定义工具（天气查询、计算器）
- `model.bindTools()` 让模型感知工具
- 手动解析执行 `tool_calls`
- `createReactAgent`（@langchain/langgraph）底层 Agent
- `createAgent`（**langchain v1 新 API**）高层封装，底层基于 LangGraph

### 6. rag-langchain.ts — LangChain 重构 RAG

用 LangChain 原生组件重构 04-rag 的完整 RAG Pipeline：
- 自定义 `LocalEmbeddings` 类（继承 LangChain Embeddings，封装 @xenova/transformers）
- `RecursiveCharacterTextSplitter`（中文分隔符）— 递归文本分块
- `Chroma` VectorStore + `asRetriever()`
- LCEL RAG Chain: `retriever → prompt → model → parser`
- 手写 vs LangChain 代码量对比

**RecursiveCharacterTextSplitter 工作原理：**

RAG 的第一步是把长文档切成小块（LLM 有 Token 上限、向量检索需要小块精准匹配）。"递归"的含义是按分隔符优先级从高到低逐级尝试：

```
separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""]
              段落    换行   句号                          空格  单字符
              ← 优先级从高到低，先尝试大粒度，切不动再用小粒度 →

第1轮: 按 "\n\n"（段落）切 → 块 ≤ 500字？✅ 放入结果  ❌ 太大→第2轮
第2轮: 按 "\n"（换行）切   → 块 ≤ 500字？✅ 放入结果  ❌ 太大→第3轮
第3轮: 按 "。"（句号）切   → ...逐级递归
兜底:  "" 按单字符切（保证一定能切到目标大小）
```

好处：尽可能在语义边界（段落→句子）断开，而不是从句子中间劈开。中文适配：默认分隔符是英文的，这里加入了 `。！？；，` 等中文标点。`chunkOverlap: 50` 让相邻块重叠 50 字符，防止关键信息在边界被截断。

04-rag 手写三种分块策略 ~120 行，LangChain 这里配置一下就搞定。

## 核心知识点

### 一、LangChain 是什么

LangChain 是目前最流行的 LLM 应用开发框架，由 Harrison Chase 于 2022 年 10 月发起。它的核心理念是：**LLM 不应该孤立使用，而应该与外部数据源、工具、记忆系统组合，构成完整的应用链路。**

一句话总结：**LangChain = 胶水层框架，把 LLM 和各种外部能力粘合成可运行的应用。**

LangChain 同时提供 Python 和 JavaScript/TypeScript 两个版本。本模块使用 **LangChain.js**（即 TypeScript 版本），与前面模块的技术栈保持一致。

#### LangChain 与 LangGraph 的关系

初学时容易混淆 LangChain 和 LangGraph，它们是同一团队的两个互补项目：

```
┌───────────────────────────────────────────────────────┐
│ langchain v1             最上层快捷入口                │
│   createAgent — 一行代码创建 Agent                     │
│  （底层自动帮你组装 LangGraph 状态图）                  │
├───────────────────────────────────────────────────────┤
│ @langchain/langgraph     编排引擎层                    │
│   StateGraph   — 定义节点和边（流程图）                 │
│   MemorySaver  — 状态检查点（记忆持久化）               │
│   createReactAgent — 预置的 ReAct 流程图               │
├───────────────────────────────────────────────────────┤
│ @langchain/core          基础零件层                    │
│   Model / Prompt / Parser / Messages / Tool           │
└───────────────────────────────────────────────────────┘
```

**类比理解：**
- **LangChain**（`@langchain/core`）= 乐高积木块 — Model、Prompt、Parser、Tool 等独立零件
- **LangGraph**（`@langchain/langgraph`）= 乐高说明书 — 规定零件怎么拼、执行顺序、遇到分支怎么走
- **langchain v1** = 拼好的成品 — `createAgent` 一行搞定，底层自动组装

**为什么要拆成两层？** 因为早期 LangChain 把"组件"和"编排"混在一起（`LLMChain`、`AgentExecutor`），复杂流程难以定制。v1 拆开后职责清晰：

| 场景 | 用什么 | 本模块示例 |
|------|-------|-----------|
| 简单线性链 | LCEL `pipe()` 串联 | Demo 1-4（prompt-lcel、output-parser） |
| 对话记忆 | LangGraph `MemorySaver` | memory-chat Demo 4 |
| 工具调用 + 自动循环 | `createReactAgent` / `createAgent` | custom-tool Demo 4-5 |
| 复杂分支/循环/断点恢复 | LangGraph `StateGraph`（本模块未涉及） | 见 06-agent 模块 |

### 二、为什么需要 LangChain

在 03-prompt_engineering 和 04-rag 中，我们手写了模型适配、Prompt 拼接、RAG Pipeline 等逻辑。回顾一下痛点：

| 痛点 | 手写实现 | LangChain 方案 |
|------|---------|---------------|
| 多模型切换 | 自己封装 `model-adapter.ts`（~80行） | `ChatOpenAI` 开箱即用，baseURL 一行适配 |
| Prompt 模板 | 字符串拼接，容易出错 | `ChatPromptTemplate` 变量插值 + 类型安全 |
| 结构化输出 | 手写 JSON 解析，容错复杂 | `StructuredOutputParser` + Zod 自动生成 format_instructions |
| 对话记忆 | 手动维护 messages 数组 | `RunnableWithMessageHistory` 自动管理 |
| 文本分块 | 手写三种策略（~120行） | `RecursiveCharacterTextSplitter` 一行搞定 |
| 向量存储 | 手动封装 ChromaDB 客户端（~100行） | `Chroma.fromDocuments()` 自动入库 |
| 工具调用 | 手动解析 tool_calls + 循环执行 | `createReactAgent` 全自动 |

**但这不意味着手写没有价值！** 理解底层原理（04-rag）是使用框架的前提。先懂原理再用框架，出问题时才能定位和优化。

### 三、LangChain 生态全景

LangChain 不是一个单独的包，而是一个完整的生态体系：

```
┌──────────────────────────────────────────────────────────────┐
│                   LangChain 生态全景（v1）                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🧱 @langchain/core          核心抽象层                       │
│     ├── Runnable 接口         一切组件的基类                   │
│     ├── ChatPromptTemplate    Prompt 模板                     │
│     ├── OutputParser          输出解析器（含 StructuredOutputParser）│
│     ├── Messages              消息类型定义                     │
│     ├── Embeddings            向量化抽象                      │
│     └── InMemoryChatMessageHistory  内存消息存储              │
│                                                              │
│  🔌 @langchain/openai         OpenAI / DeepSeek 集成         │
│     @langchain/anthropic      Claude 集成                    │
│     @langchain/google-genai   Gemini 集成                    │
│     @langchain/community      社区集成（Chroma 等）           │
│                                                              │
│  📦 langchain                 v1 高层 API                     │
│     ├── createAgent           高层 Agent 封装（推荐入口）      │
│     ├── tool                  工具定义（re-export）            │
│     └── middleware             Agent 中间件系统                │
│                                                              │
│  📐 @langchain/textsplitters  文本分块器（v1 独立包）         │
│     └── RecursiveCharacterTextSplitter 等                    │
│                                                              │
│  🤖 @langchain/langgraph      Agent 框架（状态图）            │
│     ├── createReactAgent      ReAct Agent（底层 API）         │
│     ├── MemorySaver           内存检查点（对话记忆）           │
│     ├── StateGraph            自定义状态机                    │
│     └── Checkpointer          持久化断点恢复                  │
│                                                              │
│  🛠️ LangSmith                 可观测性平台（调试/追踪/评估）   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

本模块涉及的包：

| 包名 | 版本 | 用途 |
|------|------|------|
| `@langchain/core` | ^1.1 | 核心抽象（Runnable、Prompt、Parser、Messages、ChatHistory） |
| `@langchain/openai` | ^1.4 | ChatOpenAI（同时通过 baseURL 适配 DeepSeek） |
| `@langchain/community` | ^1.1 | 社区集成（Chroma VectorStore） |
| `@langchain/langgraph` | ^1.2 | Agent 框架（createReactAgent、MemorySaver） |
| `@langchain/textsplitters` | ^1.0 | 文本分块器（v1 从 langchain 独立出来） |
| `langchain` | ^1.3 | 高层 API（createAgent、middleware） |
| `@xenova/transformers` | ^2.17 | 本地 Embedding 模型（非 LangChain 组件） |
| `chromadb` | ^1.9 | 向量数据库客户端 |
| `zod` | ^3.23 | Schema 定义（结构化输出、Tool 参数） |

### 四、六大核心概念

#### 1. Model — 模型层

LangChain 将 LLM 交互抽象为统一接口，屏蔽不同提供商的 API 差异。

```typescript
import { ChatOpenAI } from "@langchain/openai";

// OpenAI 原生
const openai = new ChatOpenAI({ modelName: "gpt-4o-mini" });

// DeepSeek 通过 baseURL 适配（本模块的核心技巧）
const deepseek = new ChatOpenAI({
  openAIApiKey: process.env.DEEPSEEK_API_KEY,
  modelName: "deepseek-chat",
  configuration: { baseURL: "https://api.deepseek.com/v1" },
});

// 无论哪个模型，调用方式完全一致
const result = await model.invoke([new HumanMessage("你好")]);
```

**为什么 DeepSeek 可以用 ChatOpenAI？** 因为 DeepSeek 的 API 兼容 OpenAI 格式（相同的请求/响应结构），只需要修改 baseURL 即可。这也是很多国内模型（如通义千问、Moonshot）的常见做法。

**Model 的关键方法：**

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `invoke(messages)` | 单次调用 | `AIMessage` |
| `stream(messages)` | 流式输出 | `AsyncIterable<AIMessageChunk>` |
| `batch(inputs[])` | 批量调用 | `AIMessage[]` |
| `bindTools(tools)` | 绑定工具 | 新的 Model 实例 |

#### 2. Prompt — 提示模板

`ChatPromptTemplate` 是类型安全的 Prompt 构建器，支持变量插值和多角色消息：

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";

// 从消息数组创建（最常用）
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一位{role}，用{language}回答问题。"],
  ["human", "{question}"],
]);

// 格式化 → 生成实际的消息数组
const messages = await prompt.formatMessages({
  role: "AI 专家",
  language: "中文",
  question: "什么是 LCEL？",
});
// → [SystemMessage("你是一位AI专家，用中文回答问题。"), HumanMessage("什么是LCEL？")]
```

**动态历史消息**：使用 `MessagesPlaceholder` 插入可变长度的对话历史：

```typescript
import { MessagesPlaceholder } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个友好的助手。"],
  new MessagesPlaceholder("history"),  // 动态插入历史消息
  ["human", "{input}"],
]);
```

#### 3. Output Parser — 输出解析

Output Parser 将 LLM 的自由文本输出转换为程序可处理的结构化数据：

```
LLM 输出（string）  →  OutputParser  →  结构化数据（object/array/string）
```

**三种常用 Parser：**

| Parser | 输出类型 | 适用场景 |
|--------|---------|---------|
| `StringOutputParser` | `string` | 最基础，提取纯文本内容 |
| `CommaSeparatedListOutputParser` | `string[]` | 列表类输出（如"列出5个..."） |
| `StructuredOutputParser` + Zod | `object` | 复杂 JSON 结构 |

**核心机制：`getFormatInstructions()`**

LLM 不知道你期望什么输出格式，所以需要在 Prompt 里明确告知。`getFormatInstructions()` 就是自动生成这段"格式说明文本"的方法：

```
完整流程（以 CommaSeparatedListOutputParser 为例）：

  1. parser.getFormatInstructions()
     → 生成: "Your response should be a list of comma separated values, eg: `foo, bar, baz`"

  2. 文本被注入到 Prompt 的 {format_instructions} 变量中
     → "列出 5 个向量数据库。\nYour response should be a list of comma separated values..."

  3. LLM 看到指令，按要求输出
     → "ChromaDB, Pinecone, Qdrant, Milvus, FAISS"

  4. parser.parse() 按逗号切分
     → ["ChromaDB", "Pinecone", "Qdrant", "Milvus", "FAISS"]
```

每种 Parser 生成的 format_instructions 不同：
- `CommaSeparatedListOutputParser` → 要求逗号分隔
- `StructuredOutputParser` + Zod → 要求输出符合 JSON Schema 的 JSON

**StructuredOutputParser 的工作原理：**

```typescript
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    name: z.string().describe("名称"),
    score: z.number().describe("评分（1-10）"),
  })
);

// 自动生成 format_instructions，告诉 LLM 以什么格式输出
const instructions = parser.getFormatInstructions();
// → "You must format your output as a JSON value that adheres to..."

// 注入到 Prompt 中
const prompt = ChatPromptTemplate.fromMessages([
  ["human", "评价 {tech}。\n{format_instructions}"],
]);

// 完整链：prompt → model → parser
const chain = prompt.pipe(model).pipe(parser);
const result = await chain.invoke({
  tech: "LangChain",
  format_instructions: instructions,
});
// → { name: "LangChain", score: 8 }  ← 直接得到类型安全的对象
```

#### 4. Memory — 对话记忆

LLM 本身是无状态的，每次调用都是独立的。Memory 机制通过在每次请求中注入历史消息来实现"记忆"。

**Memory 方式演进：**

```
┌─────────────────────────────────────────────────────────┐
│                Memory 方式演进                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  最基础                                                  │
│  └── 手动维护 messages 数组                              │
│      完全可控，但每轮都要手动 push                        │
│                                                         │
│  LCEL 方式（v0.2+）                                     │
│  └── RunnableWithMessageHistory                         │
│      + InMemoryChatMessageHistory                       │
|      只存消息历史，包装普通 chain                         │
│      自动读写历史，支持多 session                         │
│                                                         │
│  v1 推荐 ⭐                                              │
│  └── LangGraph MemorySaver + createReactAgent           │
│      状态检查点，支持断点恢复、持久化                     │
│      生产环境可换 PostgresSaver 等                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**v1 变更要点：**
- `ChatMessageHistory` → `InMemoryChatMessageHistory`（从 `@langchain/core/chat_history` 导入）
- `RunnableWithMessageHistory` 仍可用，但不再是首选
- 推荐使用 LangGraph 的 `MemorySaver`（开发）/ `PostgresSaver`（生产）配合 `thread_id` 管理会话
-  类比理解：

  RunnableWithMessageHistory ≈ 浏览器的 sessionStorage

  MemorySaver ≈ 数据库 + 事务日志（可回溯、可恢复）

#### 5. Tool — 工具定义

Tool 让 LLM 拥有"调用外部函数"的能力。LLM 不直接执行代码，而是返回"我想调用某个工具"的结构化指令，由程序侧执行后将结果回传。

```
用户提问 → LLM 分析 → 返回 tool_calls → 程序执行工具 → 结果回传 → LLM 生成最终回复
```

**LangChain 定义 Tool 的方式：**

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const weatherTool = tool(
  async ({ city }) => {
    // 实际的业务逻辑（可以是 API 调用、数据库查询等）
    return `${city} 今天晴，25°C`;
  },
  {
    name: "get_weather",                              // 工具名称
    description: "查询城市天气",                        // LLM 用此判断何时调用
    schema: z.object({                                // 参数 Schema
      city: z.string().describe("城市名称"),
    }),
  }
);
```

**三步走：从手动到全自动**

```
Step 1: model.bindTools(tools)     → LLM 知道有哪些工具可用
Step 2: 手动解析 tool_calls 并执行   → 自己写循环，理解原理
Step 3: createReactAgent            → 全自动，框架负责循环
```

#### 6. Agent — 智能体

Agent = LLM + Tools + 决策循环。它能自主决定：是否需要调用工具？调用哪个？参数是什么？结果够了吗？需要再调一次吗？

**ReAct 模式（Reason + Act）：**

```
┌──────────────────────────────────────┐
│            ReAct 循环                │
│                                      │
│  用户: "北京天气怎样？算一下 2^10"    │
│        ↓                             │
│  LLM 思考: 需要查天气 + 做计算       │
│        ↓                             │
│  Action 1: get_weather({city:"北京"}) │
│  Result 1: "晴天，22°C"             │
│        ↓                             │
│  Action 2: calculator({expr:"2^10"}) │
│  Result 2: "1024"                    │
│        ↓                             │
│  LLM 思考: 信息足够了               │
│        ↓                             │
│  最终回复: "北京晴天22°C，2^10=1024" │
└──────────────────────────────────────┘
```

本模块演示两种 Agent API：
- `createReactAgent`（`@langchain/langgraph/prebuilt`）— LangGraph 底层 API，可自定义状态图
- `createAgent`（`langchain` v1）— 高层封装，底层基于 LangGraph ReactAgent，参数更简洁，支持字符串模型名、systemPrompt、middleware 等

### 五、LCEL — LangChain Expression Language

LCEL 是 LangChain v0.2+ 的核心编程范式，灵感来自 Unix 管道（`|`）。它的设计哲学：**一切组件都是 Runnable，通过 pipe() 串联成链。**

#### 核心语法

```typescript
// 最简形式：prompt → model → parser
const chain = prompt.pipe(model).pipe(parser);

// 等价的显式写法
const chain = RunnableSequence.from([prompt, model, parser]);

// 调用方式统一
const result = await chain.invoke({ question: "什么是LLM？" }); // 单次
const results = await chain.batch([{ question: "Q1" }, { question: "Q2" }]); // 批量
const stream = await chain.stream({ question: "Q1" }); // 流式
```

#### 数据流转机制

LCEL 链中每个组件的输出是下一个组件的输入：

```
{ role: "专家", question: "什么是LLM？" }
        ↓  ChatPromptTemplate
[SystemMessage("你是一位专家..."), HumanMessage("什么是LLM？")]
        ↓  ChatOpenAI
AIMessage({ content: "LLM是..." })
        ↓  StringOutputParser
"LLM是..."
```

#### 数据变换工具

LCEL 链中，上一步的输出格式经常和下一步的输入格式不匹配，需要在中间插入数据变换：

| 工具 | 用途 | JS 类比 | 示例 |
|------|------|---------|------|
| `RunnableLambda` | 自定义数据映射，输入输出完全自定义 | `Array.map(fn)` | `new RunnableLambda({ func: (x) => ({ a: x.b }) })` |
| `RunnablePassthrough` | 原样透传输入 | `(x) => x` | `new RunnablePassthrough()` |
| `RunnablePassthrough.assign()` | 透传所有字段 + 附加新计算字段 | `{ ...input, newKey: value }` | `RunnablePassthrough.assign({ upper: lambdaFn })` |
| `RunnableParallel` | 并行执行多个 Runnable | `Promise.all()` | `{ a: chainA, b: chainB }` 对象字面量 |

**典型场景：用户输入和 Prompt 模板字段不匹配**

```typescript
// 用户传入 { topic: "RAG" }，但 Prompt 需要 { concept, analogy }
// 用 RunnableLambda 做格式转换
const preprocessor = new RunnableLambda({
  func: (input) => ({ concept: input.topic, analogy: "烹饪做菜" }),
});

//  { topic: "RAG" }
//      ↓ RunnableLambda — 格式转换
//  { concept: "RAG", analogy: "烹饪做菜" }
//      ↓ ChatPromptTemplate — 变量插值
//  [HumanMessage("请用「烹饪做菜」的类比来解释「RAG」")]
//      ↓ Model → Parser
//  "RAG 就像做菜..."
const chain = preprocessor.pipe(prompt).pipe(model).pipe(parser);
```

**典型场景：保留原始数据 + 附加计算字段**

```typescript
// 输入: { text: "hello langchain" }
// 输出: { text: "hello langchain", uppercased: "HELLO LANGCHAIN" }
//                 ↑ 原样保留             ↑ 新增字段
const passthrough = RunnablePassthrough.assign({
  uppercased: new RunnableLambda({
    func: (input) => input.text.toUpperCase(),
  }),
});
```

#### VectorStore 与 Retriever

| | VectorStore | Retriever |
|---|---|---|
| **职责** | 完整的向量数据库操作（入库、删除、搜索） | 只读检索（给问题→返回相关文档） |
| **常用方法** | `addDocuments()`, `similaritySearch()`, `delete()` | `invoke(question)` → `Document[]` |
| **支持 LCEL** | ❌ 没有 `pipe()` | ✅ 实现了 Runnable 接口，可直接 `pipe()` |
| **创建方式** | `Chroma.fromDocuments(...)` | `vectorStore.asRetriever({ k: 3 })` |

**一句话：Retriever 是 VectorStore 的 LCEL 友好包装，让"检索"可以像积木一样拼进链里。**

`retriever.invoke(question)` 内部自动做两步：
1. 调用 Embedding 模型将 question 向量化
2. 在向量数据库中找最相似的 k 个文档块，返回 `Document[]`

#### LCEL RAG Chain（核心范式）

```typescript
// 这是 LangChain RAG 的标准写法
const ragChain = RunnableSequence.from([
  {
    // 并行执行两个分支：
    context: retriever.pipe(formatDocs),      // 检索 → 格式化为文本
    question: new RunnablePassthrough(),       // 原样透传问题
  },
  ragPrompt,    // 将 context + question 注入模板
  model,        // LLM 基于检索内容生成回答
  parser,       // 提取纯文本
]);

// 数据流：
//   "什么是RAG？"
//       ↓ 并行
//   context:  retriever → [Doc1, Doc2, Doc3] → formatDocs → "检索文本..."
//   question: "什么是RAG？"（透传）
//       ↓ ragPrompt 注入模板
//       ↓ model 生成回答
//       ↓ parser 提取文本
//   "RAG 是一种结合检索和生成的技术..."
const answer = await ragChain.invoke("什么是RAG？");
```

### 六、DeepSeek 通过 ChatOpenAI 适配原理

本模块不引入 `@ai-sdk/deepseek`，而是直接复用 `ChatOpenAI`，这是因为：

1. **API 兼容**：DeepSeek API 完全兼容 OpenAI 的 Chat Completions 格式
2. **减少依赖**：不需要额外的 provider 包
3. **社区通用**：很多 OpenAI 兼容模型都用这种方式接入

```typescript
// 适配原理：只改 baseURL 和 apiKey，其他完全一样
const model = new ChatOpenAI({
  openAIApiKey: process.env.DEEPSEEK_API_KEY,
  modelName: "deepseek-chat",
  configuration: {
    baseURL: "https://api.deepseek.com/v1",  // 关键：指向 DeepSeek 的 API 地址
  },
});
```

同理，其他 OpenAI 兼容的模型也可以这样接入：
- **Moonshot（Kimi）**：`baseURL: "https://api.moonshot.cn/v1"`
- **通义千问**：`baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"`
- **本地 Ollama**：`baseURL: "http://localhost:11434/v1"`

### 七、LangChain vs Vercel AI SDK

在 02-ai_chat_sdk 和 03-prompt_engineering 中我们使用了 Vercel AI SDK，本模块使用 LangChain。它们的定位不同：

| 维度 | Vercel AI SDK | LangChain |
|------|--------------|-----------|
| **定位** | 轻量级 AI 工具库 | 全功能 LLM 应用框架 |
| **核心优势** | 流式 UI（React hooks）、边缘函数友好 | 丰富的抽象层、完整的工具链生态 |
| **Prompt 管理** | 手动字符串拼接 | ChatPromptTemplate 模板引擎 |
| **输出解析** | `generateObject()` + Zod | OutputParser + format_instructions |
| **记忆管理** | 需手动实现 | 内置多种 Memory 方案 |
| **RAG** | 需手动组装各环节 | 一站式：Splitter → VectorStore → Retriever → Chain |
| **Agent** | 需手动实现工具循环 | createReactAgent 自动循环 |
| **包体积** | 小（~100KB） | 大（整个生态 ~2MB+） |
| **适合场景** | Web 应用、流式聊天 UI | 后端服务、复杂 AI 流程、原型验证 |

**本教程的设计意图：** 先用 Vercel AI SDK 体验"薄封装"开发（02-03），再用 LangChain 体验"厚框架"开发（05），最终根据项目需求选择合适的工具。两者也可以混合使用——Vercel AI SDK 负责前端流式 UI，LangChain 负责后端 AI 逻辑编排。

### 八、LangChain vs 手写对比

通过本模块和 04-rag 的对比，可以清晰看到框架带来的效率提升：

| 维度 | 手写（04-rag） | LangChain（05） |
|------|---------------|----------------|
| RAG 总代码量 | ~440 行 | ~75 行（减少 83%） |
| 灵活性 | 高，完全可控 | 中，受框架 API 约束 |
| 学习曲线 | 理解底层原理 | 需学习框架抽象和 API |
| 调试难度 | 低，代码一目了然 | 中，需理解框架内部流程 |
| 生态整合 | 需自行封装适配 | 丰富的社区集成（100+ 组件） |
| 版本稳定性 | 高，自己的代码自己控制 | 中，框架更新快、Breaking Changes 多 |
| 适用场景 | 特殊需求、深度定制、学习原理 | 快速原型、标准流程、团队协作 |

**建议学习路径：** 先手写理解原理（03-04）→ 再用框架提升效率（05）→ 生产中根据需求选择。

### 九、从 LangChain 到 LangGraph — 进阶路线图

本模块已经使用了 LangGraph 的两个关键组件：`MemorySaver`（Demo 4）和 `createReactAgent`（Demo 4-5），但这只是 LangGraph 的"冰山一角"。当你的应用从简单的线性链升级为复杂的 Agent 系统时，就需要 LangGraph 的完整能力。

**什么时候该用 LangGraph？**

```
本模块 LCEL 链能搞定的 ✅             需要 LangGraph 的 ❌（→ 见 06-agent 模块）
─────────────────────────             ────────────────────────────────────
线性流程: A → B → C                   条件分支: if X then A else B
单次工具调用                          多轮工具循环 + 自动终止判断
简单对话记忆                          状态持久化 + 断点恢复 + 时间旅行
单 Agent                             多 Agent 协作（管道/路由/辩论/Supervisor）
同步执行                              人机交互审批（interrupt + resume）
```

**06-agent 模块涵盖的 LangGraph 核心内容：**

| 主题 | 说明 | 对应 Demo |
|------|------|-----------|
| ReAct 模式深入 | 手动实现 Thought→Action→Observation 循环，理解 Agent 底层原理 | `npm run react-agent` |
| StateGraph | `Annotation.Root()` 定义类型化状态，条件边、循环、人机交互 | `npm run state-graph` |
| Agent 记忆 | MemorySaver 深度使用、多会话管理、检查点恢复 | `npm run memory-agent` |
| 多 Agent 编排 | 4 种模式：顺序管道、条件路由、Supervisor、辩论 | `npm run multi-agent` |

**学习路径建议：**

```
Module 05（本模块）                         Module 06（下一步 ⭐）
├── LCEL 链式调用                           ├── StateGraph 状态图
├── Tool 定义 + bindTools                   ├── 多工具编排 + 错误处理
├── createReactAgent（基础使用）      →      ├── ReAct 模式深入（手写 + 框架）
├── MemorySaver（基础使用）           →      ├── Agent 记忆（多会话 + 持久化）
└── 单 Agent                         →      └── 多 Agent 协作（4 种模式）
```

> 💡 **LangChain 和 LangGraph 是同一团队开发的互补项目**，在实际项目中几乎总是配合使用。本模块帮你掌握"零件"（Model、Prompt、Tool、Memory），06-agent 模块教你用 LangGraph 把零件"组装"成复杂的 Agent 系统。建议学完本模块后立即进入 06-agent。

### 十、LangChain 版本演进与注意事项

LangChain 发展迅速，API 变化较大。本模块基于 **v1** 编写。以下是 v0.3 → v1 的关键变更：

#### Import 路径变更

| 组件 | v0.3 路径（❌ 已移除） | v1 路径（✅） |
|------|---------------------|-------------|
| `RecursiveCharacterTextSplitter` | `langchain/text_splitter` | `@langchain/textsplitters` |
| `StructuredOutputParser` | `langchain/output_parsers` | `@langchain/core/output_parsers` |
| `ChatMessageHistory` | `langchain/stores/message/in_memory` | `InMemoryChatMessageHistory` from `@langchain/core/chat_history` |

#### API 变更

| 特性 | v0.3 | v1 |
|------|------|-----|
| Chain | `LLMChain`、`ConversationChain` | LCEL `pipe()` 链式调用 |
| Memory | `RunnableWithMessageHistory` | LangGraph `MemorySaver`（推荐） |
| Agent | `createReactAgent`（唯一） | 新增 `createAgent` 高层 API |
| 包结构 | `langchain` 包含 TextSplitter/OutputParser | 拆分为独立包（`@langchain/textsplitters` 等） |
| 调用方式 | `.predict()` / `.call()` | 统一使用 `.invoke()` |

#### 新增功能

- `createAgent`（`langchain`）— 高层 Agent 入口，支持字符串模型名（`"openai:gpt-4o"`）、systemPrompt、middleware 中间件系统
- `MemorySaver`（`@langchain/langgraph`）— 内存检查点，配合 `thread_id` 管理多会话
- middleware 系统 — Agent 中间件（限流、重试、工具选择等）

**踩坑提醒：**
- 搜索到的很多教程/博客基于 v0.1/v0.2 写的，代码在 v1 中可能无法运行
- `langchain/text_splitter`、`langchain/output_parsers` 等旧路径在 v1 中已完全移除
- `ConversationChain`、`LLMChain`、`BufferMemory` 等旧类已移至 `@langchain/classic`（不推荐使用）
- 官方文档以 Python 版为主，JS 版文档偶尔滞后
- 关注 `@langchain/core` 的版本，它是所有包的基础依赖
