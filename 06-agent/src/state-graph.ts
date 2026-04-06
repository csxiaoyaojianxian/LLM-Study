/**
 * state-graph.ts — StateGraph 自定义流程图
 *
 * LangGraph 的核心概念：用状态图（StateGraph）定义 Agent 的执行流程。
 * 超越简单的 ReAct 循环，实现任意复杂的 Agent 流程。
 *
 * ========== 核心概念 ==========
 *
 * 1. State（状态）— 整个图的「共享白板」
 *    - 用 Annotation.Root({ ... }) 定义，声明所有字段和类型
 *    - 所有节点都能读取完整状态，但只需返回要更新的字段（Partial）
 *    - 默认行为：后写覆盖前值（如 topic: Annotation<string>）
 *    - 高级用法：Reducer 模式（如消息追加而非覆盖）：
 *      messages: Annotation<BaseMessage[]>({
 *        reducer: (prev, next) => [...prev, ...next],  // 追加
 *        default: () => [],
 *      })
 *
 * 2. Node（节点）— 处理函数
 *    - 签名：(state: FullState) => Partial<FullState>
 *    - 接收完整状态，返回要更新的字段子集
 *    - ⚠️ 节点名不能与状态字段名重名
 *
 * 3. Edge（边）— 节点间的连接
 *    - addEdge(A, B)              — 无条件连接
 *    - addConditionalEdges(A, fn) — 条件分支，fn 返回下一个节点名
 *
 * 4. START / END — 特殊节点，标记流程的起点和终点
 *
 * Demo:
 * - Demo 1: 最简 StateGraph — 线性串联
 * - Demo 2: 条件分支 — 根据 LLM 判断走不同路径
 * - Demo 3: 循环图 — 自动改进直到满足条件
 * - Demo 4: Human-in-the-Loop — interrupt 暂停等待确认
 *
 * 运行: npm run state-graph
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
  interrupt,
  Command,
} from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "./model-chat.js";

// ============================================================
// FileSaver — 基于本地文件的 Checkpoint 持久化
// ============================================================
//
// 继承 MemorySaver，在每次写入 checkpoint 时同步保存到 JSON 文件。
// 启动时自动从文件恢复，实现跨进程持久化。
//
// 原理：MemorySaver 的 storage/writes 是纯 JS 对象，值为 Uint8Array（序列化后的字节）。
// 我们把 Uint8Array 转为 Base64 字符串存入 JSON 文件，恢复时反转回来。
//
// ⚠️ 这是教学简化版。生产环境推荐：
//   - @langchain/langgraph-checkpoint-postgres（PostgreSQL）
//   - @langchain/langgraph-checkpoint-redis（Redis）
//   - LangGraph Platform（托管服务，自带持久化）

/** Uint8Array → Base64 字符串（可 JSON 序列化） */
function uint8ArrayToBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString("base64");
}

/** Base64 字符串 → Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

class FileSaver extends MemorySaver {
  private filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
    this._loadFromFile();
  }

  /** 从文件恢复 storage 和 writes */
  private _loadFromFile(): void {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));

      // 恢复 storage: { threadId: { ns: { cpId: [Uint8Array, Uint8Array, string?] } } }
      for (const [tid, nsMap] of Object.entries(raw.storage || {})) {
        this.storage[tid] = {};
        for (const [ns, cpMap] of Object.entries(nsMap as Record<string, unknown>)) {
          this.storage[tid][ns] = {};
          for (const [cpId, tuple] of Object.entries(cpMap as Record<string, unknown>)) {
            const [cp, meta, parent] = tuple as [string, string, string | undefined];
            this.storage[tid][ns][cpId] = [
              base64ToUint8Array(cp),
              base64ToUint8Array(meta),
              parent,
            ];
          }
        }
      }

      // 恢复 writes: { key: { innerKey: [string, string, Uint8Array] } }
      for (const [key, innerMap] of Object.entries(raw.writes || {})) {
        this.writes[key] = {};
        for (const [innerKey, tuple] of Object.entries(innerMap as Record<string, unknown>)) {
          const [taskId, channel, value] = tuple as [string, string, string];
          this.writes[key][innerKey] = [taskId, channel, base64ToUint8Array(value)];
        }
      }

      console.log(`  📂 从文件恢复 checkpoint: ${this.filePath}`);
    } catch {
      console.log(`  ⚠️ 读取 checkpoint 文件失败，使用空状态`);
    }
  }

  /** 将 storage 和 writes 序列化写入文件 */
  private _saveToFile(): void {
    // 序列化 storage: Uint8Array → Base64
    const serializedStorage: Record<string, unknown> = {};
    for (const [tid, nsMap] of Object.entries(this.storage)) {
      serializedStorage[tid] = {};
      for (const [ns, cpMap] of Object.entries(nsMap)) {
        (serializedStorage[tid] as Record<string, unknown>)[ns] = {};
        for (const [cpId, [cp, meta, parent]] of Object.entries(cpMap)) {
          ((serializedStorage[tid] as Record<string, unknown>)[ns] as Record<string, unknown>)[cpId] = [
            uint8ArrayToBase64(cp),
            uint8ArrayToBase64(meta),
            parent,
          ];
        }
      }
    }

    // 序列化 writes: Uint8Array → Base64
    const serializedWrites: Record<string, unknown> = {};
    for (const [key, innerMap] of Object.entries(this.writes)) {
      serializedWrites[key] = {};
      for (const [innerKey, [taskId, channel, value]] of Object.entries(innerMap)) {
        (serializedWrites[key] as Record<string, unknown>)[innerKey] = [
          taskId,
          channel,
          uint8ArrayToBase64(value),
        ];
      }
    }

    fs.writeFileSync(
      this.filePath,
      JSON.stringify({ storage: serializedStorage, writes: serializedWrites }, null, 2),
      "utf-8"
    );
  }

  // 重写 put/putWrites：调用父类方法后自动保存到文件
  async put(...args: Parameters<MemorySaver["put"]>) {
    const result = await super.put(...args);
    this._saveToFile();
    return result;
  }

  async putWrites(...args: Parameters<MemorySaver["putWrites"]>) {
    await super.putWrites(...args);
    this._saveToFile();
  }
}

// ============================================================
// Demo 入口
// ============================================================

async function main() {
  console.log("📊 state-graph.ts — StateGraph 自定义流程图 Demo\n");

  const model = createChatModel({ temperature: 0.7 });

  // ==========================================================
  // Demo 1: 最简 StateGraph — 两个节点线性串联
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 最简 StateGraph — 线性串联\n");
  console.log("💡 流程：START → 分析节点 → 总结节点 → END\n");

  // 1. 定义状态 — 整个图的「共享白板」
  //
  // Annotation.Root 定义所有节点共享的全局状态结构
  // 每个字段就是白板上的一个"格子"，所有节点都能读写
  // 默认行为：Annotation<T> = 后写覆盖前值（最简形式）
  //
  // 高级用法 — Reducer（自定义合并策略）：
  //   messages: Annotation<string[]>({
  //     reducer: (prev, next) => [...prev, ...next],  // 追加而非覆盖
  //     default: () => [],
  //   })
  const SimpleState = Annotation.Root({
    topic: Annotation<string>,      // 输入：由 invoke() 传入
    analysis: Annotation<string>,   // 中间结果：由 analyzeNode 写入
    summary: Annotation<string>,    // 最终输出：由 summarizeNode 写入
  });

  // 2. 定义节点
  //
  // 节点签名：(state: 完整状态) => Partial<状态>
  // - 参数：接收完整状态（所有字段），可以读取任意字段
  // - 返回：只需返回要更新的字段（Partial），未返回的字段保持不变
  // analyzeNode：读 topic → 写 analysis
  async function analyzeNode(
    state: typeof SimpleState.State   // 接收完整状态 { topic, analysis, summary }
  ): Promise<Partial<typeof SimpleState.State>> {   // 只返回要更新的字段
    console.log("  📝 [分析节点] 正在分析主题:", state.topic);
    const response = await model.invoke([
      new SystemMessage("你是一位技术分析师，请对给定主题进行简要分析（100字以内）。"),
      new HumanMessage(`请分析：${state.topic}`),
    ]);
    const analysis = response.content as string;
    console.log("  📝 [分析节点] 分析完成");
    return { analysis };  // 只更新 analysis，topic 和 summary 保持不变
  }

  // summarizeNode：读 analysis → 写 summary
  async function summarizeNode(
    state: typeof SimpleState.State   // 此时 state.analysis 已被 analyzeNode 填充
  ): Promise<Partial<typeof SimpleState.State>> {
    console.log("  📋 [总结节点] 正在生成总结...");
    const response = await model.invoke([
      new SystemMessage("你是一位技术编辑，请将分析内容总结为一句话核心观点。"),
      new HumanMessage(`分析内容：${state.analysis}\n\n请用一句话总结。`),
    ]);
    const summary = response.content as string;
    console.log("  📋 [总结节点] 总结完成");
    return { summary };  // 只更新 summary
  }

  // 3. 构建状态图 — 将节点用边串联
  //
  // ⚠️ 注意：节点名（addNode 第一个参数）不能与状态字段名重名！
  //    例如状态有 plan 字段，节点就不能叫 "plan"，否则报错
  const simpleGraph = new StateGraph(SimpleState)
    .addNode("analyze", analyzeNode)
    .addNode("summarize", summarizeNode)
    .addEdge(START, "analyze") // START → 分析
    .addEdge("analyze", "summarize") // 分析 → 总结
    .addEdge("summarize", END) // 总结 → END
    .compile();

  // 4. 执行 — invoke() 传入初始状态，返回最终状态（所有字段都已填充）
  const result1 = await simpleGraph.invoke({
    topic: "AI Agent 对软件开发的影响",
    // analysis 和 summary 不需要传入，由节点填充
  });

  console.log("\n📊 执行结果:");
  console.log("  主题:", result1.topic);
  console.log("  分析:", result1.analysis?.substring(0, 150));
  console.log("  总结:", result1.summary);
  console.log();

  // ==========================================================
  // Demo 2: 条件分支 — 根据 LLM 判断走不同路径
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 2: 条件分支 — 问题分类路由\n");
  console.log("💡 流程：START → 分类 → [技术问题 | 闲聊] → END\n");

  // 状态：三个字段分别由不同节点写入
  const RouterState = Annotation.Root({
    question: Annotation<string>,   // 输入：用户问题
    category: Annotation<string>,   // classifyNode 写入：问题分类结果
    answer: Annotation<string>,     // techExpertNode 或 chatNode 写入：最终回答
  });

  // 分类节点：判断问题类型
  async function classifyNode(
    state: typeof RouterState.State
  ): Promise<Partial<typeof RouterState.State>> {
    console.log("  🏷️  [分类节点] 分析问题类型...");
    const response = await model.invoke([
      new SystemMessage(
        "判断用户的问题类型，只回复一个词：'技术' 或 '闲聊'。不要回复其他内容。"
      ),
      new HumanMessage(state.question),
    ]);
    const category = (response.content as string).includes("技术") ? "技术" : "闲聊";
    console.log(`  🏷️  [分类节点] 判定为: ${category}`);
    return { category };
  }

  // 技术专家节点
  async function techExpertNode(
    state: typeof RouterState.State
  ): Promise<Partial<typeof RouterState.State>> {
    console.log("  🔬 [技术专家] 处理技术问题...");
    const response = await model.invoke([
      new SystemMessage("你是一位资深技术专家，请专业、准确地回答技术问题。使用中文，简洁明了。"),
      new HumanMessage(state.question),
    ]);
    return { answer: `[技术专家] ${response.content}` };
  }

  // 闲聊节点
  async function chatNode(
    state: typeof RouterState.State
  ): Promise<Partial<typeof RouterState.State>> {
    console.log("  💬 [闲聊助手] 处理日常对话...");
    const response = await model.invoke([
      new SystemMessage("你是一位友善的聊天助手，轻松愉快地回答。使用中文。"),
      new HumanMessage(state.question),
    ]);
    return { answer: `[闲聊助手] ${response.content}` };
  }

  // 路由函数：根据分类结果决定下一个节点
  function routeByCategory(state: typeof RouterState.State): string {
    return state.category === "技术" ? "tech_expert" : "chat";
  }

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

  // 测试两种问题
  const questions = [
    "TypeScript 的泛型有什么用？",
    "周末去哪里玩比较好？",
  ];

  for (const q of questions) {
    console.log(`\n❓ 问题: ${q}`);
    const result = await routerGraph.invoke({ question: q });
    console.log(`✅ 回复: ${(result.answer as string).substring(0, 200)}`);
  }
  console.log();

  // ==========================================================
  // Demo 3: 循环图 — 自动改进直到满足条件
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 3: 循环图 — 自动改进文案\n");
  console.log("💡 流程：写文案 → 评分 → 分数不够 → 重写 → 再评分 → 满意 → 输出\n");

  // 状态：循环中多个字段会被反复覆盖更新（默认覆盖语义正好适用）
  const LoopState = Annotation.Root({
    topic: Annotation<string>,      // 输入：不变
    draft: Annotation<string>,      // writeNode 每次覆盖写入新版文案
    score: Annotation<number>,      // reviewNode 每次覆盖写入新评分
    feedback: Annotation<string>,   // reviewNode 每次覆盖写入新反馈
    iteration: Annotation<number>,  // writeNode 每次覆盖写入新迭代次数
  });

  // 写作节点
  async function writeNode(
    state: typeof LoopState.State
  ): Promise<Partial<typeof LoopState.State>> {
    const iteration = (state.iteration || 0) + 1;
    console.log(`  ✍️  [写作节点] 第 ${iteration} 次撰写...`);

    const prompt = state.feedback
      ? `请根据以下反馈改进文案：\n反馈：${state.feedback}\n原文：${state.draft}\n\n请写出改进后的版本（50字以内的宣传语）。`
      : `请为"${state.topic}"写一句宣传语（50字以内）。`;

    const response = await model.invoke([
      new SystemMessage("你是一位广告文案专家。"),
      new HumanMessage(prompt),
    ]);
    return { draft: response.content as string, iteration };
  }

  // 评审节点
  async function reviewNode(
    state: typeof LoopState.State
  ): Promise<Partial<typeof LoopState.State>> {
    console.log(`  📊 [评审节点] 评审第 ${state.iteration} 版文案...`);

    const response = await model.invoke([
      new SystemMessage(
        "你是一位文案评审专家。请对文案评分（1-10），并给出改进建议。" +
          "严格按以下格式回复：\n评分：X\n反馈：XXX"
      ),
      new HumanMessage(`文案：${state.draft}`),
    ]);

    const text = response.content as string;

    // 解析评分
    const scoreMatch = text.match(/评分[：:]\s*(\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 7;

    // 解析反馈
    const feedbackMatch = text.match(/反馈[：:]\s*([\s\S]+)/);
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : "继续改进";

    console.log(`  📊 [评审节点] 评分: ${score}/10`);
    return { score, feedback };
  }

  // 条件：是否需要继续改进
  function shouldContinue(state: typeof LoopState.State): string {
    // 评分 >= 8 或已迭代 3 次，停止
    if (state.score >= 8 || state.iteration >= 3) {
      console.log(
        state.score >= 8
          ? `  ✅ 评分达标 (${state.score}/10)，结束`
          : `  ⚠️ 达到最大迭代次数 (${state.iteration})，结束`
      );
      return "end";
    }
    console.log(`  🔄 评分未达标 (${state.score}/10)，继续改进...`);
    return "continue";
  }

  const loopGraph = new StateGraph(LoopState)
    .addNode("write", writeNode)
    .addNode("review", reviewNode)
    .addEdge(START, "write")
    .addEdge("write", "review")
    .addConditionalEdges("review", shouldContinue, {
      continue: "write", // 继续改进 → 回到写作
      end: END, // 满意 → 结束
    })
    .compile();

  const result3 = await loopGraph.invoke({
    topic: "AI Agent 开发教程",
    iteration: 0,
    score: 0,
  });

  console.log("\n📊 最终结果:");
  console.log(`  文案: ${result3.draft}`);
  console.log(`  评分: ${result3.score}/10`);
  console.log(`  迭代次数: ${result3.iteration}`);
  console.log();

  // ==========================================================
  // Demo 4: Human-in-the-Loop — interrupt 暂停等待确认
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 4: Human-in-the-Loop — interrupt 暂停机制\n");
  console.log("💡 Agent 执行敏感操作前暂停，等待人工确认后继续\n");

  // ── interrupt + Command 工作原理 ──
  //
  // 1. 图执行到 interrupt() 时，立即暂停，状态快照写入 checkpointer
  // 2. invoke() 返回当前状态（但 interrupt 后的节点还没执行）
  //    ─── 此时可以是几秒、几小时、甚至几天后 ───
  // 3. 用 Command({ resume: value }) 恢复执行，value 作为 interrupt() 的返回值
  //    图从暂停点继续，confirm 节点拿到 resume 值后正常返回
  //
  // ── 生产环境典型架构 ──
  //
  // ┌─────────┐     ┌──────────┐     ┌──────────────┐     ┌─────────┐
  // │  用户    │────▶│ API 服务  │────▶│ LangGraph    │────▶│ DB/Redis│
  // │  请求    │     │ (HTTP)   │     │ invoke()     │     │ 持久化   │
  // └─────────┘     └──────────┘     └──────────────┘     │ 检查点   │
  //                                    │ interrupt!       └─────────┘
  //                                    ▼                       │
  //                  ┌──────────┐   返回 thread_id              │
  //                  │ 通知人工  │   + 待确认信息                 │
  //                  │ (邮件/IM) │                              │
  //                  └────┬─────┘                              │
  //                       │ 人工审批（可能数小时后）               │
  //                       ▼                                    │
  //                  ┌──────────┐     ┌──────────────┐         │
  //                  │ 审批API  │────▶│ LangGraph    │────────▶│
  //                  │ (HTTP)   │     │ Command({    │  读取检查点
  //                  └──────────┘     │   resume:... │  继续执行
  //                                   │ })           │
  //                                   └──────────────┘
  //
  // 关键点：
  // - checkpointer 生产环境用数据库（PostgreSQL/Redis），不用 MemorySaver
  //   LangGraph 提供 @langchain/langgraph-checkpoint-postgres 等包
  // - thread_id 作为会话标识存入业务数据库，关联用户/工单
  // - 恢复时通过 thread_id 找到对应的 checkpoint，从断点继续执行
  // - 两次 invoke 可以在不同进程/服务器上执行（状态全在 checkpointer 中）

  // 状态：⚠️ 字段名 plan 不能与节点名重复（所以规划节点叫 "planning"）
  const HumanLoopState = Annotation.Root({
    request: Annotation<string>,       // 输入：用户请求
    plan: Annotation<string>,          // planningNode 写入：执行计划
    humanApproval: Annotation<string>, // confirmNode 写入：人工审批结果（来自 interrupt）
    result: Annotation<string>,        // executeNode 写入：最终执行结果
  });

  // 规划节点：分析请求，制定执行计划
  async function planNode(
    state: typeof HumanLoopState.State
  ): Promise<Partial<typeof HumanLoopState.State>> {
    console.log("  📝 [规划节点] 分析请求，制定计划...");
    const response = await model.invoke([
      new SystemMessage("你是一位项目经理，请根据用户请求制定执行计划（简洁，50字以内）。"),
      new HumanMessage(state.request),
    ]);
    return { plan: response.content as string };
  }

  // 确认节点：使用 interrupt 暂停，等待外部恢复
  function confirmNode(
    state: typeof HumanLoopState.State
  ): Partial<typeof HumanLoopState.State> {
    console.log("  ⏸️  [确认节点] 暂停等待人工确认...");
    console.log(`  📋 待确认的计划: ${state.plan}`);

    // interrupt() — 暂停图的执行
    // 参数：传给外部的提示信息（会出现在 getState() 的 tasks 中，供前端展示）
    // 返回值：恢复时 Command({ resume: value }) 传入的 value
    const approval = interrupt({
      question: "是否批准以上执行计划？",
      plan: state.plan,
    });

    // ↑ 第一次执行到这里会暂停，不会走到下面
    // ↓ 恢复后 approval = Command 中 resume 的值，继续执行
    console.log(`  ✅ [确认节点] 收到人工反馈: ${approval}`);
    return { humanApproval: approval as string };
  }

  // 执行节点
  async function executeNode(
    state: typeof HumanLoopState.State
  ): Promise<Partial<typeof HumanLoopState.State>> {
    if (state.humanApproval?.includes("拒绝") || state.humanApproval?.includes("否")) {
      console.log("  ❌ [执行节点] 计划被拒绝，取消执行");
      return { result: "计划已取消" };
    }
    console.log("  🚀 [执行节点] 计划已批准，执行中...");
    const response = await model.invoke([
      new SystemMessage("你是执行助手，请根据计划给出执行结果摘要（简洁，50字以内）。"),
      new HumanMessage(`计划: ${state.plan}\n用户反馈: ${state.humanApproval}`),
    ]);
    return { result: response.content as string };
  }

  // 构建图
  // ⚠️ interrupt 必须配合 checkpointer 使用，因为暂停后状态需要持久化
  // 生产环境：用 PostgresSaver / RedisSaver 替换 MemorySaver
  //
  // ── Checkpoint 持久化了什么？──
  //
  // 每个节点执行完后，checkpointer 存一份完整快照，类似 Git commit：
  //
  // Checkpoint {
  //   id: "1ef8...",               // checkpoint ID（uuid6，有序，可用于回溯）
  //   ts: "2026-01-15T10:30:00Z",  // 时间戳
  //   channel_values: {            // ⭐ 核心：所有 Annotation 字段的当前值（白板快照）
  //     request: "重构数据库访问层",
  //     plan: "1. 抽象DAO层...",
  //     humanApproval: undefined,   // confirm 还没执行
  //     result: undefined,          // execute 还没执行
  //   },
  //   channel_versions: { request: 1, plan: 2, ... },  // 字段版本号（增量更新用）
  //   versions_seen: { planning: { request: 1 }, ... }, // 每个节点看到的字段版本
  // }
  //
  // 附属数据：
  // - metadata:      来源（input/loop）、步骤号、写入该 checkpoint 的节点名
  // - pendingWrites: interrupt 暂停时的挂起信息，恢复时需要
  // - parentConfig:  父 checkpoint 引用，形成链表（支持 getStateHistory 回溯）
  //
  // 以本 Demo 为例，完整 checkpoint 链：
  //   #1 (input)    → channel_values = { request: "重构..." }
  //   #2 (planning) → channel_values = { request: "重构...", plan: "1. 抽象DAO..." }
  //   #3 (interrupt) → 同上 + pendingWrites 记录暂停点
  //   ── 可能隔了几天，进程甚至重启了 ──
  //   #4 (confirm)  → channel_values = { ..., humanApproval: "批准" }
  //   #5 (execute)  → channel_values = { ..., result: "已完成重构..." }
  //
  // 这就是 getStateHistory() 能遍历历史、checkpoint_id 能回溯的原理。
  //
  // ── 本 Demo 使用 FileSaver 演示持久化 ──
  //
  // FileSaver 继承 MemorySaver，在每次 put/putWrites 后自动写入本地 JSON 文件。
  // 即使进程退出，重启后也能从文件恢复 checkpoint，继续执行。
  // 文件路径：./data/checkpoint-demo4.json（运行后可打开查看内部结构）
  const checkpointFile = path.resolve("data", "checkpoint-demo4.json");
  fs.mkdirSync(path.dirname(checkpointFile), { recursive: true });
  // 每次 Demo 清空旧文件，确保从头演示
  if (fs.existsSync(checkpointFile)) fs.unlinkSync(checkpointFile);
  const checkpointer = new FileSaver(checkpointFile);

  const humanLoopGraph = new StateGraph(HumanLoopState)
    .addNode("planning", planNode)
    .addNode("confirm", confirmNode)
    .addNode("execute", executeNode)
    .addEdge(START, "planning")
    .addEdge("planning", "confirm")
    .addEdge("confirm", "execute")
    .addEdge("execute", END)
    .compile({ checkpointer });

  // thread_id：会话标识，生产环境通常关联业务 ID（如工单号、用户 ID）
  const threadConfig = { configurable: { thread_id: "human-loop-demo" } };

  // ── 第一次调用：执行到 interrupt 暂停 ──
  console.log("--- 第一次调用（会在 confirm 节点暂停）---");
  const result4a = await humanLoopGraph.invoke(
    { request: "重构项目的数据库访问层" },
    threadConfig
  );
  // 此时 planning 已完成，confirm 中的 interrupt 触发暂停
  // result4a 包含暂停时的状态（plan 已填充，humanApproval/result 未填充）
  // FileSaver 已自动将 checkpoint 写入文件
  console.log("  📊 暂停时的状态:", {
    plan: result4a.plan?.substring(0, 80),
    result: result4a.result || "(尚未执行)",
  });
  console.log(`  💾 Checkpoint 已持久化到: ${checkpointFile}`);

  // 查看文件大小，验证持久化成功
  const fileStats = fs.statSync(checkpointFile);
  console.log(`  📄 文件大小: ${fileStats.size} bytes`);

  // ── 模拟进程重启：创建新的 FileSaver 从文件恢复 ──
  // 生产环境中，这可能在几小时后、由另一个 API 请求、甚至另一台服务器触发
  console.log("\n--- 模拟进程重启：从文件恢复 checkpoint ---");
  const restoredCheckpointer = new FileSaver(checkpointFile);

  // 用恢复的 checkpointer 重建图
  const restoredGraph = new StateGraph(HumanLoopState)
    .addNode("planning", planNode)
    .addNode("confirm", confirmNode)
    .addNode("execute", executeNode)
    .addEdge(START, "planning")
    .addEdge("planning", "confirm")
    .addEdge("confirm", "execute")
    .addEdge("execute", END)
    .compile({ checkpointer: restoredCheckpointer });

  // ── 用 Command({ resume }) 恢复执行 ──
  console.log("\n--- 恢复执行（传入人工确认）---");
  const result4b = await restoredGraph.invoke(
    // Command({ resume }) 恢复 interrupt，resume 值作为 interrupt() 的返回值
    new Command({ resume: "批准，请执行" }),
    threadConfig
  );
  console.log("  📊 最终结果:", {
    plan: result4b.plan?.substring(0, 80),
    approval: result4b.humanApproval,
    result: result4b.result?.substring(0, 100),
  });

  // 清理 demo 文件
  if (fs.existsSync(checkpointFile)) fs.unlinkSync(checkpointFile);
  // 尝试清理空的 data 目录
  try { fs.rmdirSync(path.resolve("data")); } catch { /* 目录非空则忽略 */ }

  console.log("\n" + "=".repeat(60));
  console.log("✅ StateGraph 自定义流程图 Demo 完成！");
  console.log("\n💡 核心知识点:");
  console.log("   1. Annotation.Root — 定义全局共享状态（「白板」），所有节点读同一份状态");
  console.log("      - Annotation<T> 默认覆盖写入，Reducer 模式可自定义合并策略");
  console.log("      - 节点返回 Partial<State>，只更新自己负责的字段");
  console.log("   2. addNode / addEdge — 构建线性流程（节点名不能与状态字段名重名！）");
  console.log("   3. addConditionalEdges — 条件分支路由，路由函数返回下一个节点名");
  console.log("   4. 循环图 — 条件边指回已有节点，实现迭代改进");
  console.log("   5. interrupt() + Command({ resume }) — Human-in-the-Loop 暂停/恢复");
  console.log("   6. Checkpoint 持久化 — FileSaver 演示文件持久化，生产用 PostgresSaver");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("state-graph.ts");

if (isMainModule) {
  main().catch(console.error);
}
