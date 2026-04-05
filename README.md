# LLM-Study

> 大语言模型学习实践 — 从零到一的 AI 应用开发之路

面向 Web 开发者的 LLM 应用开发系统教程，以 **TypeScript/Node.js** 为主要技术栈，每个模块包含可运行代码 + 配套中文教程文章。

📦 源码：[https://github.com/csxiaoyaojianxian/LLM-Study](https://github.com/csxiaoyaojianxian/LLM-Study)

---

## 学习路线

```
基础篇 ──────────────────────── 已完成 ✅
│ 01-Start           纯前端 HTML 示例
│ 02-ai_chat_sdk     Next.js + Vercel AI SDK
│
进阶篇 ──────────────────────── 第2-3期
│ 03-prompt_engineering   Prompt 工程 + 多模型适配
│ 04-rag                  RAG 检索增强生成 ⭐
│
框架篇 ──────────────────────── 第4-5期
│ 05-langchain       LangChain.js 框架
│ 06-agent           AI Agent 智能体 ⭐
│
生态篇 ──────────────────────── 第6-7期
│ 07-mcp             MCP 协议与服务 ⭐
│ 08-skill           Claude Skill 开发
│
扩展篇 ──────────────────────── 第8-9期
│ 09-multimodal      多模态应用
│ 10-deployment      本地部署与优化
```

---

## 模块总览

### 基础篇（已完成 ✅）

| 模块 | 内容 | 教程 |
| --- | --- | --- |
| [01-Start](./01-Start/) | 纯前端 HTML 实现 AI 聊天，涵盖基础对话、流式输出、对话历史、Function Calling | [第1期教程](./AI应用开发实践系列(第1期)—前端er从零构建智能聊天应用.md) |
| [02-ai_chat_sdk](./02-ai_chat_sdk/) | 使用 Next.js + Vercel AI SDK 构建完整聊天应用，体验框架级开发效率 | [第1期教程](./AI应用开发实践系列(第1期)—前端er从零构建智能聊天应用.md) |

### 进阶篇

| 模块 | 内容 | 状态 |
| --- | --- | --- |
| [03-prompt_engineering](./03-prompt_engineering/) | **Prompt 工程进阶** — System Prompt 设计模式、CoT 思维链、Few-shot 对比实验、结构化输出（JSON Mode）、多模型统一适配层封装 | ✅ |
| [04-rag](./04-rag/) | **RAG 检索增强生成** — 文本分块策略、Embedding 向量化、向量数据库（ChromaDB）、相似度检索、完整 RAG Pipeline、对话式 RAG | ✅ |

### 框架篇

| 模块 | 内容 | 状态 |
| --- | --- | --- |
| [05-langchain](./05-langchain/) | **LangChain.js 框架** — 核心概念（Model/Prompt/Chain/Memory/Tool）、LCEL 链式调用、用 LangChain 重构 RAG、Memory 对话记忆、Output Parser、自定义 Tool | ✅ |
| [06-agent](./06-agent/) | **AI Agent 智能体** — ReAct 模式、多工具编排（搜索/计算/文件操作）、StateGraph 自定义流程图、Multi-Agent 协作、Agent 记忆与状态管理 | ✅ |

### 生态篇

| 模块 | 内容 | 状态 |
| --- | --- | --- |
| 07-mcp | **MCP 协议与服务** — MCP 核心概念（Resources/Tools/Prompts/Sampling）、从零实现 MCP Server（TypeScript SDK）、MCP Client 调试、在 Claude 中使用自建 Server、个人知识库 MCP Server 实战 | 🔜 |
| 08-skill | **Claude Skill 开发** — Slash Commands / Hooks / Custom Instructions、自定义 Skill（代码审查/测试生成/文档生成）、Hooks 自动化工作流、settings.json 配置详解 | 🔜 |

### 扩展篇

| 模块 | 内容 | 状态 |
| --- | --- | --- |
| 09-multimodal | **多模态应用** — Vision 图片理解与分析、图片生成（DALL-E/Stable Diffusion）、语音识别（Whisper）与语音合成（TTS）、多模态对话应用 | 🔜 |
| 10-deployment | **本地部署与优化** — Ollama 本地部署开源模型、本地模型整合替换、生产环境优化（缓存/限流/Token 计费/监控）、Prompt 缓存与成本控制 | 🔜 |


---

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 语言 | TypeScript / Node.js |
| 前端框架 | Next.js / React |
| AI SDK | Vercel AI SDK / LangChain.js |
| LLM 模型 | DeepSeek / OpenAI / Claude（多模型切换） |
| 向量数据库 | ChromaDB / Qdrant |
| 本地部署 | Ollama |
| AI 生态 | MCP Protocol / Claude Skill |
| 部署 | Vercel / Docker |

---

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm（推荐）或 npm
- 至少一个 LLM API Key（DeepSeek / OpenAI / Claude）

### 运行已完成的模块

**01-Start — 纯前端示例**

直接在浏览器中打开 HTML 文件即可，需要在页面中填入 API Key。

**02-ai_chat_sdk — Next.js 聊天应用**

```bash
cd 02-ai_chat_sdk
cp .env.example .env.local  # 配置你的 API Key
pnpm install
pnpm dev
# 访问 http://localhost:3000
```

**03-prompt_engineering — Prompt 工程进阶**

```bash
cd 03-prompt_engineering
cp .env.example .env  # 配置至少一个 API Key
npm install
npm run model-adapter       # 多模型适配
npm run prompt-templates     # Prompt 模板引擎
npm run structured-output    # 结构化输出
npm run cot-demo             # 思维链对比
```

**04-rag — RAG 检索增强生成**

```bash
cd 04-rag
cp .env.example .env  # 配置至少一个 API Key
npm install
npm run chunking            # 分块策略对比（无需 ChromaDB）
npm run embeddings          # 本地 embedding（无需 ChromaDB，首次下载 ~90MB）
# 启动 ChromaDB（新终端窗口，二选一）
docker run -d -p 8000:8000 chromadb/chroma              # Docker 方式
# 或: python3 -m venv .venv && .venv/bin/pip install chromadb && .venv/bin/chroma run --path ./chroma-data
npm run rag-pipeline        # 完整 RAG 对比
npm run rag-optimize        # RAG 优化对比实验
npm run conversational-rag  # 对话式 RAG
```

**05-langchain — LangChain.js 框架**

```bash
cd 05-langchain
cp .env.example .env  # 配置至少一个 API Key
npm install
npm run model-chat        # Model 基础（ChatOpenAI + 流式输出）
npm run prompt-lcel       # LCEL 链式调用
npm run output-parser     # 结构化输出
npm run memory-chat       # 对话记忆
npm run custom-tool       # 自定义 Tool + Agent（推荐使用 OpenAI Key）
# 启动 ChromaDB（同 04-rag）
npm run rag-langchain     # LangChain RAG
```

**06-agent — AI Agent 智能体**

```bash
cd 06-agent
cp .env.example .env  # 配置至少一个 API Key（推荐 OpenAI）
npm install
npm run react-agent      # ReAct 模式原理（手动循环 / createReactAgent / createAgent）
npm run tools-deep       # 工具进阶（多工具编排、错误处理、结构化输出）
npm run state-graph      # StateGraph 自定义流程图（条件分支、循环、Human-in-the-Loop）
npm run memory-agent     # Agent 记忆（MemorySaver、多会话隔离、状态回溯）
npm run multi-agent      # Multi-Agent 协作（顺序流水线、条件路由循环改进）
```
---

## 项目结构

```
LLM-Study/
├── 01-Start/                          ✅ 纯前端 HTML 示例
│   ├── 01-chat.html                   基础对话
│   ├── 02-chat_stream.html            流式输出
│   ├── 03-history.html                对话历史
│   └── 04-function_calling.html       Function Calling
├── 02-ai_chat_sdk/                    ✅ Next.js + AI SDK
├── 03-prompt_engineering/             ✅ Prompt 工程进阶
├── 04-rag/                            ✅ RAG 检索增强生成
├── 05-langchain/                      ✅ LangChain.js 框架
├── 06-agent/                          ✅ AI Agent 智能体
├── 07-mcp/                            🔜 MCP 协议与服务
├── 08-skill/                          🔜 Claude Skill 开发
├── 09-multimodal/                     🔜 多模态应用
├── 10-deployment/                     🔜 本地部署与优化
└── README.md                          📍 学习路线总览（本文件）
```

---

## 配套教程

每个模块配套一篇中文教程文章，记录从原理到实现的完整过程：

| 期数 | 教程 | 状态 |
| --- | --- | --- |
| 第1期 | [前端er从零构建智能聊天应用](./AI应用开发实践系列(第1期)—前端er从零构建智能聊天应用.md) | ✅ |
| 第2期 | Prompt 工程进阶与多模型适配 | 🔜 |
| 第3期 | RAG 检索增强生成实战 | 🔜 |
| 第4期 | LangChain.js 框架入门 | 🔜 |
| 第5期 | AI Agent 智能体开发 | 🔜 |
| 第6期 | MCP 协议与服务开发 | 🔜 |
| 第7期 | Claude Skill 开发 | 🔜 |
| 第8期 | 多模态应用开发 | 🔜 |
| 第9期 | 本地部署与生产优化 | 🔜 |

---

## License

[MIT](./LICENSE)
