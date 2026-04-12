# AI应用实践(3)—RAG检索增强生成实战

前两篇解决了模型调用和 Prompt 管理的问题，但模型的知识边界并没有变。想让 AI 回答最新文档、私有资料和业务知识，RAG 基本是绕不过去的一层。

值得一提的是，随着模型上下文窗口不断扩大（从 4K → 128K → 1M+），"把文档全塞进 Prompt"在很多场景下已经可行，RAG 不再是唯一解。但当文档量超出窗口限制、需要精确溯源引用、对推理成本敏感、或者知识库持续更新时，RAG 仍然是更务实的选择。**理解 RAG 的原理不会过时——即使窗口无限大，"先检索再生成"的思想本身也是一种通用的工程模式。**

这篇不依赖 LangChain 等框架，直接手写一个完整的 RAG 系统：文本切分 → 向量化 → 存储 → 检索 → 生成 → 多轮对话。重点不是“调通一个库”，而是把每个环节为什么这样设计讲清楚。

技术栈：TypeScript + @xenova/transformers + ChromaDB + Vercel AI SDK
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/04-rag](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/04-rag)

## 一、为什么需要 RAG

### 1.1 LLM 的两大硬伤

在前两期中，我们已经体验了 LLM 的强大。但在实际业务场景中，纯 LLM 有两个致命问题：

| 问题 | 说明 | 真实场景 |
|------|------|---------|
| **知识过时** | 训练数据有截止日期 | 问"GPT-5什么时候发布的？"，模型可能回答"我不知道" |
| **幻觉（Hallucination）** | 模型会自信地编造不存在的信息 | 问"公司内部报销流程"，LLM 编一个看似合理但完全虚构的流程 |
| **缺乏私有知识** | 无法获取企业专属数据 | 不了解你的代码库、内部文档、业务规则 |

简单来说：**LLM 只能用"记忆"回答问题，而它的"记忆"既不完整也不可靠。**

### 1.2 RAG 的核心思想：先检索再生成

**RAG（Retrieval-Augmented Generation，检索增强生成）** 的思路非常直觉：

> 🎒 **类比**：想象你参加一场考试。
> - **纯 LLM** = 闭卷考试：全靠脑子记，记不清就瞎编
> - **RAG** = 开卷考试：先翻书找到相关章节，再基于书本内容作答
>
> 开卷考试不需要你把所有知识背下来，只要你**能快速找到正确的参考资料**，就能答得又准又好。

RAG 做的就是这件事：**在 LLM 回答之前，先从知识库中检索出最相关的内容，作为"参考资料"塞进 Prompt，再让 LLM 基于这些资料回答。**

### 1.3 RAG 的完整流程

整个 RAG 系统分为两个阶段：

```
离线阶段（Indexing）— 建索引

  文档 ──→ 文本切分 ──→ 向量化(Embedding) ──→ 存入向量DB
  PDF/MD    Chunking     数字向量           ChromaDB

在线阶段（Query）— 问答

  用户问题 ──→ 向量化 ──→ 向量检索 ──→ Top-K 结果
                                     ↓
              LLM ←── Prompt 组装 ←──┘
               ↓
           最终回答（基于参考资料）
```

接下来，我们逐个环节拆解实现。



## 二、文本切分策略

### 2.1 为什么需要切分

你可能会问：直接把整个文档塞给 LLM 不行吗？

两个原因：

1. **Token 限制**：LLM 的上下文窗口有限（如 GPT-4 约 128K token），一本书可能有几百万 token，根本塞不进去
2. **精准检索**：整个文档太大，检索时无法定位到具体段落。把文档切成小块，检索才能找到**最相关的那几段**

> 🎒 **类比**：你在图书馆找"什么是 RAG"的答案。是翻遍整本《AI导论》效率高，还是直接翻到目录定位到"RAG 章节"的那几页效率高？切分就是帮你**建目录**。

### 2.2 三种切分策略

我们在 `chunking.ts` 中实现了三种策略：

#### 策略1：固定大小分块

最简单粗暴——按字符数均匀切分，加上 overlap（重叠）防止关键信息被截断。

```typescript
export function fixedSizeChunk(
  text: string,
  options: FixedSizeOptions = { chunkSize: 200, overlap: 50 }
): string[] {
  const { chunkSize, overlap } = options;
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    // 每次前进 chunkSize - overlap 个字符，实现重叠
    start += chunkSize - overlap;
  }

  return chunks;
}
```

**优点**：实现简单，块大小均匀
**缺点**：可能在句子中间截断，"今天天气真" | "好，适合出去散步"

#### 策略2：递归字符分块（推荐，中文友好）

核心思想：**优先用粗粒度的分隔符切分，切不动再用细粒度的**。

```
第1层: 尝试用 "\n\n"(段落) 切
   → 段落A(500字) > 300字 ❌ 递归到下一层 ↓
   → 段落B(200字) ≤ 300字 ✅ 直接保留

   第2层: 对段落A，尝试用 "。"(句号) 切
     → 句1(120字) + 句2(100字) = 220 ≤ 300 ✅ 合并为一块
     → 句3(130字) 单独一块 ✅
```

代码中的分隔符优先级，专门为中文优化：

```typescript
const separators = [
  "\n\n",   // 段落
  "\n",     // 换行
  "。",     // 中文句号
  "！",     // 中文感叹号
  "？",     // 中文问号
  "；",     // 中文分号
  ". ",     // 英文句号
  "，",     // 中文逗号
  ", ",     // 英文逗号
  " ",      // 空格
  "",       // 字符级（兜底）
];
```

**优点**：兼顾语义完整性和块大小均匀性
**缺点**：实现稍复杂

递归切分的核心逻辑：找到文本中存在的最粗粒度分隔符 → 按它切分 → 小于 chunkSize 的片段合并 → 大于 chunkSize 的片段递归用更细的分隔符继续切 → 相邻块之间保留 overlap 重叠：

```typescript
function recursiveSplit(text: string, separators: string[], chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) return text.trim() ? [text.trim()] : [];

  // 找当前最合适的分隔符
  let currentSep = "";
  for (const sep of separators) {
    if (sep === "" || text.includes(sep)) { currentSep = sep; break; }
  }

  const parts = currentSep ? text.split(currentSep).filter(p => p.trim().length > 0) : [...text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const part of parts) {
    const candidate = currentChunk ? currentChunk + currentSep + part : part;
    if (candidate.length <= chunkSize) {
      currentChunk = candidate;  // 还能合并
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      if (part.length > chunkSize) {
        // 单个 part 超限，递归用更细的分隔符
        const remainingSeps = separators.slice(separators.indexOf(currentSep) + 1);
        chunks.push(...recursiveSplit(part, remainingSeps, chunkSize, overlap));
        currentChunk = "";
      } else {
        // 实现 overlap：从上一块末尾取部分文本
        if (overlap > 0 && chunks.length > 0) {
          const overlapText = chunks[chunks.length - 1].slice(-overlap);
          currentChunk = overlapText + currentSep + part;
        } else {
          currentChunk = part;
        }
      }
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}
```

#### 策略3：段落分块

按自然段落（双换行 `\n\n`）切分，过小的段落自动合并。

```typescript
export function paragraphChunk(
  text: string,
  options: ParagraphOptions = { minChunkSize: 100 }
): string[] {
  const { minChunkSize = 100 } = options;
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  // 合并过小的段落...
}
```

**优点**：最好地保留语义完整性
**缺点**：块大小不均匀（有的段落10字，有的500字）

### 2.3 切分效果对比

运行 `npm run chunking`，对同一篇知识库文档（~2000字）使用三种策略，得到：

| 策略 | 块数 | 平均长度 | 最小 | 最大 | 适用场景 |
|------|------|---------|------|------|---------|
| 固定大小 (300/50) | 11 | 293 | 221 | 300 | 快速原型 |
| **递归字符 (300/50)** | **14** | **241** | **173** | **294** | **通用推荐** |
| 段落分块 (min 150) | 11 | 246 | 157 | 401 | 结构清晰的文档 |

> 💡 **实践建议**：
> - 通用场景：递归字符分块，**200-500字/块**，overlap 10-20%
> - Q&A 场景：小块（200字）+ 更多 Top-K 结果
> - 摘要场景：大块（500-1000字）保留更多上下文



## 三、文本向量化（Embeddings）

### 3.1 什么是 Embedding

切分完文本后，我们需要让计算机"理解"这些文本的含义。问题是——计算机只认数字，不认文字。

**Embedding 就是把文字变成一组数字（向量），让"含义相近"的文字对应"距离相近"的向量。**

> 🎒 **类比**：想象一个二维地图，每个词都有一个坐标。"狗"和"猫"离得近（都是宠物），"狗"和"飞机"离得远。Embedding 就是给每段文字一个"坐标"，只不过这个坐标不是2维，而是高维，如 512 维。

```
"什么是机器学习"  →  [0.12, -0.34, 0.56, ..., 0.78]  (512维)
"ML 的定义"      →  [0.11, -0.33, 0.55, ..., 0.77]  ← 距离很近！
"今天天气不错"    →  [0.89, 0.23, -0.45, ..., -0.12]  ← 距离很远！
```

### 3.2 余弦相似度：怎么衡量"距离"

有了向量，如何判断两段文字是否相似？最常用的方法是**余弦相似度**。

**直觉理解**：想象两支箭从原点射出，余弦相似度衡量的是夹角大小——**只看方向，不看长度**：

```
        ↗ A "什么是LLM"
       / 30°  ← 夹角小 = 方向接近 = 语义相似
      /
    ──────→ B "大语言模型的定义"     cos 30° ≈ 0.87 ✅

        ↗ A "什么是LLM"
       /
      / 90°  ← 夹角大 = 方向不同 = 语义无关
    |
    ↓ C "今天天气不错"               cos 90° = 0    ❌
```

公式很简单：

```
            A · B（点积）
cos θ = ─────────────────
         |A| × |B|（模长之积）
```

**为什么 RAG 更适合余弦相似度而非欧氏距离？** 因为余弦只看方向不看长度——同义的短文和长文方向相同，余弦相似度为 1.0 ✅；但欧氏距离会因向量长度差异判定它们"距离远" ❌。

我们在 `embeddings.ts` 中实现了这个计算：

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
```

**计算示例**（假设只有 4 维，实际 512 维原理一样）：

```
A = "什么是LLM"   → [0.8,  0.6,  0.1,  0.0]
B = "大语言模型"   → [0.7,  0.5,  0.2,  0.1]
C = "今天天气好"   → [0.1,  0.0,  0.9,  0.7]

cosine(A, B):
  点积 = 0.8×0.7 + 0.6×0.5 + 0.1×0.2 + 0×0.1 = 0.88
  |A|  = √(0.64+0.36+0.01+0)    ≈ 1.005
  |B|  = √(0.49+0.25+0.04+0.01) ≈ 0.889
  结果 = 0.88 / (1.005×0.889)   ≈ 0.985  ← 非常相似 ✅

cosine(A, C):
  点积 = 0.8×0.1 + 0.6×0 + 0.1×0.9 + 0×0.7 = 0.17
  结果 = 0.17 / (1.005×1.145)   ≈ 0.148  ← 不相似 ✅
```

### 3.3 本地 Embedding 模型：@xenova/transformers

生成 Embedding 需要模型。好消息是，在实验学习阶段，**我们可以在本地运行 Embedding 模型，不需要调用 API，不花钱。**

`@xenova/transformers` 是 HuggingFace Transformers 的 JS 版本，能在 Node.js 环境直接运行模型。

我们封装了一个 `LocalEmbedding` 类：

```typescript
import { pipeline, env } from "@xenova/transformers";

// 配置 HuggingFace 镜像（国内访问加速）
env.remoteHost = "https://hf-mirror.com/";

export class LocalEmbedding {
  private extractor: any = null;
  private modelName: string;

  constructor(modelName = "Xenova/bge-small-zh-v1.5") {
    this.modelName = modelName;
  }

  /** 懒加载模型（首次调用时下载 ~90MB 并缓存） */
  private async getExtractor() {
    if (!this.extractor) {
      console.log(`📦 加载模型: ${this.modelName}...`);
      this.extractor = await pipeline("feature-extraction", this.modelName);
    }
    return this.extractor;
  }

  /** 生成单条文本的 Embedding */
  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    // pooling: "mean" 对所有 token 取平均，normalize: true 归一化到单位长度
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  }

  /** 批量生成 + 实现 ChromaDB 的 IEmbeddingFunction 接口 */
  async generate(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) results.push(await this.embed(text));
    return results;
  }
}
```

**关键设计**：
- 懒加载：模型仅在第一次使用时下载，之后从缓存读取
- `normalize: true`：归一化后向量模长为1，余弦相似度退化为更快的点积运算
- 实现 `generate` 方法：符合 ChromaDB 的 `IEmbeddingFunction` 接口，可以直接对接 ChromaDB

### 3.4 中文模型 vs 英文模型 PK

运行 `npm run embeddings`，对比两个模型在中文场景的表现：

基准查询：**"什么是大语言模型？"**

| 对比文本 | 英文模型 all-MiniLM-L6-v2 | 中文模型 bge-small-zh-v1.5 |
|---------|--------------------------|---------------------------|
| "LLM 是基于 Transformer 的深度学习模型"（语义相近） | 0.30 ❌ | **0.56** ✅ |
| "RAG 是检索增强生成技术"（相关但不同主题） | 0.60 | 0.31 |
| "今天天气真好，适合出去散步"（完全无关） | 0.60 ❌ | **0.20** ✅ |

**结论一目了然**：
- 英文模型对中文语义几乎"瞎猜"——无关的"今天天气真好"反而得到最高相似度
- 中文模型排序合理：语义相近 > 主题相关 > 完全无关

> ⚠️ **实践经验**：中文场景务必使用中文优化的 Embedding 模型！推荐 `bge-small-zh-v1.5`（512维，体积小速度快）或 `bge-base-zh-v1.5`（768维，精度更高）。

**常用模型选型参考**：

| 模型 | 维度 | 运行方式 | 中文效果 | 适合场景 |
|------|------|---------|---------|---------|
| `all-MiniLM-L6-v2` | 384 | 本地 | 差 | 英文场景、快速原型 |
| **`bge-small-zh-v1.5`** | **512** | **本地** | **优秀** | **中文推荐（本模块默认）** |
| `bge-base-zh-v1.5` | 768 | 本地 | 优秀 | 中文生产环境 |
| `text-embedding-3-small` | 1536 | OpenAI API | 好 | 生产（英文为主） |
| `BGE-M3` | 1024 | 本地/API | 优秀 | 多语言通吃 |



## 四、向量数据库（ChromaDB）

### 4.1 为什么需要向量数据库

有了 Embedding 向量，我们需要一个地方**存储**它们，并支持**快速检索**"最相似的向量"。

传统数据库（MySQL、PostgreSQL）的索引是 B-tree，擅长精确匹配和范围查询。但向量检索需要的是**近似最近邻搜索（ANN）**——在百万个 512 维向量中，找出和查询向量最近的 Top-K 个。这是传统索引做不了的。

> 🎒 **类比**：传统数据库像字典，按拼音/字母排序查找；向量数据库像一个多维空间的"GPS"，能快速定位"最近的几个点"。

**向量数据库选型**：

| 数据库 | 特点 | 适合场景 |
|--------|------|---------|
| **ChromaDB** | 轻量、纯 Python/JS | 学习、原型（本模块使用） |
| Qdrant | 高性能、Rust 实现 | 中大规模生产 |
| Pinecone | 全托管云服务 | 快速上线 |
| Milvus | 分布式、亿级 | 大规模企业级 |
| pgvector | PostgreSQL 扩展 | 已有 PG 基础设施 |

### 4.2 ChromaDB 安装与启动

ChromaDB 的 npm 包只是 JS 客户端，服务端需要单独启动：

**方式1：Docker 运行（推荐）**

```bash
docker run -d -p 8000:8000 -v ./chroma-data:/chroma/chroma chromadb/chroma
```

**方式2：pip 安装运行**

```bash
python3 -m venv .venv
.venv/bin/pip install chromadb
.venv/bin/chroma run --path ./chroma-data
```

> 💡 `chunking` 和 `embeddings` 两个 Demo 不依赖 ChromaDB，可以直接运行无需启动服务。

### 4.3 VectorStore 封装

我们在 `vector-store.ts` 中封装了 ChromaDB 的操作，提供三个核心接口：

```typescript
import { ChromaClient, type Collection, type IEmbeddingFunction } from "chromadb";
import { LocalEmbedding } from "./embeddings.js";

// 将 LocalEmbedding 适配为 ChromaDB 的 IEmbeddingFunction 接口
class TransformersEmbeddingFunction implements IEmbeddingFunction {
  private embedder: LocalEmbedding;
  constructor(embedder: LocalEmbedding) { this.embedder = embedder; }
  async generate(texts: string[]): Promise<number[][]> {
    return this.embedder.generate(texts);
  }
}

export interface SearchResult {
  document: string;   // 文档文本
  distance: number;   // 与查询的距离（越小越相似）
  metadata?: Record<string, unknown>;
  id: string;
}

export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private embedder: LocalEmbedding;
  private embeddingFunction: TransformersEmbeddingFunction;

  constructor(embedder?: LocalEmbedding) {
    this.client = new ChromaClient();   // 默认连接 localhost:8000
    this.embedder = embedder ?? new LocalEmbedding();
    this.embeddingFunction = new TransformersEmbeddingFunction(this.embedder);
  }

  /** 初始化 collection */
  async init(collectionName: string): Promise<void> {
    // 删除已存在的同名 collection（确保干净环境）
    try { await this.client.deleteCollection({ name: collectionName }); } catch {}

    this.collection = await this.client.createCollection({
      name: collectionName,
      embeddingFunction: this.embeddingFunction,
      metadata: { "hnsw:space": "cosine" },  // 使用余弦距离
    });
  }

  /** 批量添加文档（自动向量化） */
  async addDocuments(docs: string[], metadatas?: Record<string, unknown>[]): Promise<void> {
    const ids = docs.map((_, i) => `doc_${i}`);
    await this.collection!.add({ ids, documents: docs, metadatas });
  }

  /** 相似度检索，返回 Top-K 最相似的文档 */
  async search(query: string, topK = 3): Promise<SearchResult[]> {
    const results = await this.collection!.query({
      queryTexts: [query],
      nResults: topK,
    });
    // 解析并返回 SearchResult 数组...
  }

  /** 清空 collection */
  async clear(): Promise<void> { /* 删除后重建 */ }
}
```

**注意这行关键配置**：

```typescript
metadata: { "hnsw:space": "cosine" }
```

这告诉 ChromaDB 使用**余弦距离**而非默认的欧氏距离（L2）。

### 4.4 HNSW 索引：如何做到毫秒级检索

ChromaDB 默认使用 **HNSW（Hierarchical Navigable Small World）** 索引。暴力检索在百万级文档下不可用（100万 × 512维 ≈ 5亿次浮点运算），HNSW 通过构建层级图结构实现 O(log N) 检索：

```
Layer 2:    A ──────────────── D           (稀疏，长距离跳跃)
            │                  │
Layer 1:    A ──── B ──── C ── D ── E      (中等密度)
            │     │     │     │     │
Layer 0:    A ─ B ─ C ─ D ─ E ─ F ─ G ─ H  (最密，所有节点)
```

检索过程（类比找人）：
```
① 从最高层出发 → 大步跳跃到大致区域（省 → 市）
② 下降一层     → 中步跳跃到更精确区域（市 → 区）
③ 到最底层     → 在邻居间精确比较（区 → 门牌号）

100万文档: ~20次比较  vs  暴力搜索 100万次比较
```

### 4.5 数据流全景

```
addDocuments(["文本1", "文本2", ...])
│
├─ ① embeddingFunction.generate(texts)  → 批量向量化（本地 bge-small-zh 模型）
├─ ② ChromaDB 构建 HNSW 索引（每个向量 = 图中一个节点）
└─ ③ 持久化到 chroma-data/ 目录

search("用户问题", topK=3)
│
├─ ① embeddingFunction.generate(["用户问题"])  → 查询向量化
├─ ② HNSW 图检索：顶层 → 逐层下降 → 找到最近的 3 个节点
└─ ③ 返回 Top-3 文档 + 距离值
```



## 五、完整 RAG Pipeline

### 5.1 把所有环节串起来

前面我们分别实现了切分（chunking）、向量化（embeddings）、存储检索（vector-store），现在是时候把它们组装成完整的 RAG 系统了。

`rag-pipeline.ts` 中的 `RAGPipeline` 类做了两件事：
1. **文档摄入（Ingest）**：加载文件 → 切分 → 向量化 → 存入 ChromaDB
2. **RAG 查询（Query）**：检索 → 构建 Prompt → LLM 生成回答

```typescript
import { VectorStore } from "./vector-store.js";
import { recursiveCharacterChunk } from "./chunking.js";
import { chatWithModel, getDefaultProvider } from "./model-adapter.js";

export class RAGPipeline {
  private store: VectorStore;
  private provider: Provider;

  /** 文档摄入：加载 → 切分 → 存储 */
  async ingest(filePath: string, chunkSize = 300, overlap = 50): Promise<number> {
    // 1. 读取文件
    const text = readFileSync(filePath, "utf-8");
    // 2. 递归字符分块
    const chunks = recursiveCharacterChunk(text, { chunkSize, overlap });
    // 3. 初始化向量存储
    await this.store.init(this.collectionName);
    // 4. 添加文档（向量化在 addDocuments 内部自动完成）
    await this.store.addDocuments(chunks, metadatas);
    return chunks.length;
  }

  /** RAG 查询：检索 → Prompt 组装 → LLM 生成 */
  async query(question: string, topK = 3): Promise<RAGQueryResult> {
    // 1. 检索相关文档
    const contexts = await this.store.search(question, topK);

    // 2. 构建增强 Prompt
    const contextText = contexts
      .map((c, i) => `[参考资料 ${i + 1}]（相关度: ${(1 - c.distance).toFixed(2)}）\n${c.document}`)
      .join("\n\n");

    const systemPrompt = `你是一个基于知识库的问答助手。请根据以下参考资料回答用户的问题。
要求：
- 优先使用参考资料中的信息来回答
- 如果参考资料中没有相关信息，请明确说明"根据现有资料未找到相关信息"
- 回答要准确、简洁、有条理

参考资料：
${contextText}`;

    // 3. 调用 LLM 生成回答
    const answer = await chatWithModel(this.provider,
      [{ role: "user", content: question }],
      { system: systemPrompt, maxOutputTokens: 500, temperature: 0.3 }
    );
    return { answer, contexts, query: question };
  }
}
```

**Prompt 设计的关键技巧**：
- ✅ 明确告诉模型"如果不知道就说不知道"——减少幻觉
- ✅ 标注参考资料编号——便于追溯来源
- ✅ `temperature: 0.3`——低创造性，更忠于参考资料

### 5.2 多模型适配层

你可能注意到代码中使用了 `chatWithModel` 和 `getDefaultProvider`。这来自 `model-adapter.ts`——一个支持 DeepSeek/OpenAI/Anthropic 三家的统一适配层（从上一期模块复制，保持本模块独立可运行）：

```typescript
export type Provider = "deepseek" | "openai" | "anthropic";

export function getModel(provider: Provider, modelName?: string): LanguageModel {
  switch (provider) {
    case "deepseek": return createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY })(model);
    case "openai":   return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(model);
    case "anthropic": return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(model);
  }
}

/** 自动检测第一个配置了 API Key 的 provider */
export function getDefaultProvider(): Provider { /* 按 deepseek → openai → anthropic 顺序检测 */ }
```

只需在 `.env` 中配置至少一个 API Key，系统会自动选择可用的模型。

### 5.3 RAG vs 纯 LLM 对比实验

`RAGPipeline` 还提供了 `queryWithoutRAG` 方法，用于对比：

```typescript
/** 纯 LLM 查询（不使用 RAG） */
async queryWithoutRAG(question: string): Promise<string> {
  return chatWithModel(this.provider,
    [{ role: "user", content: question }],
    { system: "请简洁准确地回答用户的问题。", maxOutputTokens: 500, temperature: 0.3 }
  );
}
```

运行 `npm run rag-pipeline`，同一个问题对比效果：

**❓ 问题："文本分块时推荐的块大小和重叠大小是多少？"**

**🤖 纯 LLM 回答（无 RAG）**：
> - 通用场景：256~512 tokens
> - 长文本检索：500~1000 tokens
> - 重叠 10%~20%
> - LangChain 默认 1000 tokens，重叠 200 tokens
> - ...（长篇大论，包含各种"通用建议"）

**📚 RAG 增强回答**：
> 根据参考资料，文本分块时推荐的块大小和重叠大小如下：
> **块大小**：通常在 **200-1000 个 Token** 之间。
> **重叠大小**：建议设置为块大小的 **10%-20%**。
> （以上信息来自参考资料 2）

**差异很明显**：
| 维度 | 纯 LLM | RAG 增强 |
|------|--------|---------|
| 信息来源 | 模型"记忆" | 知识库文档 |
| 准确性 | 泛泛的通用建议 | 精准引用知识库内容 |
| 幻觉风险 | 可能编造 | 基于资料，可追溯 |
| 回答风格 | 长篇大论 | 简洁准确 |



## 六、延伸：多轮对话中的 RAG

> 💡 这一节严格来说更偏"上下文工程"而非 RAG 本身。之所以放在这里讲，是因为**代词消解是 RAG 进入多轮对话后遇到的第一个实际痛点**——"它有什么优势？"这种问题如果不改写，向量检索根本找不到正确的内容。换句话说，这是 RAG 系统从"能用"到"好用"必须解决的衔接问题。后续第 4 篇的 LangChain Memory 和第 9 篇的 LlamaIndex ContextChatEngine 都会用框架内置的方式重新处理这个问题。

### 6.1 问题：代词消解

单轮 RAG 已经可以工作了，但多轮对话时会遇到一个致命问题：

```
用户: 什么是 RAG？
助手: RAG 是检索增强生成...

用户: 它有什么优势？     ← "它"指什么？
```

**人类**一看就知道"它"指的是 RAG。但向量检索不理解代词——用"它有什么优势"去检索，可能匹配到完全无关的内容。

### 6.2 解决方案：问题改写（Query Rewriting）

核心思路：**在检索之前，先用 LLM 把含有代词的问题改写为独立问题。**

```
对话历史 + 当前问题 ──→ LLM 改写 ──→ 独立问题 ──→ 正常 RAG 流程

"它有什么优势？"           → 改写为 → "RAG 有什么优势？"
"第一个阶段怎么做？"        → 改写为 → "RAG 的离线索引阶段怎么做？"
```

### 6.3 ConversationalRAG 实现

`conversational-rag.ts` 在 `RAGPipeline` 基础上增加了两个能力：
1. **对话历史管理**
2. **问题改写**

**改写的核心方法**：

```typescript
private async rewriteQuestion(question: string): Promise<string> {
  // 没有历史对话时，无需改写
  if (this.history.length === 0) return question;

  // 取最近 3 轮（6 条消息），每条截断 100 字
  const recentHistory = this.history.slice(-6);
  const historyText = recentHistory
    .map(m => `${m.role === "user" ? "用户" : "助手"}: ${m.content.slice(0, 100)}`)
    .join("\n");

  const rewritePrompt = `你是一个问题改写助手。根据对话历史，将用户的当前问题改写为独立问题。
规则：
- 如果当前问题已经是独立的，直接返回原问题
- 解决代词指代（"它"、"这个"、"那种方法"等）
- 只返回改写后的问题，不要任何解释

对话历史：
${historyText}

当前问题：${question}
改写后的问题：`;

  try {
    const rewritten = await chatWithModel(this.provider,
      [{ role: "user", content: rewritePrompt }],
      { maxOutputTokens: 100, temperature: 0 }  // temperature=0 保证稳定输出
    );
    return rewritten.trim();
  } catch {
    return question;  // 改写失败用原问题，容错降级
  }
}
```

**完整的对话流程**：

```typescript
async chat(question: string) {
  // 1. 问题改写（解决代词指代）
  const rewrittenQuestion = await this.rewriteQuestion(question);

  // 2. 用改写后的问题进行 RAG 查询
  const result = await this.ragPipeline.query(rewrittenQuestion);

  // 3. 更新历史（存原始问题，不是改写后的）
  this.history.push({ role: "user", content: question });
  this.history.push({ role: "assistant", content: result.answer });

  // 4. 控制历史长度，避免上下文窗口溢出
  if (this.history.length > this.maxHistory * 2) {
    this.history = this.history.slice(-this.maxHistory * 2);
  }

  return { answer: result.answer, rewrittenQuestion, contexts: result.contexts };
}
```

### 6.4 改写流程详解

以 3 轮 Demo 对话为例：

**第1轮 — 无需改写**

```
history = []（空）→ 直接跳过改写，返回原问题
然后存入历史:
  history = [
    { user: "什么是 RAG？它解决了什么问题？" },
    { assistant: "RAG 是检索增强生成..." }
  ]
```

**第2轮 — "它" → "RAG"**

```
① 构建历史摘要（只取最近3轮，每条截断100字）
② 组装改写 Prompt → 发给 LLM（temperature=0 保证稳定）
③ LLM 推断 "它" = "RAG"，返回：
   "RAG（Retrieval-Augmented Generation）的完整工作流程是怎样的？"
④ 用改写结果检索：
   原始: "它的完整工作流程"      → 😵 匹配到无关文档
   改写: "RAG的完整工作流程"     → ✅ 精准命中 RAG 流程章节
```

**第3轮 — "第一个阶段" → "离线阶段/Indexing"**

```
历史中有: "...工作流程分为两个阶段：离线阶段（Indexing）和在线阶段..."
LLM 推断 "第一个阶段" = 离线阶段
改写: "RAG在检索阶段的分块策略有哪些选择？"
```

### 6.5 多轮对话演示

运行 `npm run conversational-rag`，模拟三轮对话：

```
🔄 第 1 轮对话
👤 用户原始问题: 什么是 RAG？它解决了什么问题？
✏️  问题无需改写（没有历史，直接用原问题检索）

🔄 第 2 轮对话
👤 用户原始问题: 它的完整工作流程是怎样的？
✏️  改写后的问题: RAG（Retrieval-Augmented Generation）的完整工作流程是怎样的？
                  ↑ "它" 被正确解析为 "RAG"

🔄 第 3 轮对话
👤 用户原始问题: 在第一个阶段中，分块策略有哪些选择？
✏️  改写后的问题: RAG（检索增强生成）在检索阶段的分块策略有哪些选择？
                  ↑ "第一个阶段" 被正确推断为 "检索/离线阶段"
```

### 6.6 关键设计决策

| 决策 | 为什么 |
|------|--------|
| history 为空时跳过改写 | 省一次 LLM 调用，没有上下文改写无意义 |
| 只取最近 3 轮（6条消息） | 太远的历史对当前问题没帮助，节省 Token |
| 每条消息截断 100 字 | 改写只需理解主题，不需要完整内容 |
| `temperature = 0` | 改写要稳定确定性，不要创意发挥 |
| 改写失败则用原问题 | try-catch 兜底，宁可检索不精准也不要报错中断 |
| 存**原始问题**到历史 | 保持对话自然，改写只是给检索用的中间产物 |

### 6.7 性能开销

每次多轮问答实际需要**两次 LLM 调用**：

```
用户问: "它有什么优势？"
│
├─ 第1次 LLM 调用: 问题改写（几十个 Token，快且便宜）
│   → 输出: "RAG有什么优势？"
│
├─ 向量检索（不调用 LLM，毫秒级）
│
└─ 第2次 LLM 调用: 生成回答（几百个 Token，主要开销）
    → 输出: 完整回答
```

> 💡 优化方向：可以用更轻量的模型做改写，用强模型做生成；或者通过规则预判——检测到代词才调用改写。



## 七、本期回顾

我们从零实现了一个完整的 RAG 系统，涵盖 5 个核心环节：

```
① 文本切分        ② 向量化           ③ 向量存储         ④ 检索+生成       ⑤ 多轮对话
chunking.ts  →  embeddings.ts  →  vector-store.ts  →  rag-pipeline.ts → conversational-rag.ts
  ↓                ↓                  ↓                   ↓                 ↓
三种策略          本地模型           ChromaDB            Prompt 组装       问题改写
固定/递归/段落    bge-small-zh      余弦距离检索         RAG vs 纯LLM     代词消解
```

**核心要点清单**：

| 环节 | 关键选择 | 本模块方案 |
|------|---------|-----------|
| 文本切分 | 策略 + 参数 | 递归字符分块，300字/块，50字重叠 |
| Embedding | 模型选型 | bge-small-zh-v1.5（本地，512维，中文优化） |
| 向量数据库 | 数据库 + 距离函数 | ChromaDB + 余弦距离 |
| RAG 查询 | Prompt 设计 | 严格约束 + 来源标注 + 低 temperature |
| 多轮对话 | 代词处理 | LLM 问题改写，history 长度限制 |

本篇从零手写了 RAG 的每个环节，好处是原理清楚，缺点是接入方式和应用强耦合——换一个 AI 工具就要重写对接代码。后续第 5 篇会用 LangChain 框架大幅简化代码量，第 9 篇用 LlamaIndex 进一步将 RAG 压缩到十几行代码，第 7 篇则会介绍 MCP（Model Context Protocol），把知识库检索封装成标准化的 MCP Server，实现"写一次，任何 AI 工具都能用"的效果。

## 八、参考资料

**官方文档：**
- [ChromaDB](https://docs.trychroma.com/)
- [Xenova/transformers](https://huggingface.co/docs/transformers.js)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [BGE Embedding Models](https://huggingface.co/BAAI/bge-small-zh-v1.5)

