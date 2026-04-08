# 10-deployment — 本地部署与优化

> Ollama 本地部署开源模型、云端/本地混合策略、生产环境优化（缓存/限流/计费/监控）

## 概述

本模块演示如何将 LLM 应用从开发阶段推向生产环境，涵盖本地模型部署和关键优化策略。

## 环境准备

```bash
cd 10-deployment
cp .env.example .env   # 填入 API Key（部分 demo 需要）
npm install
```

**Ollama 安装（本地模型 demo 需要）：**
```bash
# 1. 安装 Ollama
# macOS: https://ollama.com/download
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 2. 拉取测试模型
ollama pull qwen3.5:9b

# 3. 验证
ollama list
```

## canirun.ai

 看看本地能跑什么模型

[www.canirun.ai](https://www.canirun.ai/)

## 运行 Demo

```bash
npm run ollama-basics     # Ollama 本地部署基础（需要 Ollama）
npm run ollama-replace    # 云端 vs 本地模型对比（需要 Ollama + API Key）
npm run caching           # 缓存策略（纯逻辑，无需 API Key）
npm run token-cost        # Token 计费与成本控制（部分需要 API Key）
npm run rate-limit        # 限流与并发控制（纯逻辑，无需 API Key）
npm run monitoring        # 监控与日志（纯逻辑，无需 API Key）
```

## Demo 内容

### ollama-basics.ts — Ollama 本地部署
1. Ollama 概念讲解 — 本地部署价值、架构、推荐模型
2. 连接检测 — 自动检测 Ollama 状态和已安装模型
3. 基础对话 — 通过 AI SDK 与本地模型对话
4. 流式输出 — `streamText` 流式对话

### ollama-replace.ts — 本地模型替换
1. 云端 vs 本地对比表（延迟/成本/隐私/质量）
2. 同一问题对比 — 云端模型 vs 本地 Ollama
3. 混合路由策略 — 简单任务→本地，复杂任务→云端

### caching.ts — 缓存策略
1. 缓存原理讲解
2. 内存 LRU 缓存 — Map 实现 + TTL
3. 文件缓存 — JSON 持久化到 data/cache/
4. 缓存命中率统计分析

### token-cost.ts — Token 计费
1. Token 计算原理 & 各模型定价表
2. usage 字段统计 — AI SDK result.usage
3. 成本计算器 — 月成本预估
4. 预算控制 — 超限自动降级到便宜模型

### rate-limit.ts — 限流与并发控制
1. 限流算法讲解（令牌桶/滑动窗口）
2. Token Bucket 实现
3. 并发信号量 — Semaphore
4. 指数退避重试

### monitoring.ts — 监控与日志
1. 生产环境监控要素讲解
2. 结构化 JSON 日志
3. 性能指标收集（P50/P95/P99）
4. Dashboard 监控报表

## model-adapter.ts 扩展

相比前序模块，新增 `ollama` provider：

```typescript
import { getModel } from './model-adapter.js';

// 使用 Ollama 本地模型
const model = getModel('ollama', 'qwen3.5:9b');

// Ollama 通过 OpenAI 兼容 API 接入
// createOpenAI({ baseURL: 'http://localhost:11434/v1', apiKey: 'ollama' })
```

支持 `OLLAMA_BASE_URL` 环境变量自定义地址。

## 技术栈

- **AI SDK v6** — `generateText` / `streamText`
- **Ollama** — 本地 LLM 推理引擎（OpenAI 兼容 API）
- **@ai-sdk/openai** — 同时适配 OpenAI 云端和 Ollama 本地
