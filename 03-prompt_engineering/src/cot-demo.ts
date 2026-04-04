/**
 * cot-demo.ts — 思维链（Chain-of-Thought）对比实验
 *
 * 同一道数学/逻辑推理题，对比三种 Prompt 策略的效果：
 * - Zero-shot：直接提问
 * - Few-shot：提供示例
 * - CoT（Chain-of-Thought）：要求逐步推理
 *
 * 运行: npm run cot-demo
 */

import "dotenv/config";
import { generateText } from "ai";
import { getModel, getDefaultProvider, type Provider } from "./model-adapter.js";

// ============================================================
// 1. 测试题目定义
// ============================================================

interface Problem {
  id: number;
  question: string;
  correctAnswer: string;
  /** 用于自动判断的关键字/数值 */
  answerCheck: (answer: string) => boolean;
}

const PROBLEMS: Problem[] = [
  {
    id: 1,
    question:
      "一个商店进了一批苹果，第一天卖了总数的一半多2个，第二天卖了剩下的一半多1个，第三天还剩5个。这批苹果一共有多少个？",
    correctAnswer: "28",
    answerCheck: (answer) => answer.includes("28"),
  },
  {
    id: 2,
    question:
      "农场里有鸡和兔子共35只，数一数共有94只脚。鸡有多少只？兔子有多少只？",
    correctAnswer: "鸡23只，兔12只",
    answerCheck: (answer) => answer.includes("23") && answer.includes("12"),
  },
  {
    id: 3,
    question:
      "一列火车通过一座长200米的桥用了30秒，以同样的速度通过一座长500米的桥用了45秒。火车的速度是多少米/秒？火车的长度是多少米？",
    correctAnswer: "速度20米/秒，长度400米",
    answerCheck: (answer) => answer.includes("20") && answer.includes("400"),
  },
];

// ============================================================
// 2. 三种 Prompt 策略
// ============================================================

type Strategy = "zero-shot" | "few-shot" | "cot";

function buildPrompt(problem: Problem, strategy: Strategy): string {
  switch (strategy) {
    case "zero-shot":
      return `${problem.question}\n\n请直接给出答案。`;

    case "few-shot":
      return `以下是一些数学题的例子：

【示例1】
问题：小明有12个苹果，给了小红5个，又买了3个，小明现在有几个苹果？
答案：12 - 5 + 3 = 10个苹果。

【示例2】
问题：一根绳子长16米，第一次剪去一半，第二次剪去剩下的一半，绳子还剩多少米？
答案：第一次剪后剩 16÷2=8 米，第二次剪后剩 8÷2=4 米。

现在请解答：
${problem.question}`;

    case "cot":
      return `${problem.question}

请一步一步地思考这个问题：
1. 首先理解题目中的条件
2. 建立数学关系或方程
3. 逐步求解
4. 验证答案是否正确

请展示你的完整推理过程，最后给出明确答案。`;

    default:
      throw new Error(`未知策略: ${strategy}`);
  }
}

// ============================================================
// 3. 执行实验
// ============================================================

interface ExperimentResult {
  problemId: number;
  strategy: Strategy;
  answer: string;
  isCorrect: boolean;
  tokenLength: number;
}

async function runExperiment(
  provider: Provider,
  problem: Problem,
  strategy: Strategy
): Promise<ExperimentResult> {
  const model = getModel(provider);
  const prompt = buildPrompt(problem, strategy);

  const { text, usage } = await generateText({
    model,
    prompt,
    maxOutputTokens: 800,
    temperature: 0.1, // 低温度保证结果稳定
  });

  return {
    problemId: problem.id,
    strategy,
    answer: text.trim(),
    isCorrect: problem.answerCheck(text),
    tokenLength: usage?.totalTokens ?? text.length,
  };
}

// ============================================================
// 4. 表格打印
// ============================================================

function printResultsTable(results: ExperimentResult[]) {
  const strategies: Strategy[] = ["zero-shot", "few-shot", "cot"];
  const problemIds = [...new Set(results.map((r) => r.problemId))];

  console.log("\n📊 对比结果汇总");
  console.log(
    "┌──────────┬────────────┬────────────┬──────────┬──────────────────────────────────┐"
  );
  console.log(
    "│ 题目     │ 策略       │ 是否正确   │ Token数  │ 答案摘要                         │"
  );
  console.log(
    "├──────────┼────────────┼────────────┼──────────┼──────────────────────────────────┤"
  );

  for (const pid of problemIds) {
    for (const strategy of strategies) {
      const result = results.find(
        (r) => r.problemId === pid && r.strategy === strategy
      );
      if (!result) continue;

      const answerPreview =
        result.answer.replace(/\n/g, " ").substring(0, 30) + "…";
      const correctMark = result.isCorrect ? "✅ 正确" : "❌ 错误";

      console.log(
        `│ 题目${String(pid).padEnd(4)}│ ${strategy.padEnd(11)}│ ${correctMark.padEnd(8)}   │ ${String(result.tokenLength).padEnd(9)}│ ${answerPreview.padEnd(33)}│`
      );
    }
    if (pid !== problemIds[problemIds.length - 1]) {
      console.log(
        "├──────────┼────────────┼────────────┼──────────┼──────────────────────────────────┤"
      );
    }
  }

  console.log(
    "└──────────┴────────────┴────────────┴──────────┴──────────────────────────────────┘"
  );

  // 统计
  const stats: Record<Strategy, { total: number; correct: number }> = {
    "zero-shot": { total: 0, correct: 0 },
    "few-shot": { total: 0, correct: 0 },
    cot: { total: 0, correct: 0 },
  };

  for (const r of results) {
    stats[r.strategy].total++;
    if (r.isCorrect) stats[r.strategy].correct++;
  }

  console.log("\n📈 正确率统计:");
  for (const strategy of strategies) {
    const s = stats[strategy];
    const rate = ((s.correct / s.total) * 100).toFixed(0);
    const bar = "█".repeat(s.correct) + "░".repeat(s.total - s.correct);
    console.log(`  ${strategy.padEnd(12)} ${bar} ${s.correct}/${s.total} (${rate}%)`);
  }
}

// ============================================================
// 5. Main
// ============================================================

async function main() {
  console.log("🧠 cot-demo.ts — 思维链（Chain-of-Thought）对比实验\n");

  const provider = getDefaultProvider();
  console.log(`使用 Provider: ${provider}\n`);

  const strategies: Strategy[] = ["zero-shot", "few-shot", "cot"];
  const results: ExperimentResult[] = [];

  for (const problem of PROBLEMS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📝 题目 ${problem.id}: ${problem.question.substring(0, 50)}...`);
    console.log(`   正确答案: ${problem.correctAnswer}`);
    console.log("=".repeat(60));

    for (const strategy of strategies) {
      console.log(`\n  🔹 策略: ${strategy}`);

      try {
        const result = await runExperiment(provider, problem, strategy);
        results.push(result);

        const mark = result.isCorrect ? "✅" : "❌";
        console.log(`     ${mark} 答案: ${result.answer.replace(/\n/g, "\n          ").substring(0, 200)}`);
        if (result.answer.length > 200) console.log("          ...(已截断)");
      } catch (error) {
        console.error(`     ⚠️ 调用失败: ${(error as Error).message}`);
        results.push({
          problemId: problem.id,
          strategy,
          answer: "ERROR",
          isCorrect: false,
          tokenLength: 0,
        });
      }
    }
  }

  // 打印汇总表格
  printResultsTable(results);

  console.log("\n💡 核心洞察:");
  console.log("  1. Zero-shot 适合简单任务，复杂推理容易出错");
  console.log("  2. Few-shot 通过示例帮助模型理解解题模式");
  console.log("  3. CoT 通过逐步推理显著提升复杂问题的准确率");
  console.log("  4. CoT 的输出更长（更多 Token），但可靠性更高");

  console.log("\n" + "=".repeat(60));
  console.log("✅ 实验完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("cot-demo.ts");

if (isMainModule) {
  main().catch(console.error);
}
