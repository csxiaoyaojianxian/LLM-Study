# AI应用实践(2)—Prompt Engineering进阶指南

上一期我们先把聊天应用跑了起来，这一篇开始解决另一个更实际的问题：怎么把 Prompt 从“写几句话”变成“能维护、能复用、能约束输出”的工程能力。

这篇不会停留在提示词技巧层面，而是直接落到代码实现上，分别处理多模型切换、Prompt 模板、结构化输出和思维链这几个最常见的问题。

技术栈：TypeScript + Vercel AI SDK + Zod + DeepSeek / OpenAI / Anthropic
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/03-prompt_engineering](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/03-prompt_engineering)

## 一、为什么需要 Prompt Engineering

### 1.1 回顾：前文的简单 Prompt

在前文里，我们的聊天应用只用了一行 System Prompt：

```typescript
{ role: 'system', content: 'You are a helpful assistant.' }
```

这在演示场景下完全够用。但当你开始做真实项目，问题就来了：

- **多模型切换**：产品要求同时支持 DeepSeek（便宜）、OpenAI（稳定）、Anthropic（安全），每次换模型都要改一堆代码？
- **Prompt 管理混乱**：翻译、审查、摘要……几十个 Prompt 散落在各处，改一个就得到处找？
- **输出格式不可控**：让 AI 返回 JSON，结果它有时加个 ` ```json ` 包裹，有时多一句废话，程序直接崩？
- **复杂推理不准确**：问一道数学题，AI 直接给答案但算错了，怎么提高准确率？

### 1.2 从"手艺人"到"工程师"

打个比方，前文我们还是"手工匠人"——每次手写 Prompt，效果全凭感觉。这一篇的目标是成为"工程师"——用代码来管理 Prompt，让它可复用、可测试、可维护。

**本期你将掌握四个核心技能：**

| 技能 | 解决的问题 | 类比 |
|------|-----------|------|
| 多模型适配器 | 一套代码支持多个 AI 模型 | 数据库 ORM 抹平 MySQL/PostgreSQL 差异 |
| Prompt 模板引擎 | 动态生成 Prompt，避免硬编码 | 前端模板引擎（Handlebars/EJS） |
| 结构化输出 | AI 返回强类型 JSON | 接口返回值的 TypeScript 类型约束 |
| 思维链（CoT） | 提升复杂推理准确率 | 让 AI "展示解题步骤"而不是直接猜答案 |

### 1.3 环境搭建

```bash
cd 03-prompt_engineering
npm install

# 配置 API Key（至少填一个）
cp .env.example .env
```

编辑 `.env`：

```env
# 推荐：DeepSeek（性价比高）
DEEPSEEK_API_KEY=sk-xxx
# 可选
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

> 💡 填入一个 Key 即可运行所有 Demo，填入多个可体验多模型对比。

运行四个 Demo：

```bash
npm run model-adapter       # 多模型对比
npm run prompt-templates    # 模板引擎
npm run structured-output   # 结构化输出
npm run cot-demo            # 思维链对比
```



## 二、多模型统一适配器

### 2.1 问题：换个模型要改多少代码？

假设你的项目先用了 OpenAI，后来想换成 DeepSeek 省钱。你会发现：

```typescript
// 用 OpenAI
import { createOpenAI } from "@ai-sdk/openai";
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = openai("gpt-4o-mini");

// 换成 DeepSeek？所有调用处都要改！
import { createDeepSeek } from "@ai-sdk/deepseek";
const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
const model = deepseek("deepseek-chat");
```

每个模型的 SDK 初始化方式不同、默认模型名不同、API Key 环境变量名不同。如果项目里有几十个调用点，全部手动改一遍？这不是"工程"，这是"搬砖"。

**我们需要一个统一的适配层，就像数据库 ORM 一样——上层代码不关心底层用的是 MySQL 还是 PostgreSQL。**

### 2.2 Vercel AI SDK 的 Provider 体系

好消息是 Vercel AI SDK 已经帮我们做了大部分标准化工作。它为每个模型提供商（DeepSeek、OpenAI、Anthropic 等）提供了独立的 Provider 包，但它们都返回统一的 `LanguageModel` 接口：

```
@ai-sdk/deepseek   ──┐
@ai-sdk/openai     ──┤──→ LanguageModel（统一接口）──→ generateText() / generateObject()
@ai-sdk/anthropic  ──┘
```

我们要做的，就是在此基础上再包一层，实现"一行代码切换模型"。

### 2.3 model-adapter.ts 实现

> 源码：[model-adapter.ts](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/03-prompt_engineering/src/model-adapter.ts)

**核心设计：三个函数搞定一切。**

#### ① 类型定义与默认模型

```typescript
import { generateText, type LanguageModel, type ModelMessage } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

export type Provider = "deepseek" | "openai" | "anthropic";

/** 各 provider 的默认模型——选的都是性价比最高的 */
const DEFAULT_MODELS: Record<Provider, string> = {
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
};
```

#### ② getModel() —— 模型工厂函数

```typescript
export function getModel(provider: Provider, modelName?: string): LanguageModel {
  const model = modelName ?? DEFAULT_MODELS[provider];
  switch (provider) {
    case "deepseek": {
      const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
      return deepseek(model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      return openai(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      return anthropic(model);
    }
    default:
      throw new Error(`不支持的 provider: ${provider}`);
  }
}
```

**设计要点：**
- `switch` 路由只出现在这**一个地方**，所有上层代码完全无感
- 不传 `modelName` 时自动使用默认模型，减少调用方心智负担
- 返回统一的 `LanguageModel` 接口

#### ③ chatWithModel() —— 一步到位的便捷函数

```typescript
export interface ChatOptions {
  temperature?: number;
  maxOutputTokens?: number;
  system?: string;
}

export async function chatWithModel(
  provider: Provider,
  messages: ModelMessage[],
  options?: ChatOptions
): Promise<string> {
  const model = getModel(provider);
  const result = await generateText({
    model,
    messages,
    temperature: options?.temperature,
    maxOutputTokens: options?.maxOutputTokens,
    system: options?.system,
  });
  return result.text;
}
```

封装后，调用方只需关心"用哪个 Provider"和"发什么消息"：

```typescript
// ✅ 一行代码搞定！
const answer = await chatWithModel("deepseek", [
  { role: "user", content: "Hello!" }
]);
```

#### ④ 自动检测可用 Provider

```typescript
export function getAvailableProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== "sk-") {
    providers.push("deepseek");
  }
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "sk-") {
    providers.push("openai");
  }
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-") {
    providers.push("anthropic");
  }
  return providers;
}

export function getDefaultProvider(): Provider {
  const available = getAvailableProviders();
  if (available.length === 0) {
    throw new Error("❌ 未找到任何可用的 API Key！请复制 .env.example 为 .env 并填入至少一个 Key。");
  }
  return available[0]; // 返回第一个配置了 Key 的 provider
}
```

**巧妙之处**：不只是检测环境变量是否存在，还排除了 `.env.example` 中的占位符（如 `sk-`）。`getDefaultProvider()` 会自动选第一个可用的模型，所以后续所有 Demo 都能"零配置"运行。

### 2.4 运行效果

```bash
npm run model-adapter
```

```
🔌 model-adapter.ts — 多模型统一适配层 Demo

✅ 已配置的 Provider: deepseek, openai

📝 测试问题: 用一句话解释什么是 Prompt Engineering（提示工程）？

============================================================

🤖 [deepseek] (deepseek-chat)
----------------------------------------
Prompt Engineering是通过精心设计输入提示来引导AI模型生成更准确、相关和高质量输出的技术。

🤖 [openai] (gpt-4o-mini)
----------------------------------------
Prompt Engineering是通过设计和优化输入文本（提示）来引导大型语言模型生成更精准输出的技术和方法。

============================================================
✅ Demo 完成！
```

同一个问题，不同模型给出不同风格的回答——适配器让这种对比测试变得轻而易举。

### 2.5 适配器的复用

这个 `model-adapter.ts` 在后续模块中也会用到（如模块 04 的 RAG 流水线）。为了保持每个模块独立可运行（不需要安装其他模块的依赖），我们选择**复制**而非**共享引用**——模块 04 的副本去掉了 demo `main()` 函数。

> 💡 **设计思考**：在学习项目中，"可独立运行"比"代码不重复"更重要。生产项目中可以用 monorepo + workspace 共享。



## 三、Prompt 模板引擎

### 3.1 硬编码 Prompt 的问题

看看下面这段代码，你觉得哪里有问题？

```typescript
// ❌ 硬编码 Prompt——每个场景都要写一遍
const result = await generateText({
  model,
  messages: [
    {
      role: "system",
      content: "你是一位资深的TypeScript开发工程师，擅长代码审查。请从以下角度审查代码：1) 潜在Bug 2) 性能问题 3) 代码风格 4) 安全隐患。"
    },
    {
      role: "user",
      content: `请审查以下代码：\n\n\`\`\`typescript\n${code}\n\`\`\``
    },
  ],
});
```

问题在于：

1. **不可复用**：换成审查 Python 代码，又要复制粘贴一遍，只改个 "TypeScript" → "Python"
2. **难以维护**：Prompt 散落在代码各处，想统一修改审查角度？祝你好运
3. **没有校验**：忘了传 `code` 变量？运行时才发现 Prompt 是残缺的

**解决方案**：像前端模板引擎（Handlebars、EJS）一样，把 Prompt 做成"模板 + 变量"的形式。

### 3.2 PromptTemplate —— 基础模板类

> 源码：[prompt-templates.ts](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/03-prompt_engineering/src/prompt-templates.ts)

```typescript
export class PromptTemplate {
  constructor(
    public readonly template: string,
    public readonly inputVariables: string[]
  ) {
    // 校验：模板中的 {{变量}} 必须全部在 inputVariables 中声明
    const found = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const missing = found.filter((v) => !inputVariables.includes(v));
    if (missing.length > 0) {
      throw new Error(`模板中发现未声明的变量: ${missing.join(", ")}`);
    }
  }

  /** 静态工厂方法：自动从模板字符串中提取变量名 */
  static fromTemplate(template: string): PromptTemplate {
    const variables = [...new Set(
      [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
    )];
    return new PromptTemplate(template, variables);
  }

  /** 用变量值填充模板 */
  format(values: Record<string, string>): string {
    // 检查是否所有必须变量都已提供
    const missing = this.inputVariables.filter((v) => !(v in values));
    if (missing.length > 0) {
      throw new Error(`缺少必须的变量: ${missing.join(", ")}`);
    }
    let result = this.template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    return result;
  }
}
```

**核心机制拆解：**

| 功能 | 实现方式 | 类比 |
|------|---------|------|
| 变量占位 | `{{variable}}` 双花括号语法 | Handlebars 模板 |
| 自动提取变量 | 正则 `/\{\{(\w+)\}\}/g` | — |
| 构造时校验 | 模板中的变量必须全部声明 | TypeScript 编译检查 |
| format 时校验 | 所有必须变量都要传入 | 运行时类型守卫 |
| 静态工厂 | `fromTemplate()` 自动推断变量名 | 省去手动声明 |

使用示例：

```typescript
// 自动提取变量：style, topic
const template = PromptTemplate.fromTemplate(
  "请用{{style}}的语气，介绍{{topic}}，控制在50字以内。"
);
console.log(template.inputVariables); // ["style", "topic"]

const prompt = template.format({
  style: "幽默",
  topic: "TypeScript 的类型系统",
});
// → "请用幽默的语气，介绍TypeScript 的类型系统，控制在50字以内。"
```

如果忘了传变量会怎样？

```typescript
template.format({ style: "幽默" });
// ❌ Error: 缺少必须的变量: topic
```

**开发阶段就能发现问题，而不是等 AI 返回一堆乱码才意识到 Prompt 写错了。**

### 3.3 ChatPromptTemplate —— 消息级别模板

基础模板只能生成一个字符串。但实际调用 AI 需要的是 `messages` 数组（包含 system、user 角色）。`ChatPromptTemplate` 解决这个问题：

```typescript
interface MessageTemplate {
  role: "system" | "user" | "assistant";
  template: PromptTemplate;
}

export class ChatPromptTemplate {
  private messageTemplates: MessageTemplate[];

  constructor(templates: { role: "system" | "user" | "assistant"; template: string }[]) {
    this.messageTemplates = templates.map((t) => ({
      role: t.role,
      template: PromptTemplate.fromTemplate(t.template),
    }));
  }

  /** 获取所有需要的变量名 */
  get inputVariables(): string[] {
    const vars = new Set<string>();
    for (const t of this.messageTemplates) {
      for (const v of t.template.inputVariables) {
        vars.add(v);
      }
    }
    return [...vars];
  }

  /** 填充所有消息模板，返回 messages 数组 */
  format(values: Record<string, string>): ModelMessage[] {
    return this.messageTemplates.map((t) => ({
      role: t.role,
      content: t.template.format(values),
    }));
  }
}
```

一次 `format()` 调用，同时填充 system 和 user 两个模板，输出的格式可以直接传给 AI SDK 的 `generateText()`。

### 3.4 三个预置实用模板

项目中预置了三个开箱即用的模板，覆盖最常见的场景：

#### 🌐 翻译器模板

```typescript
export const translatorTemplate = new ChatPromptTemplate([
  {
    role: "system",
    template:
      "你是一位精通多语言的专业翻译。请将用户提供的文本翻译成{{targetLang}}。" +
      "要求：保持原文的语气和风格，翻译要自然流畅，不要逐字直译。",
  },
  {
    role: "user",
    template: "请翻译以下内容：\n\n{{text}}",
  },
]);

// 使用
const messages = translatorTemplate.format({
  targetLang: "英语",
  text: "大语言模型正在改变我们与计算机交互的方式，Prompt 工程是释放其潜力的关键技能。",
});
const result = await generateText({ model, messages, maxOutputTokens: 200 });
```

#### 🔍 代码审查模板

```typescript
export const codeReviewTemplate = new ChatPromptTemplate([
  {
    role: "system",
    template:
      "你是一位资深的{{language}}开发工程师，擅长代码审查。" +
      "请从以下角度审查代码：1) 潜在 Bug 2) 性能问题 3) 代码风格 4) 安全隐患。" +
      "对每个问题给出具体的改进建议。",
  },
  {
    role: "user",
    template: "请审查以下代码：\n\n```{{language}}\n{{code}}\n```",
  },
]);
```

注意 `{{language}}` 同时出现在 system 和 user 模板中——传一次值就能同时填充两个位置。审查 TypeScript 还是 Python，只需换一个变量。

#### 📝 摘要生成模板

```typescript
export const summaryTemplate = new ChatPromptTemplate([
  {
    role: "system",
    template:
      "你是一位专业的内容编辑。请用{{style}}的风格，将以下文本总结为不超过{{maxLength}}字的摘要。" +
      "要求：抓住核心要点，语言精炼，逻辑清晰。",
  },
  {
    role: "user",
    template: "请总结以下内容：\n\n{{text}}",
  },
]);
```

**模板的设计思路**：每个模板都是 `system`（角色设定 + 规则约束） + `user`（用户输入）的组合。变量分为两类——角色参数（`language`、`targetLang`、`style`）和内容参数（`code`、`text`）。通过变量替换，一个模板可以适配无数场景。

### 3.5 运行效果

```bash
npm run prompt-templates
```

```
📝 prompt-templates.ts — Prompt 模板引擎 Demo

使用 Provider: deepseek

============================================================
📌 Demo 1: 基础 PromptTemplate 变量插值
============================================================
模板变量: style, topic
生成的 Prompt: 请用幽默的语气，介绍TypeScript 的类型系统，控制在50字以内。

🤖 回答: TypeScript的类型系统就像一个唠叨但贴心的老妈——你每写一行代码，
它都要检查一遍："这变量是什么类型？确定不改了？"

============================================================
📌 Demo 2: ChatPromptTemplate — 翻译器
============================================================
生成的消息:
  [system] 你是一位精通多语言的专业翻译。请将用户提供的文本翻译成英语...
  [user] 请翻译以下内容：大语言模型正在改变我们与计算机交互的方式...

🤖 翻译结果: Large language models are transforming the way we interact
with computers, and prompt engineering is the key skill to unlock their potential.

============================================================
📌 Demo 3: ChatPromptTemplate — 代码审查
============================================================
🤖 审查结果:
1) 潜在 Bug: 使用 `==` 而非 `===` 可能导致类型隐式转换...
2) 性能问题: 每次调用都从 localStorage 解析完整 JSON...
3) 代码风格: 参数类型使用 `any`，失去了 TypeScript 类型保护...
4) 安全隐患: 未对 localStorage 数据进行校验，可能被注入...

============================================================
📌 Demo 4: ChatPromptTemplate — 摘要生成
============================================================
🤖 摘要: Prompt Engineering 是优化大模型输入的技术，包括零样本、少样本和思维链等方法...

============================================================
✅ Demo 完成！
```

> 💡 **模板的价值**：当你的项目有几十个不同的 AI 调用场景时，模板让 Prompt 管理变得像管理 UI 组件一样清晰——每个模板职责单一，可以独立测试和迭代。

## 四、结构化输出

### 4.1 问题：AI 输出是"自由文本"

假设你要做一个情感分析 API，需要 AI 返回这样的 JSON：

```json
{"sentiment": "positive", "score": 0.85}
```

但实际上 AI 可能返回：

````
根据分析，这段文本的情感倾向如下：
```json
{"sentiment": "positive", "score": 0.85}
```
整体来看是积极的...
````

多了一堆"废话"，还用 ` ```json ` 包裹了。你得写正则去提取、`JSON.parse` 可能失败、字段名可能不对……这不是在做 AI 应用，这是在做"AI 输出清洗工程"。

**我们需要的是：AI 直接返回符合约定结构的 JSON，就像调用一个有 TypeScript 类型约束的 API 一样。**

### 4.2 Zod Schema：运行时的类型守卫

在讲解决方案之前，先认识一个关键工具——**[Zod](https://zod.dev/)**。

TypeScript 的类型只在编译时存在，运行时就消失了。但 AI 返回的数据是运行时才拿到的，编译时的类型检查帮不上忙。Zod 解决了这个问题——**运行时也能校验类型**：

```typescript
// TypeScript type → 编译后消失，运行时无法校验
type Article = { title: string; keywords: string[] };

// Zod schema → 运行时仍存在，可以校验数据
const schema = z.object({ title: z.string(), keywords: z.array(z.string()) });
schema.parse({ title: 123 }); // ❌ 运行时抛错！
schema.parse({ title: "hi", keywords: ["a"] }); // ✅ 通过
```

**Zod 常用 API 速查：**

| 方法 | 含义 | 示例值 |
|------|------|--------|
| `z.string()` | 字符串 | `"hello"` |
| `z.number()` | 数字 | `42` |
| `z.boolean()` | 布尔 | `true` |
| `z.enum(["a","b"])` | 枚举，值只能是列出的选项 | `"a"` |
| `z.array(z.string())` | 字符串数组 | `["x","y"]` |
| `z.object({...})` | 对象（嵌套组合） | `{ name: "..." }` |
| `.describe("...")` | 自然语言描述 | 告诉 AI 该字段应填什么 |
| `.min(0).max(1)` | 数值范围约束 | `0.85` |

> 🔑 `.describe()` 是结构化输出的关键——它会被转为 JSON Schema 的 `description` 字段，作为指令告诉 LLM 每个字段应该填什么内容。

### 4.3 generateObject()：AI SDK 的结构化输出方案

> 源码：[structured-output.ts](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/03-prompt_engineering/src/structured-output.ts)

`generateObject()` 是 AI SDK 实现结构化输出的核心 API，内部分三步完成：

```
Zod Schema ──→ JSON Schema ──→ LLM 约束生成 ──→ Zod 校验
```

**① Schema 转换**：AI SDK 将你的 Zod Schema 自动转为 JSON Schema 发给模型

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

**② 约束生成**：模型在 JSON Mode 下被约束为只能输出符合 Schema 的 JSON，而不是自由文本。

**③ 类型安全校验**：返回的 JSON 经 Zod `.parse()` 校验，`object` 自动获得完整 TypeScript 类型推断：

```typescript
const { object } = await generateObject({ model, schema, prompt: "..." });
object.title      // ✅ string — 有类型提示
object.sentiment  // ✅ "positive" | "negative" | "neutral" — 枚举类型
object.foo        // ❌ 编译报错 — 不存在的字段
```

### 4.4 四个实验详解

#### 实验1：提取文章结构化信息

定义一个复合 Schema，从一段新闻中提取标题、摘要、关键词、情感倾向和预估阅读时间：

```typescript
const ArticleInfoSchema = z.object({
  title: z.string().describe("文章标题"),
  summary: z.string().describe("文章摘要，不超过100字"),
  keywords: z.array(z.string()).describe("3-5个关键词"),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("文章整体情感倾向"),
  readingTimeMinutes: z.number().describe("预估阅读时间（分钟）"),
});

const article = `
近日，OpenAI 发布了 GPT-4o 模型的重大更新，带来了更快的响应速度和更低的使用成本。
新模型在多语言理解、代码生成和逻辑推理方面都有显著提升。
开发者社区对此反应热烈，纷纷表示这将大大降低 AI 应用的开发门槛。
不过也有部分研究者担忧，模型能力的快速提升可能带来安全和伦理方面的挑战。
业内人士预计，这一更新将加速 AI 在教育、医疗和金融等领域的落地应用。
`.trim();

const { object } = await generateObject({
  model,
  schema: ArticleInfoSchema,
  prompt: `请分析以下文章，提取结构化信息：\n\n${article}`,
});
```

输出示例：

```json
{
  "title": "OpenAI 发布 GPT-4o 重大更新",
  "summary": "OpenAI发布GPT-4o更新，提升响应速度和降低成本，在多语言、代码生成等方面显著进步...",
  "keywords": ["OpenAI", "GPT-4o", "AI应用", "大语言模型", "开发者"],
  "sentiment": "positive",
  "readingTimeMinutes": 2
}
```

每个字段都**严格符合 Schema 定义**——`sentiment` 一定是三个枚举值之一，`keywords` 一定是字符串数组，`readingTimeMinutes` 一定是数字。这在传统的 `generateText + JSON.parse` 方式中是无法保证的。

#### 实验2：生成结构化商品数据

用嵌套数组 Schema 让 AI 生成结构化商品列表：

```typescript
const ProductSchema = z.object({
  name: z.string().describe("商品名称"),
  description: z.string().describe("商品描述，50字以内"),
  price: z.number().describe("价格（元）"),
  category: z.enum(["electronics", "clothing", "food", "books", "other"]).describe("商品分类"),
  tags: z.array(z.string()).describe("商品标签"),
  inStock: z.boolean().describe("是否有库存"),
});

const { object } = await generateObject({
  model,
  schema: z.object({
    products: z.array(ProductSchema).describe("商品列表"),
  }),
  prompt: "请生成3个虚构的科技类商品信息，包含不同价位段（100元以下、100-1000元、1000元以上）。",
});
```

运行效果：

```
📦 生成的商品列表:

  📱 智能LED台灯
     描述: 支持色温调节和定时关灯，护眼无频闪
     价格: ¥89
     分类: electronics
     标签: 智能家居, LED, 护眼
     库存: ✅ 有

  📱 无线降噪耳机 Pro
     描述: 40dB主动降噪，蓝牙5.3，续航30小时
     价格: ¥599
     分类: electronics
     标签: 耳机, 降噪, 蓝牙
     库存: ✅ 有

  📱 便携式4K投影仪
     描述: 支持4K解码，自动对焦，内置音箱
     价格: ¥3299
     分类: electronics
     标签: 投影仪, 4K, 便携
     库存: ❌ 无
```

> 💡 注意嵌套结构：`z.object({ products: z.array(ProductSchema) })`，AI 会自动生成一个包含数组的 JSON 对象。`price` 一定是数字类型、`inStock` 一定是布尔值——不用再写 `parseInt()` 或 `=== "true"` 了。

#### 实验3：批量情感分析

`z.enum()` 非常适合分类任务，可以确保 AI 只输出预定义的类别，结合 `z.number().min(0).max(1)` 约束置信度范围：

```typescript
const SentimentSchema = z.object({
  text: z.string().describe("原始文本"),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("情感分类"),
  confidence: z.number().min(0).max(1).describe("置信度 0-1"),
  reason: z.string().describe("判断依据，一句话解释"),
});

const texts = [
  "这款产品太棒了，完全超出我的期望！强烈推荐给大家！",
  "发货速度很慢，客服态度也很差，再也不会买了。",
  "产品质量一般，价格还行，中规中矩吧。",
  "今天天气不错，适合出去走走。",
];

for (const text of texts) {
  const { object } = await generateObject({
    model,
    schema: SentimentSchema,
    prompt: `请对以下文本进行情感分析：\n"${text}"`,
  });
  // object.sentiment 一定是 "positive" | "negative" | "neutral"
  // object.confidence 一定在 0~1 之间
}
```

对四段文本做批量分析，输出整齐的表格：

```
🎭 情感分析结果:

  文本                                  情感        置信度   依据
  ────────────────────────────────────  ─────────   ──────   ────────────────────────
  这款产品太棒了，完全超出我的期望！…   😊 积极     0.95     强烈正面评价词汇…
  发货速度很慢，客服态度也很差…         😞 消极     0.92     包含多个负面评价…
  产品质量一般，价格还行…               😐 中性     0.75     正面和负面评价各半…
  今天天气不错，适合出去走走。           😊 积极     0.70     表达了愉快的心情…
```

#### 实验4：generateObject vs generateText + JSON.parse

同一个任务，分别用两种方式实现，直观对比差异：

**方法 A：generateObject（推荐）**

```typescript
const schema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(0).max(1),
});

const { object } = await generateObject({ model, schema, prompt: testPrompt });
console.log(object);
// { sentiment: "neutral", score: 0.6 }
// ✅ 类型安全：sentiment 是枚举类型，score 是 number
```

**方法 B：generateText + JSON.parse（传统方式）**

```typescript
const { text } = await generateText({
  model,
  prompt: testPrompt + "\n\n注意：只返回 JSON，不要返回其他内容。",
  maxOutputTokens: 200,
});
console.log(text);
// 可能是：```json\n{"sentiment":"neutral","score":0.6}\n```
// 也可能是：好的，以下是分析结果：{"sentiment":"neutral","score":0.6}

// 需要正则提取 + 手动解析
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  const parsed = JSON.parse(jsonMatch[0]); // 类型是 any
  // ❌ 无法保证 sentiment 是枚举值，score 是数字且在 0-1 之间
}
```

**对比总结：**

| 维度 | `generateObject` | `generateText` + `JSON.parse` |
|------|-------------------|-------------------------------|
| 类型安全 | ✅ Zod 自动校验 + TypeScript 推断 | ❌ 返回 `any`，需手动校验 |
| 输出可靠性 | ✅ 始终符合 Schema | ⚠️ 可能包含 ` ```json ` 包裹、多余文字 |
| 错误处理 | ✅ SDK 内置重试机制 | ❌ 需自行 try-catch 和重试 |
| 开发体验 | ✅ 写 Schema 就有类型提示 | ❌ 全靠手动 |
| 灵活性 | ⚠️ 需提前定义 Schema | ✅ 自由格式 |
| 适用场景 | API 数据提取、分类任务、表单填充 | 自由格式文本、不确定结构的输出 |

> 🎯 **结论**：需要结构化数据时，优先用 `generateObject()`。只有输出格式完全不确定时，才退回到 `generateText()`。



## 五、思维链（Chain-of-Thought）

### 5.1 什么是 CoT

你有没有遇到过这种情况——让 AI 做一道数学题，它瞬间给出答案，但答案是错的？

这就像考试时"秒答"的同学：看到题目直接写答案，不打草稿。有时候能对，但遇到复杂问题就翻车。

**思维链（Chain-of-Thought，CoT）的核心思想**：不要让 AI 直接给答案，而是要求它"展示推理过程"——一步一步地思考，就像要求学生必须写解题步骤一样。

原理也很直观：AI 是"文字接龙"，它在生成中间推理步骤时，能利用前面已经输出的上下文来修正后续推理。如果直接蹦答案，就没有这个自我修正的机会。

### 5.2 三种策略对比

> 源码：[cot-demo.ts](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/03-prompt_engineering/src/cot-demo.ts)

我们用三道经典数学题来对比三种 Prompt 策略：

| 策略 | Prompt 特点 | 类比 |
|------|-----------|------|
| **Zero-shot** | 直接提问，不给任何提示 | 裸考，直觉作答 |
| **Few-shot** | 先给 2-3 个解题示例，再提问 | 参考例题后作答 |
| **CoT** | 要求"一步步思考" | 必须写完整解题步骤 |

对应的 Prompt 构建代码：

#### Zero-shot —— 直接提问

```typescript
case "zero-shot":
  return `${problem.question}\n\n请直接给出答案。`;
```

简单粗暴，给题目就要答案。

#### Few-shot —— 先给示例再出题

```typescript
case "few-shot":
  return `以下是一些数学题的例子：

【示例1】
问题：小明有12个苹果，给了小红5个，又买了3个，小明现在有几个苹果？
答案：12 - 5 + 3 = 10个苹果。

【示例2】
问题：一根绳子长16米，第一次剪去一半，第二次剪去剩下的一半，绳子还剩多少米？
答案：第一次剪后剩 16÷2=8 米，第二次剪后剩 8÷2=4 米。

现在请解答：
${problem.question}`;
```

通过 2 个示例让 AI 学会"解题套路"——先列算式，再给答案。

#### CoT —— 要求逐步推理

```typescript
case "cot":
  return `${problem.question}

请一步一步地思考这个问题：
1. 首先理解题目中的条件
2. 建立数学关系或方程
3. 逐步求解
4. 验证答案是否正确

请展示你的完整推理过程，最后给出明确答案。`;
```

**关键指令**："请一步一步地思考"——这句话看似简单，却能显著激活模型的推理能力。

### 5.3 测试题目

三道精心设计的题目，难度递增：

```typescript
const PROBLEMS: Problem[] = [
  {
    id: 1,
    question: "一个商店进了一批苹果，第一天卖了总数的一半多2个，第二天卖了剩下的一半多1个，第三天还剩5个。这批苹果一共有多少个？",
    correctAnswer: "28",
    answerCheck: (answer) => answer.includes("28"),
  },
  {
    id: 2,
    question: "农场里有鸡和兔子共35只，数一数共有94只脚。鸡有多少只？兔子有多少只？",
    correctAnswer: "鸡23只，兔12只",
    answerCheck: (answer) => answer.includes("23") && answer.includes("12"),
  },
  {
    id: 3,
    question: "一列火车通过一座长200米的桥用了30秒，以同样的速度通过一座长500米的桥用了45秒。火车的速度是多少米/秒？火车的长度是多少米？",
    correctAnswer: "速度20米/秒，长度400米",
    answerCheck: (answer) => answer.includes("20") && answer.includes("400"),
  },
];
```

| 题目 | 类型 | 正确答案 | 难点 |
|------|------|----------|------|
| 题1：苹果分三天卖 | 逆向推理 | 28个 | 需要从最后一天倒推 |
| 题2：鸡兔同笼 | 二元一次方程 | 鸡23只，兔12只 | 需要建立方程组 |
| 题3：火车过桥 | 行程问题 | 速度20米/秒，长度400米 | 需要理解"火车+桥"的距离关系 |

程序会自动检查答案中是否包含正确数值（`answerCheck`），并记录输出的 Token 数量用于成本对比。

### 5.4 运行效果

```bash
npm run cot-demo
```

```
🧠 cot-demo.ts — 思维链（Chain-of-Thought）对比实验

使用 Provider: deepseek

============================================================
📝 题目 1: 一个商店进了一批苹果，第一天卖了总数的一半多2个...
   正确答案: 28
============================================================

  🔹 策略: zero-shot
     ❌ 答案: 这批苹果一共有24个。

  🔹 策略: few-shot
     ✅ 答案: 第三天还剩5个，第二天卖前有(5+1)×2=12个，
              第一天卖前有(12+2)×2=28个。答案是28个。

  🔹 策略: cot
     ✅ 答案:
     1. 理解条件：第三天剩5个...
     2. 逆推第二天：卖了剩下的一半多1个后剩5个，
        即 x/2 - 1 = 5, x = 12
     3. 逆推第一天：卖了总数的一半多2个后剩12个，
        即 y/2 - 2 = 12, y = 28
     4. 验证：28→28/2-2=12→12/2-1=5 ✓
     答案是28个。
```

最终的对比汇总表格：

```
📊 对比结果汇总

  题目     策略        是否正确   Token数   答案摘要
  ──────   ─────────   ────────   ───────   ────────────────────────────
  题目1    zero-shot   ❌ 错误    85        这批苹果一共有24个…
  题目1    few-shot    ✅ 正确    156       第三天还剩5个，第二天卖了…
  题目1    cot         ✅ 正确    342       让我一步步分析：设总数为x…
  ──────   ─────────   ────────   ───────   ────────────────────────────
  题目2    zero-shot   ✅ 正确    102       鸡23只，兔12只…
  题目2    few-shot    ✅ 正确    267       设鸡x只，兔y只…
  题目2    cot         ✅ 正确    398       1. 理解条件：共35只，94只脚…
  ──────   ─────────   ────────   ───────   ────────────────────────────
  题目3    zero-shot   ❌ 错误    115       速度10米/秒，长度100米…
  题目3    few-shot    ❌ 错误    289       速度15米/秒…
  题目3    cot         ✅ 正确    456       设火车长度L，速度v…

📈 正确率统计:
  zero-shot    █░░ 1/3 (33%)
  few-shot     ██░ 2/3 (67%)
  cot          ███ 3/3 (100%)
```

> ⚠️ 实际结果会因模型和运行时机不同而有差异，而且随着如今模型能力的增强，可能这几个问题已经难不倒先进的LLM，但趋势是一致的：**CoT 在复杂推理任务上的准确率显著高于 Zero-shot 和 Few-shot。**

### 5.5 核心洞察

从实验数据可以看出四个关键结论：

```
💡 核心洞察:
  1. Zero-shot 适合简单任务，复杂推理容易出错
  2. Few-shot 通过示例帮助模型理解解题模式
  3. CoT 通过逐步推理显著提升复杂问题的准确率
  4. CoT 的输出更长（更多 Token），但可靠性更高
```

**CoT 的代价**是输出更多 Token（= 更多费用 + 更长响应时间），所以要根据任务复杂度选择合适的策略：

| 任务类型 | 推荐策略 | 原因 |
|---------|---------|------|
| 简单事实问答 | Zero-shot | 没必要"想半天" |
| 格式固定的任务（翻译、摘要、分类） | Few-shot | 示例比推理更有用 |
| 复杂推理（数学、逻辑、多步决策） | CoT | 需要"展示思考过程"才能保证准确 |

### 5.6 CoT 的进阶变体（扩展阅读）

Chain-of-Thought 只是推理增强的起点，还有更高级的变体：

- **Self-Consistency**：同一问题让 AI 回答多次，取多数投票的结果（牺牲成本换准确率）
- **Tree-of-Thought (ToT)**：树状搜索多条推理路径，选最优的
- **ReAct**：推理 + 行动交替执行（结合前文学过的 Function Calling，让 AI 边想边做），后面章节会涉及



## 六、本期回顾

我们从四个维度提升了 Prompt Engineering 的工程化水平：

| 模块 | 核心收获 | 关键 API / 工具 |
|------|---------|-----------------|
| 多模型适配器 | 一套代码支持 DeepSeek / OpenAI / Anthropic | `getModel()`, `chatWithModel()`, `getDefaultProvider()` |
| Prompt 模板引擎 | 可复用、有校验的 Prompt 管理 | `PromptTemplate`, `ChatPromptTemplate` |
| 结构化输出 | AI 返回强类型 JSON，告别手动解析 | `generateObject()` + Zod Schema |
| 思维链 CoT | 复杂推理准确率从 33% 提升到 100% | "请一步步思考" 指令 |

**一句话总结**：Prompt Engineering 不只是"写 Prompt 的技巧"，更是一套将 AI 能力工程化落地的方法论。

在实际项目中，这四个技术通常组合使用：

```typescript
// 组合使用示例：适配器 + 模板 + 结构化输出
const analysisTemplate = new ChatPromptTemplate([
  { role: "system", template: "你是{{domain}}领域的分析专家。请一步步分析后给出结论。" },
  { role: "user", template: "请分析：{{content}}" },
]);

const messages = analysisTemplate.format({ domain: "金融", content: "某公司Q3财报..." });
const { object } = await generateObject({
  model: getModel(getDefaultProvider()),  // 自动选择可用模型
  schema: AnalysisResultSchema,           // Zod 保证输出格式
  messages,                               // 模板生成的消息
});
```



## 七、参考资料

**官方文档：**

- [Vercel AI SDK — generateObject](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data)
- [Zod 官方文档](https://zod.dev/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/zh)
- [DeepSeek API 文档](https://platform.deepseek.com)
