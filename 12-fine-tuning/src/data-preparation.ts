/**
 * data-preparation.ts — 微调训练数据准备
 *
 * 本文件演示 Fine-tuning 数据准备的完整流程：
 * - 训练数据格式介绍（OpenAI JSONL、Alpaca、ShareGPT）
 * - 原始文本 → 对话格式的自动转换
 * - 数据清洗：去重、长度过滤、质量筛选
 * - 数据集拆分（train/validation）
 * - 输出统计信息
 *
 * 无需 API Key 即可运行
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. 训练数据格式介绍
// ============================================================

/** OpenAI Fine-tuning JSONL 格式 */
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAITrainingExample {
  messages: OpenAIMessage[];
}

/** Alpaca 格式 */
interface AlpacaExample {
  instruction: string;
  input: string;
  output: string;
}

/** ShareGPT 格式 */
interface ShareGPTConversation {
  conversations: Array<{
    from: "system" | "human" | "gpt";
    value: string;
  }>;
}

function demonstrateFormats(): void {
  console.log("=".repeat(60));
  console.log("📋 1. 训练数据格式介绍");
  console.log("=".repeat(60));

  // OpenAI JSONL 格式
  console.log("\n📌 格式一：OpenAI JSONL（最常用，OpenAI Fine-tuning API 要求）");
  const openaiExample: OpenAITrainingExample = {
    messages: [
      { role: "system", content: "你是一个专业的 TypeScript 编程助手。" },
      { role: "user", content: "什么是泛型？" },
      {
        role: "assistant",
        content:
          "泛型（Generics）是 TypeScript 的核心特性之一，它允许你编写可复用的组件，同时保持类型安全。通过类型参数，函数或类可以适用于多种类型而非单一类型。",
      },
    ],
  };
  console.log("  示例:");
  console.log(`  ${JSON.stringify(openaiExample)}`);

  // Alpaca 格式
  console.log("\n📌 格式二：Alpaca（Stanford Alpaca 项目定义，开源微调常用）");
  const alpacaExample: AlpacaExample = {
    instruction: "解释 TypeScript 中的泛型概念",
    input: "",
    output:
      "泛型是 TypeScript 的核心特性之一，它允许编写可复用的组件，同时保持类型安全。",
  };
  console.log("  示例:");
  console.log(`  ${JSON.stringify(alpacaExample)}`);

  // ShareGPT 格式
  console.log("\n📌 格式三：ShareGPT（多轮对话，适合对话模型微调）");
  const sharegptExample: ShareGPTConversation = {
    conversations: [
      { from: "system", value: "你是一个专业的编程助手。" },
      { from: "human", value: "什么是泛型？" },
      { from: "gpt", value: "泛型允许编写可复用的类型安全组件。" },
      { from: "human", value: "能给个例子吗？" },
      {
        from: "gpt",
        value: "例如 function identity<T>(arg: T): T { return arg; }",
      },
    ],
  };
  console.log("  示例:");
  console.log(`  ${JSON.stringify(sharegptExample)}`);

  console.log("\n💡 格式选择建议:");
  console.log("  OpenAI API 微调 → 必须使用 OpenAI JSONL 格式");
  console.log("  LLaMA-Factory → 支持 Alpaca 和 ShareGPT 格式");
  console.log("  Unsloth → 支持多种格式，推荐 ShareGPT");
}

// ============================================================
// 2. 示例训练数据生成
// ============================================================

/** 生成示例训练数据 */
function generateSampleData(): OpenAITrainingExample[] {
  console.log("\n" + "=".repeat(60));
  console.log("📝 2. 生成示例训练数据");
  console.log("=".repeat(60));

  // 模拟一个"TypeScript 编程助手"的训练数据集
  const trainingData: OpenAITrainingExample[] = [
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "TypeScript 和 JavaScript 有什么区别？" },
        { role: "assistant", content: "TypeScript 是 JavaScript 的超集，主要区别：1）TypeScript 添加了静态类型系统，能在编译时发现类型错误；2）TypeScript 支持接口、枚举、泛型等高级类型特性；3）TypeScript 代码需要编译为 JavaScript 才能运行。TypeScript 完全兼容 JavaScript，任何合法的 JS 代码都是合法的 TS 代码。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "什么是 interface？" },
        { role: "assistant", content: "Interface（接口）是 TypeScript 中定义对象形状的方式。它描述了对象应该具有哪些属性和方法，以及它们的类型。接口支持继承（extends）、可选属性（?）和只读属性（readonly）。例如：interface User { name: string; age?: number; readonly id: string; }。接口在编译后会被完全擦除，不产生任何运行时代码。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "如何使用泛型？" },
        { role: "assistant", content: "泛型通过类型参数实现代码复用。基本语法：function identity<T>(arg: T): T { return arg; }。调用时可以显式指定类型 identity<string>('hello')，也可以让编译器自动推断。常见用法：1）泛型函数处理不同类型数据；2）泛型接口定义通用结构；3）泛型类实现类型安全的容器；4）泛型约束 <T extends HasLength> 限制类型范围。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "enum 和 const enum 有什么区别？" },
        { role: "assistant", content: "enum（枚举）在编译后会生成一个 JavaScript 对象，支持反向映射（通过值获取键名）。const enum 在编译后会被完全内联，不生成对象，性能更好但不支持反向映射。例如：enum Direction { Up, Down } 编译后生成对象；const enum Direction { Up, Down } 编译后直接替换为数值 0、1。建议：如果不需要反向映射，优先使用 const enum。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "什么是类型守卫？" },
        { role: "assistant", content: "类型守卫（Type Guard）是 TypeScript 中缩小类型范围的技术。常见方式：1）typeof 守卫：if (typeof x === 'string')；2）instanceof 守卫：if (x instanceof Date)；3）in 守卫：if ('name' in obj)；4）自定义守卫：function isString(x: unknown): x is string { return typeof x === 'string'; }。类型守卫帮助 TypeScript 在条件分支中自动推断更精确的类型。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "解释 utility types" },
        { role: "assistant", content: "Utility Types 是 TypeScript 内置的类型工具。常用的有：Partial<T> 将所有属性变为可选；Required<T> 将所有属性变为必需；Pick<T, K> 从 T 中选取指定属性；Omit<T, K> 从 T 中排除指定属性；Record<K, V> 创建键值对类型；ReturnType<T> 获取函数返回类型；Parameters<T> 获取函数参数类型。这些工具类型基于映射类型和条件类型实现。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "async/await 怎么在 TypeScript 中使用？" },
        { role: "assistant", content: "TypeScript 中 async/await 用法与 JavaScript 相同，但可以添加返回类型注解。声明异步函数：async function fetchData(): Promise<string> { const res = await fetch(url); return res.text(); }。错误处理用 try/catch：try { const data = await fetchData(); } catch (error) { console.error(error); }。TypeScript 会自动推断 await 表达式的类型，确保类型安全。注意配置 tsconfig 的 target 为 ES2017+ 以获得原生支持。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "装饰器是什么？" },
        { role: "assistant", content: "装饰器（Decorator）是一种特殊的声明，可以附加到类、方法、属性或参数上。它是一个函数，在声明时被调用，接收被装饰的目标作为参数。例如：@log 类装饰器、@readonly 属性装饰器。TypeScript 5.0 开始支持 TC39 标准装饰器（Stage 3）。常见用途：日志记录、权限验证、依赖注入。使用需在 tsconfig 中启用 experimentalDecorators（旧版）或直接使用标准装饰器语法。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "模块系统怎么选择？" },
        { role: "assistant", content: "TypeScript 支持两种模块系统：1）CommonJS（require/module.exports）：Node.js 传统方案，同步加载；2）ESM（import/export）：现代标准，支持 Tree Shaking 和静态分析。推荐策略：新项目使用 ESM，package.json 设置 \"type\": \"module\"，tsconfig 设置 module: \"ESNext\"、moduleResolution: \"bundler\"。用 tsx 直接运行 TypeScript 文件，无需编译步骤。浏览器端项目通过 bundler（Vite/webpack）处理模块。" },
      ],
    },
    {
      messages: [
        { role: "system", content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。" },
        { role: "user", content: "如何处理 null 和 undefined？" },
        { role: "assistant", content: "TypeScript 提供多种处理 null/undefined 的方式：1）开启 strictNullChecks（推荐），让编译器检查空值；2）可选链 obj?.prop?.method()，安全访问可能为空的属性；3）空值合并 value ?? defaultValue，仅在 null/undefined 时使用默认值；4）非空断言 value!，告诉编译器值一定不为空（谨慎使用）；5）类型守卫 if (value !== null)，在分支中缩小类型。建议始终开启 strictNullChecks，优先使用可选链和空值合并。" },
      ],
    },
  ];

  console.log(`  ✅ 生成了 ${trainingData.length} 条训练数据`);
  return trainingData;
}

// ============================================================
// 3. 数据清洗
// ============================================================

interface CleaningStats {
  original: number;
  afterDedup: number;
  afterLengthFilter: number;
  afterQualityFilter: number;
}

function cleanData(data: OpenAITrainingExample[]): {
  cleaned: OpenAITrainingExample[];
  stats: CleaningStats;
} {
  console.log("\n" + "=".repeat(60));
  console.log("🧹 3. 数据清洗");
  console.log("=".repeat(60));

  const stats: CleaningStats = {
    original: data.length,
    afterDedup: 0,
    afterLengthFilter: 0,
    afterQualityFilter: 0,
  };

  // 3.1 去重（基于 user message 内容）
  console.log("\n📌 步骤 1: 去重");
  const seen = new Set<string>();
  let deduped = data.filter((example) => {
    const userMsg = example.messages.find((m) => m.role === "user")?.content || "";
    if (seen.has(userMsg)) return false;
    seen.add(userMsg);
    return true;
  });
  stats.afterDedup = deduped.length;
  console.log(`  原始: ${stats.original} → 去重后: ${stats.afterDedup}`);

  // 3.2 长度过滤
  console.log("\n📌 步骤 2: 长度过滤");
  const MIN_ASSISTANT_LENGTH = 20; // 助手回复不能太短
  const MAX_ASSISTANT_LENGTH = 2000; // 也不能太长
  let lengthFiltered = deduped.filter((example) => {
    const assistantMsg =
      example.messages.find((m) => m.role === "assistant")?.content || "";
    return (
      assistantMsg.length >= MIN_ASSISTANT_LENGTH &&
      assistantMsg.length <= MAX_ASSISTANT_LENGTH
    );
  });
  stats.afterLengthFilter = lengthFiltered.length;
  console.log(
    `  过滤条件: ${MIN_ASSISTANT_LENGTH} ≤ 助手回复长度 ≤ ${MAX_ASSISTANT_LENGTH}`
  );
  console.log(`  去重后: ${stats.afterDedup} → 长度过滤后: ${stats.afterLengthFilter}`);

  // 3.3 质量筛选（简单规则）
  console.log("\n📌 步骤 3: 质量筛选");
  let qualityFiltered = lengthFiltered.filter((example) => {
    const assistantMsg =
      example.messages.find((m) => m.role === "assistant")?.content || "";

    // 检查是否有实质内容（不是纯标点、空白）
    const contentRatio =
      assistantMsg.replace(/[\s\p{P}]/gu, "").length / assistantMsg.length;
    if (contentRatio < 0.3) return false;

    // 检查是否包含完整句子
    if (!assistantMsg.includes("。") && !assistantMsg.includes("；") && !assistantMsg.includes(".")) {
      return false;
    }

    return true;
  });
  stats.afterQualityFilter = qualityFiltered.length;
  console.log(`  长度过滤后: ${stats.afterLengthFilter} → 质量筛选后: ${stats.afterQualityFilter}`);

  console.log("\n📊 清洗统计:");
  console.log(`  原始数据: ${stats.original} 条`);
  console.log(`  去重移除: ${stats.original - stats.afterDedup} 条`);
  console.log(`  长度过滤: ${stats.afterDedup - stats.afterLengthFilter} 条`);
  console.log(`  质量筛选: ${stats.afterLengthFilter - stats.afterQualityFilter} 条`);
  console.log(`  最终保留: ${stats.afterQualityFilter} 条 (${((stats.afterQualityFilter / stats.original) * 100).toFixed(1)}%)`);

  return { cleaned: qualityFiltered, stats };
}

// ============================================================
// 4. 数据集拆分
// ============================================================

function splitDataset(
  data: OpenAITrainingExample[],
  validationRatio: number = 0.2
): { train: OpenAITrainingExample[]; validation: OpenAITrainingExample[] } {
  console.log("\n" + "=".repeat(60));
  console.log("✂️  4. 数据集拆分");
  console.log("=".repeat(60));

  // 随机打乱
  const shuffled = [...data].sort(() => Math.random() - 0.5);

  const splitIndex = Math.floor(shuffled.length * (1 - validationRatio));
  const train = shuffled.slice(0, splitIndex);
  const validation = shuffled.slice(splitIndex);

  console.log(`  总数据: ${data.length} 条`);
  console.log(`  拆分比例: ${((1 - validationRatio) * 100).toFixed(0)}% / ${(validationRatio * 100).toFixed(0)}%`);
  console.log(`  训练集: ${train.length} 条`);
  console.log(`  验证集: ${validation.length} 条`);

  return { train, validation };
}

// ============================================================
// 5. 统计分析
// ============================================================

function analyzeDataset(data: OpenAITrainingExample[], label: string): void {
  console.log(`\n📊 ${label} 统计分析:`);

  const assistantLengths = data.map(
    (d) => d.messages.find((m) => m.role === "assistant")?.content.length || 0
  );
  const userLengths = data.map(
    (d) => d.messages.find((m) => m.role === "user")?.content.length || 0
  );

  const avgAssistant =
    assistantLengths.reduce((a, b) => a + b, 0) / assistantLengths.length;
  const avgUser =
    userLengths.reduce((a, b) => a + b, 0) / userLengths.length;

  // 粗略估算 token 数（中文约 1 字符 ≈ 1.5 token）
  const totalChars = data.reduce(
    (sum, d) => sum + d.messages.reduce((s, m) => s + m.content.length, 0),
    0
  );
  const estimatedTokens = Math.round(totalChars * 1.5);

  console.log(`  样本数: ${data.length}`);
  console.log(`  用户消息平均长度: ${avgUser.toFixed(0)} 字符`);
  console.log(`  助手回复平均长度: ${avgAssistant.toFixed(0)} 字符`);
  console.log(`  助手回复最短: ${Math.min(...assistantLengths)} 字符`);
  console.log(`  助手回复最长: ${Math.max(...assistantLengths)} 字符`);
  console.log(`  总字符数: ${totalChars.toLocaleString()}`);
  console.log(`  预估 Token 数: ~${estimatedTokens.toLocaleString()}`);
  console.log(
    `  每轮对话: ${(data[0]?.messages.length || 0)} 条消息（含 system）`
  );
}

// ============================================================
// 6. 格式转换
// ============================================================

function convertFormats(data: OpenAITrainingExample[]): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 5. 格式转换");
  console.log("=".repeat(60));

  // OpenAI → Alpaca
  console.log("\n📌 OpenAI JSONL → Alpaca 格式:");
  const alpacaData: AlpacaExample[] = data.map((d) => ({
    instruction:
      d.messages.find((m) => m.role === "user")?.content || "",
    input: "",
    output:
      d.messages.find((m) => m.role === "assistant")?.content || "",
  }));
  console.log(`  转换完成: ${alpacaData.length} 条`);
  console.log(`  示例: ${JSON.stringify(alpacaData[0]).substring(0, 120)}...`);

  // OpenAI → ShareGPT
  console.log("\n📌 OpenAI JSONL → ShareGPT 格式:");
  const sharegptData: ShareGPTConversation[] = data.map((d) => ({
    conversations: d.messages.map((m) => ({
      from: m.role === "user" ? "human" as const : m.role === "assistant" ? "gpt" as const : "system" as const,
      value: m.content,
    })),
  }));
  console.log(`  转换完成: ${sharegptData.length} 条`);
  console.log(`  示例: ${JSON.stringify(sharegptData[0]).substring(0, 120)}...`);
}

// ============================================================
// 7. 保存到文件
// ============================================================

function saveToFiles(
  train: OpenAITrainingExample[],
  validation: OpenAITrainingExample[]
): void {
  console.log("\n" + "=".repeat(60));
  console.log("💾 6. 保存训练数据");
  console.log("=".repeat(60));

  const formattedDir = path.join(__dirname, "..", "data", "formatted");
  fs.mkdirSync(formattedDir, { recursive: true });

  // 保存 OpenAI JSONL 格式
  const trainPath = path.join(formattedDir, "train.jsonl");
  const valPath = path.join(formattedDir, "validation.jsonl");

  const trainContent = train.map((d) => JSON.stringify(d)).join("\n");
  const valContent = validation.map((d) => JSON.stringify(d)).join("\n");

  fs.writeFileSync(trainPath, trainContent, "utf-8");
  fs.writeFileSync(valPath, valContent, "utf-8");

  console.log(`  ✅ 训练集: ${trainPath} (${train.length} 条)`);
  console.log(`  ✅ 验证集: ${valPath} (${validation.length} 条)`);

  // 保存 Alpaca 格式
  const alpacaPath = path.join(formattedDir, "train_alpaca.json");
  const alpacaData = train.map((d) => ({
    instruction: d.messages.find((m) => m.role === "user")?.content || "",
    input: "",
    output: d.messages.find((m) => m.role === "assistant")?.content || "",
  }));
  fs.writeFileSync(alpacaPath, JSON.stringify(alpacaData, null, 2), "utf-8");
  console.log(`  ✅ Alpaca: ${alpacaPath}`);

  console.log("\n💡 使用方式:");
  console.log("  OpenAI Fine-tuning: 上传 train.jsonl 和 validation.jsonl");
  console.log("  LLaMA-Factory: 使用 train_alpaca.json");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 Fine-tuning 数据准备教程");
  console.log("本教程演示训练数据的准备流程，无需 API Key\n");

  // 1. 格式介绍
  demonstrateFormats();

  // 2. 生成示例数据
  const rawData = generateSampleData();

  // 3. 数据清洗
  const { cleaned } = cleanData(rawData);

  // 4. 数据集拆分
  const { train, validation } = splitDataset(cleaned);

  // 5. 统计分析
  analyzeDataset(train, "训练集");
  analyzeDataset(validation, "验证集");

  // 6. 格式转换
  convertFormats(cleaned);

  // 7. 保存文件
  saveToFiles(train, validation);

  console.log("\n" + "=".repeat(60));
  console.log("🎓 数据准备完成！");
  console.log("=".repeat(60));
  console.log("📚 下一步:");
  console.log("  npm run fine-tuning-api → 使用 OpenAI API 进行云端微调");
  console.log("  npm run lora-concepts   → 了解 LoRA/QLoRA 微调原理");
  console.log("  npm run evaluation      → 微调效果评估");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("data-preparation.ts");

if (isMainModule) {
  main().catch(console.error);
}

export {
  generateSampleData,
  cleanData,
  splitDataset,
  analyzeDataset,
  type OpenAITrainingExample,
  type AlpacaExample,
  type ShareGPTConversation,
};
