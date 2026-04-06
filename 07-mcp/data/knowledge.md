# LLM-Study 知识库

> 本文件是 MCP 知识库 Server 的示例数据源，包含 LLM 应用开发的核心知识点。

## MCP 协议简介

MCP（Model Context Protocol，模型上下文协议）是由 Anthropic 提出的开放标准协议，旨在标准化 AI 应用与外部数据源/工具之间的通信方式。

MCP 的核心理念是"即插即用"——就像 USB 协议让各种外设可以轻松连接电脑一样，MCP 让 AI 模型可以轻松连接各种数据源和工具。

### 核心架构

MCP 采用 Client-Server 架构：
- **Host**: 运行 AI 模型的应用（如 Claude Desktop、IDE 插件）
- **Client**: Host 中负责与 Server 通信的模块
- **Server**: 提供数据和工具的服务端程序

### 三大核心能力

1. **Tools（工具）**: 让 LLM 可以调用外部函数，类似 Function Calling
2. **Resources（资源）**: 向 LLM 暴露数据和文件，类似 RAG 的数据源
3. **Prompts（提示模板）**: 可复用的参数化 Prompt 模板

## MCP vs REST API

传统 REST API 需要为每个服务编写专门的适配代码，而 MCP 提供了统一的协议标准：

| 维度 | REST API | MCP |
| --- | --- | --- |
| 通信方式 | HTTP 请求/响应 | JSON-RPC over stdio/SSE |
| 发现机制 | 需查阅文档 | 自动能力发现（listTools 等） |
| 适配成本 | 每个 API 单独对接 | 统一协议，即插即用 |
| LLM 友好 | 需自行包装 | 原生支持工具调用 |

## Vercel AI SDK 简介

Vercel AI SDK 是一个用于构建 AI 应用的 TypeScript 工具包，提供了统一的接口来对接多种 AI 模型提供商。

### 核心特性

- **多模型支持**: OpenAI、Anthropic、DeepSeek 等
- **流式输出**: 支持 Server-Sent Events 流式响应
- **工具调用**: 内置 Tool 定义与执行框架
- **结构化输出**: 基于 Zod Schema 的 JSON 输出
- **React Hooks**: useChat、useCompletion 等前端 Hooks

### 常用函数

- `generateText()` — 生成完整文本
- `streamText()` — 流式生成文本
- `generateObject()` — 生成结构化 JSON 对象

## RAG 检索增强生成

RAG（Retrieval-Augmented Generation）是一种将外部知识注入 LLM 的技术方案。

### RAG 流程

1. **文档分块**: 将长文档切分为小段落
2. **向量化**: 使用 Embedding 模型将文本转换为向量
3. **存储**: 将向量存入向量数据库（如 ChromaDB）
4. **检索**: 根据用户查询检索最相关的文档块
5. **生成**: 将检索到的内容作为上下文，让 LLM 生成回答

### RAG vs Fine-tuning

- RAG 适合动态知识、实时更新的场景
- Fine-tuning 适合固定领域知识、风格迁移

## Prompt Engineering

Prompt Engineering（提示工程）是设计和优化输入提示以获得最佳 LLM 输出的技术。

### 核心技巧

1. **System Prompt**: 设定 AI 角色和行为规范
2. **Few-shot Learning**: 提供示例引导输出格式
3. **Chain of Thought**: 要求逐步推理，提升复杂任务准确性
4. **结构化输出**: 指定 JSON/XML 等输出格式

## AI Agent

AI Agent（智能体）是能够自主规划、使用工具、完成复杂任务的 AI 系统。

### ReAct 模式

ReAct = Reasoning + Acting，LLM 交替进行推理和行动：
1. **Thought**: 分析当前状况，决定下一步
2. **Action**: 调用工具执行操作
3. **Observation**: 观察执行结果
4. 重复直到任务完成

### Multi-Agent

多个 Agent 协作完成复杂任务：
- **顺序流水线**: Agent A → Agent B → Agent C
- **条件路由**: 根据任务类型分配给不同 Agent
- **协作循环**: 多个 Agent 迭代改进结果
