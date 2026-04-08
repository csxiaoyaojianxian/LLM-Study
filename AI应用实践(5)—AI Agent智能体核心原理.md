# AI应用实践(5)—AI Agent智能体核心原理

前面几篇我们已经让模型学会了聊天、结构化输出、访问知识库和调用工具，但整体流程仍然是业务代码写死的。Agent 的核心变化，是把“下一步做什么”这件事部分交给模型自己决定。

这篇聚焦 AI Agent 的三个关键层次：ReAct 决策循环、多工具编排，以及用 StateGraph 组织复杂流程。目标不是只会调一个现成 Agent，而是理解 Agent 这套机制为什么能工作。

技术栈：LangChain v1 + LangGraph + TypeScript + Zod
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/06-agent](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/06-agent)

## 一、什么是 AI Agent

### 1.1 从"聊天机器人"到"智能体"的飞跃

回顾前面的内容，我们已经构建了能聊天的 AI 应用，也让它通过 Function Calling 学会了查天气、做计算。但你有没有发现一个问题？

**Function Calling 是"单次调用"**：你问一个问题，AI 调一次工具，给你一个答案。整个流程由你的代码控制——什么时候调工具、调哪个工具，都是**你**写死的。

现在，想象一个更复杂的场景：

> 用户：帮我分析一下这个项目的依赖情况，看看有多少个依赖包，然后算一下 devDependencies 占总依赖的百分比。

要完成这个任务，AI 需要：
1. 先列出项目目录，找到 `package.json`
2. 读取 `package.json` 的内容
3. 数出 dependencies 和 devDependencies 的数量
4. 调用计算器算百分比
5. 整理输出结果

关键点在于：**这些步骤的顺序和选择，不是你代码里写死的，而是 AI 自己决定的。** 这就是 Agent。

### 1.2 Agent = LLM + Tools + 决策循环

用一个通俗的类比来理解：

| 组件 | 类比 | 作用 |
| --- | --- | --- |
| **LLM** | 🧠 大脑 | 思考、理解、决策 |
| **Tools** | 🤲 双手 | 执行具体操作（读文件、算数、调 API） |
| **决策循环** | 🔄 自主意识 | 不断思考→行动→观察，直到任务完成 |

**LLM 是大脑**——它能理解你的需求，知道应该做什么。
**Tools 是双手**——它能执行具体操作，比如读文件、搜索、计算。
**Agent 是完整的人**——它有大脑和双手，还有自主意识，能独立完成复杂任务。

### 1.3 与 Function Calling 的区别

很多人会困惑：前面不是已经实现了 Function Calling 吗？和 Agent 有什么区别？

| 维度 | Function Calling | Agent |
| --- | --- | --- |
| **调用次数** | 通常 1 次 | 可能 N 次（自主决定） |
| **决策者** | 你的代码 | LLM 自己 |
| **流程控制** | 线性、预设 | 动态、循环 |
| **错误处理** | 你写 try-catch | Agent 自己重试或换方案 |
| **核心区别** | 工具是被调用的 | Agent 主动使用工具 |

一句话总结：**Function Calling 是给 AI 装了一只手，Agent 是给 AI 装了一个完整的决策系统。**



## 二、ReAct 模式 — Agent 的核心引擎

### 2.1 ReAct = Reasoning + Acting

ReAct 是目前最主流的 Agent 决策模式，名字来源于 **Re**asoning（推理）+ **Act**ing（行动）。它的核心思想很简单：

```
用户提问
   │
   ▼
┌─────────────────────────────┐
│  💭 Thought（思考）          │ ◀─┐
│  "我需要先查天气，再做计算"    │   │
│                              │   │
│  🔧 Action（行动）           │   │  循环
│  调用 get_weather("杭州")    │   │
│                              │   │
│  👁️ Observation（观察）       │   │
│  "杭州：晴转多云，24°C"       │   │
└──────────────┬──────────────┘   │
               │ 还需要继续？       │
               ├── 是 ────────────┘
               │
               ▼ 否
         ✅ Final Answer
```

**Thought → Action → Observation**，这三个步骤不断循环，直到 AI 认为任务完成。这就是 Agent 的"核心引擎"。

### 2.2 手动实现 ReAct 循环

理解原理最好的方式是自己实现一遍。我们用 **while 循环 + bindTools** 手动构建 ReAct：

首先定义工具（供三种实现方式共用）：

```typescript
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { createChatModel } from "./model-chat.js";

// 天气查询工具
const getWeatherTool = tool(
  async ({ city }: { city: string }) => {
    const weatherData: Record<string, string> = {
      北京: "晴天，气温 22°C，微风",
      上海: "多云，气温 25°C，东南风 3 级",
      杭州: "晴转多云，气温 24°C，西北风 2 级",
    };
    return weatherData[city] || `暂无 ${city} 的天气数据`;
  },
  {
    name: "get_weather",
    description: "查询指定城市的天气信息",
    schema: z.object({
      city: z.string().describe("城市名称，如：北京、上海"),
    }),
  }
);

// 计算器工具
const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "");
    const result = new Function(`return ${sanitized}`)();
    return `${expression} = ${result}`;
  },
  {
    name: "calculator",
    description: "计算数学表达式，支持加减乘除和括号",
    schema: z.object({
      expression: z.string().describe("数学表达式，如: 2 + 3 * 4"),
    }),
  }
);

// 知识搜索工具
const searchKnowledgeTool = tool(
  async ({ query }: { query: string }) => {
    const knowledge: Record<string, string> = {
      ReAct: "ReAct 是一种 Agent 模式，LLM 交替进行推理和行动，通过工具与环境交互来解决问题。",
      Agent: "AI Agent 是能自主决策和执行任务的智能体，核心组件：LLM + Tools + Memory + Planning。",
    };
    for (const [key, value] of Object.entries(knowledge)) {
      if (query.toLowerCase().includes(key.toLowerCase())) return `📚 ${value}`;
    }
    return `未找到与「${query}」相关的知识`;
  },
  {
    name: "search_knowledge",
    description: "搜索知识库，查找技术概念和定义",
    schema: z.object({
      query: z.string().describe("搜索关键词"),
    }),
  }
);

const tools = [getWeatherTool, calculatorTool, searchKnowledgeTool];
```

然后是核心的 **ReAct 循环**——其实就是一个 while 循环：

```typescript
const model = createChatModel({ temperature: 0 });

const question = "杭州今天天气如何？另外帮我算一下 (100 + 200) * 3";

// 1. 绑定工具：让模型知道有哪些工具可用
const modelWithTools = model.bindTools!(tools);

// 2. 构建消息列表
const messages: BaseMessage[] = [new HumanMessage(question)];

// 3. ReAct 循环
let step = 0;
const MAX_STEPS = 10; // 防止死循环

while (step < MAX_STEPS) {
  step++;
  console.log(`--- 🔄 Step ${step} ---`);

  // ① LLM 思考（Thought）
  const response = await modelWithTools.invoke(messages);
  messages.push(response);

  // ② 检查是否有工具调用
  const aiMsg = response as AIMessage;
  if (!aiMsg.tool_calls || aiMsg.tool_calls.length === 0) {
    // 没有工具调用 → 任务完成，输出最终回复
    console.log("💭 Thought: 任务完成");
    console.log(`✅ Final Answer: ${response.content}`);
    break;
  }

  // ③ 执行每个工具调用（Action + Observation）
  for (const toolCall of aiMsg.tool_calls) {
    console.log(`💭 Thought: 需要调用工具获取信息`);
    console.log(`🔧 Action: ${toolCall.name}(${JSON.stringify(toolCall.args)})`);

    // 执行工具
    const toolFn = tools.find(t => t.name === toolCall.name);
    const result = await toolFn!.invoke(toolCall.args);
    console.log(`👁️  Observation: ${result}`);

    // 工具结果回传给 LLM
    messages.push(new ToolMessage({
      content: result as string,
      tool_call_id: toolCall.id!,
    }));
  }
}
```

运行效果：

```
❓ 问题: 杭州今天天气如何？另外帮我算一下 (100 + 200) * 3

--- 🔄 Step 1 ---
💭 Thought: 需要调用工具获取信息
🔧 Action: get_weather({"city":"杭州"})
👁️  Observation: 晴转多云，气温 24°C，西北风 2 级
💭 Thought: 需要调用工具获取信息
🔧 Action: calculator({"expression":"(100 + 200) * 3"})
👁️  Observation: (100 + 200) * 3 = 900

--- 🔄 Step 2 ---
💭 Thought: 任务完成
✅ Final Answer: 杭州今天晴转多云，气温 24°C，西北风 2 级。
   另外，(100 + 200) × 3 = 900。
```

看到了吗？**ReAct 的本质就是一个 while 循环 + tool_calls 判断**。LLM 自己决定要不要调工具、调哪个工具、什么时候结束。这就是 Agent 的核心。

### 2.3 createReactAgent — LangGraph 预置 Agent

手动实现帮助理解原理，但实际开发中我们会用框架。LangGraph 提供了开箱即用的 `createReactAgent`：

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// 一行搞定：框架自动处理工具绑定、循环调用、结果回传、终止判断
const reactAgent = createReactAgent({
  llm: model,
  tools,
});

const result = await reactAgent.invoke({
  messages: [new HumanMessage("什么是 ReAct 模式？另外查一下北京天气")],
});

// 打印 Agent 的完整执行过程
for (const msg of result.messages) {
  if (msg instanceof HumanMessage) {
    console.log(`👤 Human: ${msg.content}`);
  } else if (msg instanceof AIMessage) {
    if (msg.tool_calls?.length > 0) {
      for (const tc of msg.tool_calls) {
        console.log(`🤖 AI → 调用: ${tc.name}(${JSON.stringify(tc.args)})`);
      }
    }
    if (msg.content) console.log(`🤖 AI: ${msg.content}`);
  } else if (msg instanceof ToolMessage) {
    console.log(`🔧 Tool: ${msg.content}`);
  }
}
```

`createReactAgent` 帮你封装了整个 while 循环，内部用 LangGraph 的 StateGraph 实现，灵活性高，适合需要自定义状态图的场景。

### 2.4 createAgent — 高层 API（推荐）

LangChain v1 提供了更高层的 `createAgent`，API 更简洁，还支持 `systemPrompt` 等便捷参数：

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model,
  tools,
});

const result = await agent.invoke({
  messages: [new HumanMessage("帮我查一下 Agent 的定义，然后算算 999 * 111")],
});

const lastMsg = result.messages[result.messages.length - 1];
console.log(`✅ Agent 回复: ${lastMsg.content}`);
```

### 2.5 三种方式对比

| 方式 | 代码量 | 适用场景 | 特点 |
| --- | --- | --- | --- |
| **手动 while 循环** | ~40 行 | 学习原理、深度定制 | 完全控制每一步，理解底层机制 |
| **createReactAgent** | ~5 行 | 需要自定义状态图 | LangGraph 底层，灵活性高 |
| **createAgent** | ~5 行 | 快速上手（✅ 推荐） | v1 高层 API，开箱即用 |

💡 **核心启示**：
1. ReAct 的本质就是一个 **while 循环 + tool_calls 判断**
2. `createReactAgent` / `createAgent` 帮你封装了这个循环
3. 理解手动实现后，再用框架会事半功倍

完整源码参考：[react-agent.ts](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/06-agent/src/react-agent.ts)



## 三、工具进阶

掌握了 ReAct 循环后，我们来深入工具的高级用法：多工具编排、错误处理、结构化输出。

### 3.1 实用工具集定义

实际开发中，Agent 需要各种实用工具。以下是几个典型示例：

```typescript
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import * as fs from "fs";
import * as path from "path";

// 📄 读取文件内容（安全限制：只读项目目录）
const readFileTool = tool(
  async ({ filePath }: { filePath: string }) => {
    try {
      const absolutePath = path.resolve(filePath);
      const projectRoot = path.resolve(".");
      if (!absolutePath.startsWith(projectRoot)) {
        return `❌ 安全限制：只能读取项目目录下的文件`;
      }
      const content = fs.readFileSync(absolutePath, "utf-8");
      if (content.length > 2000) {
        return content.substring(0, 2000) + "\n... (已截断，共 " + content.length + " 字符)";
      }
      return content;
    } catch (error) {
      return `❌ 读取文件失败: ${(error as Error).message}`;
    }
  },
  {
    name: "read_file",
    description: "读取指定文件的内容（仅限项目目录）",
    schema: z.object({
      filePath: z.string().describe("文件路径，如: package.json"),
    }),
  }
);

// 📁 列出目录下的文件
const listDirectoryTool = tool(
  async ({ dirPath }: { dirPath: string }) => {
    const entries = fs.readdirSync(path.resolve(dirPath || "."), { withFileTypes: true });
    return entries.map(e => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`).join("\n");
  },
  {
    name: "list_directory",
    description: "列出指定目录下的文件和文件夹",
    schema: z.object({
      dirPath: z.string().describe("目录路径，如: .、src/"),
    }),
  }
);

// ⏰ 获取当前时间
const getCurrentTimeTool = tool(
  async ({}: Record<string, never>) => {
    return `当前时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}（北京时间）`;
  },
  {
    name: "get_current_time",
    description: "获取当前日期和时间",
    schema: z.object({}),
  }
);

// 📏 计算文本长度
const textLengthTool = tool(
  async ({ text }: { text: string }) => {
    return `字符数: ${text.length}，单词数: ${text.split(/\s+/).filter(Boolean).length}，行数: ${text.split("\n").length}`;
  },
  {
    name: "text_length",
    description: "计算文本的字符数、单词数和行数",
    schema: z.object({
      text: z.string().describe("要计算长度的文本"),
    }),
  }
);
```

定义工具的核心三要素：
- **name** — 工具名称（LLM 通过它识别工具）
- **description** — 工具描述（LLM 根据它决定何时调用）
- **schema** — Zod Schema 定义参数类型和说明

### 3.2 多工具编排：一个问题触发多次调用

Agent 最强大的地方在于：**面对一个复杂问题，它会自动拆解并按顺序调用多个不同工具**。

```typescript
const orchestrationAgent = createAgent({
  model,
  tools: [readFileTool, listDirectoryTool, calculatorTool, textLengthTool],
});

const result = await orchestrationAgent.invoke({
  messages: [new HumanMessage(
    "请读取 package.json 的内容，告诉我有多少个 dependencies 和 devDependencies，总共几个依赖？"
  )],
});
```

Agent 的执行链路：

```
❓ 问题: 读取 package.json，统计依赖数量

🔗 工具调用链:
   → read_file({"filePath":"package.json"})   // 第1步：读文件
   → calculator({"expression":"5 + 3"})        // 第2步：算总数

✅ 回复: package.json 中有 5 个 dependencies，3 个 devDependencies，
   总共 8 个依赖包。
```

注意：**Agent 自己决定了调用顺序**——先读文件获取信息，再用计算器算总数。你不需要在代码里写这个流程。

### 3.3 工具错误处理：Agent 如何从错误中恢复

真实环境中，工具调用可能失败（网络超时、文件不存在、API 报错）。好的 Agent 不会因为一次失败就放弃——它会尝试换一种方式：

```typescript
// 故意会出错的工具（模拟不稳定 API）
const unstableApiTool = tool(
  async ({ endpoint }: { endpoint: string }) => {
    if (endpoint.includes("error")) {
      throw new Error(`API 请求失败: ${endpoint} 返回 500`);
    }
    return `✅ API 响应成功: ${endpoint}`;
  },
  {
    name: "call_api",
    description: "调用外部 API 接口（可能会失败）",
    schema: z.object({
      endpoint: z.string().describe("API 端点"),
    }),
  }
);

const errorHandlingAgent = createAgent({
  model,
  tools: [unstableApiTool, readFileTool],
});

const result = await errorHandlingAgent.invoke({
  messages: [new HumanMessage(
    "请调用 /api/error-endpoint 获取数据。如果失败，尝试读取 package.json 获取项目信息。"
  )],
});
```

执行过程：

```
📜 执行过程:
   🤖 调用: call_api({"endpoint":"/api/error-endpoint"})
   ❌ 工具错误: API 请求失败: /api/error-endpoint 返回 500
   🤖 调用: read_file({"filePath":"package.json"})
   ✅ 工具成功: {"name":"06-agent","version":"1.0.0"...

✅ Agent 最终回复: API 调用失败了，但我成功读取了 package.json...
```

Agent 遇到错误后，**自动切换到备选方案**（读取本地文件）。这种"韧性"是简单 Function Calling 做不到的。

### 3.4 结构化输出：Agent 输出 JSON

很多场景需要 Agent 的输出是结构化的 JSON（而不是自然语言），方便程序后续处理。有两种方式：

**方式 A：两阶段 — Agent 收集 + 独立提取**

```typescript
const ProjectInfoSchema = z.object({
  projectName: z.string().describe("项目名称"),
  dependencyCount: z.number().describe("依赖总数"),
  hasTypeScript: z.boolean().describe("是否使用 TypeScript"),
  mainTechnologies: z.array(z.string()).describe("主要技术栈列表"),
});

// 第一阶段：Agent 用工具收集信息（返回自然语言）
const infoAgent = createAgent({
  model,
  tools: [readFileTool, listDirectoryTool],
});
const gatherResult = await infoAgent.invoke({
  messages: [new HumanMessage("请读取 package.json 和 tsconfig.json，收集项目信息")],
});

// 第二阶段：withStructuredOutput 提取为 JSON
// ⚠️ 使用 method: "functionCalling"，DeepSeek 等模型不支持 json_schema 但支持 function calling
const structuredModel = model.withStructuredOutput!(ProjectInfoSchema, {
  method: "functionCalling",
  name: "extract_project_info",
});
const structured = await structuredModel.invoke([
  new HumanMessage(`根据以下信息提取结构化数据：\n\n${lastMsg.content}`),
]);
// => { projectName: "06-agent", dependencyCount: 8, hasTypeScript: true, ... }
```

**方式 B：单次调用 — responseFormat 一步到位（推荐）**

```typescript
const structuredAgent = createAgent({
  model,
  tools: [readFileTool, listDirectoryTool],
  responseFormat: ProjectInfoSchema, // ← 就这一个参数
});

const result = await structuredAgent.invoke({
  messages: [new HumanMessage("请读取 package.json 和 tsconfig.json，提取项目信息")],
});

console.log(result.structuredResponse);
// => { projectName: "06-agent", dependencyCount: 8, hasTypeScript: true, ... }
```

**两种方式对比：**

| | 方式 A：两阶段 | 方式 B：responseFormat |
| --- | --- | --- |
| **调用次数** | 2 次（收集 + 提取） | 1 次（一步到位） |
| **代码量** | 较多（两段独立逻辑） | 少（一个参数搞定） |
| **灵活性** | 高（可分别定制两阶段） | 低（框架内部处理） |
| **适用场景** | 收集与提取逻辑需解耦 | 端到端一步到位（✅ 推荐） |

完整源码参考：[tools-deep.ts](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/06-agent/src/tools-deep.ts)



## 四、StateGraph — 自定义流程图

### 4.1 超越 ReAct：为什么需要 StateGraph

ReAct 模式虽然强大，但它本质上是一个**线性循环**：思考→行动→观察→思考→行动→…。在很多实际场景中，我们需要更复杂的流程：

- 📋 **线性串联**：分析 → 总结（固定流水线）
- 🔀 **条件分支**：根据问题类型路由到不同专家
- 🔄 **循环改进**：写文案 → 评审 → 不合格 → 重写 → 再评审
- ⏸️ **人工确认**：执行敏感操作前暂停，等待审批

这些复杂流程用 ReAct 难以表达，需要更通用的编排工具——**LangGraph StateGraph**。

### 4.2 核心概念：State、Node、Edge

StateGraph 只有三个核心概念，理解了它们就掌握了一切：

```
┌─────────────────────────────────────────────────────┐
│  State（状态）— 共享白板 📋                          │
│                                                      │
│  把 State 想象成会议室的白板：                         │
│  - 所有人（节点）都能看到白板上的内容                    │
│  - 每个人完成任务后，把结果写到白板上                    │
│  - 下一个人基于白板上的信息继续工作                      │
│                                                      │
│  用 Annotation.Root 定义白板的"格子"：                 │
│  { topic: string, analysis: string, summary: string } │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Node（节点）— 处理函数 ⚙️                           │
│                                                      │
│  每个节点就是一个工人：                                │
│  - 接收：完整的白板内容（state）                       │
│  - 处理：读取需要的信息，做自己的工作                    │
│  - 返回：只写回自己负责的"格子"（Partial）              │
│                                                      │
│  签名：(state: State) => Partial<State>               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Edge（边）— 节点间的连接 🔗                          │
│                                                      │
│  - addEdge(A, B)               — 无条件：A 完成后去 B │
│  - addConditionalEdges(A, fn)  — 条件：fn 决定下一步  │
│  - START / END                 — 流程的起点和终点      │
└─────────────────────────────────────────────────────┘
```

> 💡 **Annotation 的默认行为与 Reducer 模式**
>
> - `Annotation<T>` 默认行为：**后写覆盖前值**，适合每个节点负责一个字段的场景
> - **Reducer 模式**（高级）：自定义合并策略，如消息追加：
>   ```typescript
>   messages: Annotation<string[]>({
>     reducer: (prev, next) => [...prev, ...next],
>     default: () => [],
>   })
>   ```

### 4.3 Demo 1：线性串联

最简单的 StateGraph——两个节点依次执行：

```
START ──▶ 分析节点 ──▶ 总结节点 ──▶ END
              │              │
           读 topic       读 analysis
           写 analysis    写 summary
```

```typescript
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";

// 1. 定义状态 — "白板"上有三个格子
const SimpleState = Annotation.Root({
  topic: Annotation<string>,      // 输入：由 invoke() 传入
  analysis: Annotation<string>,   // 中间结果：由分析节点写入
  summary: Annotation<string>,    // 最终输出：由总结节点写入
});

// 2. 定义节点
// 签名：接收完整状态 → 返回要更新的字段（Partial）
async function analyzeNode(
  state: typeof SimpleState.State
): Promise<Partial<typeof SimpleState.State>> {
  console.log("📝 [分析节点] 分析主题:", state.topic);
  const response = await model.invoke([
    new SystemMessage("你是技术分析师，请简要分析（100字以内）。"),
    new HumanMessage(`请分析：${state.topic}`),
  ]);
  return { analysis: response.content as string };
  // ↑ 只更新 analysis，topic 和 summary 保持不变
}

async function summarizeNode(
  state: typeof SimpleState.State
): Promise<Partial<typeof SimpleState.State>> {
  console.log("📋 [总结节点] 生成总结...");
  const response = await model.invoke([
    new SystemMessage("请将分析内容总结为一句话核心观点。"),
    new HumanMessage(`分析内容：${state.analysis}`),
  ]);
  return { summary: response.content as string };
  // ↑ 只更新 summary
}

// 3. 构建状态图 — 用边连接节点
// ⚠️ 注意：节点名不能与状态字段名重名！
const graph = new StateGraph(SimpleState)
  .addNode("analyze", analyzeNode)
  .addNode("summarize", summarizeNode)
  .addEdge(START, "analyze")         // START → 分析
  .addEdge("analyze", "summarize")   // 分析 → 总结
  .addEdge("summarize", END)         // 总结 → END
  .compile();

// 4. 执行 — 传入初始状态，返回最终状态
const result = await graph.invoke({
  topic: "AI Agent 对软件开发的影响",
});

console.log("主题:", result.topic);
console.log("分析:", result.analysis);
console.log("总结:", result.summary);
```

运行效果：

```
📝 [分析节点] 分析主题: AI Agent 对软件开发的影响
📋 [总结节点] 生成总结...

📊 执行结果:
  主题: AI Agent 对软件开发的影响
  分析: AI Agent 正在改变软件开发模式，从代码补全到自动化测试...
  总结: AI Agent 将软件开发从"人写代码"推向"人机协作"的新范式。
```

### 4.4 Demo 2：条件分支 — 问题分类路由

根据 LLM 的判断结果，走不同的处理路径：

```
                       ┌─ "技术" ──▶ 🔬 技术专家 ──▶ END
START ──▶ 🏷️ 分类 ──┤
                       └─ "闲聊" ──▶ 💬 闲聊助手 ──▶ END
```

```typescript
const RouterState = Annotation.Root({
  question: Annotation<string>,   // 输入
  category: Annotation<string>,   // 分类节点写入
  answer: Annotation<string>,     // 专家节点写入
});

// 分类节点：LLM 判断问题类型
async function classifyNode(state: typeof RouterState.State) {
  const response = await model.invoke([
    new SystemMessage("判断问题类型，只回复：'技术' 或 '闲聊'"),
    new HumanMessage(state.question),
  ]);
  const category = (response.content as string).includes("技术") ? "技术" : "闲聊";
  return { category };
}

// 技术专家节点
async function techExpertNode(state: typeof RouterState.State) {
  const response = await model.invoke([
    new SystemMessage("你是资深技术专家，专业回答技术问题。"),
    new HumanMessage(state.question),
  ]);
  return { answer: `[技术专家] ${response.content}` };
}

// 闲聊助手节点
async function chatNode(state: typeof RouterState.State) {
  const response = await model.invoke([
    new SystemMessage("你是友善的聊天助手，轻松愉快。"),
    new HumanMessage(state.question),
  ]);
  return { answer: `[闲聊助手] ${response.content}` };
}

// 路由函数：根据分类结果返回下一个节点名
function routeByCategory(state: typeof RouterState.State): string {
  return state.category === "技术" ? "tech_expert" : "chat";
}

// 构建图 — addConditionalEdges 实现条件分支
const routerGraph = new StateGraph(RouterState)
  .addNode("classify", classifyNode)
  .addNode("tech_expert", techExpertNode)
  .addNode("chat", chatNode)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", routeByCategory, {
    tech_expert: "tech_expert",
    chat: "chat",
  })
  .addEdge("tech_expert", END)
  .addEdge("chat", END)
  .compile();
```

测试效果：

```
❓ 问题: TypeScript 的泛型有什么用？
  🏷️  [分类节点] 判定为: 技术
  🔬 [技术专家] 处理技术问题...
✅ 回复: [技术专家] 泛型是 TypeScript 的核心特性...

❓ 问题: 周末去哪里玩比较好？
  🏷️  [分类节点] 判定为: 闲聊
  💬 [闲聊助手] 处理日常对话...
✅ 回复: [闲聊助手] 周末可以考虑去公园、博物馆...
```

### 4.5 Demo 3：循环图 — 自动改进文案

这是 StateGraph 最有趣的能力——**条件边指回已有节点，形成循环**：

```
                 ┌───────────────────────────┐
                 │                           │
                 ▼                           │ 评分 < 8
START ──▶ ✍️ 写文案 ──▶ 📊 评审 ──┬─────────┘
                                   │
                                   │ 评分 ≥ 8
                                   ▼
                                  END
```

```typescript
const LoopState = Annotation.Root({
  topic: Annotation<string>,      // 输入：不变
  draft: Annotation<string>,      // 每次循环覆盖更新
  score: Annotation<number>,      // 每次循环覆盖更新
  feedback: Annotation<string>,   // 每次循环覆盖更新
  iteration: Annotation<number>,  // 迭代计数
});

// 写作节点：根据反馈改进（或首次撰写）
async function writeNode(state: typeof LoopState.State) {
  const iteration = (state.iteration || 0) + 1;
  console.log(`✍️  [写作] 第 ${iteration} 次撰写...`);

  const prompt = state.feedback
    ? `根据反馈改进文案：\n反馈：${state.feedback}\n原文：${state.draft}`
    : `为"${state.topic}"写一句宣传语（50字以内）`;

  const response = await model.invoke([
    new SystemMessage("你是广告文案专家。"),
    new HumanMessage(prompt),
  ]);
  return { draft: response.content as string, iteration };
}

// 评审节点：打分 + 反馈
async function reviewNode(state: typeof LoopState.State) {
  console.log(`📊 [评审] 评审第 ${state.iteration} 版...`);
  const response = await model.invoke([
    new SystemMessage("你是文案评审，评分（1-10）并给改进建议。格式：评分：X\n反馈：XXX"),
    new HumanMessage(`文案：${state.draft}`),
  ]);

  const text = response.content as string;
  const score = parseInt(text.match(/评分[：:]\s*(\d+)/)?.[1] || "7");
  const feedback = text.match(/反馈[：:]\s*([\s\S]+)/)?.[1]?.trim() || "继续改进";

  console.log(`📊 [评审] 评分: ${score}/10`);
  return { score, feedback };
}

// 条件函数：评分 ≥ 8 或迭代 ≥ 3 次就停止
function shouldContinue(state: typeof LoopState.State): string {
  if (state.score >= 8 || state.iteration >= 3) {
    console.log(state.score >= 8 ? `✅ 评分达标！` : `⚠️ 达到最大迭代次数`);
    return "end";
  }
  console.log(`🔄 评分未达标 (${state.score}/10)，继续改进...`);
  return "continue";
}

// 构建循环图
const loopGraph = new StateGraph(LoopState)
  .addNode("write", writeNode)
  .addNode("review", reviewNode)
  .addEdge(START, "write")
  .addEdge("write", "review")
  .addConditionalEdges("review", shouldContinue, {
    continue: "write",  // 不满意 → 回到写作节点（循环！）
    end: END,           // 满意 → 结束
  })
  .compile();

const result = await loopGraph.invoke({
  topic: "AI Agent 开发教程",
  iteration: 0,
  score: 0,
});
```

运行效果：

```
✍️  [写作] 第 1 次撰写...
📊 [评审] 评分: 6/10
🔄 评分未达标 (6/10)，继续改进...

✍️  [写作] 第 2 次撰写...
📊 [评审] 评分: 7/10
🔄 评分未达标 (7/10)，继续改进...

✍️  [写作] 第 3 次撰写...
📊 [评审] 评分: 8/10
✅ 评分达标！

📊 最终结果:
  文案: 用 AI Agent，让代码自己写自己——从入门到精通的智能开发之旅
  评分: 8/10
  迭代次数: 3
```

### 4.6 Demo 4：Human-in-the-Loop — 暂停等待人工确认

在很多业务场景中，Agent 执行敏感操作（如修改数据库、发送邮件、花钱）前需要**人工确认**。LangGraph 提供了 `interrupt()` + `Command({ resume })` 机制：

```
START ──▶ 📝 规划 ──▶ ⏸️ 确认 ──▶ 🚀 执行 ──▶ END
                           │
                     interrupt()
                      暂停等待
                           │
                     ─── 可能隔了几小时 ───
                           │
                     Command({ resume })
                       恢复执行
```

**工作原理：**

1. 图执行到 `interrupt()` 时，**立即暂停**，状态快照写入 checkpointer
2. `invoke()` 返回当前状态（但 interrupt 后的节点还没执行）
3. 之后（可能是几秒、几小时、甚至几天后），用 `Command({ resume: value })` 恢复执行

```typescript
import { StateGraph, Annotation, START, END, MemorySaver, interrupt, Command } from "@langchain/langgraph";

const HumanLoopState = Annotation.Root({
  request: Annotation<string>,
  plan: Annotation<string>,
  humanApproval: Annotation<string>,
  result: Annotation<string>,
});

// 规划节点
async function planNode(state: typeof HumanLoopState.State) {
  const response = await model.invoke([
    new SystemMessage("根据请求制定执行计划（50字以内）"),
    new HumanMessage(state.request),
  ]);
  return { plan: response.content as string };
}

// 确认节点 — 使用 interrupt 暂停
function confirmNode(state: typeof HumanLoopState.State) {
  console.log(`⏸️ 暂停！待确认计划: ${state.plan}`);

  // interrupt() — 暂停执行
  // 参数：传给外部的提示信息（出现在 getState() 的 tasks 中）
  // 返回值：恢复时 Command({ resume: value }) 的 value
  const approval = interrupt({
    question: "是否批准以上计划？",
    plan: state.plan,
  });

  // ↑ 第一次到这里会暂停，不走下面
  // ↓ 恢复后 approval 就是 resume 的值
  return { humanApproval: approval as string };
}

// 执行节点
async function executeNode(state: typeof HumanLoopState.State) {
  if (state.humanApproval?.includes("拒绝")) {
    return { result: "计划已取消" };
  }
  const response = await model.invoke([
    new SystemMessage("根据计划给出执行结果（50字以内）"),
    new HumanMessage(`计划: ${state.plan}`),
  ]);
  return { result: response.content as string };
}

// ⚠️ interrupt 必须配合 checkpointer，暂停后状态需要持久化
const checkpointer = new MemorySaver();

const graph = new StateGraph(HumanLoopState)
  .addNode("planning", planNode)    // ⚠️ 节点名是 "planning" 而非 "plan"，避免与状态字段 plan 重名
  .addNode("confirm", confirmNode)
  .addNode("execute", executeNode)
  .addEdge(START, "planning")
  .addEdge("planning", "confirm")
  .addEdge("confirm", "execute")
  .addEdge("execute", END)
  .compile({ checkpointer });

const threadConfig = { configurable: { thread_id: "human-loop-demo" } };

// ── 第一次调用：执行到 interrupt 暂停 ──
const state1 = await graph.invoke(
  { request: "重构项目的数据库访问层" },
  threadConfig
);
console.log("暂停状态:", { plan: state1.plan, result: state1.result || "(尚未执行)" });

// ── 之后恢复执行（传入人工确认） ──
const state2 = await graph.invoke(
  new Command({ resume: "批准，请执行" }),
  threadConfig
);
console.log("最终结果:", { plan: state2.plan, approval: state2.humanApproval, result: state2.result });
```

运行效果：

```
--- 第一次调用（会在 confirm 暂停）---
  📝 [规划节点] 分析请求，制定计划...
  ⏸️ 暂停！待确认计划: 1. 抽象 DAO 层 2. 迁移查询逻辑 3. 补充单测
  📊 暂停状态: { plan: "1. 抽象 DAO 层...", result: "(尚未执行)" }

--- 恢复执行（传入人工确认）---
  ✅ [确认节点] 收到人工反馈: 批准，请执行
  🚀 [执行节点] 计划已批准，执行中...
  📊 最终结果: { plan: "1. 抽象 DAO 层...", approval: "批准，请执行", result: "已完成 DAO 层..." }
```

**生产环境的典型架构：**

```
┌─────────┐     ┌──────────┐     ┌──────────────┐     ┌─────────┐
│  用户    │────▶│ API 服务  │────▶│ LangGraph    │────▶│ DB/Redis│
│  请求    │     │ (HTTP)   │     │ invoke()     │     │ 持久化   │
└─────────┘     └──────────┘     └──────────────┘     │ 检查点   │
                                   │ interrupt!       └─────────┘
                                   ▼                       │
                 ┌──────────┐   返回 thread_id              │
                 │ 通知人工  │   + 待确认信息                 │
                 │ (邮件/IM) │                              │
                 └────┬─────┘                              │
                      │ 人工审批（可能数小时后）               │
                      ▼                                    │
                 ┌──────────┐     ┌──────────────┐         │
                 │ 审批 API │────▶│ Command({    │────────▶│
                 │ (HTTP)   │     │   resume:... │  读取检查点
                 └──────────┘     │ })           │  继续执行
                                  └──────────────┘
```

关键点：两次 invoke 可以在不同进程甚至不同服务器上执行，状态全在 checkpointer 中。

> 💡 **Checkpoint 持久化方案选择**
>
> | 方案 | 适用场景 |
> | --- | --- |
> | MemorySaver | 开发/测试（进程退出丢失） |
> | FileSaver（自定义） | 教学演示（本地文件持久化） |
> | PostgresSaver | 生产环境（跨进程/服务器） |
> | RedisSaver | 高频读写场景 |
> | LangGraph Platform | 托管服务（自带持久化） |
>
> 源码中实现了一个 `FileSaver`，继承 `MemorySaver`，在每次 `put/putWrites` 后自动同步到 JSON 文件，支持跨进程恢复。详见 [state-graph.ts](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/06-agent/src/state-graph.ts)。

完整源码参考：[state-graph.ts](https://github.com/csxiaoyaojianxian/LLM-Study/blob/main/06-agent/src/state-graph.ts)



## 五、总结

### 本期回顾

本期我们深入了 AI Agent 的核心原理，掌握了三大核心技能：

| 知识点 | 核心内容 | 一句话总结 |
| --- | --- | --- |
| **ReAct 模式** | Thought → Action → Observation 循环 | Agent 的本质就是 while 循环 + tool_calls |
| **工具进阶** | 多工具编排、错误恢复、结构化输出 | Agent 自主决定调哪个工具、如何处理错误 |
| **StateGraph** | State + Node + Edge 自定义流程图 | 线性、分支、循环、人工确认，任意组合 |

**核心概念速查：**

```
ReAct 模式
├── 手动 while 循环 ─── 理解原理
├── createReactAgent ── LangGraph 底层，灵活
└── createAgent ─────── v1 高层 API，推荐

StateGraph 四种模式
├── 线性串联 ─────── START → A → B → END
├── 条件分支 ─────── A → [条件] → B 或 C → END
├── 循环改进 ─────── A → B → [不满意] → A（循环）
└── Human-in-the-Loop ── interrupt + Command 暂停/恢复
```

## 六、运行示例

```bash
cd 06-agent
cp .env.example .env  # 配置至少一个 API Key（推荐 OpenAI）
npm install

npm run react-agent   # ReAct 模式三种实现
npm run tools-deep    # 工具进阶
npm run state-graph   # StateGraph 自定义流程图
```

## 七、参考资料

**官方文档：**
- [LangGraph 官方文档](https://langchain-ai.github.io/langgraphjs/)
- [LangChain v1 文档](https://js.langchain.com/)
- [ReAct 论文](https://arxiv.org/abs/2210.03629)

**相关代码：**
- [06-agent](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/06-agent)
