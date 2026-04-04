/**
 * prompt-templates.ts — Prompt 模板引擎
 *
 * 核心功能：
 * 1. PromptTemplate — 支持 {{variable}} 变量插值的模板类
 * 2. ChatPromptTemplate — 组合 system + user 消息模板
 * 3. 预置实用模板：翻译器、代码审查、摘要生成
 *
 * 运行: npm run prompt-templates
 */

import "dotenv/config";
import { generateText, type ModelMessage } from "ai";
import { getModel, getDefaultProvider, type Provider } from "./model-adapter.js";

// ============================================================
// 1. PromptTemplate — 基础模板类
// ============================================================

export class PromptTemplate {
  constructor(
    public readonly template: string,
    public readonly inputVariables: string[]
  ) {
    // 校验模板中的变量是否与声明一致
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

// ============================================================
// 2. ChatPromptTemplate — 消息级别模板
// ============================================================

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

  /** 填充所有消息模板，返回 CoreMessage 数组 */
  format(values: Record<string, string>): ModelMessage[] {
    return this.messageTemplates.map((t) => ({
      role: t.role,
      content: t.template.format(values),
    }));
  }
}

// ============================================================
// 3. 预置实用模板
// ============================================================

/** 翻译器模板 */
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

/** 代码审查模板 */
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

/** 摘要生成模板 */
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

// ============================================================
// 4. Demo 入口
// ============================================================

async function main() {
  console.log("📝 prompt-templates.ts — Prompt 模板引擎 Demo\n");

  const provider: Provider = getDefaultProvider();
  const model = getModel(provider);
  console.log(`使用 Provider: ${provider}\n`);

  // --- Demo 1: 基础模板插值 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 基础 PromptTemplate 变量插值");
  console.log("=".repeat(60));

  const simpleTemplate = PromptTemplate.fromTemplate(
    "请用{{style}}的语气，介绍{{topic}}，控制在50字以内。"
  );
  console.log(`模板变量: ${simpleTemplate.inputVariables.join(", ")}`);

  const prompt1 = simpleTemplate.format({
    style: "幽默",
    topic: "TypeScript 的类型系统",
  });
  console.log(`生成的 Prompt: ${prompt1}\n`);

  const result1 = await generateText({
    model,
    prompt: prompt1,
    maxOutputTokens: 200,
  });
  console.log(`🤖 回答: ${result1.text.trim()}\n`);

  // --- Demo 2: 翻译器模板 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 2: ChatPromptTemplate — 翻译器");
  console.log("=".repeat(60));

  const translatorMessages = translatorTemplate.format({
    targetLang: "英语",
    text: "大语言模型正在改变我们与计算机交互的方式，Prompt 工程是释放其潜力的关键技能。",
  });

  console.log("生成的消息:");
  for (const msg of translatorMessages) {
    console.log(`  [${msg.role}] ${(msg.content as string).substring(0, 60)}...`);
  }
  console.log();

  const result2 = await generateText({
    model,
    messages: translatorMessages,
    maxOutputTokens: 200,
  });
  console.log(`🤖 翻译结果: ${result2.text.trim()}\n`);

  // --- Demo 3: 代码审查模板 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 3: ChatPromptTemplate — 代码审查");
  console.log("=".repeat(60));

  const codeReviewMessages = codeReviewTemplate.format({
    language: "TypeScript",
    code: `function getUser(id: any) {
  const users = JSON.parse(localStorage.getItem("users"));
  return users.filter((u: any) => u.id == id)[0];
}`,
  });

  const result3 = await generateText({
    model,
    messages: codeReviewMessages,
    maxOutputTokens: 500,
  });
  console.log(`🤖 审查结果:\n${result3.text.trim()}\n`);

  // --- Demo 4: 摘要生成模板 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 4: ChatPromptTemplate — 摘要生成");
  console.log("=".repeat(60));

  const summaryMessages = summaryTemplate.format({
    style: "技术博客",
    maxLength: "100",
    text: `Prompt Engineering（提示工程）是指设计和优化输入给大型语言模型的提示文本的技术。
通过精心设计 Prompt，可以显著提高模型输出的质量和准确性。
常见的技术包括：零样本提示（Zero-shot）、少样本提示（Few-shot）、思维链（Chain-of-Thought）等。
零样本提示直接向模型提问；少样本提示通过提供示例来引导模型；
思维链则要求模型逐步推理，从而提高复杂问题的解决能力。
此外，结构化输出技术可以让模型按照指定的 JSON Schema 输出，便于程序处理。`,
  });

  const result4 = await generateText({
    model,
    messages: summaryMessages,
    maxOutputTokens: 300,
  });
  console.log(`🤖 摘要:\n${result4.text.trim()}\n`);

  console.log("=".repeat(60));
  console.log("✅ Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("prompt-templates.ts");

if (isMainModule) {
  main().catch(console.error);
}
