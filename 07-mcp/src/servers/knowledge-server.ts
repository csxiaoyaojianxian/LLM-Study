/**
 * knowledge-server.ts — 个人知识库 MCP Server
 *
 * 综合示例：同时提供 Tools + Resources + Prompts，
 * 实现一个简单的知识库问答服务。
 *
 * 运行: npm run server:knowledge
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, "../../data");

// 创建 Server
const server = new McpServer({
  name: "knowledge-server",
  version: "1.0.0",
});

// ============================================================
// Resources: 暴露知识库文档
// ============================================================

server.resource(
  "knowledge-base",
  "knowledge://base",
  async (uri) => {
    try {
      const content = await fs.readFile(
        path.join(KNOWLEDGE_DIR, "knowledge.md"),
        "utf-8"
      );
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/markdown",
          text: content,
        }],
      };
    } catch {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: "❌ 知识库文件不存在，请确保 data/knowledge.md 已创建",
        }],
      };
    }
  }
);

// ============================================================
// Tools: 知识库搜索
// ============================================================

server.tool(
  "search_knowledge",
  "在知识库中搜索相关内容",
  {
    query: z.string().describe("搜索关键词"),
  },
  async ({ query }) => {
    try {
      const content = await fs.readFile(
        path.join(KNOWLEDGE_DIR, "knowledge.md"),
        "utf-8"
      );

      // 简单的关键词匹配搜索
      const sections = content.split(/\n## /);
      const results: string[] = [];

      for (const section of sections) {
        if (section.toLowerCase().includes(query.toLowerCase())) {
          // 截取相关段落（最多 500 字）
          const trimmed = section.length > 500
            ? section.substring(0, 500) + "..."
            : section;
          results.push(`## ${trimmed}`);
        }
      }

      if (results.length === 0) {
        return {
          content: [{
            type: "text",
            text: `未找到与「${query}」相关的内容。`,
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: `找到 ${results.length} 个相关段落:\n\n${results.join("\n\n---\n\n")}`,
        }],
      };
    } catch {
      return {
        content: [{
          type: "text",
          text: "❌ 知识库文件读取失败",
        }],
      };
    }
  }
);

// ============================================================
// Tools: 列出知识库章节
// ============================================================

server.tool(
  "list_sections",
  "列出知识库的所有章节标题",
  {},
  async () => {
    try {
      const content = await fs.readFile(
        path.join(KNOWLEDGE_DIR, "knowledge.md"),
        "utf-8"
      );

      const headings = content
        .split("\n")
        .filter(line => line.startsWith("## "))
        .map(line => line.replace("## ", ""));

      return {
        content: [{
          type: "text",
          text: `知识库章节:\n${headings.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
        }],
      };
    } catch {
      return {
        content: [{
          type: "text",
          text: "❌ 知识库文件读取失败",
        }],
      };
    }
  }
);

// ============================================================
// Prompts: 知识库问答模板
// ============================================================

server.prompt(
  "knowledge-qa",
  "基于知识库内容回答问题",
  {
    question: z.string().describe("用户的问题"),
    context: z.string().describe("从知识库检索到的相关内容"),
  },
  ({ question, context }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          "请基于以下知识库内容回答问题。",
          "",
          "## 知识库内容",
          context,
          "",
          "## 问题",
          question,
          "",
          "## 要求",
          "1. 仅基于提供的知识库内容回答",
          "2. 如果知识库中没有相关信息，请明确告知",
          "3. 用中文回答，条理清晰",
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
  console.error("📚 Knowledge Server 已启动 (stdio)");
}

main().catch(console.error);
