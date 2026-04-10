# Node.js 运行时

## 概述

Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境。它使得 JavaScript 可以在服务器端运行，实现了全栈 JavaScript 开发的可能。Node.js 采用事件驱动、非阻塞 I/O 模型，使其轻量且高效。

## 核心架构

### 事件循环

Node.js 的核心是事件循环（Event Loop），它负责处理异步操作。事件循环分为多个阶段：timers（定时器回调）、pending callbacks（待处理回调）、idle/prepare（内部使用）、poll（轮询新的 I/O 事件）、check（setImmediate 回调）和 close callbacks（关闭回调）。

### 模块系统

Node.js 支持两种模块系统：CommonJS（require/module.exports）和 ESM（import/export）。现代项目推荐使用 ESM，通过在 package.json 中设置 "type": "module" 启用。

### 包管理器

npm 是 Node.js 的默认包管理器，拥有全球最大的开源软件注册表。pnpm 和 yarn 是常用的替代方案，提供了更快的安装速度和更好的依赖管理。

## 在 AI 应用中的角色

Node.js 在 AI 应用开发中扮演关键角色。它可以作为 AI 服务的后端运行时，处理 API 请求和响应流。流式传输（Streaming）是 Node.js 的强项，天然适配 LLM 的逐 token 生成模式。结合 TypeScript，开发者可以构建类型安全的 AI 应用。

## 常用 AI 开发包

主要的 AI 开发包包括：ai（Vercel AI SDK）提供统一的模型调用接口；langchain 提供 LLM 应用开发框架；llamaindex 提供知识管理和检索框架；openai 提供 OpenAI API 的官方客户端。这些包都提供了完整的 TypeScript 类型定义。
