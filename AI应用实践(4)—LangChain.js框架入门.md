# AI应用实践(4)—LangChain.js框架入门

前几篇我们刻意手写了模型调用、Prompt、结构化输出和 RAG。这样做的好处是原理足够清楚，坏处是样板代码很多，功能一复杂就容易重复劳动。

这篇开始引入 LangChain.js，用框架化方式重组前面已经实现过的能力。重点不是记 API，而是看它到底替你省掉了哪些重复工作，以及什么时候该用、什么时候不该用。

技术栈：LangChain.js v1（langchain@1.3 / @langchain/core@1.1 / @langchain/langgraph@1.2）+ TypeScript + ChromaDB + Zod
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study](https://github.com/csxiaoyaojianxian/LLM-Study)

## 一、为什么需要 LangChain

### 1.1 回顾前几期的"手工作坊"

在前三期中，我们从零构建了 AI 应用的各个环节：

- **第1期**：手动调用 API、手动解析 SSE 流、手动维护 `history` 数组实现多轮对话
- **第2期**：自己封装 `model-adapter.ts` 做多模型适配（~80行）、手动字符串拼接 Prompt
- **第3期**：手写三种文本分块策略（~120行）、手动封装 ChromaDB 客户端（~100行）、手写完整 RAG Pipeline（~150行）

这些实践让我们**深刻理解了底层原理**——但如果每个项目都从头来一遍，效率显然太低了。

来看一组直观的痛点对比：

| 痛点 | 手写实现 | 问题 |
|------|---------|------|
| 多模型切换 | 自己封装 `model-adapter.ts`（~80行） | 每加一个模型都要改代码 |
| Prompt 模板 | 字符串拼接 | 容易出错，没有类型检查 |
| 结构化输出 | 手写 JSON 解析 | 容错复杂，LLM 输出不稳定 |
| 对话记忆 | 手动维护 messages 数组 | 重复代码，多会话管理麻烦 |
| 文本分块 | 手写三种策略 ~120行 | 重复造轮子 |
| 向量存储 | 手动封装 ChromaDB ~100行 | 换数据库就要重写 |
| 工具调用 | 手动解析 tool_calls + 循环执行 | 易出 bug，流程难维护 |

**这就像 Web 开发早期**——手写 HTTP 服务器、手动解析请求体、手动路由分发——能跑，但效率低、容易出错。Express/Next.js 的出现解决了这些问题。而 **LangChain 之于 AI 开发，就像 Express 之于 Web 开发**——提供标准化抽象，让你专注业务逻辑。

### 1.2 框架的价值

**LangChain** 由 Harrison Chase 于 2022 年 10 月发起，是目前最流行的 LLM 应用开发框架。它同时提供 Python 和 JavaScript/TypeScript 两个版本，本模块使用 **LangChain.js**（TypeScript 版本）。一句话概括：

> **LangChain = 胶水层框架，把 LLM 和各种外部能力（数据、工具、记忆）粘合成可运行的应用。**

核心价值：
- 🧱 **标准化抽象**：Model、Prompt、Chain、Memory、Tool 等统一接口，一套代码适配多个 LLM
- ♻️ **复用生态**：100+ 社区集成（向量数据库、文档加载器、工具等），不用重复造轮子
- 🔗 **组合范式**：LCEL（LangChain Expression Language）用 `pipe()` 像管道一样串联组件，数据流清晰可读

用 LangChain 重新解决前面的痛点：

| 痛点 | 手写实现 | LangChain 方案 |
|------|---------|---------------|
| 多模型切换 | 自己封装 `model-adapter.ts`（~80行） | `ChatOpenAI` 开箱即用，baseURL 一行适配 |
| Prompt 模板 | 字符串拼接，容易出错 | `ChatPromptTemplate` 变量插值 + 类型安全 |
| 结构化输出 | 手写 JSON 解析，容错复杂 | `StructuredOutputParser` + Zod 自动生成 format_instructions |
| 对话记忆 | 手动维护 messages 数组 | `RunnableWithMessageHistory` / `MemorySaver` 自动管理 |
| 文本分块 | 手写三种策略（~120行） | `RecursiveCharacterTextSplitter` 配置一下就搞定 |
| 向量存储 | 手动封装 ChromaDB 客户端（~100行） | `Chroma.fromDocuments()` 自动入库 |
| 工具调用 | 手动解析 tool_calls + 循环执行 | `createReactAgent` 全自动 |

### 1.3 核心概念速览

LangChain 围绕五大核心概念构建：

```
┌─────────────────────────────────────────────────────┐
│               LangChain 五大核心概念                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  🤖 Model    — 模型层，统一接口调用不同 LLM           │
│  📝 Prompt   — 提示模板，变量插值 + 类型安全           │
│  🔗 Chain    — 链式调用，pipe() 串联多个组件           │
│  🧠 Memory   — 对话记忆，自动管理多轮对话历史          │
│  🔧 Tool     — 工具调用，让 LLM 拥有"执行"能力        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**类比 Web 开发：**

| AI 开发概念 | Web 开发类比 |
|------------|------------|
| LangChain | Express / Next.js — 标准化开发框架 |
| LCEL `pipe()` | 中间件链 `app.use(a).use(b).use(c)` |
| `ChatPromptTemplate` | 模板引擎（EJS / Handlebars） |
| `OutputParser` | 响应格式化（`res.json()`） |
| Memory | Session / Cookie 管理 |
| Tool + Agent | 路由 + Controller 自动派发 |

### 1.4 LangChain 与 LangGraph 的关系

初学时容易混淆这两个名字，它们是同一团队的两个互补项目：

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

类比理解：
- **@langchain/core** = 乐高积木块 — Model、Prompt、Parser、Tool 等独立零件
- **@langchain/langgraph** = 乐高说明书 — 规定零件怎么拼、执行顺序、遇到分支怎么走
- **langchain v1** = 拼好的成品 — `createAgent` 一行搞定，底层自动组装

**为什么要拆成两层？** 因为早期 LangChain 把"组件"和"编排"混在一起（`LLMChain`、`AgentExecutor`），复杂流程难以定制。v1 拆开后职责清晰：

| 场景 | 用什么 | 本模块示例 |
|------|-------|-----------|
| 简单线性链 | LCEL `pipe()` 串联 | prompt-lcel、output-parser |
| 对话记忆 | LangGraph `MemorySaver` | memory-chat |
| 工具调用 + 自动循环 | `createReactAgent` / `createAgent` | custom-tool |
| 复杂分支/循环/断点恢复 | LangGraph `StateGraph`（本模块未涉及） | 见 06-agent 模块 |

### 1.5 环境准备

```bash
cd 05-langchain
npm install
cp .env.example .env  # 编辑 .env，填入 API Key
```

**DeepSeek 适配说明：** 本模块不使用独立的 DeepSeek SDK，而是通过 `@langchain/openai` 的 `ChatOpenAI` + 自定义 `baseURL` 来适配 DeepSeek API。这是 LangChain 社区通用的适配方式。

本模块涉及的核心包：

| 包名 | 版本 | 用途 |
|------|------|------|
| `@langchain/core` | ^1.1 | 核心抽象（Runnable、Prompt、Parser、Messages、ChatHistory） |
| `@langchain/openai` | ^1.4 | ChatOpenAI（同时通过 baseURL 适配 DeepSeek） |
| `@langchain/community` | ^1.1 | 社区集成（Chroma VectorStore） |
| `@langchain/langgraph` | ^1.2 | Agent 框架（createReactAgent、MemorySaver） |
| `@langchain/textsplitters` | ^1.0 | 文本分块器 |
| `langchain` | ^1.3 | 高层 API（createAgent） |
| `zod` | ^3.23 | Schema 定义（结构化输出、Tool 参数） |



## 二、模型接入与基础调用

### 2.1 ChatOpenAI 配置

LangChain 通过 `ChatOpenAI` 统一接入 OpenAI 及兼容模型。**DeepSeek 的 API 完全兼容 OpenAI 格式**，所以只需修改 `baseURL` 即可适配：

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// ✅ OpenAI 原生
const openai = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
  temperature: 0.7,
});

// ✅ DeepSeek 通过 baseURL 适配（核心技巧）
const deepseek = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: "deepseek-chat",
  temperature: 0.7,
  configuration: {
    baseURL: "https://api.deepseek.com/v1",  // 关键：指向 DeepSeek 的 API 地址
  },
});
```

**为什么 DeepSeek 可以用 ChatOpenAI？** 因为 DeepSeek API 和 OpenAI 的请求/响应结构完全一致。这也是很多国内模型的通用做法：
- **Moonshot（Kimi）**：`baseURL: "https://api.moonshot.cn/v1"`
- **通义千问**：`baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"`
- **本地 Ollama**：`baseURL: "http://localhost:11434/v1"`

对比第2期自己封装的 `model-adapter.ts`（~80行），LangChain 的 `ChatOpenAI` 开箱即用，一行 `baseURL` 搞定适配。

实际项目中，我们通常会封装一个工厂函数，自动检测可用的 API Key：

```typescript
export function createChatModel(options?: {
  temperature?: number;
  modelName?: string;
}): BaseChatModel {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (deepseekKey && deepseekKey.length > 10) {
    return new ChatOpenAI({
      apiKey: deepseekKey,
      model: options?.modelName ?? "deepseek-chat",
      temperature: options?.temperature ?? 0.7,
      configuration: { baseURL: "https://api.deepseek.com/v1" },
    });
  }

  if (openaiKey && openaiKey.length > 10) {
    return new ChatOpenAI({
      apiKey: openaiKey,
      model: options?.modelName ?? "gpt-4o-mini",
      temperature: options?.temperature ?? 0.7,
    });
  }

  throw new Error("❌ 未找到可用的 API Key！");
}
```

> 💡 **temperature 参数**控制 LLM 输出的随机性：LLM 每一步预测下一个 Token 时会生成概率分布（如："晴"60%、"雨"30%），temperature 对该分布做缩放。0 = 总选最高概率，输出确定性高（适合代码/事实问答）；0.7 = 默认平衡；1.0+ = 低概率 Token 也有机会被选中，更随机（适合创意写作）。

### 2.2 基本调用 invoke()

`invoke()` 返回的是 `AIMessage` 对象，通过 `.content` 获取回复文本：

```typescript
// 最简单的调用方式
const response = await model.invoke([
  new HumanMessage("用一句话解释什么是 LangChain"),
]);
console.log(response.content);
// → "LangChain 是一个用于构建 LLM 应用的开源框架..."
```

还可以组合 `SystemMessage` + `HumanMessage` 多消息类型：

```typescript
const response = await model.invoke([
  new SystemMessage("你是一位资深 TypeScript 开发者，回答简洁专业，使用中文。"),
  new HumanMessage("LangChain.js 和 Vercel AI SDK 的核心区别是什么？"),
]);
console.log(response.content);
```

### 2.3 流式输出 stream()

回顾第1期，我们手动解析 SSE 流，处理 `data:` 前缀、`[DONE]` 标记，代码繁琐。LangChain 一行搞定：

```typescript
const stream = await model.stream([
  new HumanMessage("用三个要点总结 RAG 的核心原理"),
]);

process.stdout.write("回复: ");
for await (const chunk of stream) {
  process.stdout.write(chunk.content as string);
}
```

### 2.4 Model 关键方法一览

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `invoke(messages)` | 单次调用 | `AIMessage` |
| `stream(messages)` | 流式输出 | `AsyncIterable<AIMessageChunk>` |
| `batch(inputs[])` | 批量调用 | `AIMessage[]` |
| `bindTools(tools)` | 绑定工具 | 新的 Model 实例 |

运行示例：
```bash
npm run model-chat
```



## 三、LCEL — LangChain 表达式语言

### 3.1 什么是 LCEL

LCEL（LangChain Expression Language）是 LangChain v0.2+ 的核心编程范式，灵感来自 Unix 管道（`|`）。核心理念：**一切组件都是 Runnable，通过 `pipe()` 串联成链。**

如果你用过 RxJS 的 `pipe()` 或者 Unix 命令行的 `cat file | grep "error" | wc -l`，那你已经懂了 LCEL 的精髓。

还记得第2期我们怎么做的吗？

```typescript
// ❌ 第2期：手动拼接 Prompt → 调用模型 → 手动解析输出
const prompt = `你是${role}，请回答：${question}`;
const response = await chatWithModel("deepseek", [{ role: "user", content: prompt }]);
// 还要手动处理 response 格式...
```

用 LCEL 重写：

```typescript
// ✅ LCEL：pipe() 像管道一样串联组件
const chain = prompt.pipe(model).pipe(parser);
const result = await chain.invoke({ role: "专家", question: "什么是LLM？" });
// 一步到位，result 直接是解析好的字符串
```

### 3.2 Prompt → Model → Parser 标准链

这是 LangChain 最经典的三件套：

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = createChatModel();
const parser = new StringOutputParser();

// Step 1: 创建 Prompt 模板（支持变量插值）
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一位{role}，用简洁的中文回答问题。"],
  ["human", "{question}"],
]);

// Step 2: 用 pipe() 串联成链 ✨
const chain = prompt.pipe(model).pipe(parser);

// Step 3: invoke 调用
const result = await chain.invoke({
  role: "LangChain 专家",
  question: "用一句话解释 LCEL 是什么",
});
console.log(result); // → 直接拿到字符串结果
```

数据流转过程：

```
{ role: "LangChain 专家", question: "用一句话解释 LCEL 是什么" }
        ↓  ChatPromptTemplate（变量插值）
[SystemMessage("你是一位LangChain专家..."), HumanMessage("用一句话解释LCEL是什么")]
        ↓  ChatOpenAI（调用 LLM）
AIMessage({ content: "LCEL是LangChain的链式表达语言..." })
        ↓  StringOutputParser（提取文本）
"LCEL是LangChain的链式表达语言..."
```

也可以先格式化看看模板的结果：

```typescript
const formatted = await prompt.formatMessages({
  role: "AI 技术专家",
  question: "什么是 LCEL？",
});
for (const msg of formatted) {
  console.log(`[${msg._getType()}]: ${msg.content}`);
}
// [system]: 你是一位AI技术专家，用简洁的中文回答问题。
// [human]: 什么是 LCEL？
```

### 3.3 RunnableSequence 与数据变换

`pipe()` 的等价写法是 `RunnableSequence.from()`：

```typescript
import { RunnableSequence } from "@langchain/core/runnables";

// 与 prompt.pipe(model).pipe(parser) 完全等价
const chain = RunnableSequence.from([prompt, model, parser]);
```

**实际开发中常遇到的问题**：上一步的输出格式和下一步的输入格式不匹配。LangChain 提供了数据变换工具来解决：

**RunnableLambda — 自定义数据映射：**

```typescript
import { RunnableLambda } from "@langchain/core/runnables";

const prompt4 = ChatPromptTemplate.fromMessages([
  ["system", "你是一位技术导师，善于用类比解释概念。"],
  ["human", "请用「{analogy}」的类比来解释「{concept}」"],
  // ← 模板需要两个变量：concept 和 analogy
]);

// 用户只传了 { topic }，但 Prompt 需要 { concept, analogy }
// 用 RunnableLambda 做格式转换 ↓
const preprocessor = new RunnableLambda({
  func: (input: { topic: string }) => ({
    concept: input.topic,      // 从 topic 映射到 concept
    analogy: "烹饪做菜",        // 补充一个固定值
  }),
});

// 数据流：
//   { topic: "RAG 检索增强生成" }
//       ↓ RunnableLambda — 格式转换
//   { concept: "RAG 检索增强生成", analogy: "烹饪做菜" }
//       ↓ ChatPromptTemplate — 变量插值
//   [SystemMessage("你是一位技术导师..."), HumanMessage("请用「烹饪做菜」的类比来解释「RAG 检索增强生成」")]
//       ↓ Model → Parser
//   "RAG 就像做菜..."
const chain = preprocessor.pipe(prompt4).pipe(model).pipe(parser);
const result = await chain.invoke({ topic: "RAG 检索增强生成" });
```

**RunnablePassthrough.assign() — 透传原始字段 + 附加新字段：**

```typescript
import { RunnablePassthrough } from "@langchain/core/runnables";

// 保留原始数据，同时新增计算字段（类似 { ...input, newField: value }）
const passthrough = RunnablePassthrough.assign({
  uppercased: new RunnableLambda({
    func: (input: { text: string }) => input.text.toUpperCase(),
  }),
});

await passthrough.invoke({ text: "hello langchain" });
// → { text: "hello langchain", uppercased: "HELLO LANGCHAIN" }
//          ↑ 原样保留              ↑ 新增字段
```

**数据变换工具速查表：**

| 工具 | 用途 | JS 类比 | 示例 |
|------|------|---------|------|
| `RunnableLambda` | 自定义数据映射 | `Array.map(fn)` | `new RunnableLambda({ func: (x) => ({ a: x.b }) })` |
| `RunnablePassthrough` | 原样透传输入 | `(x) => x` | `new RunnablePassthrough()` |
| `RunnablePassthrough.assign()` | 透传 + 附加新字段 | `{ ...input, newKey: value }` | `RunnablePassthrough.assign({ upper: lambdaFn })` |
| `RunnableParallel` | 并行执行多个链 | `Promise.all()` | 对象字面量 `{ a: chainA, b: chainB }` |

### 3.4 batch() 批量 + stream() 流式

LCEL 链天然支持三种调用方式，无需修改链的定义：

```typescript
const prompt5 = ChatPromptTemplate.fromMessages([
  ["human", "用一个 emoji 表示「{word}」，只回复 emoji"],
]);
const chain5 = prompt5.pipe(model).pipe(parser);

// 单次调用
const result = await chain5.invoke({ word: "太阳" });

// 批量调用（并行）
const results = await chain5.batch([
  { word: "太阳" },
  { word: "月亮" },
  { word: "星星" },
]);
console.log(results); // → ["☀️", "🌙", "⭐"]

// 流式调用
const stream = await chain5.stream({ word: "写一首关于编程的五言绝句" });
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

运行示例：
```bash
npm run prompt-lcel
```



## 四、Output Parser — 结构化输出

### 4.1 三种 Parser

回顾第2期，我们用 Vercel AI SDK 的 `generateObject()` + Zod Schema 实现结构化输出。LangChain 的方案是 **Output Parser + `format_instructions`**——在 Prompt 里告诉 LLM "以什么格式输出"，然后用 Parser 解析：

```
LLM 输出（string）  →  OutputParser  →  结构化数据（object / array / string）
```

LangChain 提供三种常用 Parser：

| Parser | 输出类型 | 适用场景 |
|--------|---------|---------|
| `StringOutputParser` | `string` | 最基础，提取纯文本 |
| `CommaSeparatedListOutputParser` | `string[]` | 列表类输出（如"列出5个..."） |
| `StructuredOutputParser` + Zod | `object` | 复杂 JSON 结构 |

### 4.2 StringOutputParser — 纯文本

最基础的 Parser，从 `AIMessage` 中提取 `.content` 文本（前面章节已经在用了）：

```typescript
import { StringOutputParser } from "@langchain/core/output_parsers";

const parser = new StringOutputParser();
const chain = prompt.pipe(model).pipe(parser);
const result = await chain.invoke({ concept: "向量数据库" });
console.log(typeof result); // string — 不再是 AIMessage 对象
```

### 4.3 CommaSeparatedListOutputParser — 列表输出

让 LLM 返回逗号分隔的列表，自动解析为 `string[]`：

```typescript
import { CommaSeparatedListOutputParser } from "@langchain/core/output_parsers";

const listParser = new CommaSeparatedListOutputParser();

const prompt = ChatPromptTemplate.fromMessages([
  ["human", "列出 5 个常用的向量数据库名称。\n{format_instructions}"],
]);

const chain = prompt.pipe(model).pipe(listParser);
const result = await chain.invoke({
  format_instructions: listParser.getFormatInstructions(),
});
console.log(result);            // → ["ChromaDB", "Pinecone", "Qdrant", "Milvus", "FAISS"]
console.log(Array.isArray(result)); // → true
```

🔑 **`getFormatInstructions()` 是什么？** LLM 不知道你期望什么格式输出，所以需要在 Prompt 里明确告知。`getFormatInstructions()` 自动生成格式说明文本，注入到 Prompt 的 `{format_instructions}` 变量中。完整流程：

```
1. listParser.getFormatInstructions()
   → 生成: "Your response should be a list of comma separated values, eg: `foo, bar, baz`"

2. 注入到 Prompt 的 {format_instructions}
   → "列出 5 个向量数据库。\nYour response should be a list of comma separated values..."

3. LLM 按指令输出 → "ChromaDB, Pinecone, Qdrant, Milvus, FAISS"

4. listParser.parse() 按逗号切分 → ["ChromaDB", "Pinecone", "Qdrant", "Milvus", "FAISS"]
```

每种 Parser 生成的 format_instructions 不同：
- `CommaSeparatedListOutputParser` → 要求逗号分隔
- `StructuredOutputParser` + Zod → 要求输出符合 JSON Schema 的 JSON

### 4.4 StructuredOutputParser + Zod Schema

这是最强大的 Parser，可以解析复杂 JSON 结构：

```typescript
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// 用 Zod 定义输出结构
const structuredParser = StructuredOutputParser.fromZodSchema(
  z.object({
    name: z.string().describe("技术名称"),
    category: z.string().describe("所属类别（如：框架、数据库、协议等）"),
    description: z.string().describe("一句话描述"),
    pros: z.array(z.string()).describe("优点列表（2-3个）"),
    difficulty: z.enum(["简单", "中等", "困难"]).describe("学习难度"),
  })
);

const prompt = ChatPromptTemplate.fromMessages([
  ["human", "请分析以下技术：{tech}\n\n{format_instructions}"],
]);

const chain = prompt.pipe(model).pipe(structuredParser);
const result = await chain.invoke({
  tech: "LangChain",
  format_instructions: structuredParser.getFormatInstructions(),
});

// result 是类型安全的对象 ✨
console.log(result.name);       // → "LangChain"
console.log(result.difficulty);  // → "中等"
console.log(result.pros);       // → ["生态丰富", "抽象层完善", "社区活跃"]
```

`StructuredOutputParser` 的工作原理：`getFormatInstructions()` 自动生成 "You must format your output as a JSON value that adheres to..." + 完整的 JSON Schema 说明。LLM 看到后按 Schema 输出 JSON 字符串，Parser 自动解析为对象。

### 4.5 与第2期 generateObject 的对比

| 维度 | Vercel AI SDK `generateObject()` | LangChain `StructuredOutputParser` |
|------|--------------------------------|-----------------------------------|
| **原理** | SDK 层面约束模型输出（可能使用 JSON Mode / Function Calling） | Prompt 层面注入格式说明，模型"自愿"按格式输出 |
| **可靠性** | 高——模型层面保证 JSON 格式 | 中——依赖 LLM 遵守指令，偶尔格式错误 |
| **灵活性** | 限于支持 structured output 的模型 | 通用——任何 LLM 都可用，只要能理解指令 |
| **使用方式** | `generateObject({ schema })` 一个函数搞定 | 需要配合 Prompt 模板注入 format_instructions |

运行示例：
```bash
npm run output-parser
```



## 五、Memory — 会话记忆

### 5.1 为什么 LLM 没有"记忆"

这个问题在第1期就提到过——**LLM 是无状态的，每次 API 调用都是全新的、独立的**。它不会"记住"你上一轮说了什么。

```
第1轮: 用户说"我叫小明" → AI回复"你好小明"    ← 正常
第2轮: 用户问"我叫什么？" → AI回复"我不知道"   ← 因为这是一次全新的调用
```

要实现"记忆"，本质上是**每次请求都带上之前的对话历史**。区别只在于谁来管理这个历史。

### 5.2 方式一：手动维护 history 数组

这是第1期用过的最基础方式，只是换成了 LangChain 的消息类型：

```typescript
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const history: BaseMessage[] = [];

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个友好的 AI 助手，请记住用户告诉你的信息。"],
  new MessagesPlaceholder("history"),  // 动态插入历史消息
  ["human", "{input}"],
]);

const chain = prompt.pipe(model).pipe(parser);

// 每轮对话需要手动操作
for (const userMsg of conversations) {
  console.log(`👤 用户: ${userMsg}`);
  const result = await chain.invoke({ history, input: userMsg });
  console.log(`🤖 AI: ${result}`);

  // ⚠️ 手动 push 消息到历史
  history.push(new HumanMessage(userMsg));
  history.push(new AIMessage(result));
}
```

**问题**：每轮都要手动 push 两条消息，多会话管理更是灾难。

**进阶：滑动窗口记忆** —— 只保留最近 k 轮，防止 Token 超限：

```typescript
const windowSize = 2; // 只记住最近 2 轮
// 每轮对话只取最近 k 轮的消息（每轮 = Human + AI = 2条）
const recentHistory = windowHistory.slice(-(windowSize * 2));
const result = await chain.invoke({ history: recentHistory, input: userMsg });
```

### 5.3 方式二：RunnableWithMessageHistory（LCEL 方式）

LangChain 提供 `RunnableWithMessageHistory`，本质是一个"装饰器"——把普通 chain 包一层，自动管理历史的读写。

对比手动方式，你每轮对话要自己做 3 件事：① 把 history 传进 invoke ② 手动 push HumanMessage ③ 手动 push AIMessage。`RunnableWithMessageHistory` 把这 3 件事全自动化了：

```typescript
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

// Step 1: 准备一条普通的 LCEL 链（和手动方式完全一样）
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个友好的 AI 助手。请记住用户的信息并在后续对话中使用。"],
  new MessagesPlaceholder("history"),  // ← 历史消息会被自动注入到这里
  ["human", "{input}"],
]);
const chain = prompt.pipe(model).pipe(parser);

// Step 2: 创建历史存储（用 Map 支持多会话）
const messageHistories = new Map<string, InMemoryChatMessageHistory>();

const getMessageHistory = (sessionId: string) => {
  if (!messageHistories.has(sessionId)) {
    messageHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return messageHistories.get(sessionId)!;
};

// Step 3: 用 RunnableWithMessageHistory 包装——升级为"带记忆的链"
const withHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory,
  inputMessagesKey: "input",       // 用户输入的字段名
  historyMessagesKey: "history",   // 历史消息的字段名
});

// Step 4: 调用时指定 sessionId
const config = { configurable: { sessionId: "session-1" } };

await withHistory.invoke({ input: "我是一名全栈开发者，正在学习 LangChain" }, config);
await withHistory.invoke({ input: "我之前学了哪些技术栈？" }, config);
// → AI 能记住你是全栈开发者！不需要手动 push，全自动 ✨
```

每次 `withHistory.invoke()` 内部自动做了什么？以第2轮调用为例：

```
1. 从 config 取出 sessionId = "session-1"
2. 调用 getMessageHistory("session-1") 拿到历史 store
3. 从 store 取出已有消息 → 注入到 chain 的 "history" 参数
4. 调用 chain.invoke() → 得到 AI 回复
5. 自动把本轮的 HumanMessage + AIMessage 存回 store
```

> 💡 **v1 变更**：`ChatMessageHistory` → `InMemoryChatMessageHistory`，import 路径从 `langchain/stores/message/in_memory` → `@langchain/core/chat_history`

### 5.4 方式三：LangGraph MemorySaver（v1 推荐方式 ⭐）

LangChain v1 推荐使用 LangGraph 的 `MemorySaver`——不仅存消息历史，还存完整状态（支持断点恢复、持久化）：

```typescript
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Step 1: 创建 MemorySaver（内存版；生产可换 PostgresSaver）
const memorySaver = new MemorySaver();

// Step 2: 创建带记忆的 Agent
const agent = createReactAgent({
  llm: model,
  tools: [],  // 本 demo 不需要工具，只演示记忆
  checkpointSaver: memorySaver,
});

// Step 3: 通过 thread_id 区分会话
const threadConfig = { configurable: { thread_id: "memory-demo-1" } };

await agent.invoke(
  { messages: [new HumanMessage("我叫李四，我是一名后端开发者，主要用 Go 语言")] },
  threadConfig
);
await agent.invoke(
  { messages: [new HumanMessage("我擅长什么编程语言？")] },
  threadConfig
);
// → AI 能记住你是李四，擅长 Go
```

### 5.5 三种方式对比

| 方案 | 版本 | 自动管理 | 多会话 | 持久化 | 适用场景 |
|------|------|---------|--------|--------|---------|
| 手动 push messages | 通用 | ❌ | ❌ | ❌ | 学习原理、简单脚本 |
| `RunnableWithMessageHistory` | v0.2+ | ✅ | ✅ | ❌ 内存 | LCEL 链、中等复杂度 |
| LangGraph `MemorySaver` | v1 推荐 ⭐ | ✅ | ✅ | ✅ 可换 | Agent、生产环境 |

> 💡 类比理解：`RunnableWithMessageHistory` ≈ 浏览器的 `sessionStorage`（仅内存存储消息历史）；`MemorySaver` ≈ 数据库 + 事务日志（存完整状态，可回溯、可恢复）。生产环境可换 `PostgresSaver` 等持久化方案。

运行示例：
```bash
npm run memory-chat
```



## 六、Custom Tool — 自定义工具

### 6.1 用 tool() 定义工具

第1期我们在 Vercel AI SDK 中用 Zod Schema + `tools` 对象定义了天气查询和计算器工具。LangChain 的方式类似，但用 `tool()` 函数封装：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/** 天气查询工具 */
const getWeatherTool = tool(
  async ({ city }: { city: string }) => {
    const weatherData: Record<string, string> = {
      北京: "晴天，气温 22°C，微风",
      上海: "多云，气温 25°C，东南风 3 级",
      广州: "小雨，气温 28°C，湿度 85%",
      深圳: "阴天，气温 27°C，有雾",
    };
    return weatherData[city] || `暂无 ${city} 的天气数据`;
  },
  {
    name: "get_weather",
    description: "查询指定城市的天气信息",     // LLM 根据此描述决定何时调用
    schema: z.object({
      city: z.string().describe("城市名称，如：北京、上海"),
    }),
  }
);

/** 计算器工具 */
const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "");
    if (sanitized !== expression.trim()) return `不安全的表达式: ${expression}`;
    const result = new Function(`return ${sanitized}`)();
    return `${expression} = ${result}`;
  },
  {
    name: "calculator",
    description: "计算数学表达式，支持加减乘除和括号",
    schema: z.object({
      expression: z.string().describe("数学表达式，如: 2 + 3 * 4"),
    }),
  }
);

const tools = [getWeatherTool, calculatorTool];
```

工具可以直接调用测试：

```typescript
const weatherResult = await getWeatherTool.invoke({ city: "北京" });
console.log(weatherResult); // → "晴天，气温 22°C，微风"
```

### 6.2 bindTools — 手动解析模式

`model.bindTools(tools)` 让模型知道有哪些工具可用，模型会返回 `tool_calls`，但**需要你手动执行**：

```typescript
import { ToolMessage } from "@langchain/core/messages";

const modelWithTools = model.bindTools!(tools);

// 第一步：模型返回 tool_calls
const response = await modelWithTools.invoke([
  new HumanMessage("帮我算一下 123 * 456"),
]);
console.log(response.content);     // → ""（空，模型选择调用工具）
console.log(response.tool_calls);
// → [{ name: "calculator", args: { expression: "123 * 456" }, id: "..." }]

// 第二步：手动执行工具
if (response.tool_calls?.length > 0) {
  const messages = [new HumanMessage("帮我算 123 * 456"), response];

  for (const toolCall of response.tool_calls) {
    const toolResult = await calculatorTool.invoke(toolCall.args);
    messages.push(new ToolMessage({
      content: toolResult,
      tool_call_id: toolCall.id!,
    }));
  }

  // 第三步：让模型基于工具结果生成最终回复
  const finalResponse = await modelWithTools.invoke(messages);
  console.log(finalResponse.content); // → "123 × 456 = 56088"
}
```

### 6.3 createReactAgent — 全自动 Agent

手动模式适合理解原理，实际开发推荐 `createReactAgent`——它会自动完成 "调用工具 → 获取结果 → 再次调用" 的 ReAct 循环：

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

代码非常简洁：

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const agent = createReactAgent({
  llm: model,
  tools,
});

// 单工具调用
const result1 = await agent.invoke({
  messages: [new HumanMessage("上海今天天气如何？")],
});

// 多工具组合调用 — Agent 自动决定调用顺序！
const result2 = await agent.invoke({
  messages: [
    new HumanMessage("北京和广州天气分别怎样？顺便算一下 999 * 888"),
  ],
});

// 无需工具的问题 — Agent 自动判断不调用工具，直接回答
const result3 = await agent.invoke({
  messages: [new HumanMessage("用一句话介绍 LangChain")],
});
```

LangChain v1 还新增了 `createAgent` 高层 API，底层基于 LangGraph ReactAgent，支持字符串模型名、`systemPrompt` 等简化参数：

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model,  // 也支持字符串 "openai:gpt-4o-mini"
  tools,
});
```

### 6.4 Agent API 对比

| API | 来源 | 控制度 | 适用场景 |
|----|------|-------|---------|
| `model.bindTools()` + 手动执行 | @langchain/openai | 高 | 理解原理，特殊流程控制 |
| `createReactAgent` | @langchain/langgraph | 中 | 可自定义状态图，底层可控 |
| `createAgent` | langchain v1 | 低 | 快速上手，生产推荐 ⭐ |

> ⚠️ Agent 需要模型支持稳定的 function calling，推荐使用 OpenAI API Key 以获得最佳体验。DeepSeek 的 function calling 可能不稳定。

运行示例：
```bash
npm run custom-tool
```



## 七、用 LangChain 重构 RAG

这是本期的"压轴环节"——用 LangChain 组件重新实现第3期手写的 RAG Pipeline，直观感受框架带来的效率提升。

### 7.1 手写 vs LangChain 方案对比

| 环节 | 第3期手写 | 本期 LangChain |
|------|----------|---------------|
| Embedding | 自己封装 `LocalEmbedding` 类 ~70行 | 继承 `Embeddings` 抽象类 ~40行 |
| 文本分块 | 手写三种策略 ~120行 | `RecursiveCharacterTextSplitter` ~5行 |
| 向量存储 | 手动封装 ChromaDB ~100行 | `Chroma.fromDocuments()` ~10行 |
| RAG 链 | 手写 Pipeline 类 ~150行 | LCEL 链 ~20行 |
| **合计** | **~440行** | **~75行（减少83%）** |

### 7.2 文本分块 — RecursiveCharacterTextSplitter

第3期我们手写了三种分块策略（固定大小、递归字符、段落），约120行。LangChain 的 `RecursiveCharacterTextSplitter` 配置一下就搞定：

```typescript
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,    // 每块最大 500 字符
  chunkOverlap: 50,  // 相邻块重叠 50 字符（避免关键信息在边界被截断）
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
  //            段落    换行   句号                           空格  兜底
  //            ← 优先级从高到低，先尝试大粒度，切不动再用小粒度 →
});

const docs = await splitter.createDocuments([rawText]);
```

**"递归"的含义**：按分隔符优先级逐级尝试，尽可能在语义边界（段落→句子）断开，而非从句子中间劈开：

```
第1轮: 按 "\n\n"（段落）切 → 块 ≤ 500字？✅ 放入结果  ❌ 太大→第2轮
第2轮: 按 "\n"（换行）切   → 块 ≤ 500字？✅ 放入结果  ❌ 太大→第3轮
第3轮: 按 "。"（句号）切   → ...逐级递归
兜底:  "" 按单字符切（保证一定能切到目标大小）
```

中文适配：默认分隔符是英文的（`\n\n`, `\n`, `" "`, `""`），这里加入了 `。！？；，` 等中文标点，让切分优先在中文句子边界断开。`chunkOverlap: 50` 让相邻块重叠 50 字符，防止关键信息在边界被截断。

### 7.3 自定义 LocalEmbeddings

LangChain 的向量化需要实现 `Embeddings` 抽象类。我们复用第3期的 `@xenova/transformers` 本地模型（`Xenova/bge-small-zh-v1.5`，512维，中文优化），无需 API Key：

```typescript
import { Embeddings } from "@langchain/core/embeddings";
import { pipeline, env } from "@xenova/transformers";

env.remoteHost = "https://hf-mirror.com/";  // 国内镜像加速

export class LocalEmbeddings extends Embeddings {
  private extractor: any = null;
  private modelName: string;

  constructor(modelName = "Xenova/bge-small-zh-v1.5") {
    super({});
    this.modelName = modelName;
  }

  /** 批量文本向量化 */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const doc of documents) {
      results.push(await this.embedSingle(doc));
    }
    return results;
  }

  /** 单条查询向量化 */
  async embedQuery(query: string): Promise<number[]> {
    return this.embedSingle(query);
  }

  private async embedSingle(text: string): Promise<number[]> {
    if (!this.extractor) {
      console.log(`📦 加载 Embedding 模型: ${this.modelName}（首次运行需下载 ~90MB）...`);
      this.extractor = await pipeline("feature-extraction", this.modelName);
      console.log("✅ Embedding 模型加载完成！");
    }
    const output = await this.extractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  }
}
```

### 7.4 Chroma VectorStore + Retriever

第3期手动封装 ChromaDB 客户端约 100 行。LangChain 直接提供 `Chroma` 集成：

```typescript
import { Chroma } from "@langchain/community/vectorstores/chroma";

const embeddings = new LocalEmbeddings();

// 一行入库！
const vectorStore = await Chroma.fromDocuments(docs, embeddings, {
  collectionName: "langchain-rag-demo",
  url: "http://localhost:8000",
  collectionMetadata: { "hnsw:space": "cosine" },
});

// 转为 Retriever（支持 LCEL pipe）
const retriever = vectorStore.asRetriever({ k: 3 });
```

🔑 **VectorStore vs Retriever** — 为什么要多封装一层？

| | VectorStore | Retriever |
|---|---|---|
| **职责** | 完整数据库操作（入库/删除/搜索） | 只读检索（给问题→返回相关文档） |
| **常用方法** | `addDocuments()`, `similaritySearch()`, `delete()` | `invoke(question)` → `Document[]` |
| **支持 LCEL** | ❌ 没有 `pipe()` | ✅ 实现了 Runnable 接口，可直接 `pipe()` |

**一句话：Retriever 是 VectorStore 的 LCEL 友好包装，让"检索"可以像积木一样拼进链里。**

`retriever.invoke(question)` 内部自动做两步：① 调用 Embedding 模型将 question 向量化 ② 在向量数据库中找最相似的 k 个文档块

### 7.5 LCEL RAG Chain — 核心范式

这是 LangChain RAG 的标准写法，也是整个 LCEL 范式的精华：

```typescript
const ragPrompt = ChatPromptTemplate.fromMessages([
  ["system", `你是一个知识问答助手。请根据以下参考资料回答用户问题。
如果参考资料中没有相关信息，请诚实地说"根据现有资料无法回答"。

参考资料：
{context}`],
  ["human", "{question}"],
]);

// 格式化检索结果：把 Document[] 拼成可读文本
const formatDocs = (docs: Document[]): string =>
  docs.map((doc, i) => `[${i + 1}] ${doc.pageContent}`).join("\n\n");

// 核心：LCEL RAG Chain ✨
const ragChain = RunnableSequence.from([
  {
    // 并行执行两个分支
    context: retriever.pipe(formatDocs),      // 检索 → 格式化为文本
    question: new RunnablePassthrough(),       // 原样透传问题
  },
  ragPrompt,  // 将 context + question 注入模板
  model,      // LLM 生成回答
  parser,     // 提取纯文本
]);

// 使用
const answer = await ragChain.invoke("什么是大语言模型？它的核心架构是什么？");
```

数据流转：

```
"什么是大语言模型？"
    ↓ 并行
context:  retriever("什么是大语言模型？") → [Doc1, Doc2, Doc3] → formatDocs → 文本
question: "什么是大语言模型？"（透传）
    ↓
{ context: "检索到的文本...", question: "什么是大语言模型？" }
    ↓ ragPrompt（注入模板）
    ↓ model（LLM 生成）
    ↓ parser（提取文本）
"大语言模型是基于 Transformer 架构的深度学习模型..."
```

对比第3期手写的 `RAGPipeline` 类（~150行 Pipeline + 手动拼接 Prompt + 手动调用模型），这里不到 20 行代码实现了完整的 RAG 链，而且数据流一目了然。

### 7.6 代码量对比总结

| 功能 | 04-rag 手写 | LangChain | 缩减 |
|------|------------|-----------|------|
| Embedding 封装 | ~70 行 | ~40 行 | 43% |
| 文本分块 | ~120 行 | ~5 行 | 96% |
| 向量存储 + 检索 | ~100 行 | ~10 行 | 90% |
| RAG Pipeline | ~150 行 | ~20 行 | 87% |
| **合计** | **~440 行** | **~75 行** | **83%** |

💡 **结论：**
- LangChain 通过高级抽象大幅减少代码量（约 83% 缩减）
- 文本分块、向量存储等通用能力直接复用社区实现
- LCEL 链式调用让数据流清晰可读
- **但理解底层原理（第3期手写）对调试和优化至关重要！**

运行示例（需要 ChromaDB）：
```bash
docker run -d -p 8000:8000 chromadb/chroma
npm run rag-langchain
```



## 八、总结与下期预告

### 8.1 核心概念回顾

本期我们用 LangChain.js 框架重新实现了前三期手写的所有功能：

| 概念 | 作用 | 关键类/函数 | 对应前几期 |
|------|------|-----------|-----------|
| **Model** | 统一接口调用不同 LLM | `ChatOpenAI`（baseURL 适配 DeepSeek） | 第2期 `model-adapter.ts` |
| **Prompt** | 类型安全的模板引擎 | `ChatPromptTemplate`、`MessagesPlaceholder` | 第2期手动字符串拼接 |
| **LCEL** | 管道式链式调用 | `pipe()`、`RunnableSequence`、`RunnableLambda` | — |
| **Output Parser** | 结构化输出解析 | `StructuredOutputParser` + Zod | 第2期 `generateObject()` |
| **Memory** | 自动管理对话历史 | `RunnableWithMessageHistory`、`MemorySaver` | 第1期手动 history 数组 |
| **Tool + Agent** | 工具调用 + 自动编排 | `tool()`、`bindTools()`、`createReactAgent` | 第1期 Function Calling |
| **LCEL RAG Chain** | 完整 RAG Pipeline | `Retriever.pipe(formatDocs)`... | 第3期手写 RAG |

### 8.2 LangChain vs Vercel AI SDK

在第1-2期我们使用了 Vercel AI SDK，本期使用 LangChain。两者定位不同，可以互补使用：

| 维度 | Vercel AI SDK | LangChain |
|------|--------------|-----------|
| **定位** | 轻量级 AI 工具库 | 全功能 LLM 应用框架 |
| **核心优势** | 流式 UI（React Hooks）、边缘函数友好 | 丰富的抽象层、完整的工具链生态 |
| **Prompt 管理** | 手动字符串拼接 | ChatPromptTemplate 模板引擎 |
| **输出解析** | `generateObject()` + Zod | OutputParser + format_instructions |
| **记忆管理** | 需手动实现 | 内置多种 Memory 方案 |
| **RAG** | 需手动组装各环节 | 一站式：Splitter → VectorStore → Retriever → Chain |
| **Agent** | 需手动实现工具循环 | createReactAgent 自动循环 |
| **包体积** | 小（~100KB） | 大（整个生态 ~2MB+） |
| **适合场景** | Web 应用、流式聊天 UI | 后端服务、复杂 AI 流程、原型验证 |

**推荐策略**：前端用 Vercel AI SDK 做流式 UI，后端用 LangChain 做 AI 逻辑编排。两者也可以混合使用。

### 8.3 学习路径建议

```
先手写理解原理（01-04）→ 再用框架提升效率（05）→ 生产中按需选择
```

**手写不是浪费时间！** 理解了底层原理，使用框架时才能知道它帮你做了什么，出问题时才能定位和优化。

### 8.4 版本踩坑提醒

LangChain 发展迅速，网上很多教程基于 v0.1/v0.2 版本，代码在 v1 中可能无法运行。关键变更：

**Import 路径变更：**

| 组件 | v0.3 路径（❌ 已移除） | v1 路径（✅） |
|------|---------------------|-------------|
| `RecursiveCharacterTextSplitter` | `langchain/text_splitter` | `@langchain/textsplitters` |
| `StructuredOutputParser` | `langchain/output_parsers` | `@langchain/core/output_parsers` |
| `ChatMessageHistory` | `langchain/stores/message/in_memory` | `InMemoryChatMessageHistory` from `@langchain/core/chat_history` |

**API 变更：**

| 特性 | v0.3 | v1 |
|------|------|-----|
| Chain | `LLMChain`、`ConversationChain` | LCEL `pipe()` 链式调用 |
| Memory | `RunnableWithMessageHistory` 为主 | LangGraph `MemorySaver`（推荐） |
| Agent | `createReactAgent`（唯一） | 新增 `createAgent` 高层 API |
| 包结构 | `langchain` 包含 TextSplitter/OutputParser | 拆分为独立包 |
| 调用方式 | `.predict()` / `.call()` | 统一使用 `.invoke()` |

旧类如 `ConversationChain`、`LLMChain`、`BufferMemory` 已移至 `@langchain/classic`（不推荐使用）。
