/**
 * output-parser.ts — Output Parser 结构化输出
 *
 * LangChain 的 Output Parser 负责将 LLM 的文本输出解析为结构化数据。
 * 配合 Prompt 中的 format_instructions，实现可靠的结构化输出。
 *
 * 核心知识点：
 * - StringOutputParser — 最基础，提取纯文本
 * - CommaSeparatedListOutputParser — 返回 string[]
 * - StructuredOutputParser + Zod — 复杂结构化输出
 * - 完整 LCEL 链：prompt(含 format_instructions) → model → parser
 *
 * 运行: npm run output-parser
 */

import "dotenv/config";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { CommaSeparatedListOutputParser } from "@langchain/core/output_parsers";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { createChatModel } from "./model-chat.js";

async function main() {
  console.log("📋 output-parser.ts — Output Parser 结构化输出 Demo\n");

  const model = createChatModel({ temperature: 0 });

  // --- Demo 1: StringOutputParser ---
  console.log("=".repeat(60));
  console.log("📌 Demo 1: StringOutputParser — 最基础的文本提取\n");

  const stringParser = new StringOutputParser();

  const prompt1 = ChatPromptTemplate.fromMessages([
    ["human", "用一句话解释什么是 {concept}"],
  ]);

  const chain1 = prompt1.pipe(model).pipe(stringParser);
  const result1 = await chain1.invoke({ concept: "向量数据库" });
  console.log("结果:", result1);
  console.log("类型:", typeof result1); // string
  console.log();

  // --- Demo 2: CommaSeparatedListOutputParser ---
  console.log("=".repeat(60));
  console.log("📌 Demo 2: CommaSeparatedListOutputParser — 返回 string[]\n");

  const listParser = new CommaSeparatedListOutputParser();

  // ────────────────────────────────────────────────────────
  // 🔑 getFormatInstructions() 是什么？
  //
  // LLM 不知道你希望它用什么格式输出，所以需要在 Prompt 里"告诉"它。
  // getFormatInstructions() 会自动生成一段格式说明文本，注入到 Prompt 中。
  //
  // 比如 CommaSeparatedListOutputParser 生成的内容大致是：
  //   "Your response should be a list of comma separated values, eg: `foo, bar, baz`"
  //
  // 完整流程：
  //   1. getFormatInstructions() → 生成格式说明文本
  //   2. 文本被注入到 Prompt 的 {format_instructions} 变量中
  //   3. LLM 看到指令后，按要求输出 "ChromaDB, Pinecone, Qdrant, Milvus, FAISS"
  //   4. listParser.parse() 按逗号切分 → ["ChromaDB", "Pinecone", "Qdrant", ...]
  //
  // 这样你拿到的就是 string[]，而不是需要自己解析的自由文本。
  // ────────────────────────────────────────────────────────

  const prompt2 = ChatPromptTemplate.fromMessages([
    [
      "human",
      "列出 5 个常用的向量数据库名称。\n{format_instructions}",
      // ← {format_instructions} 会被替换为上面说的格式说明文本
    ],
  ]);

  const chain2 = prompt2.pipe(model).pipe(listParser);
  const result2 = await chain2.invoke({
    format_instructions: listParser.getFormatInstructions(),
    // ← 这里把格式说明注入到 Prompt 变量中
  });
  console.log("结果:", result2);
  console.log("类型:", Array.isArray(result2) ? "Array" : typeof result2);
  console.log("第一个:", result2[0]);
  console.log();

  // --- Demo 3: StructuredOutputParser + Zod ---
  console.log("=".repeat(60));
  console.log("📌 Demo 3: StructuredOutputParser + Zod Schema\n");

  const structuredParser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("技术名称"),
      category: z.string().describe("所属类别（如：框架、数据库、协议等）"),
      description: z.string().describe("一句话描述"),
      pros: z.array(z.string()).describe("优点列表（2-3个）"),
      difficulty: z.enum(["简单", "中等", "困难"]).describe("学习难度"),
    })
  );

  console.log("format_instructions 预览:");
  console.log(structuredParser.getFormatInstructions().slice(0, 200) + "...\n");

  const prompt3 = ChatPromptTemplate.fromMessages([
    [
      "human",
      "请分析以下技术：{tech}\n\n{format_instructions}",
    ],
  ]);

  const chain3 = prompt3.pipe(model).pipe(structuredParser);
  const result3 = await chain3.invoke({
    tech: "LangChain",
    format_instructions: structuredParser.getFormatInstructions(),
  });
  console.log("结构化结果:");
  console.log(JSON.stringify(result3, null, 2));
  console.log("类型:", typeof result3); // object
  console.log("访问字段 result.name:", result3.name);
  console.log("访问字段 result.pros:", result3.pros);
  console.log();

  // --- Demo 4: 完整 LCEL 链实战 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 4: 完整 LCEL 链 — 批量技术分析\n");

  const techs = ["ChromaDB", "RAG"];
  for (const tech of techs) {
    console.log(`--- 分析: ${tech} ---`);
    const result = await chain3.invoke({
      tech,
      format_instructions: structuredParser.getFormatInstructions(),
    });
    console.log(`  名称: ${result.name}`);
    console.log(`  类别: ${result.category}`);
    console.log(`  描述: ${result.description}`);
    console.log(`  难度: ${result.difficulty}`);
    console.log(`  优点: ${result.pros.join("、")}`);
    console.log();
  }

  console.log("=".repeat(60));
  console.log("✅ Output Parser Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("output-parser.ts");

if (isMainModule) {
  main().catch(console.error);
}
