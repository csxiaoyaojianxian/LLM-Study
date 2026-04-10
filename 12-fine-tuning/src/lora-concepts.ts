/**
 * lora-concepts.ts — LoRA/QLoRA 原理讲解
 *
 * 纯教学文件，用代码模拟和可视化讲解：
 * - Full Fine-tuning vs LoRA vs QLoRA 的原理对比
 * - 参数量计算：为什么 LoRA 能减少 99% 训练参数
 * - 本地微调工具链介绍
 * - 微调后模型部署流程
 *
 * 无需 API Key，无需 GPU
 */

// ============================================================
// 1. Fine-tuning 方法对比
// ============================================================

function explainFineTuningMethods(): void {
  console.log("=".repeat(60));
  console.log("📚 1. Fine-tuning 方法对比");
  console.log("=".repeat(60));

  console.log("\n📌 三种主要的 Fine-tuning 方法:");

  console.log("\n🔴 Full Fine-tuning（全量微调）");
  console.log("  - 更新模型的所有参数");
  console.log("  - 效果最好，但需要大量 GPU 显存");
  console.log("  - 7B 模型需要 ~60GB 显存（FP16）");
  console.log("  - 训练后生成完整的模型权重文件");

  console.log("\n🟢 LoRA（Low-Rank Adaptation）");
  console.log("  - 冻结原始模型，只训练低秩分解矩阵");
  console.log("  - 训练参数减少 99%+，显存需求大幅降低");
  console.log("  - 7B 模型仅需 ~16GB 显存");
  console.log("  - 训练后生成小型 adapter 文件（~几十MB）");

  console.log("\n🔵 QLoRA（Quantized LoRA）");
  console.log("  - 在 LoRA 基础上，将模型量化为 4-bit");
  console.log("  - 进一步降低显存需求");
  console.log("  - 7B 模型仅需 ~6GB 显存（单张消费级 GPU！）");
  console.log("  - 效果接近 LoRA，性价比最高");
}

// ============================================================
// 2. LoRA 原理详解
// ============================================================

function explainLoRAMechanism(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🧮 2. LoRA 原理 — 低秩分解");
  console.log("=".repeat(60));

  console.log("\n📌 核心思想: 权重更新矩阵是低秩的");
  console.log("  原始权重 W ∈ R^(d×d)");
  console.log("  更新量 ΔW = B × A，其中 B ∈ R^(d×r)，A ∈ R^(r×d)");
  console.log("  r << d（r 称为秩，通常取 4/8/16/32）");

  console.log("\n📌 图示:");
  console.log("  ┌───────────────────────┐");
  console.log("  │  W (d×d) + ΔW (d×d)  │  ← Full Fine-tuning: 训练所有 d² 个参数");
  console.log("  └───────────────────────┘");
  console.log("         ↓ LoRA 分解");
  console.log("  ┌──────────┐   ┌──────────┐");
  console.log("  │  B (d×r) │ × │  A (r×d) │  ← LoRA: 只训练 2×d×r 个参数");
  console.log("  └──────────┘   └──────────┘");

  // 参数量计算
  console.log("\n📊 参数量计算示例:");

  interface ModelConfig {
    name: string;
    d: number; // 隐藏维度
    layers: number;
    totalParams: string;
  }

  const models: ModelConfig[] = [
    { name: "Qwen 1.8B", d: 2048, layers: 24, totalParams: "1.8B" },
    { name: "Qwen 7B", d: 4096, layers: 32, totalParams: "7B" },
    { name: "Qwen 14B", d: 5120, layers: 40, totalParams: "14B" },
    { name: "LLaMA 70B", d: 8192, layers: 80, totalParams: "70B" },
  ];

  const ranks = [4, 8, 16, 32];

  console.log("\n  模型参数量 vs LoRA 训练参数量:");
  console.log("  ┌────────────┬────────────┬──────────┬──────────┬──────────┬──────────┐");
  console.log("  │    模型    │  总参数量  │  r=4     │  r=8     │  r=16    │  r=32    │");
  console.log("  ├────────────┼────────────┼──────────┼──────────┼──────────┼──────────┤");

  for (const model of models) {
    const loraParams = ranks.map((r) => {
      // 每层有 Q、K、V、O 四个矩阵，每个矩阵的 LoRA 参数: 2 × d × r
      const paramsPerLayer = 4 * 2 * model.d * r;
      const totalLoRA = paramsPerLayer * model.layers;
      return formatParams(totalLoRA);
    });

    console.log(
      `  │ ${model.name.padEnd(10)} │ ${model.totalParams.padEnd(10)} │ ${loraParams[0].padEnd(8)} │ ${loraParams[1].padEnd(8)} │ ${loraParams[2].padEnd(8)} │ ${loraParams[3].padEnd(8)} │`
    );
  }
  console.log("  └────────────┴────────────┴──────────┴──────────┴──────────┴──────────┘");

  // 详细计算一个例子
  const exampleD = 4096;
  const exampleR = 8;
  const exampleLayers = 32;
  const fullParams = exampleD * exampleD * 4 * exampleLayers; // Q、K、V、O
  const loraParams = 2 * exampleD * exampleR * 4 * exampleLayers;
  const ratio = ((loraParams / fullParams) * 100).toFixed(2);

  console.log(`\n📌 详细计算（以 7B 模型, r=8 为例）:`);
  console.log(`  隐藏维度 d = ${exampleD}`);
  console.log(`  LoRA 秩 r = ${exampleR}`);
  console.log(`  Transformer 层数 = ${exampleLayers}`);
  console.log(`  每层 LoRA 参数 = 4(QKV+O) × 2 × d × r = ${(4 * 2 * exampleD * exampleR).toLocaleString()}`);
  console.log(`  总 LoRA 参数 = ${loraParams.toLocaleString()} (${formatParams(loraParams)})`);
  console.log(`  全量微调参数 = ${fullParams.toLocaleString()} (${formatParams(fullParams)})`);
  console.log(`  参数比例 = ${ratio}% → 减少了 ${(100 - parseFloat(ratio)).toFixed(2)}% 的训练参数！`);
}

function formatParams(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}

// ============================================================
// 3. 显存需求估算
// ============================================================

function explainMemoryRequirements(): void {
  console.log("\n" + "=".repeat(60));
  console.log("💾 3. 显存需求估算");
  console.log("=".repeat(60));

  console.log("\n📌 不同方法的显存需求（以 7B 模型为例）:");
  console.log("  ┌──────────────────┬────────────┬────────────────────────────┐");
  console.log("  │      方法        │ 显存需求   │     可用 GPU               │");
  console.log("  ├──────────────────┼────────────┼────────────────────────────┤");
  console.log("  │ Full FT (FP32)   │ ~120 GB    │ A100 80GB × 2             │");
  console.log("  │ Full FT (FP16)   │ ~60 GB     │ A100 80GB × 1             │");
  console.log("  │ LoRA (FP16)      │ ~16 GB     │ RTX 4090 / A6000          │");
  console.log("  │ QLoRA (4-bit)    │ ~6 GB      │ RTX 3060 / RTX 4060       │");
  console.log("  └──────────────────┴────────────┴────────────────────────────┘");

  console.log("\n📌 显存计算公式:");
  console.log("  模型权重 = 参数量 × 每参数字节数");
  console.log("  FP32: 7B × 4 bytes = 28 GB");
  console.log("  FP16: 7B × 2 bytes = 14 GB");
  console.log("  INT4: 7B × 0.5 bytes = 3.5 GB");
  console.log("  + 优化器状态（约 2-3 倍模型大小）");
  console.log("  + 梯度（约 1 倍模型大小）");
  console.log("  + 激活值缓存");

  console.log("\n💡 QLoRA 为什么只需 6GB:");
  console.log("  1. 模型权重量化为 4-bit: 7B × 0.5B = 3.5 GB");
  console.log("  2. LoRA adapter 很小: ~8M params × 2B = ~16 MB");
  console.log("  3. 优化器只需管理 adapter 参数");
  console.log("  4. 梯度只需计算 adapter 参数");
  console.log("  → 总计约 6GB，消费级 GPU 即可训练！");
}

// ============================================================
// 4. 本地微调工具链
// ============================================================

function explainLocalTools(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🛠️  4. 本地微调工具链");
  console.log("=".repeat(60));

  console.log("\n📌 推荐工具（按易用性排序）:");

  console.log("\n1️⃣  Unsloth（最推荐，速度最快）");
  console.log("  - 2倍速度，50% 显存优化");
  console.log("  - 支持 LoRA/QLoRA");
  console.log("  - 一键导出 GGUF 格式");
  console.log("  - GitHub: github.com/unslothai/unsloth");
  console.log("  - 安装: pip install unsloth");

  console.log("\n2️⃣  LLaMA-Factory（功能最全，中文友好）");
  console.log("  - Web UI 操作，零代码微调");
  console.log("  - 支持 100+ 模型（Qwen、LLaMA、Mistral 等）");
  console.log("  - 内置数据集管理和评估");
  console.log("  - GitHub: github.com/hiyouga/LLaMA-Factory");
  console.log("  - 安装: pip install llmtuner");

  console.log("\n3️⃣  PEFT（Hugging Face 官方）");
  console.log("  - 最灵活，适合高级用户");
  console.log("  - 支持多种参数高效微调方法");
  console.log("  - 与 Transformers 库深度集成");
  console.log("  - 安装: pip install peft");

  console.log("\n📌 推荐基座模型（适合中文微调）:");
  console.log("  ┌──────────────────┬──────────┬────────────────────────────┐");
  console.log("  │      模型        │ 参数量   │         特点               │");
  console.log("  ├──────────────────┼──────────┼────────────────────────────┤");
  console.log("  │ Qwen2.5-7B      │ 7B       │ 中文最佳，阿里开源          │");
  console.log("  │ LLaMA-3.1-8B    │ 8B       │ 英文最佳，Meta 开源         │");
  console.log("  │ Mistral-7B      │ 7B       │ 多语言平衡                  │");
  console.log("  │ DeepSeek-V2-Lite│ 16B(MoE) │ 高效 MoE 架构              │");
  console.log("  └──────────────────┴──────────┴────────────────────────────┘");
}

// ============================================================
// 5. 从微调到部署的完整链路
// ============================================================

function explainDeploymentPipeline(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 5. 微调 → 部署完整链路");
  console.log("=".repeat(60));

  console.log("\n📌 完整流程:");
  console.log("  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐");
  console.log("  │ 准备数据 │ →  │ QLoRA    │ →  │ 合并权重 │ →  │ 量化导出 │ →  │ Ollama   │");
  console.log("  │ (JSONL)  │    │ 微调训练 │    │ (Adapter)│    │ (GGUF)   │    │ 本地部署 │");
  console.log("  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘");

  console.log("\n📌 步骤详解:");

  console.log("\n  Step 1: 数据准备");
  console.log("  → 参考 data-preparation.ts 生成训练数据");

  console.log("\n  Step 2: QLoRA 微调（以 Unsloth + Qwen2.5-7B 为例）");
  console.log("  ```python");
  console.log("  from unsloth import FastLanguageModel");
  console.log("  model, tokenizer = FastLanguageModel.from_pretrained(");
  console.log('      model_name="Qwen/Qwen2.5-7B-Instruct",');
  console.log("      load_in_4bit=True,  # QLoRA 4-bit 量化");
  console.log("  )");
  console.log("  model = FastLanguageModel.get_peft_model(model, r=16)");
  console.log("  # ... 训练代码 ...");
  console.log("  model.save_pretrained('my-model-lora')");
  console.log("  ```");

  console.log("\n  Step 3: 合并 LoRA adapter 到基座模型");
  console.log("  ```python");
  console.log("  model = model.merge_and_unload()");
  console.log("  model.save_pretrained('my-model-merged')");
  console.log("  ```");

  console.log("\n  Step 4: 导出为 GGUF 格式（Ollama 兼容）");
  console.log("  ```bash");
  console.log("  # 使用 llama.cpp 转换");
  console.log("  python convert_hf_to_gguf.py my-model-merged --outtype q4_k_m");
  console.log("  # 或使用 Unsloth 一键导出");
  console.log('  model.save_pretrained_gguf("my-model", tokenizer, quantization_method="q4_k_m")');
  console.log("  ```");

  console.log("\n  Step 5: 用 Ollama 部署（对接 Module 10）");
  console.log("  ```bash");
  console.log("  # 创建 Modelfile");
  console.log('  echo "FROM ./my-model-Q4_K_M.gguf" > Modelfile');
  console.log("  ollama create my-ts-assistant -f Modelfile");
  console.log("  ollama run my-ts-assistant");
  console.log("  ```");

  console.log("\n💡 与 Module 10 的衔接:");
  console.log("  微调后的模型部署到 Ollama 后，可以直接使用 Module 10 的");
  console.log("  model-adapter.ts 中的 ollama provider 调用：");
  console.log('  getModel("ollama", "my-ts-assistant")');
}

// ============================================================
// 6. LoRA 变体与前沿技术
// ============================================================

function explainAdvancedTechniques(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔬 6. LoRA 变体与前沿技术");
  console.log("=".repeat(60));

  console.log("\n📌 LoRA 变体:");
  console.log("  - LoRA: 基础版低秩适配");
  console.log("  - QLoRA: 量化 + LoRA，显存效率最高");
  console.log("  - DoRA: Weight-Decomposed LoRA，效果优于 LoRA");
  console.log("  - rsLoRA: 改进的缩放策略，大秩时更稳定");
  console.log("  - LoRA+: 差异化学习率（A 和 B 矩阵不同 lr）");

  console.log("\n📌 其他参数高效微调方法:");
  console.log("  - Prefix Tuning: 在每层添加可训练的前缀向量");
  console.log("  - Prompt Tuning: 在输入前添加可训练的 soft prompt");
  console.log("  - IA³: 通过学习向量缩放激活值");
  console.log("  - 对比: LoRA 是目前最主流、效果最好的方案");

  console.log("\n📌 选择建议:");
  console.log("  初学者 → QLoRA + Unsloth/LLaMA-Factory");
  console.log("  有 GPU 资源 → LoRA + 较大 rank");
  console.log("  追求极致效果 → Full Fine-tuning + DeepSpeed");
  console.log("  无 GPU → OpenAI Fine-tuning API（云端方案）");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 LoRA/QLoRA 原理讲解");
  console.log("本教程是纯概念讲解，无需 API Key 或 GPU\n");

  explainFineTuningMethods();
  explainLoRAMechanism();
  explainMemoryRequirements();
  explainLocalTools();
  explainDeploymentPipeline();
  explainAdvancedTechniques();

  console.log("\n" + "=".repeat(60));
  console.log("🎓 教程完成！");
  console.log("=".repeat(60));
  console.log("📚 下一步:");
  console.log("  npm run evaluation → 微调效果评估方法");
  console.log("  npm run fine-tuning-api → 云端微调实战（需 OpenAI Key）");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("lora-concepts.ts");

if (isMainModule) {
  main().catch(console.error);
}

export {
  explainFineTuningMethods,
  explainLoRAMechanism,
  explainMemoryRequirements,
};
