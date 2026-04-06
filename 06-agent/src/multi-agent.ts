/**
 * multi-agent.ts — Multi-Agent 多智能体协作
 *
 * 四种经典 Multi-Agent 协作模式的完整演示：
 *
 * Demo 1: 顺序流水线 — 研究 → 撰写 → 审核
 *   ┌──────────┐    ┌──────────┐    ┌──────────┐
 *   │ research │───▶│  writer  │───▶│ reviewer │───▶ END
 *   └──────────┘    └──────────┘    └──────────┘
 *
 * Demo 2: 条件路由 — 审核不通过则循环重写
 *   ┌──────────┐    ┌──────────┐    ┌──────────┐
 *   │ research │───▶│  writer  │───▶│ reviewer │
 *   └──────────┘    └────▲─────┘    └─────┬────┘
 *                        │  不合格        │
 *                        └────────────────┘
 *                                  │ 合格
 *                                  ▼
 *                                 END
 *
 * Demo 3: Supervisor 动态分派 — 主管 Agent 运行时决定调谁
 *                ┌──────────────┐
 *          ┌────▶│  supervisor  │◀───┐
 *          │     └──────┬───────┘    │
 *          │   ┌────────┼────────┐   │
 *          │   ▼        ▼        ▼   │
 *          │ research writer  translator
 *          │   │        │        │   │
 *          │   └────────┴────────┘   │
 *          │            │            │
 *          └────────────┘     DONE ──┼──▶ finalize ──▶ END
 *
 * Demo 4: 辩论协作 — 正方 ⇄ 反方 → 裁判总结
 *          ┌───────────┐
 *    ┌────▶│  正方 Pro  │────┐
 *    │     └───────────┘    │
 *    │                      ▼
 *    │     ┌───────────┐  ┌──────┐     ┌────────┐
 *  START──▶│  反方 Con  │◀─│ 轮次 │────▶│  裁判  │──▶ END
 *    │     └───────────┘  │ 判断 │     │ Judge  │
 *    │                    └──────┘     └────────┘
 *    └────── 继续辩论 ◀───┘
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

// ============================================================
// 2. Demo 入口
// ============================================================

async function main() {
  console.log("👥 multi-agent.ts — Multi-Agent 多智能体协作 Demo\n");

  const model = createChatModel({ temperature: 0.7 });

  // ==========================================================
  // Demo 1: 顺序流水线 — 研究 → 撰写 → 审核
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 顺序流水线 — 三个 Agent 流水线\n");
  console.log("💡 流程图：");
  console.log("   START → [研究] → [撰写] → [审核] → END");
  console.log("   编译时确定，无论什么输入都走同样顺序\n");

  // 定义共享状态
  const PipelineState = Annotation.Root({
    topic: Annotation<string>,
    researchData: Annotation<string>,
    article: Annotation<string>,
    review: Annotation<string>,
  });

  // 研究 Agent
  async function researchAgentNode(
    state: typeof PipelineState.State
  ): Promise<Partial<typeof PipelineState.State>> {
    console.log("  🔬 [研究 Agent] 正在检索资料...");
    const searchResult = await searchTool.invoke({ query: state.topic });
    const response = await model.invoke([
      new SystemMessage(
        "你是研究助手。请根据搜索结果，整理出关于该主题的关键要点（3-5个要点，每个要点一句话）。"
      ),
      new HumanMessage(
        `主题：${state.topic}\n\n搜索结果：\n${searchResult}`
      ),
    ]);
    console.log("  🔬 [研究 Agent] 整理完成");
    return { researchData: response.content as string };
  }

  // 撰写 Agent
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
    console.log("  ✍️  [撰写 Agent] 撰写完成");
    return { article: response.content as string };
  }

  // 审核 Agent
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
    console.log("  📋 [审核 Agent] 审核完成");
    return { review: response.content as string };
  }

  //   ┌──────────┐    ┌──────────┐    ┌──────────┐
  //   │ research │───▶│  writer  │───▶│ reviewer │───▶ END
  //   └──────────┘    └──────────┘    └──────────┘
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

  console.log("\n📊 流水线结果:");
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
  // Demo 2: 条件路由 — 审核不通过则循环重写
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 2: 条件路由 — 审核不通过则循环重写\n");
  console.log("💡 流程图：");
  console.log("   START → [研究] → [撰写] → [审核] ─┬─ 合格 → END");
  console.log("                       ▲              │");
  console.log("                       └── 不合格 ────┘\n");

  const LoopPipelineState = Annotation.Root({
    topic: Annotation<string>,
    researchData: Annotation<string>,
    article: Annotation<string>,
    review: Annotation<string>,
    score: Annotation<number>,
    feedback: Annotation<string>,
    iteration: Annotation<number>,
  });

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

  async function writerNode2(
    state: typeof LoopPipelineState.State
  ): Promise<Partial<typeof LoopPipelineState.State>> {
    const iteration = (state.iteration || 0) + 1;
    console.log(`  ✍️  [撰写 Agent] 第 ${iteration} 次撰写...`);

    const prompt = state.feedback
      ? `请根据审核反馈改进文章：\n反馈：${state.feedback}\n原文：${state.article}\n研究资料：${state.researchData}\n\n请写出改进版（150-200字）。`
      : `主题：${state.topic}\n研究资料：${state.researchData}\n\n请撰写技术介绍（150-200字）。`;

    const response = await model.invoke([
      new SystemMessage("你是技术文章作者，文风专业清晰。使用中文。"),
      new HumanMessage(prompt),
    ]);
    return { article: response.content as string, iteration };
  }

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

  //   ┌──────────┐    ┌──────────┐    ┌──────────┐
  //   │ research │───▶│  writer  │───▶│ reviewer │
  //   └──────────┘    └────▲─────┘    └─────┬────┘
  //                        │  rewrite       │
  //                        └────────────────┘
  //                                  │ end
  //                                  ▼ END
  const loopPipelineGraph = new StateGraph(LoopPipelineState)
    .addNode("research", researchNode2)
    .addNode("writer", writerNode2)
    .addNode("reviewer", reviewerNode2)
    .addEdge(START, "research")
    .addEdge("research", "writer")
    .addEdge("writer", "reviewer")
    .addConditionalEdges("reviewer", shouldRewrite, {
      rewrite: "writer",
      end: END,
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
  console.log();

  // ==========================================================
  // Demo 3: Supervisor 动态分派
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 3: Supervisor 模式 — 主管 Agent 动态分派子任务\n");
  console.log("💡 流程图：");
  console.log("              ┌──────────────┐");
  console.log("        ┌────▶│  supervisor  │◀────┐");
  console.log("        │     └──────┬───────┘     │");
  console.log("        │   ┌───────┼────────┐     │");
  console.log("        │   ▼       ▼        ▼     │");
  console.log("        │ research writer translator│");
  console.log("        │   │       │        │     │");
  console.log("        │   └───────┴────────┘     │");
  console.log("        └──────────┘    DONE──▶ finalize ──▶ END");
  console.log();
  console.log("   与 Demo 1/2 的区别：流程不是预定义的，由主管运行时动态决定\n");

  const SupervisorState = Annotation.Root({
    task: Annotation<string>,             // 默认覆盖模式：后写覆盖前值
    // ── Reducer 追加模式 ──
    // 多个 Worker 都往 messages 写入，需要追加而不是覆盖：
    //   研究员返回 { messages: ["[研究员] 要点..."] }     → ["[研究员] 要点..."]
    //   撰写员返回 { messages: ["[撰写员] 文章..."] }     → ["[研究员] 要点...", "[撰写员] 文章..."]
    //   翻译员返回 { messages: ["[翻译员] English..."] }  → [..., "[翻译员] English..."]
    // 如果用默认 Annotation<string[]>，每次只剩最后一个 Worker 的内容 ❌
    // 用 reducer: (prev, next) => [...prev, ...next]，完整保留所有执行记录 ✅
    //
    // LangGraph 内部调用时机：
    //   newState.messages = reducer(oldState.messages, nodeReturn.messages)
    messages: Annotation<string[]>({
      reducer: (prev, next) => [...prev, ...next],  // 追加合并
      default: () => [],                            // 初始值：invoke 没传时用空数组
    }),
    finalResult: Annotation<string>,      // 默认覆盖
    nextWorker: Annotation<string>,       // 默认覆盖
    iteration: Annotation<number>,        // 默认覆盖
  });

  async function researchWorker(
    state: typeof SupervisorState.State
  ): Promise<Partial<typeof SupervisorState.State>> {
    console.log("  🔬 [研究员] 执行研究任务...");
    const searchResult = await searchTool.invoke({ query: state.task });
    const response = await model.invoke([
      new SystemMessage("你是研究员，根据搜索结果整理 3 个关键要点。简洁。"),
      new HumanMessage(`任务：${state.task}\n搜索结果：${searchResult}\n\n已有信息：\n${state.messages.join("\n")}`),
    ]);
    console.log("  🔬 [研究员] 完成");
    return { messages: [`[研究员] ${response.content}`] };
  }

  async function writerWorker(
    state: typeof SupervisorState.State
  ): Promise<Partial<typeof SupervisorState.State>> {
    console.log("  ✍️  [撰写员] 执行撰写任务...");
    const response = await model.invoke([
      new SystemMessage("你是撰写员，根据已有信息撰写内容（100字以内）。使用中文。"),
      new HumanMessage(`任务：${state.task}\n\n已有信息：\n${state.messages.join("\n")}`),
    ]);
    console.log("  ✍️  [撰写员] 完成");
    return { messages: [`[撰写员] ${response.content}`] };
  }

  async function translatorWorker(
    state: typeof SupervisorState.State
  ): Promise<Partial<typeof SupervisorState.State>> {
    console.log("  🌐 [翻译员] 执行翻译任务...");
    const lastMessage = state.messages[state.messages.length - 1] || "";
    const response = await model.invoke([
      new SystemMessage("你是翻译员，将内容翻译为英文。只输出译文。"),
      new HumanMessage(lastMessage),
    ]);
    console.log("  🌐 [翻译员] 完成");
    return { messages: [`[翻译员] ${response.content}`] };
  }

  async function supervisorNode(
    state: typeof SupervisorState.State
  ): Promise<Partial<typeof SupervisorState.State>> {
    const iteration = (state.iteration || 0) + 1;
    console.log(`\n  👔 [主管] 第 ${iteration} 轮决策...`);

    const response = await model.invoke([
      new SystemMessage(
        `你是项目主管，手下有三个 Worker：
- researcher: 研究员，负责搜索和整理信息
- writer: 撰写员，负责写文章
- translator: 翻译员，负责翻译为英文

根据用户任务和当前进展，决定下一步交给谁。
如果任务已完成，回复 "DONE"。
只回复一个词：researcher / writer / translator / DONE`
      ),
      new HumanMessage(
        `用户任务：${state.task}\n\n当前进展（${state.messages.length} 条记录）：\n${state.messages.slice(-3).join("\n") || "（尚未开始）"}`
      ),
    ]);

    const decision = (response.content as string).trim().toLowerCase();
    let nextWorker: string;

    if (decision.includes("done") || iteration > 4) {
      nextWorker = "DONE";
      console.log(`  👔 [主管] 决定：任务完成`);
    } else if (decision.includes("researcher") || decision.includes("research")) {
      nextWorker = "researcher";
      console.log(`  👔 [主管] 决定：交给研究员`);
    } else if (decision.includes("translator") || decision.includes("translat")) {
      nextWorker = "translator";
      console.log(`  👔 [主管] 决定：交给翻译员`);
    } else {
      nextWorker = "writer";
      console.log(`  👔 [主管] 决定：交给撰写员`);
    }

    return { nextWorker, iteration };
  }

  async function finalizeNode(
    state: typeof SupervisorState.State
  ): Promise<Partial<typeof SupervisorState.State>> {
    console.log("  📋 [汇总] 生成最终结果...");
    const response = await model.invoke([
      new SystemMessage("你是编辑，请将以下工作成果整理为最终输出（150字以内）。使用中文。"),
      new HumanMessage(`任务：${state.task}\n\n工作记录：\n${state.messages.join("\n")}`),
    ]);
    return { finalResult: response.content as string };
  }

  function supervisorRoute(state: typeof SupervisorState.State): string {
    if (state.nextWorker === "DONE") return "finalize";
    if (state.nextWorker === "researcher") return "researcher";
    if (state.nextWorker === "translator") return "translator";
    return "writer";
  }

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
    .addEdge("researcher", "supervisor")
    .addEdge("writer", "supervisor")
    .addEdge("translator", "supervisor")
    .addEdge("finalize", END)
    .compile();

  const task3 = "研究 AI Agent 的最新进展，写一段中文介绍，然后翻译成英文";
  console.log(`📝 任务: ${task3}\n`);

  const result3 = await supervisorGraph.invoke({
    task: task3,
    iteration: 0,
  });

  console.log("\n📊 Supervisor 执行结果:");
  console.log("─".repeat(40));
  console.log(`总轮次: ${result3.iteration}`);
  console.log(`执行记录 (${result3.messages?.length || 0} 条):`);
  for (const msg of result3.messages || []) {
    console.log(`  ${msg.substring(0, 100)}`);
  }
  console.log("─".repeat(40));
  console.log("📝 最终结果:");
  console.log(result3.finalResult?.substring(0, 500));
  console.log();

  // ==========================================================
  // Demo 4: 辩论协作 — 正方 ⇄ 反方 → 裁判
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 4: 辩论协作 — 正方 ⇄ 反方 → 裁判总结\n");
  console.log("💡 流程图：");
  console.log("   START → [正方] → [反方] → 轮次判断 ─┬─ 继续 → [正方]（循环）");
  console.log("                                        └─ 结束 → [裁判] → END");
  console.log();
  console.log("   场景：对一个技术话题进行多角度辩论，最终由裁判综合双方观点\n");

  const DebateState = Annotation.Root({
    topic: Annotation<string>,             // 辩题（覆盖）
    // 正方论点列表 — Reducer 追加模式（同 Demo 3 的 messages）
    // 每轮正方返回 { proArguments: ["新论点"] }，自动追加到数组末尾
    proArguments: Annotation<string[]>({
      reducer: (prev, next) => [...prev, ...next],
      default: () => [],
    }),
    // 反方论点列表 — 同理
    conArguments: Annotation<string[]>({
      reducer: (prev, next) => [...prev, ...next],
      default: () => [],
    }),
    round: Annotation<number>,             // 当前轮次（覆盖）
    verdict: Annotation<string>,           // 裁判总结（覆盖）
  });

  // 正方 Agent：提出支持论点
  async function proAgentNode(
    state: typeof DebateState.State
  ): Promise<Partial<typeof DebateState.State>> {
    const round = (state.round || 0) + 1;
    console.log(`  🟢 [正方] 第 ${round} 轮发言...`);

    // 构建对话上下文：看到对方之前的论点以便反驳
    const previousDebate = state.conArguments.length > 0
      ? `反方之前的论点：\n${state.conArguments.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}\n\n请针对反方观点进行反驳，并提出新的支持论点。`
      : `这是第一轮辩论，请提出你的核心支持论点。`;

    const response = await model.invoke([
      new SystemMessage(
        `你是辩论正方，坚定支持该观点。要求：
1. 论点明确，有理有据（50字以内）
2. 如果有反方论点，先简要反驳再提出新论点
3. 只输出一个核心论点`
      ),
      new HumanMessage(`辩题：${state.topic}\n\n${previousDebate}`),
    ]);

    const argument = response.content as string;
    console.log(`  🟢 [正方] 论点: ${argument.substring(0, 80)}`);
    return { proArguments: [argument], round };
  }

  // 反方 Agent：提出反对论点
  async function conAgentNode(
    state: typeof DebateState.State
  ): Promise<Partial<typeof DebateState.State>> {
    console.log(`  🔴 [反方] 第 ${state.round} 轮发言...`);

    const latestProArg = state.proArguments[state.proArguments.length - 1] || "";

    const response = await model.invoke([
      new SystemMessage(
        `你是辩论反方，坚定反对该观点。要求：
1. 先反驳正方最新论点
2. 再提出自己的反对论点（50字以内）
3. 只输出一个核心论点`
      ),
      new HumanMessage(
        `辩题：${state.topic}\n\n正方最新论点：${latestProArg}\n\n正方所有论点：\n${state.proArguments.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`
      ),
    ]);

    const argument = response.content as string;
    console.log(`  🔴 [反方] 论点: ${argument.substring(0, 80)}`);
    return { conArguments: [argument] };
  }

  // 轮次判断：是否继续辩论
  function shouldContinueDebate(state: typeof DebateState.State): string {
    if (state.round >= 3) {
      console.log(`  ⏹️  辩论结束（已完成 ${state.round} 轮），交给裁判`);
      return "judge";
    }
    console.log(`  🔄 继续辩论（第 ${state.round}/3 轮完成）`);
    return "continue";
  }

  // 裁判 Agent：综合双方观点给出总结
  async function judgeAgentNode(
    state: typeof DebateState.State
  ): Promise<Partial<typeof DebateState.State>> {
    console.log("  ⚖️  [裁判] 综合评判...");

    const response = await model.invoke([
      new SystemMessage(
        `你是公正的辩论裁判。请：
1. 简要概括正反双方的核心论点
2. 指出各方的亮点和不足
3. 给出你的综合判断（哪方更有说服力，为什么）
4. 总字数 150 字以内，使用中文`
      ),
      new HumanMessage(
        `辩题：${state.topic}\n\n` +
        `正方论点（${state.proArguments.length} 条）：\n${state.proArguments.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}\n\n` +
        `反方论点（${state.conArguments.length} 条）：\n${state.conArguments.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`
      ),
    ]);

    console.log("  ⚖️  [裁判] 评判完成");
    return { verdict: response.content as string };
  }

  //   START → pro → con → shouldContinue ─┬─ continue → pro（循环）
  //                                        └─ judge → judgeAgent → END
  const debateGraph = new StateGraph(DebateState)
    .addNode("pro", proAgentNode)
    .addNode("con", conAgentNode)
    .addNode("judgeAgent", judgeAgentNode)
    .addEdge(START, "pro")
    .addEdge("pro", "con")
    .addConditionalEdges("con", shouldContinueDebate, {
      continue: "pro",    // 继续辩论 → 回到正方
      judge: "judgeAgent", // 辩论结束 → 裁判
    })
    .addEdge("judgeAgent", END)
    .compile();

  const debateTopic = "AI 将在 5 年内取代大部分程序员的工作";
  console.log(`📝 辩题: ${debateTopic}\n`);

  const result4 = await debateGraph.invoke({
    topic: debateTopic,
    round: 0,
  });

  console.log("\n📊 辩论结果:");
  console.log("─".repeat(40));
  console.log(`辩论轮次: ${result4.round}`);
  console.log("\n🟢 正方论点:");
  for (const [i, arg] of (result4.proArguments || []).entries()) {
    console.log(`  ${i + 1}. ${arg.substring(0, 100)}`);
  }
  console.log("\n🔴 反方论点:");
  for (const [i, arg] of (result4.conArguments || []).entries()) {
    console.log(`  ${i + 1}. ${arg.substring(0, 100)}`);
  }
  console.log("\n⚖️  裁判总结:");
  console.log(result4.verdict?.substring(0, 500));

  // ==========================================================
  // 总结
  // ==========================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ Multi-Agent 多智能体协作 Demo 完成！");
  console.log("\n💡 核心知识点:");
  console.log("   1. 每个 Agent 是一个 StateGraph 节点，有独立的 System Prompt 和工具");
  console.log("   2. 共享状态（Annotation）是 Agent 间通信的桥梁");
  console.log("   3. Reducer 模式用于追加式通信（如辩论论点列表、执行日志）");
  console.log("   4. 四种模式适用不同场景，可组合使用");

  console.log("\n📊 四种 Multi-Agent 协作模式对比:");
  console.log("┌──────────────┬──────────────────────────────┬─────────────────────────┐");
  console.log("│ 模式         │ 流程结构                     │ 适用场景                │");
  console.log("├──────────────┼──────────────────────────────┼─────────────────────────┤");
  console.log("│ 顺序流水线   │ A → B → C → END             │ 明确的多阶段任务        │");
  console.log("│ 条件路由     │ A → B → C →[B/END]          │ 需要质量门控            │");
  console.log("│ Supervisor   │ 主管 →[A|B|C]→ 主管（循环） │ 动态任务分配（SubAgent）│");
  console.log("│ 辩论协作     │ A ⇄ B（多轮）→ 裁判         │ 多角度评估 / 对抗生成   │");
  console.log("└──────────────┴──────────────────────────────┴─────────────────────────┘");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("multi-agent.ts");

if (isMainModule) {
  main().catch(console.error);
}
