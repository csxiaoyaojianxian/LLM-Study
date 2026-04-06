# 07-mcp — MCP 协议与服务

> MCP (Model Context Protocol) 核心概念、从零实现 MCP Server、Client 调试、知识库实战

## 目录

- [概述](#概述)
- [环境准备](#环境准备)
- [Demo 列表](#demo-列表)
- [运行方式](#运行方式)
- [MCP 核心概念](#mcp-核心概念)
- [项目结构](#项目结构)
- [在 Claude Desktop 中使用](#在-claude-desktop-中使用)

## 概述

本模块带你从零理解和实现 MCP（Model Context Protocol）：

1. **MCP 核心概念** — Host/Client/Server 架构，对比传统 API
2. **Tools 深入** — 工具注册、调用、LLM 自动选择工具
3. **Resources 深入** — 静态/动态资源暴露与读取
4. **Prompts 深入** — 模板化提示，参数化复用
5. **通用 Client** — 连接管理、能力探测、调试工具
6. **知识库实战** — 综合 Tools + Resources + Prompts 的 MCP 版 RAG

## 环境准备

```bash
cd 07-mcp
cp .env.example .env   # 配置至少一个 API Key
npm install
```

**API Key 需求**：
- `mcp-basics`、`mcp-resources`、`mcp-client` — 无需 API Key
- `mcp-tools`（Demo 3）、`mcp-prompts`（Demo 3）、`mcp-knowledge`（Demo 3） — 需要 API Key

## Demo 列表

| 脚本 | 内容 | 需要 API Key |
| --- | --- | --- |
| `npm run mcp-basics` | MCP 核心概念 + 最简 Server/Client | ❌ |
| `npm run mcp-tools` | Tools 注册、调用、LLM 集成 | ✅（Demo 3） |
| `npm run mcp-resources` | Resources 暴露与读取 | ❌ |
| `npm run mcp-prompts` | Prompts 模板与 LLM 执行 | ✅（Demo 3） |
| `npm run mcp-client` | 通用 Client 调试 | ❌ |
| `npm run mcp-knowledge` | 知识库问答实战 | ✅（Demo 3） |

## 运行方式

```bash
# MCP 核心概念（无需 API Key）
npm run mcp-basics

# Tools 演示
npm run mcp-tools

# Resources 演示（无需 API Key）
npm run mcp-resources

# Prompts 演示
npm run mcp-prompts

# Client 调试工具（无需 API Key）
npm run mcp-client

# 知识库实战（综合）
npm run mcp-knowledge
```

### 独立运行 Server（供外部 Client 连接）

```bash
npm run server:tools       # Tools Server
npm run server:resources   # Resources Server
npm run server:prompts     # Prompts Server
npm run server:knowledge   # Knowledge Server
```

## MCP 核心概念

### 架构

```
┌──────────────────────────────────────┐
│              Host                     │
│  (Claude Desktop / IDE / 自定义应用)  │
│                                      │
│   ┌──────────┐  ┌──────────┐        │
│   │ Client A │  │ Client B │  ...   │
│   └────┬─────┘  └────┬─────┘        │
└────────┼─────────────┼───────────────┘
         │             │
  ┌──────▼──────┐ ┌───▼──────────┐
  │  Server A   │ │  Server B    │
  │ • Resources │ │ • Tools      │
  │ • Tools     │ │ • Prompts    │
  │ • Prompts   │ │ • Resources  │
  └─────────────┘ └──────────────┘
```

### 三大能力

| 能力 | 说明 | 类比 |
| --- | --- | --- |
| **Tools** | LLM 可调用的函数 | Function Calling |
| **Resources** | 向 LLM 暴露的数据 | REST GET 端点 |
| **Prompts** | 可复用的提示模板 | API 请求模板 |

### 通信协议

MCP 使用 JSON-RPC 2.0，支持两种传输方式：
- **stdio** — 通过标准输入/输出通信（本地进程）
- **SSE** — 通过 Server-Sent Events 通信（远程服务）

## 项目结构

```
07-mcp/
├── src/
│   ├── model-adapter.ts        # Vercel AI SDK 多模型适配（复用自 03）
│   ├── mcp-basics.ts           # Demo 1: MCP 核心概念
│   ├── mcp-tools.ts            # Demo 2: Tools 深入
│   ├── mcp-resources.ts        # Demo 3: Resources 深入
│   ├── mcp-prompts.ts          # Demo 4: Prompts 深入
│   ├── mcp-client.ts           # Demo 5: 通用 Client 调试
│   ├── mcp-knowledge.ts        # Demo 6: 知识库实战
│   └── servers/                # 独立 Server 入口
│       ├── tools-server.ts     # 计算器/天气/翻译
│       ├── resources-server.ts # 项目信息/配置/文件读取
│       ├── prompts-server.ts   # 代码审查/翻译/文档模板
│       └── knowledge-server.ts # 知识库（综合）
├── data/
│   └── knowledge.md            # 知识库示例文档
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## 在 Claude Desktop 中使用

将以下配置添加到 Claude Desktop 的 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "npx",
      "args": ["tsx", "/path/to/07-mcp/src/servers/knowledge-server.ts"]
    },
    "tools-demo": {
      "command": "npx",
      "args": ["tsx", "/path/to/07-mcp/src/servers/tools-server.ts"]
    }
  }
}
```

替换 `/path/to/` 为实际路径，重启 Claude Desktop 即可使用。

## 技术栈

- **MCP SDK**: `@modelcontextprotocol/sdk` — 官方 TypeScript SDK
- **Vercel AI SDK**: `ai` + `@ai-sdk/*` — 多模型适配 + 工具调用
- **Zod**: Schema 验证（工具参数、Prompt 参数）
- **tsx**: TypeScript 直接运行
