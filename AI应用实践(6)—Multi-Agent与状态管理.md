# AI应用实践(6)—Multi-Agent与状态管理

上一期解决了 Agent 如何思考和调用工具，这一篇继续补上两个更接近真实生产的问题：记忆和协作。

没有状态管理，Agent 每次运行都像失忆；没有角色拆分，复杂任务很快就会变成一个巨大而脆弱的提示词。这里我们重点看 Agent 的记忆体系、状态回溯，以及 Multi-Agent 的几种协作方式。

技术栈：LangChain v1 + LangGraph + OpenAI/DeepSeek + TypeScript
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study](https://github.com/csxiaoyaojianxian/LLM-Study)



**本期内容概览：**

- 🧠 Agent 记忆体系：MemorySaver + thread_id + checkpoint 状态回溯
- 💾 状态导出与导入：跨进程迁移 Agent 状态
- 👥 Multi-Agent 四种协作模式：顺序流水线、条件路由、Supervisor 动态分派、辩论协作



## 一、Agent 为什么需要记忆

### 1.1 回顾：LLM 是无状态的

在第 1 期中我们就提过：**大模型本身不记事**。每次 API 调用都是全新的，模型不知道你 10 秒前问过什么。要实现多轮对话，靠的是应用层把历史消息拼接到请求里。

对于简单聊天应用，一个 `history[]` 数组就够了。但 Agent 不一样。

### 1.2 Agent 的记忆需求比 Chat 更复杂

Agent 不是单纯聊天，它会**调工具、做决策、产生中间结果**。一个 Agent 跑一次任务，可能经历这样的过程：

```
用户提问 → LLM 思考 → 调用计算器 → 拿到结果 → 再调用笔记工具 → 保存结果 → 生成回复
```

这里面有 6 条消息（Human、AI、ToolCall、ToolResult、AI、ToolCall...），比简单的 user-assistant 一问一答复杂得多。

如果你的 Agent 跑完第一个任务就"失忆"了，用户说"帮我用刚才的计算结果做一张报表"，Agent 只能一脸茫然——**刚才？什么刚才？**

### 1.3 类比：没有记忆的 Agent = 每次都失忆的员工

想象你雇了一个助理：

| 场景 | 没有记忆的 Agent | 有记忆的 Agent |
| --- | --- | --- |
| 你说"我叫小明" | ✅ 知道 | ✅ 知道 |
| 下一句"我叫什么？" | ❌ 不知道（新的一次调用） | ✅ 你叫小明 |
| 再下一句"帮我算下年龄" | ❌ 不知道你的出生年份 | ✅ 还记得之前的上下文 |
| 换一个话题开始新对话 | —— | ✅ 新会话，互不干扰 |

Agent 的记忆体系就是要解决这个问题：**同一会话内保持上下文，不同会话之间互相隔离**。



## 二、MemorySaver — Agent 记忆基础

### 2.1 核心机制：checkpointer + thread_id

LangGraph 的记忆方案非常直观——两个概念就够了：

- **checkpointer**：状态存储器，每次 Agent 执行后自动保存一份"状态快照"
- **thread_id**：会话标识，就像聊天软件的"会话 ID"

```
Agent 第 1 次调用 (thread_id="session-001")
  → LangGraph 执行完毕
  → checkpointer 自动保存状态快照 #1

Agent 第 2 次调用 (thread_id="session-001")
  → checkpointer 自动加载快照 #1 的历史
  → Agent 带着记忆继续工作
  → checkpointer 自动保存状态快照 #2
```

代码只需 3 步：

```typescript
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";

// 1️⃣ 创建 MemorySaver（内存级存储）
const memory = new MemorySaver();

// 2️⃣ 创建 Agent 时传入 checkpointer
const agent = createAgent({
  model,
  tools,
  checkpointer: memory,
});

// 3️⃣ 调用时通过 thread_id 标识会话
const threadConfig = { configurable: { thread_id: "session-001" } };

// 第 1 轮对话
await agent.invoke(
  { messages: [new HumanMessage("我叫小明，我是前端工程师")] },
  threadConfig
);

// 第 2 轮对话 — 同一 thread_id，Agent 记得你
const result = await agent.invoke(
  { messages: [new HumanMessage("我叫什么名字？")] },
  threadConfig
);
// 🤖 Agent: 你叫小明，你是一名前端工程师
```

就这么简单。`MemorySaver` 在内存中自动维护每个 `thread_id` 的完整消息历史，你不需要手动拼接 `history[]`。

### 2.2 多会话隔离

不同 `thread_id` 之间完全隔离，就像两个独立的聊天窗口：

```typescript
const threadAlice = { configurable: { thread_id: "user-alice" } };
const threadBob   = { configurable: { thread_id: "user-bob" } };

// Alice 的会话
await agent.invoke(
  { messages: [new HumanMessage("我是 Alice，我喜欢 React")] },
  threadAlice
);

// Bob 的会话
await agent.invoke(
  { messages: [new HumanMessage("我是 Bob，我喜欢 Vue")] },
  threadBob
);

// 在 Alice 的会话中问
await agent.invoke(
  { messages: [new HumanMessage("我叫什么？我喜欢什么框架？")] },
  threadAlice
);
// 🤖 你是 Alice，你喜欢 React（不会串到 Bob 的信息）

// 在 Bob 的会话中问
await agent.invoke(
  { messages: [new HumanMessage("我叫什么？我喜欢什么框架？")] },
  threadBob
);
// 🤖 你是 Bob，你喜欢 Vue
```

**类比**：`thread_id` 就像微信的群聊 ID。Alice 群里说的话，Bob 群看不到。

运行 Demo：

```bash
cd 06-agent
npm run memory-agent
# 查看 Demo 1（多轮对话记忆）和 Demo 2（多会话隔离）
```



## 三、Checkpoint — 状态快照与回溯

### 3.1 checkpoint 的本质：类似 Git commit

每次 Agent 执行一个节点后，checkpointer 都会保存一份完整的状态快照。你可以把它理解为 **Git commit**：

| Git | Checkpoint |
| --- | --- |
| 每次 `git commit` 保存一个代码快照 | 每个节点执行后保存一个状态快照 |
| 用 commit hash 唯一标识 | 用 `checkpoint_id` 唯一标识 |
| `git log` 查看提交历史 | `getStateHistory()` 查看快照历史 |
| `git checkout <hash>` 回到历史版本 | 指定 `checkpoint_id` 回到历史状态 |

### 3.2 getState() — 查看当前状态

`getState()` 返回当前 thread 的完整状态快照：

```typescript
const state = await agent.getState(threadConfig);

console.log("消息总数:", state.values.messages?.length);
console.log("checkpoint_id:", state.config?.configurable?.checkpoint_id);
```

返回的状态对象包含以下关键字段：

| 字段 | 说明 | 类比 |
| --- | --- | --- |
| `channel_values` | 所有状态字段的当前值（白板快照） | Git 的工作目录内容 |
| `channel_versions` | 字段版本号（增量更新） | Git 的 diff |
| `metadata` | 来源、步骤号、节点名 | Git 的 commit message |
| `pendingWrites` | interrupt 暂停时的挂起信息 | Git 的 stash |

### 3.3 状态回溯：用 checkpoint_id 回到历史状态

这是 Agent 记忆最强大的能力之一——**撤销**。假设 Agent 经历了 4 轮对话：

```
第 1 轮：我叫小明，前端工程师
第 2 轮：问名字和职业       ← 我们记录这个 checkpoint_id 作为"书签"
第 3 轮：帮我算年龄（2026-1993=33）
第 4 轮：总结所有信息
```

如果我们回溯到第 2 轮的 checkpoint，Agent 会"忘记"第 3、4 轮的所有内容：

```typescript
// 📌 在第 2 轮结束后记录 checkpoint_id 作为"书签"
const stateAfterRound2 = await agent.getState(threadConfig);
const bookmarkId = stateAfterRound2.config?.configurable?.checkpoint_id;

// ... 继续第 3、4 轮对话 ...

// 🔄 回溯到第 2 轮
const rollbackConfig = {
  configurable: {
    thread_id: "session-001",
    checkpoint_id: bookmarkId,  // 回到书签位置
  },
};

// 在回溯点上继续对话
const result = await agent.invoke(
  { messages: [new HumanMessage("我多大了？你知道我的年龄吗？")] },
  rollbackConfig
);
// 🤖 Agent: 你没有告诉过我你的年龄（第 3 轮的计算已被"撤销"）

// 但仍然记得书签之前的内容
const result2 = await agent.invoke(
  { messages: [new HumanMessage("那你还记得我叫什么名字吗？")] },
  { configurable: { thread_id: "session-001" } }
);
// 🤖 Agent: 你叫小明，是一名前端工程师（第 1 轮在书签之前，未被撤销）
```

### 3.4 安全书签：避免回溯到工具调用中间态

**这是一个容易踩的坑。** Agent 调用工具时，会产生多个中间 checkpoint：

```
LLM 决定调用工具 → checkpoint（含 tool_use 消息）
工具执行完毕    → checkpoint（含 tool_result 消息）
LLM 生成回复    → checkpoint（完整消息序列）
```

如果你盲猜"倒数第 N 个 checkpoint"回溯，可能恰好落在 tool_use 之后、tool_result 之前——消息序列不完整，API 会报错：

```
Error: tool_use ids were found without tool_result blocks
```

**正确做法**：在安全的时间点（如每轮对话结束后）主动记录 `checkpoint_id` 作为"书签"，回溯时只用书签。

```typescript
// ✅ 正确：在安全时间点记录书签
const safeState = await agent.getState(threadConfig);
const safeBookmark = safeState.config?.configurable?.checkpoint_id;

// ❌ 错误：从 history 里盲猜"倒数第 3 个"
// 可能落在工具调用的中间状态
```

运行 Demo：

```bash
npm run memory-agent
# 查看 Demo 3（checkpoint 状态查看）和 Demo 4（状态回溯）
```



## 四、状态导出与导入

### 4.1 为什么需要状态迁移

`MemorySaver` 是内存级存储，进程一退出数据就没了。但在实际生产中，你可能需要：

- 服务 A 的 Agent 对话状态迁移到服务 B 继续
- 定期备份 Agent 状态到文件或数据库
- 从备份恢复 Agent 状态

### 4.2 导出：getState() → JSON 文件

```typescript
// Step 1: 获取当前状态
const exportState = await agent.getState(threadConfig);
const messages = exportState.values.messages || [];

// Step 2: 序列化消息（提取类型和内容）
const serializedMessages = messages.map((msg) => ({
  type: msg instanceof HumanMessage ? "human"
    : msg instanceof AIMessage ? "ai"
    : msg instanceof ToolMessage ? "tool" : "unknown",
  content: msg.content,
  tool_calls: msg.tool_calls || undefined,
  tool_call_id: msg.tool_call_id || undefined,
}));

// Step 3: 写入 JSON 文件
fs.writeFileSync("agent-state-export.json", JSON.stringify({
  thread_id: "session-001",
  message_count: serializedMessages.length,
  messages: serializedMessages,
  exported_at: new Date().toISOString(),
}, null, 2));
```

### 4.3 导入：JSON 文件 → updateState()

```typescript
// Step 1: 创建全新的 Agent（空 MemorySaver）
const newMemory = new MemorySaver();
const newAgent = createAgent({ model, tools, checkpointer: newMemory });
const newThreadConfig = { configurable: { thread_id: "imported-session" } };

// Step 2: 从文件读取并反序列化消息
const importData = JSON.parse(fs.readFileSync("agent-state-export.json", "utf-8"));
const restoredMessages = importData.messages.map((m) => {
  if (m.type === "human") return new HumanMessage(m.content);
  if (m.type === "ai") {
    const aiMsg = new AIMessage(m.content);
    if (m.tool_calls) aiMsg.tool_calls = m.tool_calls;
    return aiMsg;
  }
  if (m.type === "tool") {
    return new ToolMessage({ content: m.content, tool_call_id: m.tool_call_id || "" });
  }
  return new HumanMessage(m.content);
});

// Step 3: 用 updateState 写入新 Agent 的 checkpointer
await newAgent.updateState(newThreadConfig, { messages: restoredMessages });

// Step 4: 验证 — 新 Agent 继续对话
const result = await newAgent.invoke(
  { messages: [new HumanMessage("你还记得我叫什么名字吗？")] },
  newThreadConfig
);
// 🤖 新 Agent: 你叫小明，是一名前端工程师（状态成功迁移！）
```

### 4.4 生产环境持久化方案对比

`MemorySaver` 只适合开发测试。生产环境需要更持久的方案：

| 方案 | 存储位置 | 适用场景 | 特点 |
| --- | --- | --- | --- |
| **MemorySaver** | 内存 | 开发/测试 | 进程退出即丢失 |
| **FileSaver**（自定义） | 本地文件 | 教学演示 | 简单但不适合分布式 |
| **PostgresSaver** | PostgreSQL | 生产环境 | 跨进程/服务器，推荐 |
| **RedisSaver** | Redis | 高频读写场景 | 快速但需注意持久化配置 |
| **LangGraph Platform** | 托管服务 | 团队协作 | 自带持久化，开箱即用 |

运行 Demo：

```bash
npm run memory-agent
# 查看 Demo 5（状态导出与导入）
```



## 五、Multi-Agent — 多智能体协作

### 5.1 为什么需要多 Agent

上一期我们构建的单个 Agent 已经很强了——能推理、能调工具、能自动循环。但面对复杂任务，一个 Agent 也有力不从心的时候。

**类比：一个人 vs 一个团队**

| 场景 | 单 Agent | Multi-Agent |
| --- | --- | --- |
| "查个天气" | ✅ 一个人轻松搞定 | 杀鸡用牛刀 |
| "研究 AI Agent，写一篇文章，翻译成英文" | 😰 一个人又查又写又翻，prompt 巨长 | ✅ 研究员查资料，作者写文章，翻译员翻译 |
| "写一篇技术博客并审核质量" | 😰 自己写自己审，难以客观 | ✅ 作者写，审核员审，不合格打回重写 |
| "针对一个技术争议给出全面分析" | 😰 容易有偏见 | ✅ 正方、反方辩论，裁判综合评判 |

**Multi-Agent 的核心思想**：把复杂任务拆分给多个专业 Agent，各司其职，通过共享状态协作。

在 LangGraph 中，实现 Multi-Agent 非常自然——**每个 Agent 就是一个 StateGraph 节点**，共享状态（Annotation）就是它们之间的"通信白板"。

接下来我们看四种经典协作模式。

### 5.2 顺序流水线

**流程图：**

```
START → [🔬 研究 Agent] → [✍️ 撰写 Agent] → [📋 审核 Agent] → END
```

**场景**：任务可以清晰地分为多个阶段，每个阶段的输出是下一个阶段的输入。就像工厂流水线——原材料进来，成品出去。

**共享状态定义：**

```typescript
const PipelineState = Annotation.Root({
  topic: Annotation<string>,         // 主题（输入）
  researchData: Annotation<string>,  // 研究资料（研究 Agent 输出）
  article: Annotation<string>,       // 文章（撰写 Agent 输出）
  review: Annotation<string>,        // 审核意见（审核 Agent 输出）
});
```

**三个 Agent 节点：**

```typescript
// 🔬 研究 Agent — 检索资料并整理要点
async function researchAgentNode(state) {
  const searchResult = await searchTool.invoke({ query: state.topic });
  const response = await model.invoke([
    new SystemMessage("你是研究助手。请整理出 3-5 个关键要点。"),
    new HumanMessage(`主题：${state.topic}\n搜索结果：${searchResult}`),
  ]);
  return { researchData: response.content };
}

// ✍️ 撰写 Agent — 根据研究资料写文章
async function writerAgentNode(state) {
  const response = await model.invoke([
    new SystemMessage("你是技术作者。根据研究资料撰写 150-200 字的技术介绍。"),
    new HumanMessage(`主题：${state.topic}\n研究资料：${state.researchData}`),
  ]);
  return { article: response.content };
}

// 📋 审核 Agent — 审核文章质量
async function reviewerAgentNode(state) {
  const response = await model.invoke([
    new SystemMessage("你是技术编辑。评分（1-10），列出优点和改进建议。"),
    new HumanMessage(`文章：${state.article}`),
  ]);
  return { review: response.content };
}
```

**构建流程图：**

```typescript
const pipelineGraph = new StateGraph(PipelineState)
  .addNode("research", researchAgentNode)
  .addNode("writer", writerAgentNode)
  .addNode("reviewer", reviewerAgentNode)
  .addEdge(START, "research")       // 起点 → 研究
  .addEdge("research", "writer")    // 研究 → 撰写
  .addEdge("writer", "reviewer")    // 撰写 → 审核
  .addEdge("reviewer", END)         // 审核 → 结束
  .compile();

// 执行
const result = await pipelineGraph.invoke({ topic: "AI Agent 技术发展趋势" });
console.log(result.article);  // 文章内容
console.log(result.review);   // 审核意见
```

**运行效果：**

```
🔬 [研究 Agent] 正在检索资料...
🔬 [研究 Agent] 整理完成
✍️  [撰写 Agent] 正在撰写文章...
✍️  [撰写 Agent] 撰写完成
📋 [审核 Agent] 正在审核文章...
📋 [审核 Agent] 审核完成

📊 流水线结果:
────────────────────────────────
📚 研究要点: 1. AI Agent 核心组件包括 LLM、工具、记忆和规划...
📝 文章: AI Agent 是当前人工智能领域最具潜力的方向之一...
📋 审核意见: 评分：7/10  优点：结构清晰...  建议：可增加具体案例...
```

顺序流水线简单直观，但有个问题：**审核不通过怎么办？** 文章质量不达标，流水线已经走完了。这就需要下一个模式。

### 5.3 条件路由

**流程图：**

```
START → [🔬 研究] → [✍️ 撰写] → [📋 审核] ─┬─ 合格(≥7分) → END
                       ▲                     │
                       └── 不合格(<7分) ─────┘
```

**关键改进**：审核节点不再直接走向 END，而是根据评分决定——合格就结束，不合格就**打回给撰写 Agent 重写**。

**新增字段：评分 + 反馈 + 迭代计数**

```typescript
const LoopPipelineState = Annotation.Root({
  topic: Annotation<string>,
  researchData: Annotation<string>,
  article: Annotation<string>,
  review: Annotation<string>,
  score: Annotation<number>,       // 审核评分
  feedback: Annotation<string>,    // 改进建议
  iteration: Annotation<number>,   // 迭代次数（防止无限循环）
});
```

**撰写 Agent 的改进版**——第二次撰写时会参考审核反馈：

```typescript
async function writerNode(state) {
  const iteration = (state.iteration || 0) + 1;
  console.log(`✍️ [撰写 Agent] 第 ${iteration} 次撰写...`);

  // 关键：如果有反馈，就根据反馈改进；否则从头写
  const prompt = state.feedback
    ? `请根据审核反馈改进文章：\n反馈：${state.feedback}\n原文：${state.article}`
    : `主题：${state.topic}\n研究资料：${state.researchData}\n\n请撰写技术介绍。`;

  const response = await model.invoke([
    new SystemMessage("你是技术文章作者，文风专业清晰。"),
    new HumanMessage(prompt),
  ]);
  return { article: response.content, iteration };
}
```

**审核 Agent 提取评分：**

```typescript
async function reviewerNode(state) {
  const response = await model.invoke([
    new SystemMessage("评审文章，严格按格式回复：\n评分：X（1-10的数字）\n反馈：XXX"),
    new HumanMessage(`文章：\n${state.article}`),
  ]);

  const text = response.content;
  // 用正则提取评分
  const scoreMatch = text.match(/评分[：:]\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 7;
  const feedbackMatch = text.match(/反馈[：:]\s*([\s\S]+)/);
  const feedback = feedbackMatch ? feedbackMatch[1].trim() : "请继续改进";

  console.log(`📋 [审核 Agent] 评分: ${score}/10`);
  return { score, feedback, review: text };
}
```

**质量门控函数：**

```typescript
function shouldRewrite(state): string {
  if (state.score >= 7 || state.iteration >= 3) {
    // 合格 或 达到最大迭代次数 → 结束
    return "end";
  }
  // 不合格 → 打回重写
  return "rewrite";
}
```

**构建带条件路由的流程图：**

```typescript
const loopPipelineGraph = new StateGraph(LoopPipelineState)
  .addNode("research", researchNode)
  .addNode("writer", writerNode)
  .addNode("reviewer", reviewerNode)
  .addEdge(START, "research")
  .addEdge("research", "writer")
  .addEdge("writer", "reviewer")
  // 🔑 条件路由：审核后根据评分决定走向
  .addConditionalEdges("reviewer", shouldRewrite, {
    rewrite: "writer",  // 不合格 → 回到撰写
    end: END,            // 合格 → 结束
  })
  .compile();
```

**运行效果：**

```
🔬 [研究 Agent] 检索资料...
✍️  [撰写 Agent] 第 1 次撰写...
📋 [审核 Agent] 审核第 1 版文章...  评分: 5/10
🔄 评分不足 (5/10)，返回重写...

✍️  [撰写 Agent] 第 2 次撰写...
📋 [审核 Agent] 审核第 2 版文章...  评分: 8/10
✅ 评分达标 (8/10)，流程结束

最终结果: 迭代次数: 2, 最终评分: 8/10
```

**注意 `iteration >= 3` 的兜底条件**——这是防止无限循环的安全措施。如果 LLM 每次都给低分，最多重写 3 次就强制结束。

### 5.4 Supervisor 动态分派

前两种模式的流程都是**编译时确定**的——不管什么输入，都走同样的路径。但有些任务，**应该由 AI 运行时决定调谁**。

**流程图：**

```
              ┌──────────────┐
        ┌────▶│   主管 Agent  │◀────┐
        │     └──────┬───────┘     │
        │   ┌────────┼────────┐    │
        │   ▼        ▼        ▼    │
        │ 🔬研究   ✍️撰写  🌐翻译  │
        │   │        │        │    │
        │   └────────┴────────┘    │
        └───────────┘   DONE──▶ 📋汇总 ──▶ END
```

**核心思想**：有一个 Supervisor（主管）Agent，它看到任务和当前进展后，**运行时决定** 下一步交给哪个 Worker。

**类比**：Supervisor 就像项目经理。你不会告诉项目经理"先让研究员查资料，再让作者写，最后让翻译翻"——你只说"帮我完成这个任务"，由项目经理自己安排。

**Reducer 追加模式——多 Worker 通信的关键：**

```typescript
const SupervisorState = Annotation.Root({
  task: Annotation<string>,
  // 🔑 Reducer 追加模式：多个 Worker 的输出追加到同一个数组
  messages: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],  // 追加合并
    default: () => [],
  }),
  finalResult: Annotation<string>,
  nextWorker: Annotation<string>,
  iteration: Annotation<number>,
});
```

**为什么需要 Reducer？** 默认的 `Annotation<T>` 是覆盖模式——后写的值会覆盖前值。但 Supervisor 模式下，多个 Worker 都往 `messages` 写入：

```
研究员返回 { messages: ["[研究员] 要点..."] }
撰写员返回 { messages: ["[撰写员] 文章..."] }
翻译员返回 { messages: ["[翻译员] English..."] }
```

如果用默认覆盖模式，每次只剩最后一个 Worker 的内容 ❌。用 `reducer: (prev, next) => [...prev, ...next]`，所有记录完整保留 ✅。

**主管决策函数：**

```typescript
async function supervisorNode(state) {
  const iteration = (state.iteration || 0) + 1;

  const response = await model.invoke([
    new SystemMessage(
      `你是项目主管，手下有三个 Worker：
- researcher: 研究员，负责搜索和整理信息
- writer: 撰写员，负责写文章
- translator: 翻译员，负责翻译为英文

根据任务和当前进展，决定下一步交给谁。
如果任务已完成，回复 "DONE"。
只回复一个词：researcher / writer / translator / DONE`
    ),
    new HumanMessage(
      `任务：${state.task}\n当前进展：\n${state.messages.slice(-3).join("\n") || "（尚未开始）"}`
    ),
  ]);

  const decision = response.content.trim().toLowerCase();
  // 解析决策...
  return { nextWorker, iteration };
}
```

**路由函数：**

```typescript
function supervisorRoute(state): string {
  if (state.nextWorker === "DONE") return "finalize";
  if (state.nextWorker === "researcher") return "researcher";
  if (state.nextWorker === "translator") return "translator";
  return "writer";
}
```

**构建流程图：**

```typescript
const supervisorGraph = new StateGraph(SupervisorState)
  .addNode("supervisor", supervisorNode)
  .addNode("researcher", researchWorker)
  .addNode("writer", writerWorker)
  .addNode("translator", translatorWorker)
  .addNode("finalize", finalizeNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", supervisorRoute, {
    researcher: "researcher",
    writer: "writer",
    translator: "translator",
    finalize: "finalize",
  })
  // 每个 Worker 完成后回到主管
  .addEdge("researcher", "supervisor")
  .addEdge("writer", "supervisor")
  .addEdge("translator", "supervisor")
  .addEdge("finalize", END)
  .compile();
```

**运行效果：**

```
📝 任务: 研究 AI Agent 的最新进展，写一段中文介绍，然后翻译成英文

👔 [主管] 第 1 轮决策... → 交给研究员
🔬 [研究员] 执行研究任务... 完成

👔 [主管] 第 2 轮决策... → 交给撰写员
✍️  [撰写员] 执行撰写任务... 完成

👔 [主管] 第 3 轮决策... → 交给翻译员
🌐 [翻译员] 执行翻译任务... 完成

👔 [主管] 第 4 轮决策... → 任务完成
📋 [汇总] 生成最终结果...
```

主管自动安排了合理的顺序：研究 → 撰写 → 翻译 → 完成。但如果你换一个任务（比如"翻译这段英文"），主管可能直接派翻译员，跳过研究和撰写。**这就是"动态"的价值。**

### 5.5 辩论协作

**流程图：**

```
START → [🟢 正方] → [🔴 反方] → 轮次判断 ─┬─ 继续 → [🟢 正方]（循环）
                                             └─ 结束 → [⚖️ 裁判] → END
```

**场景**：对一个有争议的话题进行多角度评估。正方和反方各持立场辩论多轮，最后由裁判综合评判。

这个模式特别适合：技术选型评估、方案利弊分析、风险评估等需要**"对抗思考"** 的场景。

**共享状态——正反方论点用 Reducer 追加：**

```typescript
const DebateState = Annotation.Root({
  topic: Annotation<string>,
  // 正方论点列表 — 每轮追加一条
  proArguments: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // 反方论点列表 — 同理
  conArguments: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  round: Annotation<number>,
  verdict: Annotation<string>,
});
```

**正方 Agent——能看到反方之前的论点以便反驳：**

```typescript
async function proAgentNode(state) {
  const round = (state.round || 0) + 1;

  const previousDebate = state.conArguments.length > 0
    ? `反方之前的论点：\n${state.conArguments.map((a, i) => `${i+1}. ${a}`).join("\n")}\n请针对反方观点进行反驳，并提出新的支持论点。`
    : `这是第一轮辩论，请提出你的核心支持论点。`;

  const response = await model.invoke([
    new SystemMessage("你是辩论正方，坚定支持该观点。论点明确，50字以内，只输出一个核心论点。"),
    new HumanMessage(`辩题：${state.topic}\n\n${previousDebate}`),
  ]);
  return { proArguments: [response.content], round };
}
```

**反方 Agent——针对正方最新论点反驳：**

```typescript
async function conAgentNode(state) {
  const latestProArg = state.proArguments[state.proArguments.length - 1];
  const response = await model.invoke([
    new SystemMessage("你是辩论反方，坚定反对该观点。先反驳正方最新论点，再提出自己的反对论点。"),
    new HumanMessage(`辩题：${state.topic}\n正方最新论点：${latestProArg}`),
  ]);
  return { conArguments: [response.content] };
}
```

**轮次判断：**

```typescript
function shouldContinueDebate(state): string {
  if (state.round >= 3) return "judge";   // 3 轮结束 → 裁判
  return "continue";                       // 继续辩论
}
```

**裁判 Agent——综合评判：**

```typescript
async function judgeAgentNode(state) {
  const response = await model.invoke([
    new SystemMessage("你是公正的辩论裁判。概括双方论点，指出亮点和不足，给出综合判断。"),
    new HumanMessage(
      `辩题：${state.topic}\n` +
      `正方论点：\n${state.proArguments.map((a, i) => `${i+1}. ${a}`).join("\n")}\n` +
      `反方论点：\n${state.conArguments.map((a, i) => `${i+1}. ${a}`).join("\n")}`
    ),
  ]);
  return { verdict: response.content };
}
```

**构建辩论流程图：**

```typescript
const debateGraph = new StateGraph(DebateState)
  .addNode("pro", proAgentNode)
  .addNode("con", conAgentNode)
  .addNode("judgeAgent", judgeAgentNode)
  .addEdge(START, "pro")
  .addEdge("pro", "con")
  .addConditionalEdges("con", shouldContinueDebate, {
    continue: "pro",       // 继续 → 回到正方
    judge: "judgeAgent",   // 结束 → 裁判
  })
  .addEdge("judgeAgent", END)
  .compile();

const result = await debateGraph.invoke({
  topic: "AI 将在 5 年内取代大部分程序员的工作",
  round: 0,
});
```

**运行效果：**

```
📝 辩题: AI 将在 5 年内取代大部分程序员的工作

🟢 [正方] 第 1 轮: AI 代码生成能力指数增长，GitHub Copilot 已能自动完成...
🔴 [反方] 第 1 轮: 代码生成只是编程的冰山一角，需求分析、架构设计...
🔄 继续辩论（第 1/3 轮完成）

🟢 [正方] 第 2 轮: AI 正在攻克架构设计领域，多模态模型能理解...
🔴 [反方] 第 2 轮: 软件工程的核心是与人沟通、理解业务...
🔄 继续辩论（第 2/3 轮完成）

🟢 [正方] 第 3 轮: AI Agent 已能自主分解复杂任务...
🔴 [反方] 第 3 轮: Agent 仍需人类监督和纠错...
⏹️  辩论结束，交给裁判

⚖️  [裁判] 综合评判:
正方论据充分但过于乐观，反方理性但略显保守。
综合来看，AI 将大幅改变程序员的工作方式，但短期内全面替代不太现实...
```

运行 Demo：

```bash
npm run multi-agent
# 依次查看 Demo 1-4
```

### 5.6 四种模式对比

| 模式 | 流程结构 | 适用场景 | 流程确定时机 | 复杂度 |
| --- | --- | --- | --- | --- |
| **顺序流水线** | A → B → C → END | 明确的多阶段任务 | 编译时 | ⭐ |
| **条件路由** | A → B → C →[B/END] | 需要质量门控 | 编译时+运行时判断 | ⭐⭐ |
| **Supervisor** | 主管 →[A\|B\|C]→ 主管循环 | 动态任务分配 | 运行时（LLM 决策） | ⭐⭐⭐ |
| **辩论协作** | A ⇄ B（多轮）→ 裁判 | 多角度评估/对抗生成 | 编译时+轮次控制 | ⭐⭐ |

**选择建议：**
- 任务阶段明确 → **顺序流水线**（最简单）
- 需要"不合格打回重来" → **条件路由**
- 不确定需要哪些 Agent → **Supervisor**（最灵活）
- 需要多角度对抗思考 → **辩论协作**
- 四种模式可以**组合使用**——比如 Supervisor 的某个 Worker 内部用条件路由



## 六、总结

### Agent 体系完整回顾（第 5 + 6 期）

经过两期的学习，我们已经构建了完整的 Agent 知识体系：

| 第 5 期 | 第 6 期 |
| --- | --- |
| ReAct 模式（Agent 核心原理） | MemorySaver（Agent 记忆） |
| 工具进阶（多工具编排、错误处理） | Checkpoint（状态快照与回溯） |
| StateGraph（自定义流程图） | 状态导出/导入（跨进程迁移） |
| Human-in-the-Loop（人机交互） | Multi-Agent（四种协作模式） |

从"一个能调工具的 LLM"到"多个 Agent 组成的团队"，Agent 的能力在不断升级：

```
第 1 期: LLM 只能聊天
第 5 期: Agent = LLM + 工具 + 决策循环 → 能执行任务
第 6 期: Agent + 记忆 → 能记住上下文
         Agent + Agent → 能团队协作
```

完整源代码：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/06-agent](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/06-agent)

**官方文档：**
- [LangGraph 文档](https://langchain-ai.github.io/langgraphjs/)
- [LangChain TypeScript](https://js.langchain.com/)
- [LangGraph Checkpointing](https://langchain-ai.github.io/langgraphjs/concepts/persistence/)
- [Multi-Agent 设计模式](https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/)
