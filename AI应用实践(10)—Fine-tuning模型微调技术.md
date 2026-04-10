# AI应用实践(10)—Fine-tuning模型微调技术

前面学了 RAG（Module 04/05/11），解决的是"让模型获取外部知识"。但如果你想让模型学会特定的回答风格、掌握专业术语、或者遵循特定的输出格式——RAG 就不够了，需要 Fine-tuning。

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

### 1.3 什么时候该用 Fine-tuning

**✅ 适合的场景：**

| 场景 | 为什么 RAG/Prompt 不行 |
|------|----------------------|
| 统一回答风格（公司口吻） | 风格是"习惯"，不是"知识" |
| 缩短 Prompt（省 token 费） | Fine-tuning 让模型"记住"规则 |
| 专业术语精确表达 | 术语使用是"能力"，不是"检索" |
| 始终输出特定格式 | 格式是"习惯"，Prompt 不够稳定 |

**❌ 不该用的场景：**

| 场景 | 应该用 |
|------|--------|
| 补充最新知识 | RAG（知识会过时） |
| 简单格式调整 | Zod + structured output（Module 03） |
| 一次性任务 | Prompt Engineering |

## 二、训练数据准备

### 2.1 数据格式

三种主流格式（`data-preparation.ts` 支持全部三种的生成和互转）：

**OpenAI JSONL**（云端微调必用）：
```json
{"messages": [
  {"role": "system", "content": "你是一个专业的 TypeScript 编程助手。"},
  {"role": "user", "content": "什么是泛型？"},
  {"role": "assistant", "content": "泛型（Generics）允许编写可复用组件..."}
]}
```

**Alpaca**（开源微调常用，LLaMA-Factory 支持）：
```json
{"instruction": "解释泛型", "input": "", "output": "泛型是..."}
```

**ShareGPT**（多轮对话，Unsloth 推荐）：
```json
{"conversations": [
  {"from": "human", "value": "什么是泛型？"},
  {"from": "gpt", "value": "泛型允许..."}
]}
```

### 2.2 数据清洗流水线

```
原始数据 → 去重 → 长度过滤 → 质量筛选 → 数据集拆分 → 统计分析 → 输出
```

三步清洗的核心逻辑：

```typescript
// 1. 去重（基于 user message）
const seen = new Set<string>();
deduped = data.filter(example => {
  const userMsg = example.messages.find(m => m.role === "user")?.content || "";
  if (seen.has(userMsg)) return false;
  seen.add(userMsg);
  return true;
});

// 2. 长度过滤（太短学不到，太长浪费 token）
filtered = deduped.filter(example => {
  const len = example.messages.find(m => m.role === "assistant")?.content.length || 0;
  return len >= 20 && len <= 2000;
});

// 3. 质量筛选（内容比例、完整句子检查）
quality = filtered.filter(example => {
  const content = example.messages.find(m => m.role === "assistant")?.content || "";
  const contentRatio = content.replace(/[\s\p{P}]/gu, "").length / content.length;
  return contentRatio >= 0.3 && content.includes("。");
});
```

### 2.3 数据质量 Checklist

| 检查项 | 说明 |
|--------|------|
| ✅ 样本量 ≥ 50 条 | 推荐 100-500 条 |
| ✅ System Prompt 一致 | 所有样本用相同 system |
| ✅ 回答长度适中 | 50-500 字最佳 |
| ✅ 无重复 | 去除完全相同的对话 |
| ✅ 覆盖多样场景 | 各种问法和主题 |
| ✅ 回答质量高 | 准确、完整、格式一致 |

## 三、云端 Fine-tuning——OpenAI API

### 3.1 完整流程

```
上传训练文件 → 创建微调任务 → 监控进度 → 使用微调模型
```

### 3.2 代码实现

```typescript
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. 上传训练文件
const file = await client.files.create({
  file: fs.createReadStream("data/formatted/train.jsonl"),
  purpose: "fine-tune",
});

// 2. 创建微调任务
const job = await client.fineTuning.jobs.create({
  training_file: file.id,
  model: "gpt-4o-mini-2024-07-18",
  hyperparameters: { n_epochs: 3 },
  suffix: "ts-assistant",
});

// 3. 监控进度
const status = await client.fineTuning.jobs.retrieve(job.id);
// queued → running → succeeded

// 4. 使用微调模型
const response = await client.chat.completions.create({
  model: status.fine_tuned_model!,
  messages: [{ role: "user", content: "什么是类型推断？" }],
});
```

### 3.3 成本估算

- 100 条训练数据 × ~500 tokens/条 × 3 epochs = 150K tokens
- gpt-4o-mini 训练费用 ≈ **$0.045**——比想象的便宜得多

> 💡 先用 10-20 条数据小规模验证，确认可行后再扩大。

## 四、LoRA/QLoRA——本地微调的核心技术

### 4.1 LoRA 原理

Full Fine-tuning 更新所有参数（7B 模型需要 ~60GB 显存），LoRA 的核心思想：**冻结原始模型，只训练两个小矩阵**。

```
W_new = W + B × A

W (d×d): 原始权重，冻结不动
B (d×r): 低秩矩阵，训练
A (r×d): 低秩矩阵，训练
r << d（秩，通常 4/8/16/32）
```

### 4.2 参数量实算

以 7B 模型、r=8 为例：

```
每层 LoRA 参数 = 4(QKV+O) × 2(A和B) × 4096 × 8 = 262,144
总 LoRA 参数 = 262,144 × 32(层) = 8,388,608 ≈ 8.4M

全量微调: 7,000,000,000 (7B)
LoRA:        8,388,608 (8.4M)
参数比例: 0.12% → 减少了 99.88%！
```

### 4.3 QLoRA——消费级 GPU 也能训练

在 LoRA 基础上将模型量化为 4-bit：

| 方法 | 显存需求 | 可用 GPU |
|------|---------|---------|
| Full FT (FP16) | ~60 GB | A100 80GB |
| LoRA (FP16) | ~16 GB | RTX 4090 |
| QLoRA (4-bit) | ~6 GB | RTX 3060 / 4060 |

> 🎒 **类比**：Full FT = 重印整本教材；LoRA = 在教材空白处写批注；QLoRA = 先把教材缩印成口袋版再写批注。

### 4.4 从微调到部署的完整链路

```
准备数据(TS) → QLoRA训练(Python) → 合并权重 → 导出GGUF → Ollama部署
Module 12      Unsloth/           merge_and_   llama.cpp    Module 10
               LLaMA-Factory      unload()
```

部署后直接用 Module 10 的 model-adapter 调用：
```typescript
const model = getModel("ollama", "my-ts-assistant");
```

## 五、微调效果评估

### 5.1 关键概念覆盖率

最简单的指标——检查回答是否包含预期的关键概念：

```typescript
function calculateTopicCoverage(answer: string, topics: string[]): number {
  let covered = 0;
  for (const topic of topics) {
    if (answer.includes(topic)) covered++;
  }
  return covered / topics.length;
}
```

### 5.2 LLM-as-Judge

用更强的 LLM 作为评委打分——当前最实用的自动评估方法：

```typescript
const judgePrompt = `请评估以下 AI 回答的质量（1-5分）。
问题: ${question}
回答: ${answer}
请回复 JSON: {"score": <1-5>, "reasoning": "<理由>"}`;
```

### 5.3 过拟合检测

| 表现 | 检测方法 |
|------|---------|
| 训练题好、新题差 | 训练集 vs 验证集对比 |
| 回答模板化 | 同一问题多次回答检查多样性 |
| 某些能力退化 | 微调前后通用能力对比 |

缓解策略：减少 epochs、增加数据多样性、early stopping、增大 rank、数据增强。

## 六、Fine-tuning vs RAG 选型

```
├── 让模型知道新知识 → RAG
├── 让模型学会特定风格 → Fine-tuning
├── 两者都需要 → Fine-tuning + RAG
├── Prompt 能搞定 → Prompt Engineering
└── 不确定 → 先 RAG（成本低），不够再 Fine-tuning
```

## 七、总结

1. **训练数据准备**是成功的关键——格式、清洗、拆分缺一不可
2. **OpenAI Fine-tuning API** 让云端微调极其简单（代码不到 30 行）
3. **LoRA/QLoRA** 让本地微调成为可能——6GB 显存训练 7B 模型
4. **LLM-as-Judge** 是最实用的自动评估方法
5. Fine-tuning 和 RAG 是**互补关系**，完整链路：微调定制能力 → Ollama 部署 → RAG 补充知识 → Prompt 引导行为

下一步：看看市面上的 AI 平台如何将这些技术封装成产品 → Module 13 AI 应用平台
