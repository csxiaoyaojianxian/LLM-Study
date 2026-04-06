/**
 * prompts-server.ts — MCP Prompts Server
 *
 * 提供模板化 Prompt（代码审查、翻译），支持参数化。
 *
 * 运行: npm run server:prompts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "prompts-demo-server",
  version: "1.0.0",
});

// ============================================================
// Prompt 1: 代码审查
// ============================================================

server.prompt(
  "code-review",
  "对代码进行专业审查，给出改进建议",
  {
    code: z.string().describe("要审查的代码"),
    language: z.string().optional().describe("编程语言（可选）"),
  },
  ({ code, language }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `请对以下${language ? ` ${language} ` : ""}代码进行专业审查：`,
          "",
          "```",
          code,
          "```",
          "",
          "请从以下角度分析：",
          "1. 🐛 潜在 Bug 和错误",
          "2. ⚡ 性能优化建议",
          "3. 📖 代码可读性和规范",
          "4. 🔒 安全性问题",
          "5. ✨ 最佳实践建议",
        ].join("\n"),
      },
    }],
  })
);

// ============================================================
// Prompt 2: 翻译
// ============================================================

server.prompt(
  "translate",
  "将文本翻译为指定语言",
  {
    text: z.string().describe("要翻译的文本"),
    targetLang: z.string().describe("目标语言，如: 英文、日文、法文"),
    style: z.enum(["formal", "casual", "technical"]).optional().describe("翻译风格"),
  },
  ({ text, targetLang, style }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `请将以下文本翻译为${targetLang}：`,
          "",
          `"${text}"`,
          "",
          style ? `翻译风格: ${style === "formal" ? "正式" : style === "casual" ? "口语化" : "技术文档"}` : "",
          "",
          "要求：",
          "1. 保持原文含义",
          "2. 翻译自然流畅",
          "3. 如有专业术语请保留原文标注",
        ].filter(Boolean).join("\n"),
      },
    }],
  })
);

// ============================================================
// Prompt 3: 文档生成
// ============================================================

server.prompt(
  "generate-docs",
  "为代码生成文档注释",
  {
    code: z.string().describe("要生成文档的代码"),
    format: z.enum(["jsdoc", "tsdoc", "markdown"]).optional().describe("文档格式"),
  },
  ({ code, format }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          `请为以下代码生成${format || "JSDoc"}格式的文档注释：`,
          "",
          "```",
          code,
          "```",
          "",
          "要求：",
          "1. 为每个函数/类/接口添加完整的文档注释",
          "2. 包含参数说明、返回值说明、使用示例",
          "3. 用中文撰写说明",
        ].join("\n"),
      },
    }],
  })
);

// ============================================================
// 启动 Server
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("📋 Prompts Demo Server 已启动 (stdio)");
}

main().catch(console.error);
