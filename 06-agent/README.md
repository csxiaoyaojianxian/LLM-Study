# 06-agent — AI Agent 智能体

> 深入 Agent 的核心机制：ReAct 模式、多工具编排、StateGraph 自定义流程图、Agent 记忆与状态管理、Multi-Agent 协作

## 学习目标

- 理解 **ReAct 模式** 原理（Thought → Action → Observation 循环）
- 掌握**工具进阶**技巧（多工具编排、错误处理、结构化输出）
- 学会使用 **LangGraph StateGraph** 自定义 Agent 流程图（线性、条件分支、循环）
- 理解 **Agent 记忆体系**（MemorySaver、thread_id、checkpoint、状态回溯）
- 实践 **Multi-Agent 协作**模式（顺序流水线、条件路由循环改进）

## 前置知识

建议先完成 [05-langchain](../05-langchain/)，了解以下基础概念：
- LangChain 的 Model / Prompt / Chain / Memory / Tool
- `tool()` 工具定义、`model.bindTools()`
- `createReactAgent` 和 `createAgent` 基本用法

本模块将在此基础上**深入 Agent 内部机制和高级能力**。

## 环境配置

```bash
cd 06-agent
cp .env.example .env  # 配置至少一个 API Key
npm install
```

⚠️ **建议使用 OpenAI API Key**，Agent 依赖的 function calling 在 OpenAI 模型上最稳定。DeepSeek 也可运行但可能不稳定。

## Demo 列表

### 1. ReAct 模式 — Agent 核心原理

```bash
npm run react-agent
```

理解 Agent 的本质：**LLM + Tools + 决策循环**

| Demo | 内容 |
| --- | --- |
| Demo 1 | **手动实现 ReAct 循环** — while 循环 + bindTools，可视化 Thought/Action/Observation |
| Demo 2 | **createReactAgent** — LangGraph 预置 Agent，一行搞定 |
| Demo 3 | **createAgent** — langchain v1 高层 API |
| Demo 4 | **三种方式对比总结** |

### 2. 工具进阶

```bash
npm run tools-deep
```

工具定义的更多模式和实用技巧

| Demo | 内容 |
| --- | --- |
| Demo 1 | **实用工具集** — read_file、list_directory、get_current_time、text_length |
| Demo 2 | **多工具编排** — 一个问题触发多次不同工具调用 |
| Demo 3 | **工具错误处理** — Agent 如何从工具错误中恢复 |
| Demo 4a | **结构化输出（两阶段）** — Agent 收集信息 → withStructuredOutput 提取 JSON |
| Demo 4b | **结构化输出（单次调用）** — createAgent 的 responseFormat 一步到位 |

### 3. StateGraph — 自定义流程图

```bash
npm run state-graph
```

超越简单的 ReAct 模式，用状态图定义任意复杂的 Agent 流程

| Demo | 内容 |
| --- | --- |
| Demo 1 | **线性串联** — START → 分析 → 总结 → END |
| Demo 2 | **条件分支** — 根据 LLM 判断走不同路径（问题分类路由） |
| Demo 3 | **循环图** — 自动改进文案直到评分达标 |
| Demo 4 | **Human-in-the-Loop** — interrupt() + Command({ resume }) 暂停/恢复，FileSaver 文件持久化 |

### 4. Agent 记忆

```bash
npm run memory-agent
```

Agent 的短期记忆（对话历史）和状态管理

| Demo | 内容 |
| --- | --- |
| Demo 1 | **MemorySaver 基础** — checkpointer + thread_id，多轮对话记忆 |
| Demo 2 | **多会话隔离** — 不同 thread_id 互不干扰 |
| Demo 3 | **查看 checkpoint** — getState() 获取完整状态快照 |
| Demo 4 | **状态回溯** — 用 checkpoint_id 书签回溯，验证「撤销」效果 |
| Demo 5 | **状态导出与导入** — getState() 导出到 JSON 文件，updateState() 导入到新 Agent，跨进程迁移 |

### 5. Multi-Agent 协作

```bash
npm run multi-agent
```

多个 Agent 分工协作，各司其职

| Demo | 内容 |
| --- | --- |
| Demo 1 | **顺序流水线** — 研究 → 撰写 → 审核（编译时确定流程） |
| Demo 2 | **条件路由** — 审核不通过则返回重写（循环改进） |
| Demo 3 | **Supervisor 动态分派** — 主管 Agent 运行时决定调谁（SubAgent 模式） |
| Demo 4 | **辩论协作** — 正方 ⇄ 反方（3 轮）→ 裁判综合评判 |

## 核心知识点

### ReAct 模式

```
用户提问 → LLM 思考（Thought）
         → 决定调用工具（Action）
         → 获取工具结果（Observation）
         → 继续思考...（循环）
         → 生成最终回答
```

三种实现方式对比：

| 方式 | 适用场景 | 特点 |
| --- | --- | --- |
| 手动 while 循环 | 学习原理、深度定制 | 完全控制，代码量大 |
| createReactAgent | 需要自定义状态图 | LangGraph 底层，灵活 |
| createAgent | 快速上手（推荐） | v1 高层 API，开箱即用 |

### LangGraph StateGraph

```
状态（State）  — Annotation.Root 定义全局共享「白板」
               - Annotation<T> 默认覆盖写入
               - Reducer 模式可自定义合并（如消息追加）
节点（Node）   — (state: 完整状态) => Partial<状态>，只返回要更新的字段
               - ⚠️ 节点名不能与状态字段名重名
边（Edge）     — addEdge 无条件连接 / addConditionalEdges 条件分支
START / END   — 流程的起点和终点
```

### Checkpoint 持久化

每个节点执行后 checkpointer 存一份状态快照（类似 Git commit）：
- `channel_values` — 所有 Annotation 字段的当前值（白板快照）
- `channel_versions` — 字段版本号（增量更新）
- `metadata` — 来源、步骤号、节点名
- `pendingWrites` — interrupt 暂停时的挂起信息

生产环境持久化方案：
| 方案 | 适用场景 |
| --- | --- |
| MemorySaver | 开发/测试（进程退出丢失） |
| FileSaver（自定义） | 教学演示（本地文件持久化） |
| PostgresSaver | 生产环境（跨进程/服务器） |
| RedisSaver | 高频读写场景 |
| LangGraph Platform | 托管服务（自带持久化） |

### Agent 记忆体系

```
MemorySaver      — 内存级 checkpointer
thread_id        — 会话标识，不同 thread 隔离
getState()       — 获取当前状态快照
getStateHistory  — 遍历历史 checkpoint
checkpoint_id    — 回溯到指定历史状态（需用安全书签，避免工具调用中间态）
updateState()    — 手动写入状态，实现跨进程状态迁移
```

### Multi-Agent 四种协作模式

```
模式 1 — 顺序流水线（Demo 1）
  START → [研究] → [撰写] → [审核] → END

模式 2 — 条件路由（Demo 2）
  START → [研究] → [撰写] → [审核] ─┬─ 合格 → END
                      ▲              │
                      └── 不合格 ────┘

模式 3 — Supervisor 动态分派（Demo 3）
            ┌──────────────┐
      ┌────▶│  supervisor  │◀────┐
      │     └──────┬───────┘     │
      │   ┌───────┼────────┐    │
      │   ▼       ▼        ▼    │
      │ research writer translator
      │   └───────┴────────┘    │
      └──────────┘  DONE──▶ finalize → END

模式 4 — 辩论协作（Demo 4）
  START → [正方] → [反方] ─┬─ 继续 → [正方]（循环）
                           └─ 结束 → [裁判] → END
```

| 模式 | 结构 | 适用场景 |
| --- | --- | --- |
| 顺序流水线 | A → B → C | 明确的多阶段任务 |
| 条件路由 | A → B → C →[B/END] | 需要质量门控 |
| Supervisor | 主管 →[A\|B\|C]→ 主管循环 | 动态任务分配（SubAgent） |
| 辩论协作 | A ⇄ B（多轮）→ 裁判 | 多角度评估 / 对抗生成 |

## 技术栈

- **LangChain v1** (`langchain@^1.3`) — 高层 API
- **LangGraph** (`@langchain/langgraph@^1.2`) — Agent 编排框架
- **@langchain/openai** — OpenAI/DeepSeek 模型接入
- **Zod** — 工具参数和输出 Schema 验证
- **TypeScript + tsx** — 直接运行 TS，无需编译

## 项目结构

```
06-agent/
├── src/
│   ├── model-chat.ts        # 模型工厂函数（复用自 05-langchain）
│   ├── react-agent.ts       # ReAct 模式 — Agent 核心原理
│   ├── tools-deep.ts        # 工具进阶 — 多工具编排、错误处理
│   ├── state-graph.ts       # StateGraph — 自定义流程图
│   ├── memory-agent.ts      # Agent 记忆 — MemorySaver + 状态回溯
│   └── multi-agent.ts       # Multi-Agent — 多智能体协作
├── .env.example             # 环境变量模板
├── package.json
├── tsconfig.json
└── README.md
```
