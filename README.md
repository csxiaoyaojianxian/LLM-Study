# LLM-Study

> 大语言模型学习实践 — 从零到一的 AI 应用开发之路

面向 Web 开发者的 LLM 应用开发系统教程，以 **TypeScript/Node.js** 为主要技术栈，每个模块包含可运行代码 + 配套中文教程文章。

📦 源码：[https://github.com/csxiaoyaojianxian/LLM-Study](https://github.com/csxiaoyaojianxian/LLM-Study)

---

## 学习路线

```
基础篇 ──────────────────────── 第1期
│ 01-Start           纯前端 HTML 示例
│ 02-ai_chat_sdk     Next.js + Vercel AI SDK
│
进阶篇 ──────────────────────── 第2-3期
│ 03-prompt_engineering   Prompt 工程 + 多模型适配
│ 04-rag                  RAG 检索增强生成 ⭐
│
框架篇 ──────────────────────── 第4-6期
│ 05-langchain       LangChain.js 框架
│ 06-agent           AI Agent 智能体 ⭐
│
生态篇 ──────────────────────── 第7-8期
│ 07-mcp             MCP 协议与服务 ⭐
│ 08-skill           Claude Code Skills 定制体系
│
扩展篇 ──────────────────────── 第9-11期
│ 09-multimodal      多模态应用
│ 10-deployment      本地部署与优化
│ 11-llamaindex      LlamaIndex 知识管理
│ 12-fine-tuning     模型微调技术
│ 13-ai-platform     AI 应用平台（Coze & Dify）
│
工程篇 ────────────────────────
│ 14-harness         Claude Code 源码架构研究
```

---

## 模块总览

### 基础篇

| 模块 | 内容 | 教程 |
| --- | --- | --- |
| [01-Start](./01-Start/) | 纯前端 HTML 实现 AI 聊天，涵盖基础对话、流式输出、对话历史、Function Calling | [第1期](./AI应用实践(1)—从零构建智能聊天应用.md) |
| [02-ai_chat_sdk](./02-ai_chat_sdk/) | 使用 Next.js + Vercel AI SDK 构建完整聊天应用，体验框架级开发效率 | [第1期](./AI应用实践(1)—从零构建智能聊天应用.md) |

### 进阶篇

| 模块 | 内容 | 教程 |
| --- | --- | --- |
| [03-prompt_engineering](./03-prompt_engineering/) | **Prompt 工程进阶** — System Prompt 设计模式、CoT 思维链、Few-shot 对比实验、结构化输出（JSON Mode）、多模型统一适配层封装 | [第2期](./AI应用实践(2)—Prompt%20Engineering进阶指南.md) |
| [04-rag](./04-rag/) | **RAG 检索增强生成** — 文本分块策略、Embedding 向量化、向量数据库（ChromaDB）、相似度检索、完整 RAG Pipeline、对话式 RAG | [第3期](./AI应用实践(3)—RAG检索增强生成实战.md) |

### 框架篇

| 模块 | 内容 | 教程 |
| --- | --- | --- |
| [05-langchain](./05-langchain/) | **LangChain.js 框架** — 核心概念（Model/Prompt/Chain/Memory/Tool）、LCEL 链式调用、用 LangChain 重构 RAG、Memory 对话记忆、Output Parser、自定义 Tool | [第4期](./AI应用实践(4)—LangChain.js框架入门.md) |
| [06-agent](./06-agent/) | **AI Agent 智能体** — ReAct 模式、多工具编排、StateGraph 自定义流程图、Multi-Agent 协作、Agent 记忆与状态管理 | [第5期](./AI应用实践(5)—AI%20Agent智能体核心原理.md) / [第6期](./AI应用实践(6)—Multi-Agent与状态管理.md) |

### 生态篇

| 模块 | 内容 | 教程 |
| --- | --- | --- |
| [07-mcp](./07-mcp/) | **MCP 协议与服务** — MCP 核心概念（Resources/Tools/Prompts）、从零实现 MCP Server（TypeScript SDK）、MCP Client 调试、个人知识库 MCP Server 实战 | [第7期](./AI应用实践(7)—MCP协议与工具集成.md) |
| [08-skill](./08-skill/) | **Claude Code Skills 定制体系** — Skills（SKILL.md）能力扩展系统、渐进式披露架构、Hooks 自动化工作流、Settings 权限配置、CLAUDE.md 项目记忆 | [第8期](./AI应用实践(8)—Claude%20Code%20Skills定制体系.md) |

### 扩展篇

| 模块 | 内容 | 教程 |
| --- | --- | --- |
| [09-multimodal](./09-multimodal/) | **多模态应用** — Vision 图片理解与分析、图片生成（DALL-E）、语音识别（Whisper）与语音合成（TTS）、多模态综合对话应用 | ✅ |
| [10-deployment](./10-deployment/) | **本地部署与优化** — Ollama 本地部署开源模型、本地模型整合替换、生产环境优化（缓存/限流/Token 计费/监控）、成本控制 | ✅ |
| [11-llamaindex](./11-llamaindex/) | **LlamaIndex 知识管理** — Document/Node/Index 四层抽象、VectorStoreIndex/SummaryIndex 查询引擎、RouterQueryEngine 智能路由、ContextChatEngine 多轮对话、与 LangChain RAG 对比 | [第9期](./AI应用实践(9)—LlamaIndex知识管理与信息检索.md) |
| [12-fine-tuning](./12-fine-tuning/) | **模型微调技术** — 训练数据准备（OpenAI JSONL/Alpaca/ShareGPT 格式）、OpenAI Fine-tuning API、LoRA/QLoRA 原理与参数计算、LLM-as-Judge 评估 | [第10期](./AI应用实践(10)—Fine-tuning模型微调技术.md) |
| [13-ai-platform](./13-ai-platform/) | **AI 应用平台** — Dify API 集成（Chat/Workflow/知识库）、Coze API 集成（Bot/Plugin/Workflow）、平台 vs 自研 RAG 对比、选型策略 | [第11期](./AI应用实践(11)—AI应用平台Coze与Dify实战.md) |

### 工程篇

| 模块 | 内容 | 状态 |
| --- | --- | --- |
| [14-harness](./14-harness/) | **Claude Code 源码架构研究** — Bootstrap 启动流程、Agent Loop 消息流、Tool 系统与并发执行、多层权限体系、Hook 系统与上下文加载、10 大设计模式 | ✅ |


---

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 语言 | TypeScript / Node.js |
| 前端框架 | Next.js / React |
| AI SDK | Vercel AI SDK / LangChain.js / LangGraph / LlamaIndex.TS |
| LLM 模型 | DeepSeek / OpenAI / Claude（多模型切换） |
| 向量数据库 | ChromaDB |
| 本地部署 | Ollama |
| AI 生态 | MCP Protocol / Claude Code Skills |
| AI 平台 | Dify / Coze |
| 部署 | Vercel / Docker |

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm
- 至少一个 LLM API Key（DeepSeek / OpenAI / Claude）

### 运行各模块

**01-Start — 纯前端示例**

直接在浏览器中打开 HTML 文件即可，需要在页面中填入 API Key。

**02-ai_chat_sdk — Next.js 聊天应用**

```bash
cd 02-ai_chat_sdk
cp .env.example .env.local  # 配置你的 API Key
npm install
npm run dev
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

**07-mcp — MCP 协议与服务**

```bash
cd 07-mcp
cp .env.example .env  # 配置至少一个 API Key
npm install
npm run mcp-basics      # MCP 核心概念（无需 API Key）
npm run mcp-tools       # Tools 注册、调用、LLM 集成
npm run mcp-resources   # Resources 暴露与读取（无需 API Key）
npm run mcp-prompts     # Prompts 模板与 LLM 执行
npm run mcp-client      # 通用 Client 调试（无需 API Key）
npm run mcp-knowledge   # 知识库问答实战
```

**08-skill — Claude Code Skills 定制体系**

```bash
cd 08-skill
npm install
npm run skill-concepts    # Skills 概念讲解（无需 API Key）
npm run showcase          # 总览所有配置示例
npm run hooks-demo        # Hook 机制详解
npm run settings-explain  # Settings 层级详解
npm run setup             # 一键安装示例到 .claude/
```

**09-multimodal — 多模态应用**

```bash
cd 09-multimodal
cp .env.example .env  # 配置 API Key（Vision/DALL-E/TTS/Whisper 需要 OpenAI Key）
npm install
npm run vision            # 图片理解（Vision）
npm run image-gen         # 图片生成（DALL-E 3）
npm run speech            # 语音合成（TTS）
npm run transcription     # 语音识别（Whisper）
npm run multimodal-chat   # 多模态综合演示
```

**10-deployment — 本地部署与优化**

```bash
cd 10-deployment
cp .env.example .env  # 配置 API Key（部分 demo 需要）
npm install
# Ollama demo 需要先安装 Ollama 并拉取模型: ollama pull qwen3.5:9b
npm run ollama-basics     # Ollama 本地部署基础
npm run ollama-replace    # 云端 vs 本地模型对比
npm run caching           # 缓存策略（纯逻辑，无需 API Key）
npm run token-cost        # Token 计费与成本控制
npm run rate-limit        # 限流与并发控制（纯逻辑，无需 API Key）
npm run monitoring        # 监控与日志（纯逻辑，无需 API Key）
```

**11-llamaindex — LlamaIndex 知识管理**

```bash
cd 11-llamaindex
cp .env.example .env  # 配置 API Key
npm install
npm run index-basics      # 核心概念：Document, Node, Index（无需 API Key）
npm run query-engine      # 查询引擎对比（vector, summary, keyword）
npm run rag-llamaindex    # LlamaIndex RAG vs LangChain RAG
npm run advanced-rag      # 高级 RAG：SubQuestion, 重排序, 路由查询
```

**12-fine-tuning — 模型微调技术**

```bash
cd 12-fine-tuning
cp .env.example .env  # 配置 API Key
npm install
npm run data-preparation  # 训练数据准备（无需 API Key）
npm run fine-tuning-api   # OpenAI Fine-tuning API（需要 OpenAI Key）
npm run lora-concepts     # LoRA/QLoRA 原理（无需 API Key，无需 GPU）
npm run evaluation        # 模型评估 LLM-as-Judge
```

**13-ai-platform — AI 应用平台（Coze & Dify）**

```bash
cd 13-ai-platform
cp .env.example .env  # 配置 API Key
npm install
npm run platform-concepts   # 平台核心概念对比（无需 API Key）
npm run dify-api            # Dify API 集成（需要 Dify 部署）
npm run coze-api            # Coze API 集成（需要 Coze 凭证）
npm run platform-vs-custom  # 平台 vs 自研 RAG 对比
```

**14-harness — Claude Code 源码架构研究**

```bash
cd 14-harness
npm install
npm run 01-bootstrap     # Bootstrap 启动流程与冷启动优化
npm run 02-agent-loop    # Agent Loop 与消息流
npm run 03-tool-system   # Tool 系统与并发执行
npm run 04-permission    # 多层权限体系
npm run 05-hooks         # Hook 系统与 CLAUDE.md 上下文加载
npm run 06-patterns      # 10 大设计模式总结
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
├── 07-mcp/                            ✅ MCP 协议与服务
├── 08-skill/                          ✅ Claude Code Skills 定制体系
├── 09-multimodal/                     ✅ 多模态应用
├── 10-deployment/                     ✅ 本地部署与优化
├── 11-llamaindex/                     ✅ LlamaIndex 知识管理
├── 12-fine-tuning/                    ✅ 模型微调技术
├── 13-ai-platform/                    ✅ AI 应用平台（Coze & Dify）
├── 14-harness/                        ✅ Claude Code 源码架构研究
└── README.md                          📍 学习路线总览（本文件）
```

---

## 配套教程

每个模块配套中文教程文章，记录从原理到实现的完整过程：

| 期数 | 教程 | 覆盖模块 |
| --- | --- | --- |
| 第1期 | [从零构建智能聊天应用](./AI应用实践(1)—从零构建智能聊天应用.md) | 01-Start + 02-ai_chat_sdk |
| 第2期 | [Prompt Engineering 进阶指南](./AI应用实践(2)—Prompt%20Engineering进阶指南.md) | 03-prompt_engineering |
| 第3期 | [RAG 检索增强生成实战](./AI应用实践(3)—RAG检索增强生成实战.md) | 04-rag |
| 第4期 | [LangChain.js 框架入门](./AI应用实践(4)—LangChain.js框架入门.md) | 05-langchain |
| 第5期 | [AI Agent 智能体核心原理](./AI应用实践(5)—AI%20Agent智能体核心原理.md) | 06-agent（上） |
| 第6期 | [Multi-Agent 与状态管理](./AI应用实践(6)—Multi-Agent与状态管理.md) | 06-agent（下） |
| 第7期 | [MCP 协议与工具集成](./AI应用实践(7)—MCP协议与工具集成.md) | 07-mcp |
| 第8期 | [Claude Code Skills 定制体系](./AI应用实践(8)—Claude%20Code%20Skills定制体系.md) | 08-skill |
| 第9期 | [LlamaIndex 知识管理与信息检索](./AI应用实践(9)—LlamaIndex知识管理与信息检索.md) | 11-llamaindex |
| 第10期 | [Fine-tuning 模型微调技术](./AI应用实践(10)—Fine-tuning模型微调技术.md) | 12-fine-tuning |
| 第11期 | [AI 应用平台 Coze 与 Dify 实战](./AI应用实践(11)—AI应用平台Coze与Dify实战.md) | 13-ai-platform |

---

## License

[MIT](./LICENSE)
