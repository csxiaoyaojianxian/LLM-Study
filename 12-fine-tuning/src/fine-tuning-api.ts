/**
 * fine-tuning-api.ts — OpenAI Fine-tuning API 实战
 *
 * 本文件演示使用 OpenAI Fine-tuning API 的完整流程：
 * - 上传训练文件
 * - 创建微调任务
 * - 监控训练进度
 * - 使用微调模型推理
 * - 成本估算
 *
 * 需要 OPENAI_API_KEY
 */

import "dotenv/config";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. Fine-tuning API 流程概述
// ============================================================

function showOverview(): void {
  console.log("=".repeat(60));
  console.log("📋 1. OpenAI Fine-tuning API 流程");
  console.log("=".repeat(60));

  console.log("\n📌 完整流程（4 步）:");
  console.log("  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐");
  console.log("  │  上传    │ →  │  创建    │ →  │  监控    │ →  │  使用    │");
  console.log("  │ 训练文件 │    │ 微调任务 │    │ 训练进度 │    │ 微调模型 │");
  console.log("  └──────────┘    └──────────┘    └──────────┘    └──────────┘");

  console.log("\n📌 支持的基座模型:");
  console.log("  - gpt-4o-mini-2024-07-18 （推荐，性价比最高）");
  console.log("  - gpt-4o-2024-08-06");
  console.log("  - gpt-3.5-turbo-0125");

  console.log("\n📌 费用估算（以 gpt-4o-mini 为例）:");
  console.log("  训练: $0.30 / 100万 tokens");
  console.log("  推理: $0.30 / 100万 input tokens, $1.20 / 100万 output tokens");
  console.log("  示例: 100 条训练数据 × ~500 tokens/条 = ~50K tokens ≈ $0.015");
}

// ============================================================
// 2. 上传训练文件
// ============================================================

async function uploadTrainingFile(client: OpenAI): Promise<string | null> {
  console.log("\n" + "=".repeat(60));
  console.log("📤 2. 上传训练文件");
  console.log("=".repeat(60));

  const trainPath = path.join(__dirname, "..", "data", "formatted", "train.jsonl");

  if (!fs.existsSync(trainPath)) {
    console.log("  ⚠️  训练文件不存在，请先运行: npm run data-preparation");
    return null;
  }

  const fileContent = fs.readFileSync(trainPath, "utf-8");
  const lineCount = fileContent.split("\n").filter((l) => l.trim()).length;
  console.log(`  📄 文件: ${trainPath}`);
  console.log(`  📊 数据量: ${lineCount} 条`);

  try {
    console.log("  📤 上传中...");
    const file = await client.files.create({
      file: fs.createReadStream(trainPath),
      purpose: "fine-tune",
    });

    console.log(`  ✅ 上传成功！`);
    console.log(`  文件 ID: ${file.id}`);
    console.log(`  文件名: ${file.filename}`);
    console.log(`  大小: ${file.bytes} bytes`);
    console.log(`  状态: ${file.status}`);

    return file.id;
  } catch (error) {
    console.log(`  ❌ 上传失败: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// ============================================================
// 3. 创建微调任务
// ============================================================

async function createFineTuningJob(
  client: OpenAI,
  fileId: string
): Promise<string | null> {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 3. 创建微调任务");
  console.log("=".repeat(60));

  try {
    const job = await client.fineTuning.jobs.create({
      training_file: fileId,
      model: "gpt-4o-mini-2024-07-18",
      hyperparameters: {
        n_epochs: 3, // 训练轮次（一般 2-4 轮）
      },
      suffix: "ts-assistant", // 模型名称后缀
    });

    console.log(`  ✅ 微调任务创建成功！`);
    console.log(`  任务 ID: ${job.id}`);
    console.log(`  基座模型: ${job.model}`);
    console.log(`  状态: ${job.status}`);
    console.log(`  创建时间: ${new Date(job.created_at * 1000).toLocaleString()}`);

    return job.id;
  } catch (error) {
    console.log(`  ❌ 创建失败: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// ============================================================
// 4. 监控训练进度
// ============================================================

async function monitorJob(client: OpenAI, jobId: string): Promise<string | null> {
  console.log("\n" + "=".repeat(60));
  console.log("📊 4. 监控训练进度");
  console.log("=".repeat(60));

  try {
    // 获取任务状态
    const job = await client.fineTuning.jobs.retrieve(jobId);

    console.log(`\n  任务 ID: ${job.id}`);
    console.log(`  状态: ${job.status}`);

    if (job.status === "succeeded") {
      console.log(`  ✅ 训练完成！`);
      console.log(`  微调模型: ${job.fine_tuned_model}`);
      console.log(`  训练 tokens: ${job.trained_tokens}`);
      return job.fine_tuned_model;
    }

    if (job.status === "failed") {
      console.log(`  ❌ 训练失败: ${job.error?.message || "未知错误"}`);
      return null;
    }

    // 获取训练事件
    console.log("\n  📋 训练事件:");
    const events = await client.fineTuning.jobs.listEvents(jobId, { limit: 10 });
    for (const event of events.data.reverse()) {
      console.log(`    ${new Date(event.created_at * 1000).toLocaleTimeString()} - ${event.message}`);
    }

    console.log(`\n  ⏳ 训练进行中，请稍后再查询...`);
    console.log(`  提示: 通常需要 5-30 分钟完成训练`);

    return null;
  } catch (error) {
    console.log(`  ❌ 查询失败: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// ============================================================
// 5. 使用微调模型
// ============================================================

async function useFineTunedModel(
  client: OpenAI,
  modelName: string
): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🎯 5. 使用微调模型");
  console.log("=".repeat(60));

  const testQuestions = [
    "什么是 TypeScript 的类型推断？",
    "如何定义一个泛型接口？",
  ];

  for (const question of testQuestions) {
    console.log(`\n❓ 问题: ${question}`);
    try {
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。",
          },
          { role: "user", content: question },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const answer = response.choices[0]?.message.content || "无回答";
      console.log(`🤖 回答: ${answer}`);
      console.log(`📊 Token 用量: ${JSON.stringify(response.usage)}`);
    } catch (error) {
      console.log(`  ❌ 推理失败: ${error instanceof Error ? error.message : error}`);
    }
  }
}

// ============================================================
// 6. 最佳实践
// ============================================================

function showBestPractices(): void {
  console.log("\n" + "=".repeat(60));
  console.log("💡 6. Fine-tuning 最佳实践");
  console.log("=".repeat(60));

  console.log("\n📌 数据质量:");
  console.log("  - 至少 50 条高质量训练数据（推荐 100-500 条）");
  console.log("  - 数据格式一致，system prompt 统一");
  console.log("  - 回答长度适中（太短学不到，太长浪费 token）");
  console.log("  - 覆盖各种问法和场景");

  console.log("\n📌 超参数选择:");
  console.log("  - n_epochs: 一般 2-4 轮，数据少可以多训几轮");
  console.log("  - learning_rate_multiplier: 默认即可，除非效果异常");
  console.log("  - batch_size: 自动选择通常最优");

  console.log("\n📌 成本控制:");
  console.log("  - 先用少量数据验证效果，再扩大数据集");
  console.log("  - gpt-4o-mini 性价比最高，优先选择");
  console.log("  - 监控 validation loss，避免过拟合");

  console.log("\n📌 何时该用 Fine-tuning:");
  console.log("  ✅ 需要模型学会特定风格/格式（如公司文档风格）");
  console.log("  ✅ Prompt Engineering 已优化但效果仍不够");
  console.log("  ✅ 需要缩短 prompt 长度以降低推理成本");
  console.log("  ❌ 只需要模型获取特定知识 → 用 RAG 更好");
  console.log("  ❌ 只需要简单的格式调整 → 用 structured output 即可");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 OpenAI Fine-tuning API 实战教程\n");

  // 流程概述
  showOverview();

  // 检查 API Key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-") {
    console.log("\n⚠️  未配置 OPENAI_API_KEY");
    console.log("请在 .env 中配置 OPENAI_API_KEY 后重试");
    console.log("以下展示最佳实践（不需要 API Key）:\n");
    showBestPractices();
    return;
  }

  const client = new OpenAI({ apiKey });

  // const fileId = await uploadTrainingFile(client);
  // if (fileId) {
  //   const jobId = await createFineTuningJob(client, fileId);
  //   if (jobId) await monitorJob(client, jobId);
  // }

  // 交互式流程演示
  console.log("\n📌 以下是完整的 Fine-tuning 流程演示:");
  console.log("  注意: 实际执行会产生费用，以下仅展示代码和流程\n");

  // 列出已有的微调任务
  console.log("=".repeat(60));
  console.log("📋 已有的微调任务:");
  console.log("=".repeat(60));
  try {
    const jobs = await client.fineTuning.jobs.list({ limit: 5 });
    if (jobs.data.length === 0) {
      console.log("  暂无微调任务");
    }
    for (const job of jobs.data) {
      console.log(`  - ${job.id}: ${job.model} → ${job.fine_tuned_model || "训练中"} [${job.status}]`);
    }
  } catch (error) {
    console.log(`  ❌ 查询失败: ${error instanceof Error ? error.message : error}`);
  }

  // 最佳实践
  showBestPractices();

  console.log("\n" + "=".repeat(60));
  console.log("🎓 教程完成！");
  console.log("=".repeat(60));
  console.log("\n📌 如要实际执行微调，请取消注释以下代码并运行:");
  console.log("  // const fileId = await uploadTrainingFile(client);");
  console.log("  // if (fileId) {");
  console.log("  //   const jobId = await createFineTuningJob(client, fileId);");
  console.log("  //   if (jobId) await monitorJob(client, jobId);");
  console.log("  // }");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("fine-tuning-api.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { uploadTrainingFile, createFineTuningJob, monitorJob, useFineTunedModel };
