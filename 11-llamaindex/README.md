# 11-llamaindex — LlamaIndex 知识管理与信息检索

> 用 LlamaIndex.TS 构建知识管理应用，与 Module 04（手动 RAG）/ Module 05（LangChain RAG）形成三角对比

## 学习目标

- 理解 LlamaIndex 的核心抽象：Document、Node、Index、QueryEngine
- 掌握三种索引类型（Vector、Summary、Keyword）的适用场景
- 用 LlamaIndex 实现完整 RAG，对比 Module 04/05 的代码量和灵活性
- 学习高级 RAG 技术：子问题分解、重排序、路由查询
- 使用 ContextChatEngine 实现多轮对话 RAG

## 环境配置

### 1. 安装依赖

```bash
cd 11-llamaindex
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env，填入至少一个 API Key
```

> 💡 `index-basics` 脚本无需 API Key 即可运行。其余脚本需要 API Key（LlamaIndex 默认使用 OpenAI Embedding，推荐配置 `OPENAI_API_KEY`）。

### 3. 知识库文档

`data/knowledge/` 目录下预置了 3 篇中文技术文档（TypeScript、Node.js、LLM 基础），作为知识库数据源。



## Demo 脚本

### `npm run index-basics` — LlamaIndex 核心概念（无需 API Key）

演示 LlamaIndex 的三个基础抽象，对比 Module 04 的对应概念：

- **Document**：文本 + 元数据的统一封装（vs Module 04 的 `fs.readFileSync()`）
- **Node**：文档切分后的片段（vs Module 04 的 chunk）
- **SentenceSplitter**：句子级切分器（vs Module 04 的 `recursiveCharacterChunk`）
- 三种索引类型概念介绍

```bash
npm run index-basics
```

```
📄 1. Document — LlamaIndex 基本数据单元

📌 方式一：直接从文本创建 Document
  文本内容: TypeScript 是 JavaScript 的超集，添加了静态类型系统。...
  元数据: {"source":"manual","topic":"TypeScript","language":"zh"}
  文档 ID: 7b36a379-3d01-44ce-8c91-eaedda2c7d59

📌 方式二：从文件批量创建 Document
  ✅ 加载: llm-basics.md (854 字符)
  ✅ 加载: nodejs.md (888 字符)
  ✅ 加载: typescript.md (818 字符)

🔪 2. Node — 文档切分（对比 Module 04 Chunking）

📌 SentenceSplitter — 句子级切分器
  原始文档: 818 字符
  切分参数: chunkSize=256, chunkOverlap=30
  生成节点数: 3

📊 不同切分参数对比:
  chunkSize=128, overlap=20 → 6 个节点
  chunkSize=256, overlap=30 → 3 个节点
  chunkSize=512, overlap=50 → 2 个节点

💡 概念对比 — Module 04 Chunking vs LlamaIndex Node:
  Module 04: 手动实现 fixedSizeChunk / recursiveCharacterChunk
  LlamaIndex: 内置 SentenceSplitter，自动处理句子边界
  共同点: 都支持 chunkSize 和 overlap 参数
  LlamaIndex 优势: Node 自动维护与 Document 的引用关系
```



### `npm run query-engine` — 查询引擎对比

构建 VectorStoreIndex 和 SummaryIndex，对比两种查询引擎的效果和适用场景：

- **VectorStoreIndex**：语义向量检索，适合精确问答
- **SummaryIndex**：遍历所有节点生成摘要，适合全局总结
- 三种查询引擎的对比总结

```bash
npm run query-engine
```

未配置 API Key 时自动展示概念说明：

```
📊 查询引擎对比总结

┌──────────────────┬────────────┬────────────┬──────────────────┐
│       类型       │ 构建成本   │ 查询成本   │    适用场景       │
├──────────────────┼────────────┼────────────┼──────────────────┤
│ VectorStoreIndex │ 中(Embed)  │ 低(Top-K)  │ 语义搜索、QA     │
│ SummaryIndex     │ 零         │ 高(遍历)   │ 文档总结         │
│ KeywordTableIndex│ 低(抽取)   │ 低(匹配)   │ 精确关键词查询    │
└──────────────────┴────────────┴────────────┴──────────────────┘
```

配置 API Key 后，实际执行向量查询和摘要查询并对比耗时和效果。



### `npm run rag-llamaindex` — LlamaIndex RAG（对比 Module 04/05）

用 LlamaIndex 实现完整 RAG 流水线，并与前面的实现对比：

- **LlamaIndexRAG 类**：加载文档 → 一步构建索引 → 查询
- **RAG vs 纯 LLM** 效果对比
- **ContextChatEngine 多轮对话**（vs Module 04 手动问题改写）
- 三种 RAG 实现方式的代码量和灵活性对比

```bash
npm run rag-llamaindex
```

```
📊 三种 RAG 实现方式代码量对比

┌────────────────────┬────────┬────────────────────────────────┐
│       实现方式     │ 代码量 │         关键步骤               │
├────────────────────┼────────┼────────────────────────────────┤
│ Module 04 手动实现  │ ~200行 │ chunk→embed→store→retrieve→LLM│
│ Module 05 LangChain │ ~100行 │ splitter→vectorStore→chain     │
│ Module 11 LlamaIndex│ ~50行  │ Document→Index→QueryEngine     │
└────────────────────┴────────┴────────────────────────────────┘
```



### `npm run advanced-rag` — 高级 RAG 技术

演示 LlamaIndex 的高级检索功能：

- **SubQuestionQueryEngine**：将复杂问题分解为多个子问题分别检索
- **SimilarityPostprocessor**：按相似度阈值过滤检索结果（重排序）
- **RouterQueryEngine**：LLM 自动选择最合适的查询引擎（路由分发）
- 与 Module 04 `rag-optimize.ts` 的优化思路对比

```bash
npm run advanced-rag
```

```
📊 高级 RAG 技术总结

📌 优化方向与对应技术:
  ┌────────────────┬────────────────────┬──────────────────────┐
  │   优化方向     │   LlamaIndex 方案   │  Module 04 对应方案   │
  ├────────────────┼────────────────────┼──────────────────────┤
  │ 查询理解       │ SubQuestionQuery   │ 问题改写/HyDE         │
  │ 检索精度       │ Reranking          │ Top-K + 阈值过滤      │
  │ 多源检索       │ RouterQueryEngine  │ 未实现                │
  │ 文档切分       │ SentenceSplitter   │ recursiveCharacterChunk│
  │ 上下文窗口     │ ContextChatEngine  │ conversational-rag     │
  └────────────────┴────────────────────┴──────────────────────┘
```



## 核心知识点

### 一、LlamaIndex vs LangChain 定位

| 维度 | LangChain | LlamaIndex |
|------|-----------|------------|
| 核心能力 | 链式调用、Agent、Memory | 数据索引、查询引擎 |
| 主要场景 | 通用 LLM 应用 | 知识管理、文档 QA |
| 类比 | Express（通用框架） | Prisma（专注数据层） |
| 灵活性 | 极高（LCEL 万能组合） | 中等（高层封装为主） |

**不是谁替代谁**——LangChain 做通用编排，LlamaIndex 做数据检索。复杂项目中可以组合使用。

### 二、三种索引类型

```
你的需求是什么？
├── 精确问答 → VectorStoreIndex（语义检索）
├── 全文总结 → SummaryIndex（遍历摘要）
├── 关键词查找 → KeywordTableIndex（关键词匹配）
└── 混合需求 → RouterQueryEngine（自动路由）
```

### 三、LlamaIndex 查询流程

```
Query → Retriever → NodePostprocessor → ResponseSynthesizer → Answer
        (检索)      (重排序/过滤)        (上下文+LLM生成)
```

对应 Module 04：`vectorStore.search()` → 手动阈值过滤 → System Prompt + `chatWithModel()`

### 四、RouterQueryEngine 路由模式

类似 Module 06 Multi-Agent 的 Routing 模式，但应用在检索层面：
- 定义多个 QueryEngineTool，每个描述适用场景
- LLM 根据用户问题自动选择合适的查询引擎
- 不同问题自动路由到向量查询或摘要查询

### 五、三种 RAG 实现选型建议

```
├── 需要理解 RAG 底层原理 → Module 04 手动实现
├── 构建通用 LLM 应用（Agent + RAG + Memory）→ Module 05 LangChain
├── 专注知识管理和文档 QA → Module 11 LlamaIndex
└── 生产级知识库系统 → LlamaIndex 索引 + LangChain 编排
```



## 文件结构

```
11-llamaindex/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── model-adapter.ts   # 多模型适配（复制自 Module 10）
│   ├── index-basics.ts    # 核心概念：Document、Node、Index
│   ├── query-engine.ts    # 查询引擎对比：向量 vs 摘要
│   ├── rag-llamaindex.ts  # LlamaIndex RAG 实战（对比 Module 04/05）
│   └── advanced-rag.ts    # 高级 RAG：子问题、重排序、路由
└── data/
    └── knowledge/         # 示例知识库文档（中文）
        ├── typescript.md
        ├── nodejs.md
        └── llm-basics.md
```
