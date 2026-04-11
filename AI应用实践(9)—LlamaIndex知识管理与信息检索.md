# AI应用实践(9)—LlamaIndex知识管理与信息检索

前面 Module 04 手写了完整的 RAG 系统，Module 05 用 LangChain 重构了一遍。两次实践下来，RAG 的每个环节（切分、向量化、检索、生成）都已经摸透。但如果站在"知识管理"的角度重新审视，会发现这两套方案都偏"底层拼装"——你需要自己选切分器、自己接向量库、自己组装 Prompt。有没有更专注于数据索引和检索的方案？

这篇引入 LlamaIndex.TS，一个专注于**数据索引和检索**的框架。重点不是替换 LangChain，而是看它在知识管理这件事上做了哪些更高层的抽象，以及什么场景下选它更合适。

技术栈：LlamaIndex.TS v0.8 + TypeScript + Vercel AI SDK
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
| **TS 版本成熟度** | 高（与 Python 版同步更新） | 中（功能仍在追赶 Python 版） |

> 💡 一个很实际的判断标准：如果你的应用**核心需求是知识检索**（文档问答、知识库搜索），优先考虑 LlamaIndex；如果需要**复杂的多步编排**（Agent、工具链、状态管理），LangChain 更合适。两者也可以组合使用。

### 1.3 核心概念速览

LlamaIndex 的核心抽象只有四个层级，与前面学过的概念一一对应：

```
┌────────────────────────────────────────────────────┐
│           LlamaIndex 四层数据抽象                     │
├────────────────────────────────────────────────────┤
│                                                     │
│  📄 Document      原始数据（文件、字符串、网页...）    │
│       ↓ SentenceSplitter                            │
│  🧩 Node          切分后的片段（自动继承元数据）       │
│       ↓ Embedding                                   │
│  📦 Index         索引结构（向量/摘要/关键词）         │
│       ↓ asQueryEngine()                             │
│  🔍 QueryEngine   查询引擎（检索+生成一体化）          │
│                                                     │
└────────────────────────────────────────────────────┘
```

| LlamaIndex | Module 04（手动） | Module 05（LangChain） |
|------------|------------------|----------------------|
| Document | `fs.readFileSync()` | `Document` |
| Node / TextNode | chunk（文本片段） | `Document`（切分后） |
| VectorStoreIndex | VectorStore + ChromaDB | `Chroma.fromDocuments()` |
| QueryEngine | `RAGPipeline.query()` | `RetrievalQAChain` |
| Response Synthesizer | System Prompt 拼接 | `StuffDocumentsChain` |



## 二、Document 与 Node——数据的组织方式

### 2.1 Document——最基础的数据单元

Document 是 LlamaIndex 中原始数据的抽象。不同于 Module 04 里 `fs.readFileSync()` 返回的纯字符串，Document 是一个结构化对象，包含文本内容和元数据：

```typescript
import { Document } from "llamaindex";

// 方式一：直接从文本创建
const doc1 = new Document({
  text: "TypeScript 是 JavaScript 的超集，添加了静态类型系统。",
  metadata: {
    source: "manual",
    topic: "TypeScript",
    language: "zh",
  },
});

console.log(`文档 ID: ${doc1.id_}`);           // 自动生成唯一 ID
console.log(`元数据: ${JSON.stringify(doc1.metadata)}`);
```

`Document` 有三个关键属性：`text`（文本内容）、`metadata`（元数据字典）、`id_`（唯一标识，自动生成）。元数据会在后续的切分、索引、查询流程中**一路传递**，这是比手写 RAG 方便得多的地方。

方式二是从文件批量创建，这也是实际项目中最常见的用法：

```typescript
import fs from "fs";
import path from "path";

const knowledgeDir = path.join(__dirname, "..", "data", "knowledge");
const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

const documents: Document[] = [];
for (const file of files) {
  const filePath = path.join(knowledgeDir, file);
  const content = fs.readFileSync(filePath, "utf-8");
  const doc = new Document({
    text: content,
    metadata: {
      source: file,
      filePath: filePath,
      fileSize: content.length,
      createdAt: new Date().toISOString(),
    },
  });
  documents.push(doc);
}
```

注意这里手动读文件再包装成 Document。LlamaIndex Python 版有丰富的 Reader（PDF、网页、数据库等），但 **TS 版的 Reader 生态相对薄弱**，很多时候还是需要自己读文件。这是选型时需要考虑的一点。

> 💡 对比 Module 04：Module 04 的"文档"就是 `fs.readFileSync()` 返回的字符串，元数据（文件名、来源等）需要自己用单独的变量或对象维护。LlamaIndex 的 Document 把文本和元数据封装在一起，后续切分成 Node 时元数据会自动继承，不用手动传递。

### 2.2 Node——切分后的片段

Node（TextNode）是 Document 经过切分后的最小单元，相当于 Module 04 里的 chunk。LlamaIndex 使用 `SentenceSplitter` 完成切分：

```typescript
import { SentenceSplitter, MetadataMode } from "llamaindex";

const splitter = new SentenceSplitter({
  chunkSize: 256,     // 每个节点最大 256 字符
  chunkOverlap: 30,   // 相邻节点重叠 30 字符
});

const nodes = splitter.getNodesFromDocuments([doc]);

for (const node of nodes) {
  const text = node.getContent(MetadataMode.NONE);
  console.log(`节点 ${node.id_}: ${text.length} 字符`);
  console.log(`元数据: ${JSON.stringify(node.metadata)}`); // 自动继承 Document 的元数据！
}
```

这里有几个细节值得注意：

1. **`getContent(MetadataMode.NONE)`**：Node 的内容可以通过不同的 MetadataMode 获取。`NONE` 只返回纯文本，`ALL` 会把元数据也拼进文本里（用于 Embedding 时增强语义），`LLM` 和 `EMBED` 分别控制给 LLM 和给 Embedding 模型看的内容格式。
2. **元数据自动继承**：Document 上设置的 `source`、`topic` 等元数据，切分成 Node 后自动保留，无需手动传递。
3. **节点关系**：LlamaIndex 自动维护相邻 Node 的前后引用关系（`PREVIOUS` / `NEXT`），这让后续的"上下文窗口扩展"等高级功能成为可能。

运行 `npm run index-basics` 可以看到不同切分参数的效果对比：

```
$ npm run index-basics

🚀 LlamaIndex 核心概念教程
本教程演示 LlamaIndex.TS 的基础概念，无需 API Key

============================================================
📄 1. Document — LlamaIndex 基本数据单元
============================================================

📌 方式一：直接从文本创建 Document
  文本内容: TypeScript 是 JavaScript 的超集，添加了静态类型系统。...
  元数据: {"source":"manual","topic":"TypeScript","language":"zh"}
  文档 ID: 7a3f2b1e-...

📌 方式二：从文件批量创建 Document
  ✅ 加载: typescript.md (2340 字符)
  ✅ 加载: nodejs.md (1856 字符)
  ✅ 加载: rag-intro.md (1520 字符)

📊 共创建 3 个 Document 对象

============================================================
🔪 2. Node — 文档切分（对比 Module 04 Chunking）
============================================================

📌 SentenceSplitter — 句子级切分器
  原始文档: 2340 字符
  切分参数: chunkSize=256, chunkOverlap=30
  生成节点数: 12

📋 前 3 个节点预览:

  --- 节点 1 ---
  ID: a1b2c3d4-...
  长度: 248 字符
  内容: # TypeScript 基础 TypeScript 是 JavaScript 的超集...
  元数据: {"source":"typescript.md"}

📊 不同切分参数对比:
  chunkSize=128, overlap=20 → 22 个节点
  chunkSize=256, overlap=30 → 12 个节点
  chunkSize=512, overlap=50 → 6 个节点
```

> 💡 chunkSize 的选择直接影响检索质量。太小（128）会丢失上下文，一个完整的概念被拆成多个碎片；太大（512）会引入噪声，一个 chunk 里混杂多个不相关的主题。256 是中文文档的一个不错的起点。

### 2.3 与 Module 04 切分策略的对比

| 特性 | Module 04 手动切分 | LlamaIndex SentenceSplitter |
|------|-------------------|---------------------------|
| 中文支持 | 需要自定义分隔符（`。！？`） | 内置句子边界检测 |
| 元数据传递 | 需手动维护 | 自动从 Document 继承 |
| 节点关系 | 无 | 自动维护前后节点引用 |
| 切分策略数量 | 三种（固定/递归/段落） | 一种，但参数可调 |
| 自定义程度 | 高（完全自己控制） | 中（参数可调，逻辑封装） |

Module 04 的 `recursiveCharacterChunk` 支持自定义分隔符优先级（`\n\n` → `\n` → `。` → `，` → ` `），灵活性更高。SentenceSplitter 的优势在于**零配置就能得到不错的效果**，并且自动处理了元数据传递这个容易遗漏的环节。



## 三、三种索引类型

索引（Index）是 LlamaIndex 的核心，负责将 Node 组织成可检索的数据结构。不同的索引类型适合不同的查询模式。

### 3.1 VectorStoreIndex——向量语义检索

最常用的索引类型。一行代码完成切分 → 向量化 → 存储：

```typescript
import { VectorStoreIndex } from "llamaindex";

// LlamaIndex：一步到位
const index = await VectorStoreIndex.fromDocuments(documents);
```

这一行背后做了三件事：

```
fromDocuments(documents)
    ↓
1. SentenceSplitter 将 Document 切分为 Node
2. Embedding 模型将每个 Node 向量化
3. 向量存入内存向量库（默认 SimpleVectorStore）
```

对比 Module 04 完成同样的事情需要的代码：

```typescript
// Module 04：三步手动操作
const chunks = recursiveCharacterChunk(text, { chunkSize: 300, overlap: 50 });
const embeddings = await localEmbedding.embedDocuments(chunks);
await vectorStore.addDocuments(chunks, embeddings);
```

> 💡 `fromDocuments` 默认使用 OpenAI 的 `text-embedding-ada-002` 作为 Embedding 模型。如果要切换模型，需要通过 `Settings` 全局配置（见 3.4 节）。这种"全局配置"的设计让简单场景很方便，但多模型混用时会比较别扭。

### 3.2 SummaryIndex——遍历摘要

不做向量检索，查询时遍历所有节点让 LLM 生成摘要：

```typescript
import { SummaryIndex } from "llamaindex";
const index = await SummaryIndex.fromDocuments(documents);
```

SummaryIndex 的构建**零成本**（不需要调用 Embedding 模型），但查询时需要将所有节点都发给 LLM 处理，Token 消耗大。适合"总结全部文档"这类全局性问题，不适合精确查找。

### 3.3 索引选择决策树

```
你的查询需求是什么？
├── 针对具体问题找答案 → VectorStoreIndex（语义检索，最常用）
├── 总结所有文档内容 → SummaryIndex（遍历所有节点）
├── 按关键词精确查找 → KeywordTableIndex（倒排索引）
└── 不同问题用不同策略 → RouterQueryEngine（自动路由，见第五章）
```

| 索引类型 | 构建成本 | 查询成本 | 适用场景 |
|---------|---------|---------|---------|
| VectorStoreIndex | 中（需 Embedding） | 低（Top-K 检索） | 语义搜索、精确问答 |
| SummaryIndex | 零 | 高（遍历所有节点） | 文档总结、全局概览 |
| KeywordTableIndex | 低（关键词抽取） | 低（关键词匹配） | 精确关键词查找 |

### 3.4 Settings 全局配置——模型适配

LlamaIndex 通过 `Settings` 对象做全局配置，这是它和 LangChain 风格上的一个重要差异。LangChain 在每个 Chain 里显式传入模型，LlamaIndex 则倾向于全局设置一次：

```typescript
import { Settings, OpenAI, OpenAIEmbedding, DeepSeekLLM } from "llamaindex";

// 方案一：OpenAI 全家桶（最简单）
Settings.llm = new OpenAI({ model: "gpt-4o-mini", apiKey: process.env.OPENAI_API_KEY });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small", apiKey: process.env.OPENAI_API_KEY });

// 方案二：DeepSeek LLM + OpenAI Embedding（性价比方案）
Settings.llm = new DeepSeekLLM({ model: "deepseek-chat", apiKey: process.env.DEEPSEEK_API_KEY });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small", apiKey: process.env.OPENAI_API_KEY });
```

注意 DeepSeek 不提供 Embedding API，所以 LLM 用 DeepSeek 时 Embedding 仍需要 OpenAI。这是实际项目中常见的"混合搭配"模式。

> 💡 对比 Module 03 的 `model-adapter.ts`：我们自己封装的适配层基于 Vercel AI SDK，用 `getModel(provider)` 返回统一接口。LlamaIndex 的 Settings 是框架内置的全局配置，基于自己的 LLM 封装。两者解决的是同一个问题——多模型适配，但实现路径不同。



## 四、QueryEngine——查询引擎

### 4.1 基本查询

从 Index 创建 QueryEngine 只需一行：

```typescript
const queryEngine = index.asQueryEngine({ similarityTopK: 3 });
const response = await queryEngine.query({
  query: "TypeScript 的核心特性有哪些？"
});
console.log(response.toString());
```

`similarityTopK: 3` 表示检索最相关的 3 个节点。这个参数直接影响回答质量——太少可能遗漏关键信息，太多会引入噪声并增加 Token 消耗。

### 4.2 查询引擎内部流程

```
┌─────────┐    ┌──────────┐    ┌────────────────┐    ┌─────────────────┐    ┌─────────┐
│  Query  │ →  │ Retriever│ →  │NodePostprocessor│ →  │ResponseSynthesizer│ →  │ Answer │
│(用户问题)│    │(检索TopK)│    │ (重排序/过滤)   │    │(上下文+LLM生成)    │    │(最终回答)│
└─────────┘    └──────────┘    └────────────────┘    └─────────────────┘    └─────────┘
```

四个阶段的职责：

1. **Retriever**：从 Index 中检索出与问题最相关的 Top-K 个 Node。对 VectorStoreIndex 来说就是向量相似度计算。
2. **NodePostprocessor**（可选）：对检索结果做后处理——比如按相似度阈值过滤、按关键词筛选、重新排序等。
3. **ResponseSynthesizer**：将筛选后的 Node 内容拼接成上下文，结合用户问题构造 Prompt，调用 LLM 生成回答。
4. **Answer**：最终的结构化响应，包含回答文本和引用来源。

与 Module 04 的对应关系：

```
┌────────────────────┬────────────────────────────────────┐
│   LlamaIndex 阶段  │       Module 04 对应代码             │
├────────────────────┼────────────────────────────────────┤
│ Retriever          │ vectorStore.search(query, topK)    │
│ NodePostprocessor  │ results.filter(r => r.score > 0.7) │
│ ResponseSynthesizer│ System Prompt 拼接 + chatWithModel()│
│ Answer             │ response.text                      │
└────────────────────┴────────────────────────────────────┘
```

### 4.3 VectorStoreIndex 查询实战

运行 `npm run query-engine` 可以看到不同索引类型的查询效果：

```
$ npm run query-engine

🚀 LlamaIndex 查询引擎对比教程

✅ 使用模型提供商: deepseek

⚙️  配置 LlamaIndex 使用 deepseek 模型...
  ✅ LLM: DeepSeek (deepseek-chat)
  ✅ Embedding: OpenAI (text-embedding-3-small)

📚 加载知识库文档:
  📄 加载: typescript.md (2340 字符)
  📄 加载: nodejs.md (1856 字符)
  📄 加载: rag-intro.md (1520 字符)

============================================================
🔮 VectorStoreIndex — 向量语义查询
============================================================

📌 构建向量索引...
  ✅ 索引构建完成 (3241ms)

🔍 问题: TypeScript 的核心特性有哪些？
💬 回答: TypeScript 的核心特性包括：1. 静态类型系统...
⏱️  耗时: 1523ms

🔍 问题: RAG 的工作流程是什么？
💬 回答: RAG 的工作流程分为离线索引和在线查询两个阶段...
⏱️  耗时: 1847ms
```

### 4.4 SummaryIndex 查询实战

```
============================================================
📝 SummaryIndex — 摘要查询
============================================================

📌 构建摘要索引...
  ✅ 索引构建完成 (12ms) — 无需 Embedding，速度更快

🔍 问题: 请总结这些文档的主要内容
💬 回答: 这些文档涵盖三个主题：1. TypeScript 基础...
⏱️  耗时: 5230ms
```

注意两个指标的对比：**构建时间** SummaryIndex（12ms）远快于 VectorStoreIndex（3241ms），因为不需要 Embedding；**查询时间**则相反，SummaryIndex（5230ms）远慢于 VectorStoreIndex（1523ms），因为要遍历所有节点。

> 💡 这揭示了一个通用的工程权衡：**构建时投入更多计算（向量化），查询时就能更快更准；构建时省事（不向量化），查询时就要付出更大的代价。** 绝大多数场景下，VectorStoreIndex 是正确的选择。



## 五、高级 RAG 技术

### 5.1 结果重排序（Reranking）

向量检索返回的 Top-K 结果不一定都相关。`SimilarityPostprocessor` 可以按相似度阈值过滤掉不够相关的结果：

```typescript
import { SimilarityPostprocessor } from "llamaindex";

const queryEngine = index.asQueryEngine({
  similarityTopK: 5,           // 先检索 5 个
  nodePostprocessors: [
    new SimilarityPostprocessor({
      similarityCutoff: 0.7,   // 过滤掉相似度低于 0.7 的
    }),
  ],
});
```

工作流程：

```
用户问题
    ↓ Retriever
Top-5 节点 [0.92, 0.85, 0.73, 0.61, 0.45]
    ↓ SimilarityPostprocessor (cutoff=0.7)
过滤后 [0.92, 0.85, 0.73]  ← 只保留 3 个高质量节点
    ↓ ResponseSynthesizer
最终回答（基于高质量上下文）
```

对比 Module 04：手动实现是 `results.filter(r => r.score > threshold)`，原理完全一样，LlamaIndex 只是把它标准化为 `NodePostprocessor` 接口。

LlamaIndex 还支持其他 Postprocessor：

| Postprocessor | 作用 | 效果 |
|--------------|------|------|
| `SimilarityPostprocessor` | 相似度阈值过滤 | 去除低质量结果 |
| `KeywordNodePostprocessor` | 关键词过滤 | 必须包含/排除特定关键词 |
| `CohereRerank`（需额外包） | 专业重排序模型 | 效果最好，但需要额外 API |

### 5.2 RouterQueryEngine——路由查询引擎

这是 LlamaIndex 最有意思的高级功能之一：让 LLM 根据问题类型**自动选择**最合适的查询引擎。

```typescript
import { RouterQueryEngine, VectorStoreIndex, SummaryIndex } from "llamaindex";

// 构建两种不同的索引
const vectorIndex = await VectorStoreIndex.fromDocuments(documents);
const summaryIndex = await SummaryIndex.fromDocuments(documents);

// 创建查询引擎工具（描述越清晰，路由越准确）
const vectorTool = {
  queryEngine: vectorIndex.asQueryEngine(),
  description: "适合回答具体的技术问题，例如某个特性的说明、具体的用法等",
};

const summaryTool = {
  queryEngine: summaryIndex.asQueryEngine(),
  description: "适合总结和概览类问题，例如总结文档内容、生成报告等",
};

// 创建路由查询引擎
const routerEngine = RouterQueryEngine.fromDefaults({
  queryEngineTools: [vectorTool, summaryTool],
});

// LLM 自动判断路由
await routerEngine.query({ query: "TypeScript 泛型怎么用？" });    // → vectorTool
await routerEngine.query({ query: "总结所有文档的核心内容" });       // → summaryTool
```

路由决策的底层原理是：RouterQueryEngine 把所有工具的 `description` 和用户问题一起发给 LLM，让 LLM 决定用哪个工具。这和 Module 06 中 Multi-Agent 的 Routing 模式本质相同——都是让 LLM 做"调度员"。

运行 `npm run advanced-rag`：

```
$ npm run advanced-rag

🚀 LlamaIndex 高级 RAG 技术

============================================================
🔀 3. RouterQueryEngine — 路由查询引擎
============================================================

  🏗️  构建向量索引（用于精确查询）...
  🏗️  构建摘要索引（用于总结查询）...

🔍 问题: TypeScript 泛型的具体用法是什么？
  预期路由: vector_search
  💬 回答: TypeScript 泛型允许你创建可重用的组件...

🔍 问题: 请总结所有文档的核心内容
  预期路由: summary_search
  💬 回答: 这些文档涵盖了三个核心主题...
```

> 💡 RouterQueryEngine 的 `description` 字段至关重要。描述写得模糊，LLM 就分不清该路由到哪个引擎。这和 Module 06 中定义 Tool description 的经验一致——**给 LLM 的指令越明确，行为越可预测**。

### 5.3 SubQuestionQueryEngine——子问题分解

面对复杂的多方面问题时，直接检索往往效果不佳，因为一个复杂问题可能涉及多个知识点。SubQuestionQueryEngine 的策略是**先拆解再分别检索**：

```
"对比 TypeScript 和 Node.js 在 AI 开发中的角色"
         ↓ LLM 分解
子问题1: "TypeScript 在 AI 开发中的角色？"
子问题2: "Node.js 在 AI 开发中的角色？"
         ↓ 分别检索、分别回答
         ↓ 合并为对比分析
```

对比 Module 04 `rag-optimize.ts` 中的 HyDE（Hypothetical Document Embedding）：

| 优化策略 | 思路 | 优势 | 劣势 |
|---------|------|------|------|
| **SubQuestion** | 拆分问题 → 分别检索 → 合并回答 | 多角度全面覆盖 | 多次 LLM 调用，延迟高 |
| **HyDE** | 先生成假设答案 → 用假设答案检索 | 一次检索，延迟低 | 假设答案可能偏离 |

两者目标一致——**提升复杂问题的检索质量**，但路径不同。实际项目中可以根据延迟容忍度来选择。



## 六、用 LlamaIndex 构建完整 RAG

### 6.1 LlamaIndexRAG 类

`rag-llamaindex.ts` 用 LlamaIndex 实现了完整的 RAG 流水线。核心代码只有 50 行左右：

```typescript
class LlamaIndexRAG {
  private index: VectorStoreIndex | null = null;
  private documents: Document[] = [];

  /** 加载文档 — 对应 Module 04 的文件读取 */
  async loadDocuments(dirPath: string): Promise<number> {
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
      this.documents.push(
        new Document({
          text: content,
          metadata: { source: file, fileSize: content.length },
        })
      );
    }
    return this.documents.length;
  }

  /** 构建索引 — 对应 Module 04 的 chunk + embed + store 三步 */
  async buildIndex(): Promise<void> {
    // LlamaIndex 一步到位！
    this.index = await VectorStoreIndex.fromDocuments(this.documents);
  }

  /** RAG 查询 — 对应 Module 04 的 RAGPipeline.query() */
  async query(question: string): Promise<string> {
    if (!this.index) throw new Error("请先调用 buildIndex()");
    const queryEngine = this.index.asQueryEngine({ similarityTopK: 3 });
    const response = await queryEngine.query({ query: question });
    return response.toString();
  }
}
```

和 Module 04 的 `RAGPipeline` 对比，关键差异在 `buildIndex()`。Module 04 需要分别调用 `chunk()`、`embed()`、`store()` 三个函数，每个都要自己管理参数和错误处理。LlamaIndex 的 `fromDocuments()` 把这三步封装成了一个原子操作。

### 6.2 RAG vs 无 RAG 效果对比

运行 `npm run rag-llamaindex`：

```
$ npm run rag-llamaindex

🚀 LlamaIndex RAG 实战 — 对比 Module 04/05

✅ 使用模型提供商: deepseek
⚙️  配置 LlamaIndex 使用 deepseek 模型...
  ✅ LLM: DeepSeek | Embedding: OpenAI

📂 加载文档目录: .../data/knowledge
  ✅ typescript.md (2340 字符)
  ✅ nodejs.md (1856 字符)
  ✅ rag-intro.md (1520 字符)

🏗️  构建向量索引...
  ✅ 索引构建完成 (3156ms)

============================================================
🔬 RAG vs 无 RAG 效果对比
============================================================

❓ 问题: TypeScript 在 LLM 开发中有什么优势？
----------------------------------------

📗 LlamaIndex RAG 回答:
  根据知识库资料，TypeScript 在 LLM 开发中的优势包括：
  1. 静态类型系统确保 API 参数和返回值的类型安全
  2. 泛型能力方便封装通用的模型调用接口
  3. 与 Node.js 生态的 AI SDK 无缝集成...
  ⏱️  耗时: 1823ms

📕 无 RAG（纯 LLM）回答:
  TypeScript 在 LLM 开发中有以下优势：
  1. 类型安全
  2. 开发体验好（但内容更泛化，缺少具体细节）...
  ⏱️  耗时: 1205ms
```

RAG 的回答基于知识库中的具体内容，能给出更精确、更有针对性的答案；纯 LLM 的回答虽然也合理，但偏泛化，缺少知识库中特有的细节。

### 6.3 多轮对话 RAG

Module 04 的 `conversational-rag.ts` 用问题改写解决代词问题（约 50 行代码）——当用户说"它的泛型有什么用"时，需要把"它"替换为"TypeScript"再去检索。LlamaIndex 的 `ContextChatEngine` 内置了这个能力：

```typescript
import { ContextChatEngine } from "llamaindex";

const retriever = index.asRetriever({ similarityTopK: 3 });
const chatEngine = new ContextChatEngine({ retriever });

// 第一轮：正常问题
await chatEngine.chat({ message: "TypeScript 有哪些核心特性？" });

// 第二轮："它"自动理解为 TypeScript
await chatEngine.chat({ message: "它的泛型有什么用？" });

// 第三轮："这些特性"自动关联上下文
await chatEngine.chat({ message: "这些特性在 AI 开发中怎么用？" });
```

`ContextChatEngine` 内部自动维护对话历史，每次查询时结合历史上下文做问题理解和检索。Module 04 手动实现这个功能需要：维护 `chatHistory` 数组 → 构造改写 Prompt → 调用 LLM 改写问题 → 用改写后的问题检索。ContextChatEngine 把这些都封装了。

```
$ npm run rag-llamaindex

============================================================
💬 多轮对话 RAG（ContextChatEngine）
============================================================

👤 用户: TypeScript 有哪些核心特性？
🤖 助手: TypeScript 的核心特性包括静态类型、接口、泛型、枚举...

👤 用户: 它的泛型有什么用？
🤖 助手: TypeScript 的泛型允许你编写参数化类型的函数和类...

👤 用户: 这些特性在 AI 开发中怎么用？
🤖 助手: 在 AI 开发中，这些 TypeScript 特性的应用场景包括...
```



## 七、什么时候不该用 LlamaIndex

框架选型不能只看优点。以下是 LlamaIndex.TS 当前的局限性：

### 7.1 TS 版与 Python 版的差距

LlamaIndex 是 Python 优先的项目，TS 版（llamaindex.ts）在功能覆盖上有明显差距：

| 能力 | Python 版 | TS 版 |
|------|----------|-------|
| 文档 Reader（PDF/Web/DB） | 30+ 种 | 有限，常需手动读文件 |
| 向量数据库集成 | 20+ 种（Pinecone/Weaviate/Milvus...） | 较少 |
| 高级索引（Tree/KG） | ✅ 支持 | ❌ 不支持或实验性 |
| 评估框架 | 内置 | 无 |
| 社区生态 | 活跃 | 较小 |

如果你的项目需要丰富的集成（多种数据源、多种向量库），Python 版是更成熟的选择。

### 7.2 不适合的场景

```
├── 需要复杂的多步编排（Agent 协作、状态管理）→ LangChain / LangGraph
├── 需要流式 UI（聊天界面）→ Vercel AI SDK
├── 需要深度定制每个 RAG 环节 → Module 04 手动实现
├── 需要轻量级方案（不想引入重框架）→ 直接用 Vercel AI SDK + 向量库
└── 生产级要求高可用和可观测 → 需要额外的基础设施
```

### 7.3 Settings 全局配置的陷阱

LlamaIndex 的 `Settings` 是全局单例。这意味着：

- **同一进程只能有一套 LLM + Embedding 配置**。如果你想对不同的索引用不同的 Embedding 模型，会非常别扭。
- **测试不方便**。全局状态让单元测试需要额外的 setup/teardown。
- **多租户场景困难**。如果不同用户要用不同的模型，全局 Settings 无法满足。

对比 LangChain 的做法——每个 Chain 显式传入模型实例——更符合"显式优于隐式"的原则，在复杂场景下更灵活。

> 💡 这不是说 LlamaIndex 不好。它的设计哲学是**让最常见的场景最简单**——大多数项目确实只需要一套模型配置。但了解这个限制，能帮你在选型时做出更准确的判断。



## 八、三种 RAG 实现的终极对比

### 8.1 代码量对比

| 环节 | Module 04 手写 | Module 05 LangChain | Module 11 LlamaIndex |
|------|---------------|--------------------|--------------------|
| 文档加载 | 5 行 | 5 行 | 10 行 |
| 切分 | 40 行 | 5 行 | —（自动） |
| 向量化 | 30 行 | 5 行 | —（自动） |
| 存储 | 60 行 | 10 行 | —（自动） |
| 查询 | 50 行 | 20 行 | 5 行 |
| **合计** | **~185 行** | **~45 行** | **~15 行** |

LlamaIndex 的代码量最少，因为 `fromDocuments()` 一步包办了切分、向量化、存储三个环节。代价是你对中间过程的控制力降低了。

### 8.2 适用场景决策

```
你的需求是什么？
├── 需要理解 RAG 底层原理 → Module 04 手动实现
│   （学完再上框架，知其所以然）
├── 构建通用 LLM 应用 → Module 05 LangChain
│   （Agent + Chain + Memory 全家桶）
├── 专注知识管理和文档 QA → Module 11 LlamaIndex
│   （最少代码实现最完整的 RAG）
└── 生产级系统 → LlamaIndex 索引 + LangChain 编排
    （用各自最强的部分）
```

## 九、总结

1. **Document → Node → Index → QueryEngine** 四层抽象，清晰地组织知识数据，每一层都有明确的职责
2. **VectorStoreIndex** 是通用首选，`fromDocuments()` 一步完成切分→向量化→存储
3. **三种索引类型**各有适用场景——向量检索做精确问答，摘要索引做全局总结，关键词索引做精确匹配
4. **RouterQueryEngine** 实现智能路由，让 LLM 自动选择最佳查询策略
5. **ContextChatEngine** 内置多轮对话支持，省去手动问题改写
6. **TS 版仍在追赶 Python 版**，选型时需评估功能覆盖度
7. RAG 优化方向与框架无关——切分质量、检索精度、重排序策略、问题理解能力，这些是通用的工程问题

下一步：从"用模型"到"定制模型"——Module 12 Fine-tuning 模型微调 →

## 十、参考资料

**官方文档：**
- [LlamaIndex.TS 文档](https://ts.llamaindex.ai/)
- [LlamaIndex Python 文档](https://docs.llamaindex.ai/)
- [LlamaIndex GitHub (TS)](https://github.com/run-llama/LlamaIndexTS)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)

**相关代码：**
- [11-llamaindex](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/11-llamaindex)
