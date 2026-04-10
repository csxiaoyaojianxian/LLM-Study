# 12-fine-tuning — Fine-tuning 模型微调技术

> 学习模型微调的完整流程：训练数据准备 → 格式转换 → 云端微调（OpenAI API）→ LoRA/QLoRA 原理 → 效果评估

## 学习目标

- 掌握 Fine-tuning 训练数据的准备流程（格式、清洗、拆分、统计）
- 理解 OpenAI Fine-tuning API 的完整调用流程
- 理解 LoRA/QLoRA 的核心原理和参数量计算
- 学会用 LLM-as-Judge 自动评估微调效果
- 区分 Fine-tuning、RAG、Prompt Engineering 的适用场景

## 环境配置

### 1. 安装依赖

```bash
cd 12-fine-tuning
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
# 编辑 .env，填入 API Key
# OPENAI_API_KEY 用于 Fine-tuning API 和评估
# DEEPSEEK_API_KEY 也可用于评估脚本
```

> 💡 `data-preparation` 和 `lora-concepts` 两个脚本**无需 API Key**，可直接运行。



## Demo 脚本

### `npm run data-preparation` — 训练数据准备（无需 API Key）

完整的数据准备流水线，覆盖 Fine-tuning 数据工程的所有环节：

- **三种数据格式**：OpenAI JSONL、Alpaca、ShareGPT 格式介绍与示例
- **示例数据生成**：10 条 TypeScript 编程助手训练数据
- **数据清洗三步**：去重 → 长度过滤 → 质量筛选
- **数据集拆分**：80% 训练 / 20% 验证
- **统计分析**：字符数、Token 估算、长度分布
- **格式转换**：OpenAI JSONL ↔ Alpaca ↔ ShareGPT 互转
- **文件输出**：保存到 `data/formatted/` 目录

```bash
npm run data-preparation
```

```
📋 1. 训练数据格式介绍

📌 格式一：OpenAI JSONL（最常用，OpenAI Fine-tuning API 要求）
  示例:
  {"messages":[{"role":"system","content":"你是一个专业的 TypeScript 编程助手。"},
  {"role":"user","content":"什么是泛型？"},{"role":"assistant","content":"泛型..."}]}

📌 格式二：Alpaca（Stanford Alpaca 项目定义，开源微调常用）
📌 格式三：ShareGPT（多轮对话，适合对话模型微调）

📝 2. 生成示例训练数据
  ✅ 生成了 10 条训练数据

🧹 3. 数据清洗
📌 步骤 1: 去重
  原始: 10 → 去重后: 10
📌 步骤 2: 长度过滤
  去重后: 10 → 长度过滤后: 10
📌 步骤 3: 质量筛选
  长度过滤后: 10 → 质量筛选后: 10

✂️  4. 数据集拆分
  训练集: 8 条
  验证集: 2 条

📊 训练集统计分析:
  样本数: 8
  用户消息平均长度: 12 字符
  助手回复平均长度: 186 字符
  预估 Token 数: ~2,640

💾 6. 保存训练数据
  ✅ 训练集: data/formatted/train.jsonl (8 条)
  ✅ 验证集: data/formatted/validation.jsonl (2 条)
  ✅ Alpaca: data/formatted/train_alpaca.json
```



### `npm run fine-tuning-api` — OpenAI Fine-tuning API 实战

演示 OpenAI Cloud Fine-tuning 的完整流程（需要 `OPENAI_API_KEY`）：

- **流程概述**：上传文件 → 创建任务 → 监控进度 → 使用模型
- **成本估算**：各模型的训练和推理费用
- **已有任务查询**：列出账号下的微调任务
- **最佳实践**：数据质量、超参数选择、成本控制

```bash
npm run fine-tuning-api
```

未配置 API Key 时展示流程和最佳实践：

```
📋 1. OpenAI Fine-tuning API 流程

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  上传    │ →  │  创建    │ →  │  监控    │ →  │  使用    │
  │ 训练文件 │    │ 微调任务 │    │ 训练进度 │    │ 微调模型 │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘

📌 费用估算（以 gpt-4o-mini 为例）:
  训练: $0.30 / 100万 tokens
  推理: $0.30 / 100万 input tokens, $1.20 / 100万 output tokens
  示例: 100 条训练数据 × ~500 tokens/条 = ~50K tokens ≈ $0.015

💡 6. Fine-tuning 最佳实践
📌 数据质量:
  - 至少 50 条高质量训练数据（推荐 100-500 条）
  - 数据格式一致，system prompt 统一
📌 何时该用 Fine-tuning:
  ✅ 需要模型学会特定风格/格式
  ✅ Prompt Engineering 已优化但效果仍不够
  ❌ 只需要模型获取特定知识 → 用 RAG 更好
```

> ⚠️ 实际执行微调会产生费用。脚本默认只展示流程和查询已有任务，不会自动触发训练。



### `npm run lora-concepts` — LoRA/QLoRA 原理讲解（无需 API Key / GPU）

纯教学脚本，用代码可视化讲解 LoRA 的核心概念：

- **三种方法对比**：Full Fine-tuning vs LoRA vs QLoRA
- **LoRA 低秩分解原理**：图示 + 参数量实算
- **参数量对比表**：不同模型在不同 rank 下的 LoRA 参数量
- **显存需求估算**：各方法的 GPU 要求
- **本地微调工具链**：Unsloth、LLaMA-Factory、PEFT 介绍
- **微调到部署全链路**：训练 → 合并 → GGUF 导出 → Ollama 部署

```bash
npm run lora-concepts
```

```
📚 1. Fine-tuning 方法对比

🔴 Full Fine-tuning（全量微调）
  - 更新模型的所有参数
  - 7B 模型需要 ~60GB 显存（FP16）

🟢 LoRA（Low-Rank Adaptation）
  - 冻结原始模型，只训练低秩分解矩阵
  - 训练参数减少 99%+
  - 7B 模型仅需 ~16GB 显存

🔵 QLoRA（Quantized LoRA）
  - 在 LoRA 基础上，将模型量化为 4-bit
  - 7B 模型仅需 ~6GB 显存（单张消费级 GPU！）

🧮 2. LoRA 原理 — 低秩分解

  W_new = W + B × A
  其中 B ∈ R^(d×r)，A ∈ R^(r×d)，r << d

📊 参数量计算示例:

  ┌────────────┬────────────┬──────────┬──────────┬──────────┐
  │    模型    │  总参数量  │  r=4     │  r=8     │  r=16    │
  ├────────────┼────────────┼──────────┼──────────┼──────────┤
  │ Qwen 1.8B │ 1.8B       │ 1.6M    │ 3.1M    │ 6.3M    │
  │ Qwen 7B   │ 7B         │ 4.2M    │ 8.4M    │ 16.8M   │
  │ Qwen 14B  │ 14B        │ 6.6M    │ 13.1M   │ 26.2M   │
  │ LLaMA 70B │ 70B        │ 21.0M   │ 41.9M   │ 83.9M   │
  └────────────┴────────────┴──────────┴──────────┴──────────┘

📌 详细计算（以 7B 模型, r=8 为例）:
  总 LoRA 参数 = 8,388,608 (8.4M)
  全量微调参数 ≈ 7,000,000,000 (7B)
  参数比例 = 0.12% → 减少了 99.88% 的训练参数！

🚀 5. 微调 → 部署完整链路

  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ 准备数据 │→ │ QLoRA    │→ │ 合并权重 │→ │ 量化导出 │→ │ Ollama   │
  │ (JSONL)  │  │ 微调训练 │  │ (Adapter)│  │ (GGUF)   │  │ 本地部署 │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```



### `npm run evaluation` — 微调效果评估

多维度评估方法，用于对比基座模型 vs 微调模型的效果差异：

- **评估数据集**：5 个覆盖不同类别的测试问题
- **关键概念覆盖率**：检查回答是否包含预期关键词
- **LLM-as-Judge**：用 LLM 作为评委，1-5 分评估回答质量
- **分类统计**：按主题分类分析表现
- **过拟合检测与缓解**：检测方法 + 5 种缓解策略

```bash
npm run evaluation
```

未配置 API Key 时展示过拟合检测知识：

```
⚠️  5. 过拟合检测与缓解

📌 过拟合的表现:
  - 训练集上表现很好，但新问题回答很差
  - 回答模式高度固定，缺乏灵活性
  - 开始 '背诵' 训练数据中的回答

📌 缓解策略:
  1. 减少训练轮次（n_epochs）: 3 → 2 甚至 1
  2. 增加训练数据量和多样性
  3. 使用 early stopping（监控验证 loss）
  4. 增大 LoRA rank 或 dropout
  5. 数据增强: 对问题进行改写增加多样性
```

配置 API Key 后，实际运行评估并生成报告。



## 核心知识点

### 一、Fine-tuning vs RAG vs Prompt Engineering

| 技术 | 解决的问题 | 类比 |
|------|-----------|------|
| Prompt Engineering | 引导模型行为 | 给翻译一份术语表（每次带着） |
| RAG | 补充模型不知道的知识 | 给翻译一本词典（随时查阅） |
| Fine-tuning | 改变模型的内在能力 | 送翻译去专业进修（能力内化） |

### 二、训练数据质量 Checklist

| 检查项 | 说明 |
|--------|------|
| ✅ 样本量 ≥ 50 条 | 推荐 100-500 条 |
| ✅ System Prompt 一致 | 所有样本用相同 system |
| ✅ 回答长度适中 | 50-500 字最佳 |
| ✅ 无重复 | 去除完全相同的对话 |
| ✅ 覆盖多样场景 | 各种问法和主题 |
| ✅ 回答质量高 | 准确、完整、格式一致 |

### 三、LoRA 核心公式

```
W_new = W_original + B × A

W_original: d × d（冻结，不训练）
B: d × r（训练）
A: r × d（训练）
r << d（秩，通常 4/8/16/32）

训练参数 = 2 × d × r × 层数 × 矩阵数
```

### 四、选型决策树

```
├── 让模型知道新知识 → RAG（Module 04/11）
├── 让模型学会特定风格 → Fine-tuning（Module 12）
├── 两者都需要 → Fine-tuning + RAG
├── Prompt 能搞定 → Prompt Engineering（Module 03）
└── 不确定 → 先 RAG（成本低），不够再 Fine-tuning
```

### 五、与其他模块的衔接

- **Module 04/11**：RAG 补充知识（与 Fine-tuning 互补）
- **Module 10**：微调后的模型可导出为 GGUF，用 Ollama 本地部署
- **Module 03**：`model-adapter.ts` 可直接调用 Ollama 上的微调模型



## 文件结构

```
12-fine-tuning/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── model-adapter.ts       # 多模型适配（复制自 Module 10，含 Ollama）
│   ├── data-preparation.ts    # 训练数据准备与格式转换
│   ├── fine-tuning-api.ts     # OpenAI Fine-tuning API 完整流程
│   ├── lora-concepts.ts       # LoRA/QLoRA 原理讲解
│   └── evaluation.ts          # 微调效果评估
└── data/
    ├── raw/                   # 原始训练数据（占位）
    └── formatted/             # 格式化后的训练数据（运行 data-preparation 生成）
        ├── train.jsonl        # OpenAI JSONL 训练集
        ├── validation.jsonl   # OpenAI JSONL 验证集
        └── train_alpaca.json  # Alpaca 格式训练集
```
