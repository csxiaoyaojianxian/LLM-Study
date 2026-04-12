# AI应用实践(10)—Fine-tuning模型微调技术

前面学了 RAG（第 3/4/9 篇），解决的是"让模型获取外部知识"。但如果你想让模型学会特定的回答风格、掌握专业术语、或者始终遵循特定的输出格式——RAG 就不够了，需要 Fine-tuning。

这篇从 Web 开发者的视角讲 Fine-tuning：不需要会 Python，不需要有 GPU，但你需要理解整个流程——数据准备、训练方式选择、API 调用、效果评估。重点放在"什么时候该用、怎么用好"，而不是底层数学推导。

技术栈：TypeScript + OpenAI Fine-tuning API + Vercel AI SDK
GitHub 仓库：[https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/12-fine-tuning](https://github.com/csxiaoyaojianxian/LLM-Study/tree/main/12-fine-tuning)

## 一、Fine-tuning 是什么

### 1.1 从类比理解

> 🎒 **类比**：你雇了一个全能的翻译，但你需要他专门翻译医学论文。
>
> - **Prompt Engineering** = 给他一份医学术语表（每次翻译前先看一遍）
> - **RAG** = 给他一个医学词典（翻译时随时查阅）
> - **Fine-tuning** = 送他去医学院进修三个月（能力内化，不再需要词典）
>
> Prompt 和 RAG 是"外挂"——每次调用都要带上。Fine-tuning 是"内功"——能力成为模型的一部分。

### 1.2 三种技术的定位

| 技术 | 解决的问题 | 成本 | 持续效果 |
|------|-----------|------|---------|
| **Prompt Engineering** | 引导模型的行为方式 | 零 | 每次都要带 |
| **RAG** | 补充模型不知道的知识 | 低 | 每次都要检索 |
| **Fine-tuning** | 改变模型的内在能力 | 高（一次性） | 永久生效 |

```
Prompt ─→ 改变"怎么问"（输入侧优化）
RAG    ─→ 改变"参考什么"（外部知识增强）
Fine-tuning ─→ 改变"怎么想"（模型内部优化）
```

用一个更完整的流程图来看三者的关系：

```
用户输入
  │
  ├── Prompt Engineering: 在输入前拼接指令 ────→ [System Prompt + 用户消息] → LLM → 输出
  │
  ├── RAG: 检索外部知识后拼入上下文 ─────────→ [检索结果 + 用户消息] → LLM → 输出
  │
  └── Fine-tuning: 模型本身被修改 ───────────→ [用户消息] → 微调后LLM → 输出
                                                           ↑
                                                     内化了风格/能力
```

### 1.3 什么时候该用 Fine-tuning

**✅ 适合的场景：**

| 场景 | 为什么 RAG/Prompt 不行 |
|------|----------------------|
| 统一回答风格（公司口吻） | 风格是"习惯"，不是"知识" |
| 缩短 Prompt（省 token 费） | Fine-tuning 让模型"记住"规则 |
| 专业术语精确表达 | 术语使用是"能力"，不是"检索" |
| 始终输出特定格式 | 格式是"习惯"，Prompt 不够稳定 |
| 特定领域的推理方式 | 推理链路需要训练，不只是提供参考 |

**❌ 不该用的场景：**

| 场景 | 应该用 |
|------|--------|
| 补充最新知识 | RAG（知识会过时，而微调不能随时更新） |
| 简单格式调整 | Zod + structured output（第 2 篇） |
| 一次性任务 | Prompt Engineering |
| 需要引用来源 | RAG（微调无法提供出处） |

> 💡 **实际决策路径**：先尝试 Prompt Engineering → 不够稳定再试 RAG → 两者都搞不定才上 Fine-tuning。Fine-tuning 的数据准备成本高，不要一上来就用。

## 二、训练数据准备

训练数据是 Fine-tuning 成功的关键——"垃圾进，垃圾出"在这里体现得淋漓尽致。本篇的 `data-preparation.ts` 演示了从数据生成到清洗、拆分、导出的完整流程。

### 2.1 数据格式详解

三种主流格式（`data-preparation.ts` 支持全部三种的生成和互转）：

**格式一：OpenAI JSONL（云端微调必用）**

```json
{"messages": [
  {"role": "system", "content": "你是一个专业的 TypeScript 编程助手。"},
  {"role": "user", "content": "什么是泛型？"},
  {"role": "assistant", "content": "泛型（Generics）允许编写可复用组件..."}
]}
```

OpenAI Fine-tuning API 唯一接受的格式。每条数据就是一轮完整对话，包含 system、user、assistant 三个角色。文件为 `.jsonl`（JSON Lines），每行一个 JSON 对象。

**格式二：Alpaca（开源微调常用）**

```json
{"instruction": "解释泛型", "input": "", "output": "泛型是..."}
```

Stanford Alpaca 项目定义的格式，三个字段：`instruction`（指令）、`input`（可选输入）、`output`（期望输出）。LLaMA-Factory 等工具原生支持。缺点是不支持多轮对话，且没有 system prompt 字段。

**格式三：ShareGPT（多轮对话，Unsloth 推荐）**

```json
{"conversations": [
  {"from": "system", "value": "你是一个专业的编程助手。"},
  {"from": "human", "value": "什么是泛型？"},
  {"from": "gpt", "value": "泛型允许编写可复用的类型安全组件。"},
  {"from": "human", "value": "能给个例子吗？"},
  {"from": "gpt", "value": "例如 function identity<T>(arg: T): T { return arg; }"}
]}
```

最适合多轮对话场景。注意角色名称与 OpenAI 不同——`human`/`gpt` 代替 `user`/`assistant`。

**三种格式对比：**

| 维度 | OpenAI JSONL | Alpaca | ShareGPT |
|------|-------------|--------|----------|
| 多轮对话 | ✅ 支持 | ❌ 仅单轮 | ✅ 支持 |
| System Prompt | ✅ 有 | ❌ 无 | ✅ 有 |
| 适用工具 | OpenAI API | LLaMA-Factory | Unsloth, LLaMA-Factory |
| 文件格式 | .jsonl（每行一条） | .json（数组） | .json（数组） |
| 生态成熟度 | ⭐⭐⭐ 最成熟 | ⭐⭐ 经典 | ⭐⭐⭐ 主流 |

代码中的类型定义清晰地描述了三种格式的结构：

```typescript
/** OpenAI Fine-tuning JSONL 格式 */
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
interface OpenAITrainingExample {
  messages: OpenAIMessage[];
}

/** Alpaca 格式 */
interface AlpacaExample {
  instruction: string;
  input: string;    // 可为空字符串
  output: string;
}

/** ShareGPT 格式 */
interface ShareGPTConversation {
  conversations: Array<{
    from: "system" | "human" | "gpt";
    value: string;
  }>;
}
```

### 2.2 格式互转

`data-preparation.ts` 实现了 OpenAI 格式到其他两种格式的转换。转换逻辑非常直观——就是字段映射：

```typescript
// OpenAI → Alpaca：提取 user 和 assistant 内容，映射到 instruction/output
const alpacaData: AlpacaExample[] = data.map((d) => ({
  instruction: d.messages.find((m) => m.role === "user")?.content || "",
  input: "",    // Alpaca 的 input 字段通常留空
  output: d.messages.find((m) => m.role === "assistant")?.content || "",
}));

// OpenAI → ShareGPT：角色名映射 user→human, assistant→gpt
const sharegptData: ShareGPTConversation[] = data.map((d) => ({
  conversations: d.messages.map((m) => ({
    from: m.role === "user" ? "human" : m.role === "assistant" ? "gpt" : "system",
    value: m.content,
  })),
}));
```

> 💡 转换过程中注意 Alpaca 格式会丢失 system prompt 和多轮对话信息。如果你的训练场景需要多轮对话，优先选 OpenAI JSONL 或 ShareGPT。

### 2.3 数据清洗流水线

原始数据 → 高质量训练数据，需要经过三步清洗：

```
原始数据 → 去重 → 长度过滤 → 质量筛选 → 数据集拆分 → 统计分析 → 输出
              ↓         ↓           ↓
          移除重复    移除过短/    移除低质量
          的问题      过长的回答    的回答
```

**步骤一：去重（基于 user message 内容）**

```typescript
const seen = new Set<string>();
deduped = data.filter(example => {
  // 提取用户消息内容作为去重依据
  const userMsg = example.messages.find(m => m.role === "user")?.content || "";
  if (seen.has(userMsg)) return false;  // 已见过，过滤掉
  seen.add(userMsg);                    // 首次出现，保留并记录
  return true;
});
```

为什么基于 user message 去重？因为同一个问题可能有不同的 assistant 回答，但训练时应该只保留一个版本（最好的那个），否则模型会"困惑"。

**步骤二：长度过滤（太短学不到，太长浪费 token）**

```typescript
const MIN_ASSISTANT_LENGTH = 20;   // 回复不能太短——太短说明回答没有实质内容
const MAX_ASSISTANT_LENGTH = 2000; // 回复不能太长——太长会浪费 token 预算

filtered = deduped.filter(example => {
  const len = example.messages.find(m => m.role === "assistant")?.content.length || 0;
  return len >= MIN_ASSISTANT_LENGTH && len <= MAX_ASSISTANT_LENGTH;
});
```

**步骤三：质量筛选（内容比例 + 完整句子检查）**

```typescript
quality = filtered.filter(example => {
  const content = example.messages.find(m => m.role === "assistant")?.content || "";
  // 检查 1: 实质内容占比（去掉空白和标点后的字符比例）
  // 如果大部分是标点和空白，说明内容质量低
  const contentRatio = content.replace(/[\s\p{P}]/gu, "").length / content.length;
  if (contentRatio < 0.3) return false;
  // 检查 2: 必须包含完整句子（中文句号、分号，或英文句号）
  // 没有结束标点说明回答可能被截断
  if (!content.includes("。") && !content.includes("；") && !content.includes(".")) {
    return false;
  }
  return true;
});
```

### 2.4 数据集拆分与统计

清洗后需要将数据拆分为训练集和验证集（通常 80%/20%）：

```typescript
function splitDataset(data: OpenAITrainingExample[], validationRatio = 0.2) {
  const shuffled = [...data].sort(() => Math.random() - 0.5); // 随机打乱
  const splitIndex = Math.floor(shuffled.length * (1 - validationRatio));
  return {
    train: shuffled.slice(0, splitIndex),
    validation: shuffled.slice(splitIndex),
  };
}
```

统计分析部分会计算关键指标，帮助你判断数据是否合理：

```typescript
// 粗略估算 token 数（中文约 1 字符 ≈ 1.5 token）
const totalChars = data.reduce(
  (sum, d) => sum + d.messages.reduce((s, m) => s + m.content.length, 0), 0
);
const estimatedTokens = Math.round(totalChars * 1.5);
```

### 2.5 运行 `npm run data-preparation` 输出

```
🚀 Fine-tuning 数据准备教程
本教程演示训练数据的准备流程，无需 API Key

============================================================
📋 1. 训练数据格式介绍
============================================================

📌 格式一：OpenAI JSONL（最常用，OpenAI Fine-tuning API 要求）
  示例:
  {"messages":[{"role":"system","content":"你是一个专业的 TypeScript 编程助手。"},...]}

📌 格式二：Alpaca（Stanford Alpaca 项目定义，开源微调常用）
  示例:
  {"instruction":"解释 TypeScript 中的泛型概念","input":"","output":"泛型是..."}

📌 格式三：ShareGPT（多轮对话，适合对话模型微调）
  示例:
  {"conversations":[{"from":"system","value":"你是一个专业的编程助手。"},...]}

💡 格式选择建议:
  OpenAI API 微调 → 必须使用 OpenAI JSONL 格式
  LLaMA-Factory → 支持 Alpaca 和 ShareGPT 格式
  Unsloth → 支持多种格式，推荐 ShareGPT

============================================================
📝 2. 生成示例训练数据
============================================================
  ✅ 生成了 10 条训练数据

============================================================
🧹 3. 数据清洗
============================================================

📌 步骤 1: 去重
  原始: 10 → 去重后: 10

📌 步骤 2: 长度过滤
  过滤条件: 20 ≤ 助手回复长度 ≤ 2000
  去重后: 10 → 长度过滤后: 10

📌 步骤 3: 质量筛选
  长度过滤后: 10 → 质量筛选后: 10

📊 清洗统计:
  原始数据: 10 条
  去重移除: 0 条
  长度过滤: 0 条
  质量筛选: 0 条
  最终保留: 10 条 (100.0%)

============================================================
✂️  4. 数据集拆分
============================================================
  总数据: 10 条
  拆分比例: 80% / 20%
  训练集: 8 条
  验证集: 2 条

📊 训练集 统计分析:
  样本数: 8
  用户消息平均长度: 12 字符
  助手回复平均长度: 168 字符
  助手回复最短: 131 字符
  助手回复最长: 195 字符
  总字符数: 1,658
  预估 Token 数: ~2,487
  每轮对话: 3 条消息（含 system）

📊 验证集 统计分析:
  样本数: 2
  ...

============================================================
🔄 5. 格式转换
============================================================

📌 OpenAI JSONL → Alpaca 格式:
  转换完成: 10 条
📌 OpenAI JSONL → ShareGPT 格式:
  转换完成: 10 条

============================================================
💾 6. 保存训练数据
============================================================
  ✅ 训练集: .../data/formatted/train.jsonl (8 条)
  ✅ 验证集: .../data/formatted/validation.jsonl (2 条)
  ✅ Alpaca: .../data/formatted/train_alpaca.json

💡 使用方式:
  OpenAI Fine-tuning: 上传 train.jsonl 和 validation.jsonl
  LLaMA-Factory: 使用 train_alpaca.json

============================================================
🎓 数据准备完成！
============================================================
📚 下一步:
  npm run fine-tuning-api → 使用 OpenAI API 进行云端微调
  npm run lora-concepts   → 了解 LoRA/QLoRA 微调原理
  npm run evaluation      → 微调效果评估
```

### 2.6 数据质量 Checklist

| 检查项 | 说明 |
|--------|------|
| ✅ 样本量 ≥ 50 条 | OpenAI 推荐至少 50 条，实际效果好需要 100-500 条 |
| ✅ System Prompt 一致 | 所有样本用相同 system prompt，保证风格统一 |
| ✅ 回答长度适中 | 50-500 字最佳，太短学不到，太长浪费 token |
| ✅ 无重复 | 去除完全相同的对话，避免模型过度拟合某些样本 |
| ✅ 覆盖多样场景 | 各种问法和主题，增强模型的泛化能力 |
| ✅ 回答质量高 | 准确、完整、格式一致——模型学到的上限就是你的数据 |

> 💡 **经验法则**：与其追求样本数量，不如确保每条数据都是高质量的。50 条精心编写的数据，通常比 500 条粗糙数据效果更好。

## 三、云端 Fine-tuning——OpenAI API

OpenAI 提供了最简单的微调方案——代码不到 30 行就能完成整个流程。`fine-tuning-api.ts` 封装了从文件上传到模型使用的全部步骤。

### 3.1 完整流程

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  上传    │ →  │  创建    │ →  │  监控    │ →  │  使用    │
│ 训练文件 │    │ 微调任务 │    │ 训练进度 │    │ 微调模型 │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
   file.create   fineTuning.     fineTuning.     chat.completions
                 jobs.create     jobs.retrieve    .create
```

### 3.2 代码实现详解

**Step 1：上传训练文件**

```typescript
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 上传 JSONL 文件，purpose 必须设为 "fine-tune"
const file = await client.files.create({
  file: fs.createReadStream("data/formatted/train.jsonl"),
  purpose: "fine-tune",  // 告诉 OpenAI 这个文件用于微调
});
// file.id → 后续创建任务时引用
// file.status → "processed" 表示文件已通过格式校验
```

`purpose: "fine-tune"` 触发 OpenAI 对文件进行格式校验：检查 JSON 格式是否合法、messages 数组是否包含必要角色、token 数是否超限等。

**Step 2：创建微调任务**

```typescript
const job = await client.fineTuning.jobs.create({
  training_file: file.id,              // 引用上传的文件 ID
  model: "gpt-4o-mini-2024-07-18",     // 基座模型（推荐性价比最高的 mini）
  hyperparameters: {
    n_epochs: 3,                       // 训练轮次，数据少可以多几轮
  },
  suffix: "ts-assistant",              // 模型名称后缀，方便辨识
});
// 创建后 job.status = "queued"，等待训练资源分配
```

超参数说明：
- `n_epochs`：训练轮次。一般 2-4 轮。数据量少（<100 条）时用 3-4 轮，数据量多（>500 条）时 1-2 轮即可
- `learning_rate_multiplier`：学习率倍率。默认自动选择，除非效果异常否则不建议手动调
- `batch_size`：批次大小。默认自动选择通常最优

**Step 3：监控训练进度**

```typescript
const status = await client.fineTuning.jobs.retrieve(job.id);
// status.status: "queued" → "validating_files" → "running" → "succeeded"

// 获取训练事件日志
const events = await client.fineTuning.jobs.listEvents(job.id, { limit: 10 });
for (const event of events.data.reverse()) {
  console.log(`${new Date(event.created_at * 1000).toLocaleTimeString()} - ${event.message}`);
}
// 典型输出:
// 14:30:01 - Created fine-tuning job
// 14:30:15 - Validating training file
// 14:30:20 - Files validated, moving job to queued state
// 14:35:00 - Fine-tuning job started
// 14:42:00 - Step 100/300: training loss=0.45
// 14:48:00 - New fine-tuned model created: ft:gpt-4o-mini-2024-07-18:org:ts-assistant:abc123
```

**Step 4：使用微调模型**

```typescript
// 微调完成后，用微调模型名称替换原始模型名即可
const response = await client.chat.completions.create({
  model: status.fine_tuned_model!,  // "ft:gpt-4o-mini-2024-07-18:org:ts-assistant:abc123"
  messages: [
    { role: "system", content: "你是一个专业的 TypeScript 编程助手。" },
    { role: "user", content: "什么是类型推断？" },
  ],
  temperature: 0.7,
  max_tokens: 300,
});
```

> 💡 微调后的模型使用方式与原始模型完全相同，只是模型名称不同。这意味着你不需要改任何业务代码，只需要换一个模型名。

### 3.3 成本估算

OpenAI 微调的费用比很多人想象的要低得多：

| 数据规模 | Tokens 估算 | 训练费用（gpt-4o-mini） | 说明 |
|----------|------------|----------------------|------|
| 50 条 × 3 epochs | ~75K tokens | ~$0.023 | 最小验证集 |
| 100 条 × 3 epochs | ~150K tokens | ~$0.045 | 推荐起步量 |
| 500 条 × 3 epochs | ~750K tokens | ~$0.225 | 正式训练 |
| 1000 条 × 2 epochs | ~1M tokens | ~$0.300 | 大规模训练 |

> 💡 **成本控制建议**：先用 10-20 条数据做小规模验证，确认格式和效果没问题，再扩大到完整数据集。小规模训练费用几乎可以忽略。

### 3.4 Fine-tuning 服务商对比

除了 OpenAI，还有多种微调方案可选：

| 方案 | 成本 | 难度 | 数据隐私 | 模型选择 | 适用场景 |
|------|------|------|---------|---------|---------|
| **OpenAI API** | 按 token 计费，低 | ⭐ 最简单 | 数据上传到 OpenAI | GPT-4o/4o-mini/3.5 | 追求便捷，信任 OpenAI |
| **Google Vertex AI** | 按 token 计费 | ⭐⭐ | 数据在 Google Cloud | Gemini 系列 | 已在 GCP 生态 |
| **AWS Bedrock** | 按 token 计费 | ⭐⭐ | 数据在 AWS | Claude/Llama/Mistral | 已在 AWS 生态 |
| **Unsloth（本地）** | 仅电费 | ⭐⭐⭐ | 完全本地 | 任意开源模型 | 有 GPU，重视隐私 |
| **LLaMA-Factory（本地）** | 仅电费 | ⭐⭐ | 完全本地 | 100+ 开源模型 | 有 GPU，需要 Web UI |
| **AutoTrain（HuggingFace）** | 按小时计费 | ⭐⭐ | HuggingFace 托管 | 任意 HF 模型 | 无 GPU，想用开源模型 |

> 🎒 **类比**：选微调方案就像选服务器部署方式——OpenAI API 像 Serverless（省心但受限），本地 Unsloth 像自建机房（灵活但费力），HuggingFace AutoTrain 像 PaaS（中间路线）。

## 四、LoRA/QLoRA——本地微调的核心技术

云端微调方便但受限于平台模型。如果你想微调开源模型（Qwen、LLaMA、Mistral），就需要了解 LoRA。`lora-concepts.ts` 是一个纯教学文件，用代码和可视化讲解原理，无需 API Key 或 GPU。

### 4.1 为什么需要 LoRA

Full Fine-tuning 的问题：更新所有参数，7B 模型需要 ~60GB 显存。

```
Full Fine-tuning:
  模型权重 W (d×d) → 全部更新 → 需要存储完整的梯度和优化器状态
  7B 模型 × FP16 = 14GB（权重） + 14GB（梯度） + 28GB（优化器 Adam 状态）≈ 56GB
  → 需要 A100 80GB 级别 GPU
```

LoRA 的核心思想：**冻结原始模型，只训练两个小矩阵**。研究发现，模型在微调时的权重更新矩阵是"低秩"的——也就是说，看似很大的更新，实际可以用两个小矩阵的乘积来近似。

### 4.2 LoRA 原理

```
全量微调:  W_new = W + ΔW           ← ΔW 和 W 一样大（d×d）
LoRA:      W_new = W + B × A         ← B(d×r) × A(r×d)，r 远小于 d

W (d×d): 原始权重，冻结不动（不需要计算梯度，不占优化器显存）
B (d×r): 低秩矩阵，需要训练
A (r×d): 低秩矩阵，需要训练
r << d （秩，通常 4/8/16/32）
```

图示：

```
  ┌───────────────────────┐
  │  W (d×d) + ΔW (d×d)  │  ← Full Fine-tuning: 训练所有 d² 个参数
  └───────────────────────┘
         ↓ LoRA 低秩分解
  ┌──────────┐   ┌──────────┐
  │  B (d×r) │ × │  A (r×d) │  ← LoRA: 只训练 2×d×r 个参数
  └──────────┘   └──────────┘
```

> 🎒 **类比**：Full Fine-tuning = 重印整本教材；LoRA = 在教材空白处写批注。教材不变（原始权重冻结），但批注（LoRA adapter）赋予了新能力。

### 4.3 参数量实算

以 7B 模型（d=4096, 32 层）、r=8 为例：

```
每个注意力层有 Q、K、V、O 四个线性层
每个线性层的 LoRA 参数 = 2 × d × r = 2 × 4096 × 8 = 65,536
每层总 LoRA 参数 = 4(QKV+O) × 65,536 = 262,144
总 LoRA 参数 = 262,144 × 32(层) = 8,388,608 ≈ 8.4M

全量微调参数: 7,000,000,000 (7B)
LoRA 参数:        8,388,608 (8.4M)
参数比例: 0.12% → 减少了 99.88%！
```

`lora-concepts.ts` 中计算了四种模型在不同 rank 下的完整参数表：

```
  模型参数量 vs LoRA 训练参数量:
  ┌────────────┬────────────┬──────────┬──────────┬──────────┬──────────┐
  │    模型    │  总参数量  │  r=4     │  r=8     │  r=16    │  r=32    │
  ├────────────┼────────────┼──────────┼──────────┼──────────┼──────────┤
  │ Qwen 1.8B  │ 1.8B       │ 1.6M     │ 3.1M     │ 6.3M     │ 12.6M    │
  │ Qwen 7B    │ 7B         │ 4.2M     │ 8.4M     │ 16.8M    │ 33.6M    │
  │ Qwen 14B   │ 14B        │ 6.6M     │ 13.1M    │ 26.2M    │ 52.4M    │
  │ LLaMA 70B  │ 70B        │ 21.0M    │ 41.9M    │ 83.9M    │ 167.8M   │
  └────────────┴────────────┴──────────┴──────────┴──────────┴──────────┘
```

观察规律：
- **r=8 对 7B 模型**：8.4M 参数，是总参数的 0.12%，效果通常已经很好
- **r=16**：双倍参数但通常只有微小提升，适合追求极致效果
- **r=32**：适合大模型或复杂任务，小模型用 r=32 反而容易过拟合
- **r=4**：参数最少，适合数据量极小或只做简单风格迁移的场景

### 4.4 QLoRA——消费级 GPU 也能训练

在 LoRA 基础上，QLoRA 将模型量化为 4-bit，进一步降低显存需求：

| 方法 | 显存需求（7B） | 可用 GPU | 训练参数量 |
|------|---------------|---------|-----------|
| Full FT (FP32) | ~120 GB | A100 80GB × 2 | 7B（全部） |
| Full FT (FP16) | ~60 GB | A100 80GB × 1 | 7B（全部） |
| LoRA (FP16) | ~16 GB | RTX 4090 / A6000 | ~8M（0.12%） |
| **QLoRA (4-bit)** | **~6 GB** | **RTX 3060 / RTX 4060** | ~8M（0.12%） |

显存计算原理：

```
Full FT (FP16):
  权重 14GB + 梯度 14GB + 优化器 28GB = ~56GB → 实际 ~60GB（含激活值）

QLoRA:
  权重（4-bit量化）3.5GB + LoRA adapter ~16MB + 优化器 ~48MB + 激活值缓存 ~2GB
  = ~6GB → RTX 3060 12GB 轻松驾驭！
```

> 🎒 **类比**：QLoRA = 先把教材缩印成口袋版（4-bit 量化），再在上面写批注（LoRA adapter）。教材虽然缩小了，但"写批注"这个操作本身不受影响。

### 4.5 本地微调工具链

`lora-concepts.ts` 介绍了三个主流工具：

| 工具 | 特点 | 安装 | 适合人群 |
|------|------|------|---------|
| **Unsloth** | 2x 速度，50% 显存优化，一键导出 GGUF | `pip install unsloth` | 追求效率，推荐首选 |
| **LLaMA-Factory** | Web UI，零代码，100+ 模型，中文友好 | `pip install llmtuner` | 不想写代码，需要 GUI |
| **PEFT (HuggingFace)** | 最灵活，支持多种 PEFT 方法 | `pip install peft` | 高级用户，研究用途 |

推荐的中文基座模型：

```
  ┌──────────────────┬──────────┬────────────────────────────┐
  │      模型        │ 参数量   │         特点               │
  ├──────────────────┼──────────┼────────────────────────────┤
  │ Qwen2.5-7B      │ 7B       │ 中文最佳，阿里开源          │
  │ LLaMA-3.1-8B    │ 8B       │ 英文最佳，Meta 开源         │
  │ Mistral-7B      │ 7B       │ 多语言平衡                  │
  │ DeepSeek-V2-Lite│ 16B(MoE) │ 高效 MoE 架构              │
  └──────────────────┴──────────┴────────────────────────────┘
```

### 4.6 从微调到部署的完整链路

```
准备数据(TS)  → QLoRA训练(Python) → 合并权重     → 导出GGUF     → Ollama部署
本篇            Unsloth/            merge_and_     llama.cpp      部署模块
                LLaMA-Factory       unload()       / Unsloth      (10-deployment)
```

**Step 1: 数据准备（TypeScript，本篇）**

运行 `npm run data-preparation` 生成 `train.jsonl`。

**Step 2: QLoRA 微调（Python，Unsloth 示例）**

```python
from unsloth import FastLanguageModel
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="Qwen/Qwen2.5-7B-Instruct",
    load_in_4bit=True,  # QLoRA 4-bit 量化加载
)
model = FastLanguageModel.get_peft_model(model, r=16)  # 添加 LoRA adapter
# ... 训练代码 ...
model.save_pretrained('my-model-lora')  # 保存 LoRA adapter（~几十 MB）
```

**Step 3: 合并 LoRA adapter 到基座模型**

```python
model = model.merge_and_unload()         # 将 adapter 合并进原始权重
model.save_pretrained('my-model-merged')  # 保存完整模型（~14 GB）
```

**Step 4: 导出 GGUF 格式（Ollama 兼容）**

```bash
# 方式一：使用 llama.cpp 转换
python convert_hf_to_gguf.py my-model-merged --outtype q4_k_m

# 方式二：Unsloth 一键导出（推荐）
model.save_pretrained_gguf("my-model", tokenizer, quantization_method="q4_k_m")
```

**Step 5: 用 Ollama 部署（对接部署模块 10-deployment）**

```bash
# 创建 Modelfile
echo "FROM ./my-model-Q4_K_M.gguf" > Modelfile
ollama create my-ts-assistant -f Modelfile
ollama run my-ts-assistant
```

部署后直接用部署模块（10-deployment）的 model-adapter 调用：

```typescript
const model = getModel("ollama", "my-ts-assistant");
```

### 4.7 LoRA 变体速览

| 变体 | 核心改进 | 适用场景 |
|------|---------|---------|
| **LoRA** | 基础低秩分解 | 通用，首选方案 |
| **QLoRA** | + 4-bit 量化 | 显存不足时 |
| **DoRA** | 分解权重为方向+大小 | 追求更好效果（+1~2%） |
| **rsLoRA** | 改进缩放因子 | 使用大 rank（r≥64）时 |
| **LoRA+** | A/B 矩阵差异化学习率 | 训练不稳定时 |

其他参数高效微调（PEFT）方法包括 Prefix Tuning（每层添加可训练前缀）、Prompt Tuning（输入前添加 soft prompt）、IA³（学习激活值缩放向量），但 **LoRA 是目前效果最好、生态最成熟的方案**。

## 五、微调效果评估

微调完不代表就成功了。`evaluation.ts` 演示了三种评估方法：关键概念覆盖率、LLM-as-Judge、过拟合检测。

### 5.1 评估数据集设计

评估数据集与训练数据集完全分开，覆盖多个类别：

```typescript
interface EvalExample {
  question: string;        // 评估问题
  expectedTopics: string[];  // 期望回答中包含的关键概念
  category: string;         // 问题分类
}

// 示例——每个类别设计 1-2 个问题，覆盖核心知识点
const dataset: EvalExample[] = [
  {
    question: "TypeScript 中 interface 和 type 有什么区别？",
    expectedTopics: ["继承", "扩展", "联合类型", "声明合并"],
    category: "类型系统",
  },
  {
    question: "什么是泛型约束？如何使用 extends 关键字？",
    expectedTopics: ["extends", "约束", "类型参数", "类型安全"],
    category: "泛型",
  },
  // ...更多问题
];
```

### 5.2 关键概念覆盖率

最简单的自动评估指标——检查回答是否包含预期的关键概念：

```typescript
function calculateTopicCoverage(answer: string, topics: string[]): number {
  let covered = 0;
  for (const topic of topics) {
    if (answer.includes(topic)) covered++;  // 简单的关键词匹配
  }
  return covered / topics.length;  // 返回 0~1 的覆盖率
}
```

评估时对每个问题调用模型，计算覆盖率和响应时间：

```typescript
async function evaluateModel(provider, modelName, dataset, label) {
  for (const example of dataset) {
    const startTime = Date.now();
    const response = await generateText({
      model: getModel(provider, modelName),
      messages: [{ role: "user", content: example.question }],
      system: "你是一个专业的 TypeScript 编程助手...",
      maxOutputTokens: 300,
    });
    const topicCoverage = calculateTopicCoverage(response.text, example.expectedTopics);
    const responseTime = Date.now() - startTime;
    // 记录结果...
  }
}
```

> 💡 **覆盖率的局限**：关键词匹配是粗粒度的——模型可能用了同义词表达同一概念但未命中关键词。它适合快速筛查，不适合精确评估。

### 5.3 LLM-as-Judge 详解

用更强的 LLM 作为评委打分——当前最实用的自动评估方法。完整流程如下：

```
评估流程:
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│  准备问题  │ →  │ 被评估模型 │ →  │ Judge 模型 │ →  │ 汇总评分   │
│ (EvalSet)  │    │ 生成回答   │    │ 打分+评语  │    │ 生成报告   │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

Judge 的 Prompt 设计是关键——需要明确评分标准、输出格式、评分维度：

```typescript
const judgePrompt = `请评估以下 AI 回答的质量（1-5分）。

问题: ${result.question}

回答: ${result.answer}

评分标准:
5分 - 完全准确、内容全面、表达清晰
4分 - 基本准确、覆盖主要知识点
3分 - 部分准确、有遗漏或不够清晰
2分 - 有明显错误或严重遗漏
1分 - 完全错误或无关

请直接回复以下 JSON 格式（不要包含其他内容）:
{"score": <1-5>, "reasoning": "<评分理由，一句话>"}`;
```

解析 Judge 返回的结果：

```typescript
const response = await chatWithModel(provider, [{ role: "user", content: judgePrompt }]);
// 从返回文本中提取 JSON
const jsonMatch = response.match(/\{[^}]+\}/);
if (jsonMatch) {
  const parsed = JSON.parse(jsonMatch[0]);
  // parsed.score → 1-5 的整数评分
  // parsed.reasoning → "回答准确覆盖了核心概念，但缺少具体代码示例"
}
```

**LLM-as-Judge 的注意事项：**

| 要点 | 说明 |
|------|------|
| Judge 模型要比被评模型强 | 用 GPT-4o 评估 GPT-4o-mini 的微调结果 |
| 避免 position bias | 如果对比两个回答，随机交换顺序 |
| 多次评估取平均 | 单次评估有随机性，建议 3 次取平均 |
| 评分标准要明确 | 模糊的标准会导致不稳定的评分 |
| 控制评估成本 | 每次 Judge 调用都消耗 token，按需评估 |

### 5.4 评估报告

`generateReport` 函数汇总所有评估结果，输出关键指标：

```typescript
function generateReport(results: EvalResult[], label: string, judgeResults?: JudgeResult[]) {
  const validResults = results.filter(r => r.answer.length > 0);
  const avgCoverage = validResults.reduce((sum, r) => sum + r.topicCoverage, 0) / validResults.length;
  const avgTime = validResults.reduce((sum, r) => sum + r.responseTime, 0) / validResults.length;
  const avgLength = validResults.reduce((sum, r) => sum + r.answerLength, 0) / validResults.length;

  // 输出报告
  console.log(`  成功率: ${validResults.length}/${results.length}`);
  console.log(`  平均概念覆盖率: ${(avgCoverage * 100).toFixed(1)}%`);
  console.log(`  平均响应时间: ${avgTime.toFixed(0)}ms`);
  console.log(`  平均回答长度: ${avgLength.toFixed(0)} 字符`);

  // 分类统计——按 category 分组，分别计算覆盖率
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = validResults.filter(r => r.category === cat);
    // ...
  }
}
```

### 5.5 过拟合检测与缓解

过拟合是微调中最常见的问题，尤其在数据量较小时：

| 表现 | 检测方法 | 说明 |
|------|---------|------|
| 训练题好、新题差 | 训练集 vs 验证集对比 | validation loss 开始上升就要停 |
| 回答模板化 | 同一问题多次回答检查多样性 | temperature=0.7 下回答几乎相同 |
| 某些能力退化 | 微调前后通用能力对比 | 微调学会了新能力但丢了旧能力 |

```
正常训练:                   过拟合:
Loss ↑                     Loss ↑
     │ ╲                        │ ╲        ╱ validation
     │  ╲  ← 两条线趋势一致     │  ╲    ╱
     │   ╲                      │   ╲╱
     │    ╲ ← training          │    ╲
     │     ╲                    │     ╲ ← training（持续下降）
     └──────→ Epochs            └──────→ Epochs
                                     ↑
                                   开始过拟合
```

**缓解策略优先级：**

1. **减少 epochs**（最直接）：3 → 2 甚至 1
2. **增加数据多样性**（最有效）：更多问法、更多场景
3. **early stopping**（监控验证 loss，自动停止）
4. **增大 LoRA rank 或 dropout**（增加模型正则化）
5. **数据增强**：对问题进行同义改写，增加训练样本多样性

## 六、Fine-tuning vs RAG 决策树

在实际项目中，最关键的决策是"什么时候用 Fine-tuning，什么时候用 RAG"。这两者不是替代关系，而是互补的：

```
你的需求是什么？
│
├── 让模型知道新知识/最新数据 ──────────→ RAG
│
├── 让模型学会特定风格/格式 ──────────→ Fine-tuning
│
├── 两者都需要 ──────────────────────→ Fine-tuning + RAG（最强组合）
│   例如：用公司语气回答 + 引用内部文档
│
├── Prompt Engineering 能搞定 ────────→ Prompt Engineering（先试这个）
│
└── 不确定选哪个 ────────────────────→ 先 RAG（成本低、见效快），不够再加 Fine-tuning
```

**完整技术栈组合：**

```
微调定制能力 → Ollama 本地部署 → RAG 补充实时知识 → Prompt 引导行为

Fine-tuning:  学会回答风格、专业术语、输出格式
Ollama:       本地运行，保护数据隐私，无推理费用
RAG:          接入最新文档、知识库、实时数据
Prompt:       针对单次请求的行为引导
```

## 七、总结

这篇覆盖了 Fine-tuning 的完整知识链：

1. **训练数据准备**是成功的关键——三种格式（OpenAI JSONL / Alpaca / ShareGPT）按需选择，清洗流水线（去重 → 长度过滤 → 质量筛选）保证数据质量
2. **OpenAI Fine-tuning API** 让云端微调极其简单——代码不到 30 行，100 条数据训练费用不到 5 美分
3. **LoRA/QLoRA** 让本地微调成为可能——通过低秩分解将训练参数减少 99.88%，6GB 显存即可训练 7B 模型
4. **评估体系**三管齐下——关键概念覆盖率（快速筛查）+ LLM-as-Judge（深度评估）+ 过拟合检测（质量保障）
5. Fine-tuning 和 RAG 是**互补关系**，完整链路：微调定制能力 → Ollama 部署 → RAG 补充知识 → Prompt 引导行为

## 八、参考资料

**官方文档：**

- **OpenAI Fine-tuning Guide**: [https://platform.openai.com/docs/guides/fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
- **OpenAI API Reference — Fine-tuning**: [https://platform.openai.com/docs/api-reference/fine-tuning](https://platform.openai.com/docs/api-reference/fine-tuning)
- **LoRA 原始论文**: [LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685)
- **QLoRA 论文**: [QLoRA: Efficient Finetuning of Quantized LLMs](https://arxiv.org/abs/2305.14314)
- **Unsloth GitHub**: [https://github.com/unslothai/unsloth](https://github.com/unslothai/unsloth)
- **LLaMA-Factory GitHub**: [https://github.com/hiyouga/LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory)
- **HuggingFace PEFT**: [https://huggingface.co/docs/peft](https://huggingface.co/docs/peft)
- **Vercel AI SDK**: [https://sdk.vercel.ai/docs](https://sdk.vercel.ai/docs)
