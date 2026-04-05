/**
 * multi-agent.ts — Multi-Agent 多智能体协作
 *
 * 多个 Agent 分工协作，各司其职：
 * - researchAgent — 负责信息检索
 * - writerAgent   — 负责内容撰写
 * - reviewerAgent — 负责质量审核
 *
 * Demo:
 * - Demo 1: 顺序协作 — 研究 → 撰写 → 审核（线性流水线）
 * - Demo 2: 条件路由 — 审核不通过则返回重写（循环改进）
 *
 * 运行: npm run multi-agent
 */

import "dotenv/config";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  StateGraph,
  Annotation,
  START,
  END,
} from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "./model-chat.js";

// ============================================================
// 1. 工具定义
// ============================================================

/** 模拟搜索工具 */
const searchTool = tool(
  async ({ query }: { query: string }) => {
    // 模拟搜索结果
    const knowledgeBase: Record<string, string> = {
      "AI Agent":
        "AI Agent 是能自主决策的智能体，核心组件包括 LLM（推理引擎）、工具（外部能力）、记忆（上下文管理）和规划（任务分解）。2024年 Agent 框架如 LangGraph、CrewAI、AutoGen 快速发展。",
      TypeScript:
        "TypeScript 是 JavaScript 的超集，增加了静态类型系统。2024年 TypeScript 5.x 引入了装饰器、const 类型参数等特性，在 AI 应用开发领域使用率持续增长。",
      LangGraph:
        "LangGraph 是 LangChain 团队开发的 Agent 编排框架，基于状态图（StateGraph）模型。支持条件分支、循环、Human-in-the-Loop 等高级流程控制。",
      "Multi-Agent":
        "Multi-Agent（多智能体）系统让多个专业 Agent 协作完成复杂任务。常见模式：顺序流水线、主管-执行者、辩论协作、分层规划。",
      默认:
        "这是一个关于 AI 和软件开发的综合知识库，覆盖 LLM、Agent、框架、工程实践等主题。",
    };

    // 模糊匹配
    for (const [key, value] of Object.entries(knowledgeBase)) {
      if (
        query.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(query.toLowerCase())
      ) {
        return `🔍 搜索结果 [${key}]:\n${value}`;
      }
    }
    return `🔍 搜索「${query}」：${knowledgeBase["默认"]}`;
  },
  {
    name: "search",
    description: "搜索技术知识库，获取相关资料",
    schema: z.object({
      query: z.string().describe("搜索关键词"),
    }),
  }
);

/** 文本长度统计工具 */
const textLengthTool = tool(
  async ({ text }: { text: string }) => {
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return `字符数: ${charCount}，词数: ${wordCount}`;
  },
  {
    name: "text_length",
    description: "统计文本的字符数和词数",
    schema: z.object({
      text: z.string().describe("要统计的文本"),
    }),
  }
);

// ============================================================
// 2. Demo 入口
// ============================================================

async function main() {
  console.log("👥 multi-agent.ts — Multi-Agent 多智能体协作 Demo\n");

  const model = createChatModel({ temperature: 0.7 });

  // ==========================================================
  // Demo 1: 顺序协作 — 研究 → 撰写 → 审核
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 顺序协作 — 三个 Agent 流水线\n");
  console.log("💡 研究 Agent → 撰写 Agent → 审核 Agent（线性串联）\n");

  // 定义共享状态
  const PipelineState = Annotation.Root({
    topic: Annotation<string>,
    researchData: Annotation<string>,
    article: Annotation<string>,
    review: Annotation<string>,
  });

  // 研究 Agent：搜索资料
  async function researchAgentNode(
    state: typeof PipelineState.State
  ): Promise<Partial<typeof PipelineState.State>> {
    console.log("  🔬 [研究 Agent] 正在检索资料...");

    // 使用搜索工具
    const searchResult = await searchTool.invoke({ query: state.topic });

    // 让 LLM 整理搜索结果
    const response = await model.invoke([
      new SystemMessage(
        "你是研究助手。请根据搜索结果，整理出关于该主题的关键要点（3-5个要点，每个要点一句话）。"
      ),
      new HumanMessage(
        `主题：${state.topic}\n\n搜索结果：\n${searchResult}`
      ),
    ]);

    const researchData = response.content as string;
    console.log("  🔬 [研究 Agent] 整理完成\n");
    return { researchData };
  }

  // 撰写 Agent：写文章
  async function writerAgentNode(
    state: typeof PipelineState.State
  ): Promise<Partial<typeof PipelineState.State>> {
    console.log("  ✍️  [撰写 Agent] 正在撰写文章...");

    const response = await model.invoke([
      new SystemMessage(
        "你是技术文章作者。请根据研究资料撰写一篇简短的技术介绍（150-200字），要求：" +
          "1. 开头引入主题 2. 中间阐述要点 3. 结尾总结展望。使用中文。"
      ),
      new HumanMessage(
        `主题：${state.topic}\n\n研究资料：\n${state.researchData}`
      ),
    ]);

    const article = response.content as string;
    console.log("  ✍️  [撰写 Agent] 撰写完成\n");
    return { article };
  }

  // 审核 Agent：评审文章
  async function reviewerAgentNode(
    state: typeof PipelineState.State
  ): Promise<Partial<typeof PipelineState.State>> {
    console.log("  📋 [审核 Agent] 正在审核文章...");

    const response = await model.invoke([
      new SystemMessage(
        "你是技术编辑。请对文章进行审核，给出：" +
          "1. 评分（1-10）2. 优点 3. 改进建议。" +
          "格式：评分：X/10\\n优点：XXX\\n建议：XXX"
      ),
      new HumanMessage(`文章：\n${state.article}`),
    ]);

    const review = response.content as string;
    console.log("  📋 [审核 Agent] 审核完成\n");
    return { review };
  }

  // 构建流水线
  const pipelineGraph = new StateGraph(PipelineState)
    .addNode("research", researchAgentNode)
    .addNode("writer", writerAgentNode)
    .addNode("reviewer", reviewerAgentNode)
    .addEdge(START, "research")
    .addEdge("research", "writer")
    .addEdge("writer", "reviewer")
    .addEdge("reviewer", END)
    .compile();

  const topic1 = "AI Agent 技术发展趋势";
  console.log(`📝 主题: ${topic1}\n`);

  const result1 = await pipelineGraph.invoke({ topic: topic1 });

  console.log("📊 流水线结果:");
  console.log("─".repeat(40));
  console.log("📚 研究要点:");
  console.log(result1.researchData?.substring(0, 300));
  console.log("─".repeat(40));
  console.log("📝 文章:");
  console.log(result1.article?.substring(0, 500));
  console.log("─".repeat(40));
  console.log("📋 审核意见:");
  console.log(result1.review?.substring(0, 300));
  console.log();

  // ==========================================================
  // Demo 2: 条件路由 — 审核不通过则返回重写
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 2: 条件路由 — 审核不通过则循环重写\n");
  console.log("💡 审核 Agent 评分 < 7 → 返回撰写 Agent 重写（最多 3 轮）\n");

  const LoopPipelineState = Annotation.Root({
    topic: Annotation<string>,
    researchData: Annotation<string>,
    article: Annotation<string>,
    review: Annotation<string>,
    score: Annotation<number>,
    feedback: Annotation<string>,
    iteration: Annotation<number>,
  });

  // 研究节点（同上）
  async function researchNode2(
    state: typeof LoopPipelineState.State
  ): Promise<Partial<typeof LoopPipelineState.State>> {
    console.log("  🔬 [研究 Agent] 检索资料...");
    const searchResult = await searchTool.invoke({ query: state.topic });
    const response = await model.invoke([
      new SystemMessage("整理搜索结果为 3-5 个关键要点。"),
      new HumanMessage(`主题：${state.topic}\n搜索结果：${searchResult}`),
    ]);
    return { researchData: response.content as string };
  }

  // 撰写节点（支持根据反馈改进）
  async function writerNode2(
    state: typeof LoopPipelineState.State
  ): Promise<Partial<typeof LoopPipelineState.State>> {
    const iteration = (state.iteration || 0) + 1;
    console.log(`  ✍️  [撰写 Agent] 第 ${iteration} 次撰写...`);

    const prompt = state.feedback
      ? `请根据审核反馈改进文章：\n反馈：${state.feedback}\n原文：${state.article}\n研究资料：${state.researchData}\n\n请写出改进版（150-200字）。`
      : `主题：${state.topic}\n研究资料：${state.researchData}\n\n请撰写技术介绍（150-200字）。`;

    const response = await model.invoke([
      new SystemMessage(
        "你是技术文章作者，文风专业清晰。使用中文。"
      ),
      new HumanMessage(prompt),
    ]);

    return { article: response.content as string, iteration };
  }

  // 审核节点（带评分解析）
  async function reviewerNode2(
    state: typeof LoopPipelineState.State
  ): Promise<Partial<typeof LoopPipelineState.State>> {
    console.log(`  📋 [审核 Agent] 审核第 ${state.iteration} 版文章...`);

    const response = await model.invoke([
      new SystemMessage(
        "评审文章，严格按格式回复：\n评分：X（1-10的数字）\n反馈：XXX（改进建议）"
      ),
      new HumanMessage(`文章：\n${state.article}`),
    ]);

    const text = response.content as string;
    const scoreMatch = text.match(/评分[：:]\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 7;
    const feedbackMatch = text.match(/反馈[：:]\s*([\s\S]+)/);
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : "请继续改进";

    console.log(`  📋 [审核 Agent] 评分: ${score}/10`);
    return { score, feedback, review: text };
  }

  // 条件判断
  function shouldRewrite(state: typeof LoopPipelineState.State): string {
    if (state.score >= 7 || state.iteration >= 3) {
      console.log(
        state.score >= 7
          ? `  ✅ 评分达标 (${state.score}/10)，流程结束`
          : `  ⚠️ 达到最大迭代 (${state.iteration} 次)，流程结束`
      );
      return "end";
    }
    console.log(`  🔄 评分不足 (${state.score}/10)，返回重写...\n`);
    return "rewrite";
  }

  const loopPipelineGraph = new StateGraph(LoopPipelineState)
    .addNode("research", researchNode2)
    .addNode("writer", writerNode2)
    .addNode("reviewer", reviewerNode2)
    .addEdge(START, "research")
    .addEdge("research", "writer")
    .addEdge("writer", "reviewer")
    .addConditionalEdges("reviewer", shouldRewrite, {
      rewrite: "writer", // 不合格 → 重写
      end: END, // 合格 → 结束
    })
    .compile();

  const topic2 = "Multi-Agent 协作模式";
  console.log(`📝 主题: ${topic2}\n`);

  const result2 = await loopPipelineGraph.invoke({
    topic: topic2,
    iteration: 0,
    score: 0,
  });

  console.log("\n📊 最终结果:");
  console.log("─".repeat(40));
  console.log(`迭代次数: ${result2.iteration}`);
  console.log(`最终评分: ${result2.score}/10`);
  console.log("─".repeat(40));
  console.log("📝 最终文章:");
  console.log(result2.article?.substring(0, 500));
  console.log("─".repeat(40));
  console.log("📋 最终审核:");
  console.log(result2.review?.substring(0, 300));

  // ==========================================================
  // 总结
  // ==========================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ Multi-Agent 多智能体协作 Demo 完成！");
  console.log("\n💡 核心知识点:");
  console.log("   1. 每个 Agent 是一个 StateGraph 节点，有独立的 System Prompt 和工具");
  console.log("   2. 共享状态（Annotation）是 Agent 间通信的桥梁");
  console.log("   3. 顺序协作 — 流水线模式，A → B → C");
  console.log("   4. 条件路由 — 审核不通过则回到上一步，形成改进循环");
  console.log("   5. 实际应用：代码审查、内容生成、数据分析 pipeline");

  console.log("\n📊 Multi-Agent 协作模式对比:");
  console.log("┌──────────────┬──────────────────────┬─────────────────────┐");
  console.log("│ 模式         │ 结构                 │ 适用场景            │");
  console.log("├──────────────┼──────────────────────┼─────────────────────┤");
  console.log("│ 顺序流水线   │ A → B → C → END     │ 明确的多阶段任务    │");
  console.log("│ 条件路由     │ A → B → C →[B/END]  │ 需要质量门控        │");
  console.log("│ 主管模式     │ 主管 → [A|B|C]      │ 动态分配子任务      │");
  console.log("│ 辩论协作     │ A ⇄ B → 裁判        │ 需要多角度评估      │");
  console.log("└──────────────┴──────────────────────┴─────────────────────┘");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("multi-agent.ts");

if (isMainModule) {
  main().catch(console.error);
}
