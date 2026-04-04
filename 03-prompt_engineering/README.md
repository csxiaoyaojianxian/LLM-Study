# 03 - Prompt Engineering 进阶

> CLI 可运行的 TypeScript 脚本集合，逐个实验对比各种 Prompt 工程技术。

## 📚 学习目标

通过本模块，你将掌握：

1. **多模型统一适配** — 一套代码调用 DeepSeek / OpenAI / Anthropic
2. **Prompt 模板引擎** — 可复用的 Prompt 模板设计模式
3. **结构化输出** — 使用 Zod Schema 让 LLM 输出强类型 JSON
4. **思维链（CoT）** — 对比 Zero-shot / Few-shot / CoT 三种策略的效果

## 🛠️ 环境配置

### 1. 安装依赖

```bash
cd 03-prompt_engineering
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
```

编辑 `.env`，填入至少一个 API Key：

```env
# 推荐：DeepSeek（性价比高）
DEEPSEEK_API_KEY=sk-xxx

# 可选：OpenAI
OPENAI_API_KEY=sk-xxx

# 可选：Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
```

> 💡 填入一个 Key 即可运行所有 demo，填入多个可体验多模型对比。

## 🚀 运行 Demo

```bash
# Demo 1: 多模型适配层 — 同一问题多模型回答对比
npm run model-adapter

# Demo 2: Prompt 模板引擎 — 翻译/代码审查/摘要生成
npm run prompt-templates

# Demo 3: 结构化输出 — generateObject + Zod Schema
npm run structured-output

# Demo 4: 思维链对比 — Zero-shot vs Few-shot vs CoT
npm run cot-demo
```

## 📖 Demo 详解

### 1. model-adapter.ts — 多模型统一适配层

**核心 API：**

```typescript
import { getModel, chatWithModel, getAvailableProviders } from "./model-adapter.js";

// 获取模型实例
const model = getModel("deepseek");              // 使用默认模型
const model2 = getModel("openai", "gpt-4o");     // 指定模型

// 一步完成调用
const answer = await chatWithModel("deepseek", [
  { role: "user", content: "Hello!" }
]);

// 检测可用 provider
const providers = getAvailableProviders(); // ["deepseek", "openai", ...]
```

**运行效果：** 对同一个问题，分别用已配置的模型回答并对比输出风格。

---

### 2. prompt-templates.ts — Prompt 模板引擎

**核心类：**

```typescript
import { PromptTemplate, ChatPromptTemplate } from "./prompt-templates.js";

// 基础模板 — 自动提取变量
const template = PromptTemplate.fromTemplate(
  "请用{{style}}的语气介绍{{topic}}"
);
const prompt = template.format({ style: "幽默", topic: "TypeScript" });

// Chat 消息模板 — 组合 system + user
const chatTemplate = new ChatPromptTemplate([
  { role: "system", template: "你是{{role}}专家" },
  { role: "user", template: "请帮我{{task}}" },
]);
const messages = chatTemplate.format({ role: "前端", task: "优化性能" });
```

**预置模板：** `translatorTemplate`（翻译）、`codeReviewTemplate`（代码审查）、`summaryTemplate`（摘要生成）

---

### 3. structured-output.ts — 结构化输出

**四组实验：**

| 实验 | 内容 | 技术点 |
|------|------|--------|
| 实验1 | 文章信息提取 | `generateObject` + 复合 Schema |
| 实验2 | 商品数据生成 | 嵌套数组 Schema |
| 实验3 | 情感分类 | `z.enum()` 枚举约束 |
| 实验4 | 方法对比 | `generateObject` vs `generateText` + `JSON.parse` |

**关键代码：**

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({
  title: z.string().describe("文章标题"),
  keywords: z.array(z.string()).describe("关键词"),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});

const { object } = await generateObject({ model, schema, prompt: "..." });
// object 自动推断为 { title: string; keywords: string[]; sentiment: "positive" | ... }
```

---

### 4. cot-demo.ts — 思维链对比实验

**三种策略对比：**

| 策略 | 描述 | 适用场景 |
|------|------|----------|
| **Zero-shot** | 直接提问，不给示例 | 简单事实问答 |
| **Few-shot** | 提供 2-3 个示例 | 格式固定的任务 |
| **CoT** | 要求"一步步思考" | 复杂推理、数学题 |

**实验题目：** 3 道经典数学题（应用题、鸡兔同笼、行程问题），自动判断答案正确性并生成对比表格。

---

## 🧠 核心知识点

### Prompt 设计原则

1. **明确指令** — 清晰说明任务要求、输出格式、约束条件
2. **提供上下文** — 给模型足够的背景信息
3. **角色设定** — 用 System Prompt 定义模型角色和行为规范
4. **分步引导** — 复杂任务拆解为子步骤

### Zod — 运行时类型校验

TypeScript 的类型只在编译时存在，运行时会消失。[Zod](https://zod.dev/) 解决了这个问题 — 它让类型校验在运行时也能生效：

```typescript
// TypeScript type — 编译后消失，运行时无法校验
type Article = { title: string; keywords: string[] };

// Zod schema — 运行时仍存在，可以校验数据
const schema = z.object({ title: z.string(), keywords: z.array(z.string()) });
schema.parse({ title: 123 });                     // ❌ 运行时抛错
schema.parse({ title: "hi", keywords: ["a"] });    // ✅ 通过
```

**常用 API：**

| 方法 | 含义 | 示例值 |
|------|------|--------|
| `z.string()` | 字符串 | `"hello"` |
| `z.number()` | 数字 | `42` |
| `z.boolean()` | 布尔 | `true` |
| `z.enum(["a","b"])` | 枚举，值只能是列出的选项 | `"a"` |
| `z.array(z.string())` | 字符串数组 | `["x","y"]` |
| `z.object({...})` | 对象（嵌套组合） | `{ name: "..." }` |
| `.describe("...")` | 给字段添加自然语言描述 | — |

> `.describe()` 是结构化输出的关键 — 它会被转为 JSON Schema 的 `description` 字段，告诉 LLM 每个字段应该填什么内容。

### generateObject 工作原理

`generateObject()` 是 AI SDK 实现结构化输出的核心，内部分三步完成：

```
Zod Schema ──→ JSON Schema ──→ LLM 约束生成 ──→ Zod 校验
```

**① Schema 转换** — AI SDK 将 Zod Schema 自动转为 JSON Schema 发送给模型：

```typescript
// 你写的 Zod Schema
z.object({
  title:     z.string().describe("文章标题"),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("情感倾向"),
})

// SDK 自动转为 JSON Schema 发给 LLM
{
  "type": "object",
  "properties": {
    "title":     { "type": "string", "description": "文章标题" },
    "sentiment": { "type": "string", "enum": ["positive","negative","neutral"], "description": "情感倾向" }
  },
  "required": ["title", "sentiment"]
}
```

**② 约束生成** — 模型在 JSON Mode 下被约束为只能输出符合 Schema 的 JSON，而不是自由文本。

**③ 类型安全校验** — 返回的 JSON 经 Zod `.parse()` 校验，`object` 自动获得完整 TypeScript 类型推断：

```typescript
const { object } = await generateObject({ model, schema, prompt: "..." });
object.title      // ✅ string — 有类型提示
object.sentiment  // ✅ "positive" | "negative" | "neutral" — 枚举类型
object.foo        // ❌ 编译报错 — 不存在的字段
```

### generateObject vs generateText + JSON.parse

| 维度 | `generateObject` | `generateText` + `JSON.parse` |
|------|-------------------|-------------------------------|
| 类型安全 | ✅ Zod 自动校验 + TypeScript 推断 | ❌ 返回 `any`，需手动校验 |
| 输出可靠性 | ✅ 始终符合 Schema | ⚠️ 模型可能输出 \`\`\`json 包裹、多余文字等 |
| 错误处理 | ✅ SDK 内置重试机制 | ❌ 需自行 try-catch 和重试 |
| 适用场景 | API 数据提取、分类任务、表单填充 | 自由格式文本、不确定结构的输出 |

### Chain-of-Thought 原理

- 通过 "Let's think step by step" 类指令激活模型的推理能力
- 模型在生成中间推理步骤时，能利用前面的上下文修正后续推理
- 代价是输出 Token 更多（更贵），但复杂任务准确率显著提升
- 变体：Self-Consistency（多次采样取多数投票）、Tree-of-Thought（树状搜索）

## 📁 文件结构

```
03-prompt_engineering/
├── src/
│   ├── model-adapter.ts        # 多模型统一适配层（可复用）
│   ├── prompt-templates.ts     # Prompt 模板引擎
│   ├── structured-output.ts    # 结构化输出实验
│   └── cot-demo.ts             # 思维链对比实验
├── .env.example                # 环境变量模板
├── package.json
├── tsconfig.json
└── README.md                   # 本文件
```

## ⏭️ 下一步

完成本模块后，建议继续学习 [04-rag](../04-rag/) — RAG 检索增强生成，将在本模块的 model-adapter 基础上构建知识库问答系统。
