/**
 * prompt-lcel.ts — Prompt Template + LCEL 链式调用
 *
 * LCEL（LangChain Expression Language）是 LangChain 的核心编程范式，
 * 通过 pipe() 将 Prompt → Model → Parser 串联成可组合的链。
 *
 * 核心知识点：
 * - ChatPromptTemplate 模板创建与变量插值
 * - pipe() 管道链式调用（Prompt → Model → Parser）
 * - RunnableSequence 显式组合
 * - RunnablePassthrough / RunnableLambda 数据变换
 * - batch() 批量调用 + stream() 流式调用
 *
 * 运行: npm run prompt-lcel
 */

import "dotenv/config";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableSequence,
  RunnablePassthrough,
  RunnableLambda,
} from "@langchain/core/runnables";
import { createChatModel } from "./model-chat.js";

async function main() {
  console.log("🔗 prompt-lcel.ts — Prompt Template + LCEL 链式调用 Demo\n");

  const model = createChatModel();
  const parser = new StringOutputParser();

  // --- Demo 1: ChatPromptTemplate 模板创建 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 1: ChatPromptTemplate 模板创建与变量插值\n");

  const prompt1 = ChatPromptTemplate.fromMessages([
    ["system", "你是一位{role}，用简洁的中文回答问题。"],
    ["human", "{question}"],
  ]);

  // 格式化查看模板结果
  const formatted = await prompt1.formatMessages({
    role: "AI 技术专家",
    question: "什么是 LCEL？",
  });
  console.log("模板格式化结果:");
  for (const msg of formatted) {
    console.log(`  [${msg._getType()}]: ${msg.content}`);
  }
  console.log();

  // --- Demo 2: LCEL 管道 prompt.pipe(model).pipe(parser) ---
  console.log("=".repeat(60));
  console.log("📌 Demo 2: LCEL 管道 — prompt → model → parser\n");

  const chain2 = prompt1.pipe(model).pipe(parser);

  const result2 = await chain2.invoke({
    role: "LangChain 专家",
    question: "用一句话解释 LCEL（LangChain Expression Language）是什么",
  });
  console.log("回复:", result2);
  console.log();

  // --- Demo 3: RunnableSequence 显式组合 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 3: RunnableSequence 显式组合\n");

  const prompt3 = ChatPromptTemplate.fromMessages([
    ["system", "你是一位翻译专家。"],
    ["human", "将以下中文翻译成英文：{text}"],
  ]);

  const chain3 = RunnableSequence.from([prompt3, model, parser]);

  const result3 = await chain3.invoke({
    text: "LangChain 是一个用于构建 LLM 应用的开源框架",
  });
  console.log("翻译结果:", result3);
  console.log();

  // --- Demo 4: RunnablePassthrough + RunnableLambda 数据变换 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 4: RunnablePassthrough + RunnableLambda 数据变换\n");

  // ────────────────────────────────────────────────────────
  // 🔑 核心问题：LCEL 链中，上一步的输出格式和下一步的输入格式不匹配怎么办？
  //
  // 比如用户传入 { topic: "RAG" }，但 Prompt 模板需要 { concept, analogy } 两个字段。
  // 这时需要在链中间插入一个"数据变换"环节。
  //
  // LangChain 提供两个工具：
  //
  //   RunnableLambda  — 自定义变换函数，输入什么、输出什么完全由你决定
  //                     类似 Array.map()，对数据做任意映射
  //
  //   RunnablePassthrough — 把输入原样透传到输出，同时可以用 .assign() 附加新字段
  //                          类似 { ...input, newField: computed }
  // ────────────────────────────────────────────────────────

  const prompt4 = ChatPromptTemplate.fromMessages([
    ["system", "你是一位技术导师，善于用类比解释概念。"],
    ["human", "请用「{analogy}」的类比来解释「{concept}」"],
    // ← 模板需要两个变量：concept 和 analogy
  ]);

  // --- 4a: RunnableLambda — 自定义数据映射 ---
  //
  // 场景：用户只传了 { topic }，但 Prompt 需要 { concept, analogy }
  // 用 RunnableLambda 做格式转换：
  //   { topic: "RAG 检索增强生成" }  →  { concept: "RAG 检索增强生成", analogy: "烹饪做菜" }
  //
  console.log("--- RunnableLambda 数据映射 ---\n");

  const preprocessor = new RunnableLambda({
    func: (input: { topic: string }) => ({
      concept: input.topic,        // 从 topic 映射到 concept
      analogy: "烹饪做菜",          // 补充一个固定值
    }),
  });

  // 完整链：preprocessor 把数据格式转换好 → 再交给 prompt → model → parser
  //
  // 数据流：
  //   { topic: "RAG 检索增强生成" }
  //       ↓ RunnableLambda
  //   { concept: "RAG 检索增强生成", analogy: "烹饪做菜" }
  //       ↓ ChatPromptTemplate
  //   [SystemMessage("你是一位技术导师..."), HumanMessage("请用「烹饪做菜」的类比来解释「RAG 检索增强生成」")]
  //       ↓ Model → Parser
  //   "RAG 就像做菜..."
  //
  const chain4 = preprocessor.pipe(prompt4).pipe(model).pipe(parser);

  const result4 = await chain4.invoke({ topic: "RAG 检索增强生成" });
  console.log("回复:", result4);
  console.log();

  // --- 4b: RunnablePassthrough.assign() — 透传原始字段 + 附加新字段 ---
  //
  // 场景：想保留原始输入的所有字段，同时计算并添加新字段
  // 类似 JS 的展开运算符：{ ...input, newField: someValue }
  //
  //   输入: { text: "hello langchain" }
  //       ↓ RunnablePassthrough.assign({ uppercased: ... })
  //   输出: { text: "hello langchain", uppercased: "HELLO LANGCHAIN" }
  //                 ↑ 原样保留            ↑ 新增字段
  //
  console.log("--- RunnablePassthrough.assign() 透传 + 附加 ---\n");

  const passthrough = RunnablePassthrough.assign({
    // assign 里的每个 key 都是一个 Runnable，接收原始输入，输出作为新字段
    uppercased: new RunnableLambda({
      func: (input: { text: string }) => input.text.toUpperCase(),
    }),
  });

  const passResult = await passthrough.invoke({ text: "hello langchain" });
  console.log("输入:  { text: \"hello langchain\" }");
  console.log("输出:", passResult);
  console.log("（原始 text 保留，新增 uppercased 字段）");
  console.log();

  // --- Demo 5: batch() 批量 + stream() 流式 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 5: batch() 批量 + stream() 流式\n");

  const prompt5 = ChatPromptTemplate.fromMessages([
    ["human", "用一个 emoji 表示「{word}」，只回复 emoji"],
  ]);
  const chain5 = prompt5.pipe(model).pipe(parser);

  // batch 批量
  console.log("--- batch() 批量调用 ---");
  const batchResults = await chain5.batch([
    { word: "太阳" },
    { word: "月亮" },
    { word: "星星" },
  ]);
  console.log("批量结果:", batchResults);
  console.log();

  // stream 流式
  console.log("--- stream() 流式调用 ---");
  const streamChain = prompt1.pipe(model).pipe(parser);
  const stream = await streamChain.stream({
    role: "诗人",
    question: "写一首关于编程的五言绝句",
  });

  process.stdout.write("流式回复: ");
  for await (const chunk of stream) {
    process.stdout.write(chunk);
  }
  console.log();

  console.log("\n" + "=".repeat(60));
  console.log("✅ Prompt + LCEL Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("prompt-lcel.ts");

if (isMainModule) {
  main().catch(console.error);
}
