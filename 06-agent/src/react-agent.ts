/**
 * react-agent.ts — ReAct 模式核心原理
 *
 * ReAct = Reasoning + Acting，Agent 的核心决策模式：
 *   Thought（思考）→ Action（行动）→ Observation（观察）→ 循环直到完成
 *
 * 本文件展示三种实现方式：
 * - Demo 1: 手动实现 ReAct 循环（理解原理）
 * - Demo 2: createReactAgent（LangGraph 预置 Agent）
 * - Demo 3: createAgent（langchain v1 高层 API）
 * - Demo 4: 三种方式对比总结
 *
 * ⚠️ Agent demo 建议使用 OpenAI API Key，DeepSeek 的 function calling 可能不稳定
 *
 * 运行: npm run react-agent
 */

import "dotenv/config";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createAgent } from "langchain";
import { createChatModel } from "./model-chat.js";

// ============================================================
// 1. 定义工具（供三种方式共用）
// ============================================================

/** 天气查询工具 */
const getWeatherTool = tool(
  async ({ city }: { city: string }) => {
    const weatherData: Record<string, string> = {
      北京: "晴天，气温 22°C，微风",
      上海: "多云，气温 25°C，东南风 3 级",
      广州: "小雨，气温 28°C，湿度 85%",
      深圳: "阴天，气温 27°C，有雾",
      杭州: "晴转多云，气温 24°C，西北风 2 级",
    };
    return weatherData[city] || `暂无 ${city} 的天气数据`;
  },
  {
    name: "get_weather",
    description: "查询指定城市的天气信息",
    schema: z.object({
      city: z.string().describe("城市名称，如：北京、上海"),
    }),
  }
);

/** 计算器工具 */
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

/** 知识搜索工具（模拟） */
const searchKnowledgeTool = tool(
  async ({ query }: { query: string }) => {
    // 模拟知识库搜索
    const knowledge: Record<string, string> = {
      LangChain:
        "LangChain 是一个用于构建 LLM 应用的框架，提供 Model、Prompt、Chain、Memory、Tool 等核心抽象。",
      ReAct:
        "ReAct（Reasoning + Acting）是一种 Agent 模式，LLM 交替进行推理和行动，通过工具与环境交互来解决问题。",
      Agent:
        "AI Agent 是能够自主决策和执行任务的智能体，核心组件包括：LLM（大脑）、Tools（工具）、Memory（记忆）、Planning（规划）。",
      RAG: "RAG（检索增强生成）通过从外部知识库检索相关信息，增强 LLM 的回答准确性，避免幻觉。",
    };

    // 简单关键词匹配
    for (const [key, value] of Object.entries(knowledge)) {
      if (query.includes(key) || query.toLowerCase().includes(key.toLowerCase())) {
        return `📚 找到相关知识：${value}`;
      }
    }
    return `未找到与「${query}」相关的知识`;
  },
  {
    name: "search_knowledge",
    description: "搜索知识库，查找技术概念和定义",
    schema: z.object({
      query: z.string().describe("搜索关键词，如: LangChain、ReAct"),
    }),
  }
);

const tools = [getWeatherTool, calculatorTool, searchKnowledgeTool];

// ============================================================
// 工具查找辅助函数
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toolMap = new Map<string, any>(tools.map((t) => [t.name, t]));

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const t = toolMap.get(name);
  if (!t) return `未知工具: ${name}`;
  return (await t.invoke(args)) as string;
}

// ============================================================
// 2. Demo 入口
// ============================================================

async function main() {
  console.log("🤖 react-agent.ts — ReAct 模式核心原理 Demo\n");

  const model = createChatModel({ temperature: 0 });

  // ==========================================================
  // Demo 1: 手动实现 ReAct 循环
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 手动实现 ReAct 循环\n");
  console.log("💡 核心原理：LLM 思考 → 返回 tool_calls → 执行工具 → 结果回传 → 再次思考 → 循环\n");

  const question1 = "杭州今天天气如何？另外帮我算一下 (100 + 200) * 3";
  console.log(`❓ 问题: ${question1}\n`);

  // 绑定工具：让模型知道有哪些工具可用
  const modelWithTools = model.bindTools!(tools);

  // 构建消息列表
  const messages: BaseMessage[] = [new HumanMessage(question1)];

  let step = 0;
  const MAX_STEPS = 10; // 防止死循环

  while (step < MAX_STEPS) {
    step++;
    console.log(`--- 🔄 Step ${step} ---`);

    // 1. LLM 思考
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    // 2. 检查是否有 tool_calls
    const aiMsg = response as AIMessage;
    if (!aiMsg.tool_calls || aiMsg.tool_calls.length === 0) {
      // 无工具调用 → Agent 认为任务完成，输出最终回复
      console.log("💭 Thought: 任务完成，生成最终回复");
      console.log(`✅ Final Answer: ${response.content}\n`);
      break;
    }

    // 3. 执行每个工具调用
    for (const toolCall of aiMsg.tool_calls) {
      console.log(`💭 Thought: 需要调用工具获取信息`);
      console.log(`🔧 Action: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);

      const result = await executeTool(toolCall.name, toolCall.args);
      console.log(`👁️  Observation: ${result}`);

      // 将工具结果添加到消息列表
      messages.push(
        new ToolMessage({
          content: result,
          tool_call_id: toolCall.id!,
        })
      );
    }
    console.log();
  }

  if (step >= MAX_STEPS) {
    console.log("⚠️ 达到最大循环次数，强制停止\n");
  }

  // ==========================================================
  // Demo 2: createReactAgent — LangGraph 预置 Agent
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 2: createReactAgent — 一行搞定 ReAct Agent\n");
  console.log("💡 框架自动处理：工具绑定、循环调用、结果回传、终止判断\n");

  try {
    const reactAgent = createReactAgent({
      llm: model,
      tools,
    });

    const question2 = "什么是 ReAct 模式？另外查一下北京天气";
    console.log(`❓ 问题: ${question2}\n`);

    const result2 = await reactAgent.invoke({
      messages: [new HumanMessage(question2)],
    });

    // 打印所有消息，展示 Agent 的完整执行过程
    console.log("📜 Agent 执行过程:");
    for (const msg of result2.messages) {
      if (msg instanceof HumanMessage) {
        console.log(`  👤 Human: ${msg.content}`);
      } else if (msg instanceof AIMessage) {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            console.log(`  🤖 AI → 调用工具: ${tc.name}(${JSON.stringify(tc.args)})`);
          }
        }
        if (msg.content) {
          console.log(`  🤖 AI: ${(msg.content as string).substring(0, 200)}...`);
        }
      } else if (msg instanceof ToolMessage) {
        console.log(`  🔧 Tool: ${(msg.content as string).substring(0, 100)}`);
      }
    }

    const lastMsg = result2.messages[result2.messages.length - 1];
    console.log(`\n✅ 最终回复: ${lastMsg.content}\n`);
  } catch (error) {
    console.log("❌ createReactAgent 执行失败:", (error as Error).message);
    console.log("   建议：配置 OPENAI_API_KEY 后重试\n");
  }

  // ==========================================================
  // Demo 3: createAgent — langchain v1 高层 API
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 3: createAgent — langchain v1 高层 API\n");
  console.log("💡 createAgent 支持 systemPrompt 参数，可以设定 Agent 人设\n");

  try {
    const agent3 = createAgent({
      model,
      tools,
    });

    const question3 = "帮我查一下 Agent 的定义，然后算算 999 * 111";
    console.log(`❓ 问题: ${question3}\n`);

    const result3 = await agent3.invoke({
      messages: [new HumanMessage(question3)],
    });

    const lastMsg3 = result3.messages[result3.messages.length - 1];
    console.log(`✅ Agent 回复: ${lastMsg3.content}\n`);
  } catch (error) {
    console.log("❌ createAgent 执行失败:", (error as Error).message);
    console.log("   建议：配置 OPENAI_API_KEY 后重试\n");
  }

  // ==========================================================
  // Demo 4: 三种方式对比总结
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📊 Demo 4: 三种 ReAct 实现方式对比\n");

  console.log("┌─────────────────────┬────────────────────────┬──────────────────────────────┐");
  console.log("│ 方式                │ 适用场景               │ 特点                         │");
  console.log("├─────────────────────┼────────────────────────┼──────────────────────────────┤");
  console.log("│ 手动 while 循环     │ 学习原理、深度定制     │ 完全控制，代码量大           │");
  console.log("│ createReactAgent    │ 需要自定义状态图       │ LangGraph 底层，灵活性高     │");
  console.log("│ createAgent         │ 快速上手（推荐）       │ v1 高层 API，开箱即用        │");
  console.log("└─────────────────────┴────────────────────────┴──────────────────────────────┘");
  console.log();
  console.log("💡 核心启示：");
  console.log("   1. ReAct 的本质就是一个 while 循环 + tool_calls 判断");
  console.log("   2. createReactAgent/createAgent 帮你封装了这个循环");
  console.log("   3. 理解手动实现后，再用框架会事半功倍");

  console.log("\n" + "=".repeat(60));
  console.log("✅ ReAct 模式 Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("react-agent.ts");

if (isMainModule) {
  main().catch(console.error);
}
