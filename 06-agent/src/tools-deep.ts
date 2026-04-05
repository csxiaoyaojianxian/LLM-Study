/**
 * tools-deep.ts — 工具进阶
 *
 * 深入工具定义的更多模式和实用技巧：
 * - Demo 1: 实用工具集（文件操作、时间、文本处理）
 * - Demo 2: 多工具编排 — 一个问题需要多次调用不同工具
 * - Demo 3: 工具错误处理 — Agent 如何从工具错误中恢复
 * - Demo 4: 结构化输出 + Agent — 让 Agent 最终输出符合 Zod Schema
 *
 * 运行: npm run tools-deep
 */

import "dotenv/config";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { createChatModel } from "./model-chat.js";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// 1. 实用工具集定义
// ============================================================

/** 读取文件内容（只读，安全） */
const readFileTool = tool(
  async ({ filePath }: { filePath: string }) => {
    try {
      // 限制只能读取当前项目目录下的文件
      const absolutePath = path.resolve(filePath);
      const projectRoot = path.resolve(".");
      if (!absolutePath.startsWith(projectRoot)) {
        return `❌ 安全限制：只能读取项目目录下的文件`;
      }
      const content = fs.readFileSync(absolutePath, "utf-8");
      // 截断过长内容
      if (content.length > 2000) {
        return content.substring(0, 2000) + "\n... (内容已截断，共 " + content.length + " 字符)";
      }
      return content;
    } catch (error) {
      return `❌ 读取文件失败: ${(error as Error).message}`;
    }
  },
  {
    name: "read_file",
    description: "读取指定文件的内容（仅限项目目录内的文件）",
    schema: z.object({
      filePath: z.string().describe("文件路径，如: package.json、src/model-chat.ts"),
    }),
  }
);

/** 列出目录下的文件 */
const listDirectoryTool = tool(
  async ({ dirPath }: { dirPath: string }) => {
    try {
      const absolutePath = path.resolve(dirPath || ".");
      const projectRoot = path.resolve(".");
      if (!absolutePath.startsWith(projectRoot)) {
        return `❌ 安全限制：只能列出项目目录下的内容`;
      }
      const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
      const result = entries
        .map((e) => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
        .join("\n");
      return result || "（空目录）";
    } catch (error) {
      return `❌ 列出目录失败: ${(error as Error).message}`;
    }
  },
  {
    name: "list_directory",
    description: "列出指定目录下的文件和文件夹",
    schema: z.object({
      dirPath: z.string().describe("目录路径，如: .、src/、../05-langchain"),
    }),
  }
);

/** 获取当前时间 */
const getCurrentTimeTool = tool(
  async ({}: Record<string, never>) => {
    const now = new Date();
    return `当前时间: ${now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}（北京时间）`;
  },
  {
    name: "get_current_time",
    description: "获取当前日期和时间",
    schema: z.object({}),
  }
);

/** 计算文本长度 */
const textLengthTool = tool(
  async ({ text }: { text: string }) => {
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const lineCount = text.split("\n").length;
    return `字符数: ${charCount}，单词/词语数: ${wordCount}，行数: ${lineCount}`;
  },
  {
    name: "text_length",
    description: "计算文本的字符数、单词数和行数",
    schema: z.object({
      text: z.string().describe("要计算长度的文本"),
    }),
  }
);

/** 计算器（复用） */
const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "");
      if (sanitized !== expression.trim()) {
        return `不安全的表达式: ${expression}`;
      }
      const result = new Function(`return ${sanitized}`)();
      return `${expression} = ${result}`;
    } catch {
      return `计算错误: ${expression}`;
    }
  },
  {
    name: "calculator",
    description: "计算数学表达式，支持加减乘除和括号",
    schema: z.object({
      expression: z.string().describe("数学表达式，如: 2 + 3 * 4"),
    }),
  }
);

/** 故意会出错的工具（用于演示错误处理） */
const unstableApiTool = tool(
  async ({ endpoint }: { endpoint: string }) => {
    // 模拟不稳定的 API：特定请求会失败
    if (endpoint.includes("error") || endpoint.includes("fail")) {
      throw new Error(`API 请求失败: ${endpoint} 返回 500 Internal Server Error`);
    }
    if (endpoint.includes("timeout")) {
      throw new Error(`API 请求超时: ${endpoint} 未在 30s 内响应`);
    }
    return `✅ API 响应成功: ${endpoint} 返回 {"status": "ok", "data": "模拟数据"}`;
  },
  {
    name: "call_api",
    description: "调用外部 API 接口（可能会失败）",
    schema: z.object({
      endpoint: z.string().describe("API 端点，如: /api/users、/api/data"),
    }),
  }
);

// 全部工具列表（供参考）
// allTools = [readFileTool, listDirectoryTool, getCurrentTimeTool, textLengthTool, calculatorTool, unstableApiTool]

// ============================================================
// 2. Demo 入口
// ============================================================

async function main() {
  console.log("🔧 tools-deep.ts — 工具进阶 Demo\n");

  const model = createChatModel({ temperature: 0 });

  // ==========================================================
  // Demo 1: 实用工具集展示
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 实用工具集展示\n");
  console.log("💡 定义了 6 个工具：read_file、list_directory、get_current_time、text_length、calculator、call_api\n");

  // 直接调用工具展示
  console.log("--- 直接调用工具 ---");

  const timeResult = await getCurrentTimeTool.invoke({});
  console.log("⏰", timeResult);

  const listResult = await listDirectoryTool.invoke({ dirPath: "." });
  console.log("📁 当前目录:\n", listResult);

  const lengthResult = await textLengthTool.invoke({ text: "Hello, AI Agent 世界！" });
  console.log("📏", lengthResult);
  console.log();

  // ==========================================================
  // Demo 2: 多工具编排 — 一个问题需要多次调用不同工具
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 2: 多工具编排 — 一个问题触发多工具协作\n");
  console.log("💡 Agent 会自动决定调用顺序：先列目录 → 再读文件 → 最后计算\n");

  try {
    const orchestrationAgent = createAgent({
      model,
      tools: [readFileTool, listDirectoryTool, calculatorTool, textLengthTool],
    });

    const question2 = "请读取 package.json 的内容，告诉我有多少个 dependencies 和 devDependencies，总共几个依赖？";
    console.log(`❓ 问题: ${question2}\n`);

    const result2 = await orchestrationAgent.invoke({
      messages: [new HumanMessage(question2)],
    });

    // 打印工具调用链
    console.log("🔗 工具调用链:");
    for (const msg of result2.messages) {
      if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          console.log(`   → ${tc.name}(${JSON.stringify(tc.args).substring(0, 60)})`);
        }
      }
    }

    const lastMsg2 = result2.messages[result2.messages.length - 1];
    console.log(`\n✅ 回复: ${lastMsg2.content}\n`);
  } catch (error) {
    console.log("❌ 多工具编排失败:", (error as Error).message, "\n");
  }

  // ==========================================================
  // Demo 3: 工具错误处理 — Agent 如何从工具错误中恢复
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 3: 工具错误处理\n");
  console.log("💡 工具执行可能失败（网络超时、权限不足等），Agent 需要优雅处理\n");

  try {
    // 使用 handleToolErrors 选项，让 Agent 自动处理工具错误
    const errorHandlingAgent = createAgent({
      model,
      tools: [unstableApiTool, readFileTool],
    });

    const question3 = "请调用 /api/error-endpoint 接口获取数据。如果失败了，尝试读取 package.json 获取项目信息作为替代。";
    console.log(`❓ 问题: ${question3}\n`);

    const result3 = await errorHandlingAgent.invoke({
      messages: [new HumanMessage(question3)],
    });

    // 展示执行过程中的错误和恢复
    console.log("📜 执行过程:");
    for (const msg of result3.messages) {
      if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          console.log(`   🤖 调用: ${tc.name}(${JSON.stringify(tc.args).substring(0, 80)})`);
        }
      } else if (!(msg instanceof AIMessage) && !(msg instanceof HumanMessage)) {
        const content = msg.content as string;
        if (content.includes("❌") || content.includes("失败") || content.includes("Error")) {
          console.log(`   ❌ 工具错误: ${content.substring(0, 100)}`);
        } else {
          console.log(`   ✅ 工具成功: ${content.substring(0, 100)}`);
        }
      }
    }

    const lastMsg3 = result3.messages[result3.messages.length - 1];
    console.log(`\n✅ Agent 最终回复: ${(lastMsg3.content as string).substring(0, 300)}\n`);
  } catch (error) {
    console.log("❌ 错误处理 Demo 失败:", (error as Error).message, "\n");
  }

  // ==========================================================
  // Demo 4: 结构化输出 + Agent
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 4: 结构化输出 — Agent 输出符合 Zod Schema\n");
  console.log("💡 使用 withStructuredOutput() 让 Agent 最终输出结构化 JSON\n");

  try {
    // 定义输出 Schema
    const ProjectInfoSchema = z.object({
      projectName: z.string().describe("项目名称"),
      dependencyCount: z.number().describe("依赖总数"),
      hasTypeScript: z.boolean().describe("是否使用 TypeScript"),
      mainTechnologies: z.array(z.string()).describe("主要技术栈列表"),
    });

    // --- Demo 4a: 两阶段 — Agent 收集 + 独立结构化提取 ---
    console.log("--- Demo 4a: 两阶段方式（Agent 收集 → 独立结构化提取）---\n");
    console.log("💡 第一次调用：Agent + 工具收集原始信息（自然语言）");
    console.log("   第二次调用：withStructuredOutput 从自然语言提取为 JSON\n");

    // 第一阶段：Agent 用工具收集项目信息，返回自然语言描述
    const infoAgent = createAgent({
      model,
      tools: [readFileTool, listDirectoryTool],
    });

    const gatherResult = await infoAgent.invoke({
      messages: [
        new HumanMessage(
          "请读取 package.json 和 tsconfig.json，收集项目信息"
        ),
      ],
    });

    const lastGatherMsg = gatherResult.messages[gatherResult.messages.length - 1];
    console.log("📦 Agent 收集到的原始信息:", (lastGatherMsg.content as string).substring(0, 200), "...\n");

    // 第二阶段：独立调用 withStructuredOutput 提取结构化数据
    // ⚠️ 使用 method: "functionCalling" 而非默认的 "jsonSchema"
    // DeepSeek 等模型不支持 response_format: json_schema，但支持 function calling
    const structuredModel = model.withStructuredOutput!(ProjectInfoSchema, {
      method: "functionCalling",
      name: "extract_project_info",
    });
    const structuredResult = await structuredModel.invoke([
      new HumanMessage(
        `根据以下项目信息，提取结构化数据：\n\n${lastGatherMsg.content}`
      ),
    ]);

    console.log("📋 4a 结构化输出结果:");
    console.log(JSON.stringify(structuredResult, null, 2));

    // --- Demo 4b: 单次调用 — responseFormat 让 Agent 直接输出结构化 ---
    console.log("\n--- Demo 4b: 单次调用方式（responseFormat 一步到位）---\n");
    console.log("💡 createAgent 的 responseFormat 参数：Agent 完成工具调用后，直接输出结构化 JSON");
    console.log("   无需两阶段，Agent 内部自动处理：工具循环 → 结构化输出\n");

    // createAgent 支持 responseFormat — Agent 工具循环结束后自动输出结构化结果
    const structuredAgent = createAgent({
      model,
      tools: [readFileTool, listDirectoryTool],
      responseFormat: ProjectInfoSchema,
    });

    const structuredAgentResult = await structuredAgent.invoke({
      messages: [
        new HumanMessage(
          "请读取 package.json 和 tsconfig.json，提取项目信息"
        ),
      ],
    });

    console.log("📋 4b 结构化输出结果:");
    console.log(JSON.stringify(structuredAgentResult.structuredResponse, null, 2));

    // 对比
    console.log("\n📊 两种方式对比:");
    console.log("┌────────────────┬────────────────────────────┬────────────────────────────┐");
    console.log("│                │ 4a 两阶段                  │ 4b responseFormat          │");
    console.log("├────────────────┼────────────────────────────┼────────────────────────────┤");
    console.log("│ Agent 调用     │ 2 次（收集 + 提取）         │ 1 次（收集 + 提取一体）    │");
    console.log("│ 代码量         │ 较多（两段独立逻辑）        │ 少（一个参数搞定）         │");
    console.log("│ 灵活性         │ 高（可分别定制两阶段）      │ 低（框架内部处理）         │");
    console.log("│ 适用场景       │ 收集与提取逻辑需解耦       │ 端到端一步到位（推荐）      │");
    console.log("└────────────────┴────────────────────────────┴────────────────────────────┘");
  } catch (error) {
    console.log("❌ 结构化输出失败:", (error as Error).message);
    console.log("   提示：withStructuredOutput 需要模型支持 function calling");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ 工具进阶 Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("tools-deep.ts");

if (isMainModule) {
  main().catch(console.error);
}
