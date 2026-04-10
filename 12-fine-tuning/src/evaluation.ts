/**
 * evaluation.ts — 微调效果评估
 *
 * 本文件演示微调模型的评估方法：
 * - 基座模型 vs 微调模型的对比测试
 * - 评估指标：准确率、一致性、指令遵循能力
 * - LLM-as-Judge 自动评估
 * - 过拟合检测与缓解策略
 *
 * 需要 API Key（用于模型调用）
 */

import "dotenv/config";
import {
  getModel,
  getDefaultProvider,
  chatWithModel,
  type Provider,
} from "./model-adapter.js";
import { generateText } from "ai";

// ============================================================
// 1. 评估数据集
// ============================================================

interface EvalExample {
  question: string;
  expectedTopics: string[]; // 期望回答中包含的关键概念
  category: string;
}

function getEvalDataset(): EvalExample[] {
  return [
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
    {
      question: "解释 TypeScript 的类型推断机制",
      expectedTopics: ["自动推断", "上下文类型", "最佳公共类型"],
      category: "类型推断",
    },
    {
      question: "如何在 TypeScript 中处理异步错误？",
      expectedTopics: ["try/catch", "Promise", "async/await", "类型"],
      category: "异步编程",
    },
    {
      question: "TypeScript 的 Mapped Types 是什么？",
      expectedTopics: ["映射", "keyof", "in", "遍历"],
      category: "高级类型",
    },
  ];
}

// ============================================================
// 2. 评估指标计算
// ============================================================

interface EvalResult {
  question: string;
  category: string;
  answer: string;
  topicCoverage: number; // 关键概念覆盖率 (0-1)
  answerLength: number;
  responseTime: number; // ms
}

/**
 * 计算关键概念覆盖率
 * 简单的关键词匹配方法
 */
function calculateTopicCoverage(
  answer: string,
  expectedTopics: string[]
): number {
  let covered = 0;
  for (const topic of expectedTopics) {
    if (answer.includes(topic)) {
      covered++;
    }
  }
  return covered / expectedTopics.length;
}

/**
 * 运行评估
 */
async function evaluateModel(
  provider: Provider,
  modelName: string | undefined,
  dataset: EvalExample[],
  label: string
): Promise<EvalResult[]> {
  console.log(`\n📊 评估: ${label}`);
  console.log("-".repeat(40));

  const results: EvalResult[] = [];
  const model = getModel(provider, modelName);

  for (const example of dataset) {
    const startTime = Date.now();

    try {
      const response = await generateText({
        model,
        messages: [{ role: "user", content: example.question }],
        system:
          "你是一个专业的 TypeScript 编程助手，请用简洁准确的中文回答技术问题。",
        maxOutputTokens: 300,
      });

      const answer = response.text;
      const responseTime = Date.now() - startTime;
      const topicCoverage = calculateTopicCoverage(
        answer,
        example.expectedTopics
      );

      results.push({
        question: example.question,
        category: example.category,
        answer,
        topicCoverage,
        answerLength: answer.length,
        responseTime,
      });

      console.log(`  ✅ [${example.category}] 覆盖率: ${(topicCoverage * 100).toFixed(0)}% | ${responseTime}ms`);
    } catch (error) {
      console.log(`  ❌ [${example.category}] 失败: ${error instanceof Error ? error.message : error}`);
      results.push({
        question: example.question,
        category: example.category,
        answer: "",
        topicCoverage: 0,
        answerLength: 0,
        responseTime: Date.now() - startTime,
      });
    }
  }

  return results;
}

// ============================================================
// 3. LLM-as-Judge 评估
// ============================================================

interface JudgeResult {
  question: string;
  score: number; // 1-5
  reasoning: string;
}

async function llmAsJudge(
  provider: Provider,
  evalResults: EvalResult[]
): Promise<JudgeResult[]> {
  console.log("\n" + "=".repeat(60));
  console.log("⚖️  LLM-as-Judge 评估");
  console.log("=".repeat(60));

  console.log("\n📌 原理: 用一个更强的 LLM 作为评委，对回答打分");
  console.log("  这是当前 LLM 评估中最实用的自动化方法\n");

  const judgeResults: JudgeResult[] = [];

  for (const result of evalResults.slice(0, 3)) {
    // 只评估前3个，控制成本
    if (!result.answer) continue;

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

    try {
      const response = await chatWithModel(provider, [
        { role: "user", content: judgePrompt },
      ]);

      // 尝试解析 JSON
      const jsonMatch = response.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          score: number;
          reasoning: string;
        };
        judgeResults.push({
          question: result.question,
          score: parsed.score,
          reasoning: parsed.reasoning,
        });
        console.log(`  📝 [${result.category}] 得分: ${parsed.score}/5 — ${parsed.reasoning}`);
      }
    } catch (error) {
      console.log(`  ❌ 评估失败: ${error instanceof Error ? error.message : error}`);
    }
  }

  return judgeResults;
}

// ============================================================
// 4. 评估报告生成
// ============================================================

function generateReport(
  results: EvalResult[],
  label: string,
  judgeResults?: JudgeResult[]
): void {
  console.log("\n" + "=".repeat(60));
  console.log(`📋 评估报告 — ${label}`);
  console.log("=".repeat(60));

  if (results.length === 0) {
    console.log("  无评估结果");
    return;
  }

  const validResults = results.filter((r) => r.answer.length > 0);

  // 概念覆盖率
  const avgCoverage =
    validResults.reduce((sum, r) => sum + r.topicCoverage, 0) /
    validResults.length;

  // 响应时间
  const avgTime =
    validResults.reduce((sum, r) => sum + r.responseTime, 0) /
    validResults.length;

  // 回答长度
  const avgLength =
    validResults.reduce((sum, r) => sum + r.answerLength, 0) /
    validResults.length;

  console.log(`\n  成功率: ${validResults.length}/${results.length} (${((validResults.length / results.length) * 100).toFixed(0)}%)`);
  console.log(`  平均概念覆盖率: ${(avgCoverage * 100).toFixed(1)}%`);
  console.log(`  平均响应时间: ${avgTime.toFixed(0)}ms`);
  console.log(`  平均回答长度: ${avgLength.toFixed(0)} 字符`);

  if (judgeResults && judgeResults.length > 0) {
    const avgScore =
      judgeResults.reduce((sum, r) => sum + r.score, 0) / judgeResults.length;
    console.log(`  LLM Judge 平均分: ${avgScore.toFixed(1)}/5`);
  }

  // 分类统计
  console.log("\n  分类表现:");
  const categories = [...new Set(results.map((r) => r.category))];
  for (const cat of categories) {
    const catResults = validResults.filter((r) => r.category === cat);
    if (catResults.length > 0) {
      const catCoverage =
        catResults.reduce((sum, r) => sum + r.topicCoverage, 0) /
        catResults.length;
      console.log(`    ${cat}: 覆盖率 ${(catCoverage * 100).toFixed(0)}%`);
    }
  }
}

// ============================================================
// 5. 过拟合检测
// ============================================================

function explainOverfitting(): void {
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  5. 过拟合检测与缓解");
  console.log("=".repeat(60));

  console.log("\n📌 过拟合的表现:");
  console.log("  - 训练集上表现很好，但新问题回答很差");
  console.log("  - 回答模式高度固定，缺乏灵活性");
  console.log("  - 对问题的微小变化过于敏感");
  console.log("  - 开始 '背诵' 训练数据中的回答");

  console.log("\n📌 检测方法:");
  console.log("  1. 训练集 vs 验证集 loss 对比");
  console.log("     - 训练 loss 持续下降但验证 loss 开始上升 → 过拟合");
  console.log("  2. 训练数据内外对比测试");
  console.log("     - 训练数据中的问题回答完美，但新问题效果差 → 过拟合");
  console.log("  3. 回答多样性测试");
  console.log("     - 同一问题多次回答几乎完全相同 → 可能过拟合");

  console.log("\n📌 缓解策略:");
  console.log("  1. 减少训练轮次（n_epochs）: 3 → 2 甚至 1");
  console.log("  2. 增加训练数据量和多样性");
  console.log("  3. 使用 early stopping（监控验证 loss）");
  console.log("  4. 增大 LoRA rank 或 dropout");
  console.log("  5. 数据增强: 对问题进行改写增加多样性");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 微调效果评估教程\n");

  // 获取评估数据集
  const dataset = getEvalDataset();
  console.log(`📋 评估数据集: ${dataset.length} 个问题`);

  // 检查 API Key
  let provider: Provider;
  try {
    provider = getDefaultProvider();
    console.log(`✅ 使用模型提供商: ${provider}`);
  } catch {
    console.log("⚠️  未配置 API Key");
    console.log("以下展示评估概念和过拟合检测方法\n");
    explainOverfitting();
    return;
  }

  // 评估基座模型
  console.log("\n" + "=".repeat(60));
  console.log("🔬 模型评估测试");
  console.log("=".repeat(60));

  const baseResults = await evaluateModel(
    provider,
    undefined, // 使用默认模型（作为"基座模型"的模拟）
    dataset,
    `基座模型 (${provider})`
  );

  // 生成报告
  generateReport(baseResults, `基座模型 (${provider})`);

  // LLM-as-Judge
  if (baseResults.some((r) => r.answer.length > 0)) {
    const judgeResults = await llmAsJudge(provider, baseResults);
    if (judgeResults.length > 0) {
      const avgScore =
        judgeResults.reduce((sum, r) => sum + r.score, 0) /
        judgeResults.length;
      console.log(`\n  📊 LLM Judge 平均分: ${avgScore.toFixed(1)}/5`);
    }
  }

  // 过拟合说明
  explainOverfitting();

  // 总结
  console.log("\n" + "=".repeat(60));
  console.log("📊 评估总结");
  console.log("=".repeat(60));

  console.log("\n📌 完整的评估策略:");
  console.log("  1. 定义评估数据集（覆盖各种场景）");
  console.log("  2. 基座模型 baseline 测试");
  console.log("  3. 微调模型测试（相同数据集）");
  console.log("  4. 对比分析（覆盖率、准确性、响应风格）");
  console.log("  5. LLM-as-Judge 综合评分");
  console.log("  6. 持续监控，发现退化及时回退");

  console.log("\n💡 注意:");
  console.log("  本 demo 中仅评估了基座模型作为 baseline");
  console.log("  实际使用时，微调完成后需要用相同数据集评估微调模型");
  console.log("  然后对比两者的指标来判断微调是否有效");

  console.log("\n" + "=".repeat(60));
  console.log("🎓 Module 12 全部完成！");
  console.log("=".repeat(60));
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("evaluation.ts");

if (isMainModule) {
  main().catch(console.error);
}

export {
  getEvalDataset,
  evaluateModel,
  llmAsJudge,
  generateReport,
  type EvalResult,
  type JudgeResult,
};
