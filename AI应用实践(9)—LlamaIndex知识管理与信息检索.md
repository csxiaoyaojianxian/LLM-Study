# AI应用实践(9)—LlamaIndex知识管理与信息检索

前面 Module 04 手写了 RAG，Module 05 用 LangChain 重构了一遍。两次实践下来，RAG 的每个环节（切分、向量化、检索、生成）都已经摸透。但如果站在"知识管理"的角度重新审视，会发现这两套方案都偏"底层拼装"——你需要自己选切分器、自己接向量库、自己组装 Prompt。

这篇引入 LlamaIndex.TS，一个专注于**数据索引和检索**的框架。重点不是替换 LangChain，而是看它在知识管理这件事上做了哪些更高层的抽象，以及什么场景下选它更合适。

技术栈：LlamaIndex.TS + TypeScript + Vercel AI SDK
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/11-llamaindex](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/11-llamaindex)

## 一、为什么再学一个框架

### 1.1 三次 RAG 实现的回顾

我们已经用三种方式构建过 RAG 系统：

| 实现方式 | 模块 | 代码量 | 特点 |
|---------|------|--------|------|
| 手动实现 | Module 04 | ~200 行 | 原理清晰，但重复代码多 |
| LangChain | Module 05 | ~100 行 | LCEL 组合灵活，通用性强 |
| LlamaIndex | Module 11 | ~50 行 | 专注索引检索，开箱即用 |

> 🎒 **类比**：想想 Web 开发中处理数据库的三种方式：
> - **手写 SQL** = Module 04（控制力最强，但样板代码多）
> - **通用 ORM（Sequelize）** = Module 05 LangChain（灵活，能做任何事）
> - **专用查询构建器（Prisma）** = Module 11 LlamaIndex（专注数据层，体验更好）
>
> 不是谁替代谁，而是**不同场景的最佳选择不同**。

### 1.2 LlamaIndex 的定位

LlamaIndex（原名 GPT Index）由 Jerry Liu 于 2022 年创建，核心思想是：

> **让 LLM 与你的私有数据之间的连接变得简单。**

它和 LangChain 经常被放在一起比较，但定位有明显区别：

```
┌─────────────────────────────────────────────────────┐
│               LLM 应用框架定位对比                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  LangChain    = 通用框架（Chain + Agent + Memory...）│
│  LlamaIndex   = 数据框架（Index + Query + Retrieve）│
│                                                      │
│  LangChain 更像 Express —— 什么都能做                │
│  LlamaIndex 更像 Prisma —— 专注做好数据这一件事       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

| 维度 | LangChain | LlamaIndex |
|------|-----------|------------|
| **核心能力** | 链式调用、Agent、Memory | 数据索引、查询引擎 |
| **主要场景** | 通用 LLM 应用 | 知识管理、文档 QA |
| **上手难度** | 概念多，学习曲线陡 | 概念少，上手快 |
| **灵活性** | 极高（LCEL 万能组合） | 中等（高层封装为主） |

### 1.3 核心概念速览

LlamaIndex 的核心抽象只有三个，与前面学过的概念一一对应：

| LlamaIndex | Module 04（手动） | Module 05（LangChain） |
|------------|------------------|----------------------|
| Document | `fs.readFileSync()` | `Document` |
| Node / TextNode | chunk（文本片段） | `Document`（切分后） |
| VectorStoreIndex | VectorStore + ChromaDB | `Chroma.fromDocuments()` |
| QueryEngine | `RAGPipeline.query()` | `RetrievalQAChain` |
| Response Synthesizer | System Prompt 拼接 | `StuffDocumentsChain` |

## 二、Document 与 Node——数据的组织方式

### 2.1 Document——最基础的数据单元

Document 是 LlamaIndex 中原始数据的抽象，包含文本内容和元数据：

```typescript
import { Document } from "llamaindex";

const doc = new Document({
  text: "TypeScript 是 JavaScript 的超集，添加了静态类型系统。",
  metadata: {
    source: "manual",
    topic: "TypeScript",
    language: "zh",
  },
});
```

对比 Module 04：Module 04 的"文档"就是一个字符串，元数据需要自己维护。LlamaIndex 的 Document 是完整的数据对象，元数据会随着切分、索引一路传递下去。

### 2.2 Node——切分后的片段

Node（TextNode）是 Document 经过切分后的最小单元，相当于 Module 04 里的 chunk：

```typescript
import { SentenceSplitter, MetadataMode } from "llamaindex";

const splitter = new SentenceSplitter({
  chunkSize: 256,
  chunkOverlap: 30,
});

const nodes = splitter.getNodesFromDocuments([doc]);

for (const node of nodes) {
  const text = node.getContent(MetadataMode.NONE);
  console.log(`节点 ${node.id_}: ${text.length} 字符`);
  console.log(`元数据: ${JSON.stringify(node.metadata)}`); // 自动继承！
}
```

与 Module 04 `chunking.ts` 的关键差异：

| 特性 | Module 04 手动切分 | LlamaIndex SentenceSplitter |
|------|-------------------|---------------------------|
| 中文支持 | 需要自定义分隔符 | 内置句子边界检测 |
| 元数据传递 | 需手动维护 | 自动从 Document 继承 |
| 节点关系 | 无 | 自动维护前后节点引用 |

## 三、三种索引类型

### 3.1 VectorStoreIndex——向量语义检索

一行代码完成切分 → 向量化 → 存储：

```typescript
import { VectorStoreIndex } from "llamaindex";

// LlamaIndex：一步到位
const index = await VectorStoreIndex.fromDocuments(documents);

// 对比 Module 04：三步手动操作
// const chunks = recursiveCharacterChunk(text, { chunkSize: 300, overlap: 50 });
// const embeddings = await localEmbedding.embedDocuments(chunks);
// await vectorStore.addDocuments(chunks, embeddings);
```

### 3.2 SummaryIndex——遍历摘要

不做向量检索，查询时遍历所有节点让 LLM 生成摘要。构建零成本，但查询时 LLM 调用量大：

```typescript
import { SummaryIndex } from "llamaindex";
const index = await SummaryIndex.fromDocuments(documents);
```

### 3.3 索引选择决策树

```
├── 精确问答 → VectorStoreIndex（语义检索，最常用）
├── 全文总结 → SummaryIndex（遍历所有节点）
├── 关键词查找 → KeywordTableIndex（倒排索引）
└── 混合需求 → RouterQueryEngine（自动路由）
```

## 四、QueryEngine——查询引擎

### 4.1 基本查询

```typescript
const queryEngine = index.asQueryEngine({ similarityTopK: 3 });
const response = await queryEngine.query({
  query: "TypeScript 的核心特性有哪些？"
});
```

### 4.2 查询引擎内部流程

```
Query → Retriever → NodePostprocessor → ResponseSynthesizer → Answer
        (检索TopK)   (重排序/过滤)        (上下文+LLM生成)
```

Module 04 对应：`vectorStore.search()` → 手动阈值过滤 → System Prompt + `chatWithModel()`

## 五、高级 RAG 技术

### 5.1 结果重排序（Reranking）

```typescript
import { SimilarityPostprocessor } from "llamaindex";

const queryEngine = index.asQueryEngine({
  similarityTopK: 5,
  nodePostprocessors: [
    new SimilarityPostprocessor({ similarityCutoff: 0.7 }),
  ],
});
```

### 5.2 RouterQueryEngine——路由查询引擎

让 LLM 自动选择最合适的查询策略，类似 Module 06 Multi-Agent 的 Routing 模式：

```typescript
import { RouterQueryEngine, QueryEngineTool } from "llamaindex";

const vectorTool = new QueryEngineTool({
  queryEngine: vectorIndex.asQueryEngine(),
  metadata: { name: "vector_search", description: "适合回答具体技术问题" },
});

const summaryTool = new QueryEngineTool({
  queryEngine: summaryIndex.asQueryEngine(),
  metadata: { name: "summary_search", description: "适合总结和概览类问题" },
});

const router = RouterQueryEngine.fromDefaults({
  queryEngineTools: [vectorTool, summaryTool],
});

await router.query({ query: "TypeScript 泛型怎么用？" });  // → vector_search
await router.query({ query: "总结所有文档的核心内容" });     // → summary_search
```

### 5.3 SubQuestionQueryEngine——子问题分解

面对复杂问题时，先拆解再分别检索：

```
"对比 TypeScript 和 Node.js 在 AI 开发中的角色"
         ↓ LLM 分解
子问题1: "TypeScript 在 AI 开发中的角色？"
子问题2: "Node.js 在 AI 开发中的角色？"
         ↓ 分别检索回答 → 合并为对比分析
```

Module 04 的 HyDE 是"先生成假设答案再检索"，思路不同但目标一致：提升复杂问题的检索质量。

## 六、多轮对话 RAG

Module 04 的 `conversational-rag.ts` 用问题改写解决代词问题（约 50 行代码）。LlamaIndex 的 ContextChatEngine 内置了这个能力：

```typescript
import { ContextChatEngine } from "llamaindex";

const retriever = index.asRetriever({ similarityTopK: 3 });
const chatEngine = new ContextChatEngine({ retriever });

await chatEngine.chat({ message: "TypeScript 有哪些核心特性？" });
await chatEngine.chat({ message: "它的泛型有什么用？" });           // "它"自动理解
await chatEngine.chat({ message: "这些特性在 AI 开发中怎么用？" }); // 上下文自动传递
```

## 七、三种 RAG 实现的终极对比

### 代码量

| 实现 | 文档加载 | 切分 | 向量化 | 存储 | 查询 | 合计 |
|------|---------|------|--------|------|------|------|
| Module 04 手写 | 5 行 | 40 行 | 30 行 | 60 行 | 50 行 | ~185 行 |
| Module 05 LangChain | 5 行 | 5 行 | 5 行 | 10 行 | 20 行 | ~45 行 |
| Module 11 LlamaIndex | 10 行 | — | — | — | 5 行 | ~15 行 |

### 适用场景

```
├── 需要理解 RAG 底层原理 → Module 04 手动实现
├── 构建通用 LLM 应用 → Module 05 LangChain
├── 专注知识管理和文档 QA → Module 11 LlamaIndex
└── 生产级系统 → LlamaIndex 索引 + LangChain 编排
```

## 八、总结

1. **Document → Node → Index → Query** 四层抽象，清晰地组织知识数据
2. **三种索引类型**各有适用场景，VectorStoreIndex 是通用首选
3. **RouterQueryEngine** 实现智能路由，自动选择最佳查询策略
4. **ContextChatEngine** 内置多轮对话支持，省去手动问题改写
5. RAG 优化方向与框架无关——切分、检索、重排序、问题理解、评估迭代

下一步：从"用模型"到"定制模型"——Module 12 Fine-tuning 模型微调 →
