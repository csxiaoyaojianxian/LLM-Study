/**
 * resources-server.ts — MCP Resources Server
 *
 * 提供静态资源（项目说明、配置）和动态资源（文件系统读取）。
 *
 * 运行: npm run server:resources
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: "resources-demo-server",
  version: "1.0.0",
});

// ============================================================
// 静态资源 1: 项目说明
// ============================================================

server.resource(
  "project-info",
  "info://project",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "text/plain",
      text: [
        "📦 项目名称: LLM-Study",
        "📝 描述: 大语言模型学习实践 — 从零到一的 AI 应用开发之路",
        "🛠️ 技术栈: TypeScript / Node.js / Vercel AI SDK",
        "📚 模块数: 10 个（基础篇 → 扩展篇）",
        "👤 作者: csxiaoyao",
        "📅 更新时间: 2024",
      ].join("\n"),
    }],
  })
);

// ============================================================
// 静态资源 2: 配置信息
// ============================================================

server.resource(
  "config",
  "config://app",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({
        supportedProviders: ["deepseek", "openai", "anthropic"],
        defaultProvider: "deepseek",
        modules: [
          "01-Start", "02-ai_chat_sdk", "03-prompt_engineering",
          "04-rag", "05-langchain", "06-agent",
          "07-mcp", "08-skill", "09-multimodal", "10-deployment",
        ],
        environment: "development",
      }, null, 2),
    }],
  })
);

// ============================================================
// 动态资源: 读取文件
// ============================================================

server.resource(
  "file-reader",
  "file:///{path}",
  async (uri) => {
    const filePath = decodeURIComponent(uri.pathname);
    // 安全检查：只允许读取项目目录下的文件
    const projectRoot = path.resolve(__dirname, "../..");
    const fullPath = path.resolve(projectRoot, filePath);

    if (!fullPath.startsWith(projectRoot)) {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: "❌ 安全限制：只能读取项目目录下的文件",
        }],
      };
    }

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const ext = path.extname(fullPath);
      const mimeType = ext === ".json" ? "application/json"
        : ext === ".md" ? "text/markdown"
        : "text/plain";

      return {
        contents: [{
          uri: uri.href,
          mimeType,
          text: content,
        }],
      };
    } catch (err) {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: `❌ 读取文件失败: ${(err as Error).message}`,
        }],
      };
    }
  }
);

// ============================================================
// 启动 Server
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("📂 Resources Demo Server 已启动 (stdio)");
}

main().catch(console.error);
