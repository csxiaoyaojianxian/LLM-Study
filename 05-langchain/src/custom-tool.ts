/**
 * custom-tool.ts — 自定义 Tool + Agent
 *
 * LangChain 的 Tool 机制让 LLM 能调用外部工具（函数），
 * Agent 则自动决定何时调用哪个工具。
 *
 * 核心知识点：
 * - tool() 定义工具（name, description, schema, func）
 * - model.bindTools() — 让模型知道可用工具
 * - 手动解析 tool_calls 并执行
 * - createReactAgent（@langchain/langgraph） — LangGraph 底层 Agent
 * - createAgent（langchain v1） — 高层 API，底层基于 LangGraph
 *
 * ⚠️ Agent demo 建议使用 OpenAI API Key，DeepSeek 的 function calling 可能不稳定
 *
 * 运行: npm run custom-tool
 */

import "dotenv/config";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage, BaseMessage, ToolMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createAgent } from "langchain";
import { createChatModel } from "./model-chat.js";

// ============================================================
// 1. 定义工具
// ============================================================

/** 模拟天气查询工具 */
const getWeatherTool = tool(
  async ({ city }: { city: string }) => {
    // 模拟天气数据
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
      // 安全的数学表达式计算（仅允许数字和基本运算符）
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

const tools = [getWeatherTool, calculatorTool];

// ============================================================
// 2. Demo 入口
// ============================================================

async function main() {
  console.log("🔧 custom-tool.ts — 自定义 Tool + Agent Demo\n");

  const model = createChatModel({ temperature: 0 });

  // --- Demo 1: 直接调用工具 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 直接调用工具（tool.invoke）\n");

  const weatherResult = await getWeatherTool.invoke({ city: "北京" });
  console.log("天气查询:", weatherResult);

  const calcResult = await calculatorTool.invoke({ expression: "(2 + 3) * 4" });
  console.log("计算结果:", calcResult);
  console.log();

  // --- Demo 2: model.bindTools() — 模型返回 tool_calls ---
  console.log("=".repeat(60));
  console.log("📌 Demo 2: model.bindTools() — 模型决定调用工具\n");

  const modelWithTools = model.bindTools!(tools);

  const response2 = await modelWithTools.invoke([
    new HumanMessage("北京今天天气怎么样？"),
  ]);

  console.log("模型回复内容:", response2.content || "(空，模型选择调用工具)");
  /*
tool_calls: [
  {
    "name": "get_weather",
    "args": {
      "city": "北京"
    },
    "type": "tool_call",
    "id": "tooluse_xxxxxx"
  }
]
   */
  console.log("tool_calls:", JSON.stringify(response2.tool_calls, null, 2));
  console.log();

  // --- Demo 3: 手动解析并执行 tool_calls ---
  console.log("=".repeat(60));
  console.log("📌 Demo 3: 手动解析并执行 tool_calls\n");

  const messages3: BaseMessage[] = [
    new HumanMessage("帮我算一下 123 * 456 等于多少"),
  ];

  const response3 = await modelWithTools.invoke(messages3);
  console.log("模型返回 tool_calls:", JSON.stringify(response3.tool_calls, null, 2));

  if (response3.tool_calls && response3.tool_calls.length > 0) {
    // 执行每个 tool call
    messages3.push(response3);
    for (const toolCall of response3.tool_calls) {
      console.log(`\n执行工具: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
      let toolResult: string;
      if (toolCall.name === "get_weather") {
        toolResult = await getWeatherTool.invoke(toolCall.args as { city: string });
      } else if (toolCall.name === "calculator") {
        toolResult = await calculatorTool.invoke(toolCall.args as { expression: string });
      } else {
        toolResult = `未知工具: ${toolCall.name}`;
      }
      console.log("工具返回:", toolResult);

      // 将工具结果作为 ToolMessage 添加到消息列表
      messages3.push(
        new ToolMessage({
          content: toolResult,
          tool_call_id: toolCall.id!,
        })
      );
    }

    // 让模型根据工具结果生成最终回复
    const finalResponse = await modelWithTools.invoke(messages3);
    console.log("\n最终回复:", finalResponse.content);
  }
  console.log();

  // --- Demo 4: createReactAgent — 完整 Agent 自动循环 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 4: createReactAgent — 完整 Agent 自动循环\n");
  console.log("⚠️  提示：Agent 需要模型支持稳定的 function calling");
  console.log("   推荐使用 OpenAI API Key 以获得最佳体验\n");

  try {
    const agent = createReactAgent({
      llm: model,
      tools,
    });

    // 单工具调用
    console.log("--- 问题 1: 单工具调用 ---");
    const result1 = await agent.invoke({
      messages: [new HumanMessage("上海今天天气如何？")],
    });
    const lastMsg1 = result1.messages[result1.messages.length - 1];
    console.log("Agent 回复:", lastMsg1.content);
    console.log();

    // 多工具组合调用
    console.log("--- 问题 2: 多工具组合调用 ---");
    const result2 = await agent.invoke({
      messages: [
        new HumanMessage("北京和广州的天气分别怎样？顺便帮我算一下 999 * 888"),
      ],
    });
    const lastMsg2 = result2.messages[result2.messages.length - 1];
    console.log("Agent 回复:", lastMsg2.content);
    console.log();

    // 无需工具的问题
    console.log("--- 问题 3: 无需工具的问题 ---");
    const result3 = await agent.invoke({
      messages: [new HumanMessage("用一句话介绍 LangChain")],
    });
    const lastMsg3 = result3.messages[result3.messages.length - 1];
    console.log("Agent 回复:", lastMsg3.content);
  } catch (error) {
    console.log("❌ Agent 执行失败（可能是模型不支持稳定的 function calling）");
    console.log("   建议：配置 OPENAI_API_KEY 后重试");
    console.log("   错误:", (error as Error).message);
  }

  console.log("\n" + "=".repeat(60));

  // --- Demo 5: createAgent（langchain v1 新 API） ---
  console.log("📌 Demo 5: createAgent — langchain v1 高层 API\n");
  console.log("💡 createAgent 是 v1 新增的简化 API，底层基于 LangGraph ReactAgent");
  console.log("   相比 createReactAgent，支持字符串模型名、systemPrompt、middleware 等\n");

  try {
    // createAgent 是 langchain v1 的高层封装
    // 底层 = new ReactAgent(params)，即 LangGraph 的 ReAct Agent
    // 亮点：model 参数支持字符串格式 "provider:model-name"
    const agent5 = createAgent({
      model,  // 也可以直接传字符串如 "openai:gpt-4o-mini"
      tools,
    });

    console.log("--- createAgent 调用示例 ---");
    const result5 = await agent5.invoke({
      messages: [new HumanMessage("深圳天气如何？然后帮我算 2048 / 16")],
    });
    const lastMsg5 = result5.messages[result5.messages.length - 1];
    console.log("Agent 回复:", lastMsg5.content);
  } catch (error) {
    console.log("❌ createAgent 执行失败");
    console.log("   错误:", (error as Error).message);
  }

  // --- 方案对比 ---
  console.log("\n" + "=".repeat(60));
  console.log("📊 Agent API 对比：\n");
  console.log("┌────────────────────────┬──────────────────┬──────────────────┐");
  console.log("│ API                    │ 来源             │ 适用场景         │");
  console.log("├────────────────────────┼──────────────────┼──────────────────┤");
  console.log("│ model.bindTools()      │ @langchain/openai │ 手动控制流程     │");
  console.log("│ createReactAgent       │ @langchain/langgraph │ 自定义状态图 │");
  console.log("│ createAgent            │ langchain v1     │ 快速上手（推荐） │");
  console.log("└────────────────────────┴──────────────────┴──────────────────┘");

  // 🔗 进阶提示
  console.log("\n🔗 进阶: 本模块演示的是单 Agent + 简单工具调用。");
  console.log("   当你需要以下能力时，请进入 06-agent 模块学习 LangGraph 的完整编排能力：");
  console.log("   • 多工具复杂编排 + 错误处理与重试");
  console.log("   • StateGraph 自定义流程图（条件分支、循环、中断恢复）");
  console.log("   • 多 Agent 协作模式（顺序管道、条件路由、Supervisor、辩论）");
  console.log("   • 人机交互审批（interrupt + resume）");
  console.log("   → cd ../06-agent && npm run react-agent");

  console.log("\n" + "=".repeat(60));
  console.log("✅ Custom Tool + Agent Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("custom-tool.ts");

if (isMainModule) {
  main().catch(console.error);
}
