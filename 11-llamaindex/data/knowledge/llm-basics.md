# LLM 应用开发基础

## 什么是 LLM

大语言模型（Large Language Model，LLM）是基于 Transformer 架构的深度学习模型，通过在海量文本数据上进行预训练，学会了理解和生成自然语言。代表性模型包括 GPT 系列、Claude 系列和 DeepSeek 系列。

## RAG 检索增强生成

RAG（Retrieval-Augmented Generation）是一种结合检索和生成的技术框架。它的核心思想是：在生成回答之前，先从知识库中检索相关信息，然后将检索到的内容作为上下文提供给 LLM，从而生成更准确、更有依据的回答。

RAG 的典型流程包括：文档切分（Chunking）将长文档拆分为适当大小的片段；向量化（Embedding）将文本转换为高维向量表示；向量存储（Vector Store）将向量索引化以支持快速检索；检索（Retrieval）根据用户查询找到最相关的文档片段；生成（Generation）将检索结果作为上下文，由 LLM 生成最终回答。

## Agent 智能体

AI Agent 是能够自主规划和执行任务的智能系统。它通过工具调用（Tool Use）与外部世界交互，使用 ReAct 模式（推理-行动-观察循环）来分步解决复杂问题。

## 提示工程

提示工程（Prompt Engineering）是设计和优化 LLM 输入提示的技术。关键技巧包括：系统提示词设定角色和规则；Few-shot 学习提供示例；思维链（Chain of Thought）引导逐步推理；结构化输出使用 JSON Schema 或 Zod 约束输出格式。

## 知识管理框架

LlamaIndex 和 LangChain 是两个主流的 LLM 应用框架。LlamaIndex 专注于数据索引和检索，提供了丰富的索引类型和查询引擎。LangChain 更通用，提供了链式调用、记忆管理和 Agent 等功能。两者各有优势，可以根据需求选择使用。
