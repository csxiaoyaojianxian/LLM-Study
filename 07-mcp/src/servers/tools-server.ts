/**
 * tools-server.ts — MCP Tools Server
 *
 * 注册多个工具（calculator、get_weather、translate），
 * 通过 StdioServerTransport 提供服务。
 *
 * 运行: npm run server:tools
 * 或被 demo 脚本 spawn 为子进程
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 创建 MCP Server 实例
const server = new McpServer({
  name: "tools-demo-server",
  version: "1.0.0",
});

// ============================================================
// 工具 1: 计算器
// ============================================================

server.tool(
  "calculator",
  "执行基础数学运算（加减乘除）",
  {
    operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("运算类型"),
    a: z.number().describe("第一个数"),
    b: z.number().describe("第二个数"),
  },
  async ({ operation, a, b }) => {
    let result: number;
    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) {
          return { content: [{ type: "text", text: "错误：除数不能为零" }] };
        }
        result = a / b;
        break;
    }
    return {
      content: [{ type: "text", text: `${a} ${operation} ${b} = ${result}` }],
    };
  }
);

// ============================================================
// 工具 2: 天气查询（模拟）
// ============================================================

server.tool(
  "get_weather",
  "查询指定城市的天气信息（模拟数据）",
  {
    city: z.string().describe("城市名称"),
  },
  async ({ city }) => {
    // 模拟天气数据
    const weatherData: Record<string, { temp: number; condition: string; humidity: number }> = {
      北京: { temp: 22, condition: "晴", humidity: 45 },
      上海: { temp: 26, condition: "多云", humidity: 72 },
      深圳: { temp: 30, condition: "阵雨", humidity: 85 },
      杭州: { temp: 24, condition: "阴", humidity: 65 },
    };

    const weather = weatherData[city];
    if (!weather) {
      return {
        content: [{ type: "text", text: `未找到城市「${city}」的天气数据。支持的城市: ${Object.keys(weatherData).join("、")}` }],
      };
    }

    return {
      content: [{
        type: "text",
        text: `${city}天气: ${weather.condition}, 温度 ${weather.temp}°C, 湿度 ${weather.humidity}%`,
      }],
    };
  }
);

// ============================================================
// 工具 3: 翻译
// ============================================================

server.tool(
  "translate",
  "简单的中英互译（模拟）",
  {
    text: z.string().describe("要翻译的文本"),
    targetLang: z.enum(["zh", "en"]).describe("目标语言: zh=中文, en=英文"),
  },
  async ({ text, targetLang }) => {
    // 简单的模拟翻译
    const translations: Record<string, Record<string, string>> = {
      zh: {
        "hello": "你好",
        "goodbye": "再见",
        "thank you": "谢谢",
        "good morning": "早上好",
        "how are you": "你好吗",
      },
      en: {
        "你好": "hello",
        "再见": "goodbye",
        "谢谢": "thank you",
        "早上好": "good morning",
        "你好吗": "how are you",
      },
    };

    const dict = translations[targetLang] || {};
    const translated = dict[text.toLowerCase()] || `[模拟翻译] ${text} → (${targetLang})`;

    return {
      content: [{ type: "text", text: `翻译结果 (→${targetLang}): ${translated}` }],
    };
  }
);

// ============================================================
// 启动 Server
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🔧 Tools Demo Server 已启动 (stdio)");
}

main().catch(console.error);
