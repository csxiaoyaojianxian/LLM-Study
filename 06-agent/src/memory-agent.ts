/**
 * memory-agent.ts — Agent 记忆与状态管理
 *
 * Agent 的记忆体系：
 * - 短期记忆：MemorySaver + thread_id，同一会话内的对话历史
 * - 会话隔离：不同 thread_id 互不干扰
 * - 状态查看：getState() 获取完整状态快照
 * - 状态回溯：getStateHistory() 查看历史，实现"撤销"
 *
 * 运行: npm run memory-agent
 */

import "dotenv/config";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createChatModel } from "./model-chat.js";

// ============================================================
// 工具定义
// ============================================================

const calculatorTool = tool(
  async ({ expression }: { expression: string }) => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "");
      if (sanitized !== expression.trim()) return `不安全的表达式: ${expression}`;
      const result = new Function(`return ${sanitized}`)();
      return `${expression} = ${result}`;
    } catch {
      return `计算错误: ${expression}`;
    }
  },
  {
    name: "calculator",
    description: "计算数学表达式",
    schema: z.object({
      expression: z.string().describe("数学表达式"),
    }),
  }
);

// 笔记存储（模块级变量）
const noteStorage: Record<string, string> = {};

const noteTool = tool(
  async ({ action, key, value }: { action: string; key: string; value?: string }): Promise<string> => {
    if (action === "save") {
      noteStorage[key] = value || "";
      return `✅ 已保存笔记: ${key} = ${value}`;
    } else if (action === "get") {
      return noteStorage[key] ? `📝 ${key}: ${noteStorage[key]}` : `未找到笔记: ${key}`;
    } else if (action === "list") {
      const keys = Object.keys(noteStorage);
      return keys.length > 0 ? `📝 所有笔记: ${keys.join(", ")}` : "暂无笔记";
    }
    return "未知操作，支持: save/get/list";
  },
  {
    name: "note",
    description: "简单笔记工具，支持保存(save)、获取(get)、列出(list)笔记",
    schema: z.object({
      action: z.enum(["save", "get", "list"]).describe("操作类型"),
      key: z.string().describe("笔记键名"),
      value: z.string().optional().describe("笔记内容（save 时需要）"),
    }),
  }
);

const tools = [calculatorTool, noteTool];

// ============================================================
// Demo 入口
// ============================================================

async function main() {
  console.log("🧠 memory-agent.ts — Agent 记忆与状态管理 Demo\n");

  const model = createChatModel({ temperature: 0 });

  // 创建 MemorySaver — 内存级检查点存储
  const memory = new MemorySaver();

  // 创建带记忆的 Agent
  const agent = createReactAgent({
    llm: model,
    tools,
    checkpointer: memory,
  });

  // ==========================================================
  // Demo 1: MemorySaver 基础 — 多轮对话记忆
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 1: MemorySaver 基础 — 多轮对话记忆\n");
  console.log("💡 关键：同一 thread_id 的多次调用共享对话历史\n");

  const thread1 = { configurable: { thread_id: "session-001" } };

  // 第一轮对话
  console.log("--- 第 1 轮对话 ---");
  const r1 = await agent.invoke(
    { messages: [new HumanMessage("我叫小明，我是一名前端开发工程师")] },
    thread1
  );
  console.log("👤 用户: 我叫小明，我是一名前端开发工程师");
  console.log("🤖 Agent:", (r1.messages[r1.messages.length - 1].content as string).substring(0, 200));
  console.log();

  // 第二轮对话 — Agent 应该记得用户名字
  console.log("--- 第 2 轮对话 ---");
  const r2 = await agent.invoke(
    { messages: [new HumanMessage("我叫什么名字？我的职业是什么？")] },
    thread1
  );
  console.log("👤 用户: 我叫什么名字？我的职业是什么？");
  console.log("🤖 Agent:", (r2.messages[r2.messages.length - 1].content as string).substring(0, 200));
  console.log();

  // 第三轮对话 — 使用工具 + 记忆
  console.log("--- 第 3 轮对话 ---");
  const r3 = await agent.invoke(
    { messages: [new HumanMessage("帮我算算 2024 - 1995 等于多少（这是我的年龄）")] },
    thread1
  );
  console.log("👤 用户: 帮我算算 2024 - 1995 等于多少（这是我的年龄）");
  console.log("🤖 Agent:", (r3.messages[r3.messages.length - 1].content as string).substring(0, 200));
  console.log();

  // 第四轮 — 验证 Agent 记住了之前的所有信息
  console.log("--- 第 4 轮对话 ---");
  const r4 = await agent.invoke(
    { messages: [new HumanMessage("总结一下你知道的关于我的所有信息")] },
    thread1
  );
  console.log("👤 用户: 总结一下你知道的关于我的所有信息");
  console.log("🤖 Agent:", (r4.messages[r4.messages.length - 1].content as string).substring(0, 300));
  console.log();

  // ==========================================================
  // Demo 2: 多会话隔离
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 2: 多会话隔离 — 不同 thread_id 互不干扰\n");

  const threadA = { configurable: { thread_id: "user-alice" } };
  const threadB = { configurable: { thread_id: "user-bob" } };

  // Alice 的对话
  console.log("--- Alice 的会话 ---");
  await agent.invoke(
    { messages: [new HumanMessage("我是 Alice，我喜欢 React")] },
    threadA
  );
  console.log("👤 Alice: 我是 Alice，我喜欢 React");

  // Bob 的对话
  console.log("--- Bob 的会话 ---");
  await agent.invoke(
    { messages: [new HumanMessage("我是 Bob，我喜欢 Vue")] },
    threadB
  );
  console.log("👤 Bob: 我是 Bob，我喜欢 Vue");

  // 验证隔离：在 Alice 的会话中问
  const rAlice = await agent.invoke(
    { messages: [new HumanMessage("我叫什么？我喜欢什么框架？")] },
    threadA
  );
  console.log("\n--- 在 Alice 的会话中询问 ---");
  console.log("🤖 回复:", (rAlice.messages[rAlice.messages.length - 1].content as string).substring(0, 200));

  // 验证隔离：在 Bob 的会话中问
  const rBob = await agent.invoke(
    { messages: [new HumanMessage("我叫什么？我喜欢什么框架？")] },
    threadB
  );
  console.log("\n--- 在 Bob 的会话中询问 ---");
  console.log("🤖 回复:", (rBob.messages[rBob.messages.length - 1].content as string).substring(0, 200));
  console.log();

  // ==========================================================
  // Demo 3: 查看 checkpoint 状态
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 3: 查看 checkpoint 状态 — getState()\n");
  console.log("💡 getState() 返回完整的状态快照，包含所有消息历史\n");

  const currentState = await agent.getState(thread1);

  console.log("📊 当前状态快照:");
  console.log("  - thread_id:", thread1.configurable.thread_id);
  console.log("  - 消息总数:", currentState.values.messages?.length || 0);
  console.log("  - checkpoint_id:", currentState.config?.configurable?.checkpoint_id);
  console.log("  - 最近的节点:", currentState.next);

  // 打印最后几条消息
  const msgs = currentState.values.messages || [];
  if (msgs.length > 0) {
    console.log("\n  📝 最后 3 条消息:");
    const recent = msgs.slice(-3);
    for (const msg of recent) {
      const type = msg._getType();
      const content = (msg.content as string).substring(0, 80);
      console.log(`     [${type}] ${content}...`);
    }
  }
  console.log();

  // ==========================================================
  // Demo 4: 状态回溯 — getStateHistory()
  // ==========================================================
  console.log("=".repeat(60));
  console.log("📌 Demo 4: 状态回溯 — getStateHistory()\n");
  console.log("💡 每次调用都会创建 checkpoint，可以查看历史状态并回溯（撤销）\n");

  const history = agent.getStateHistory(thread1);

  console.log("📜 Checkpoint 历史:");
  let historyCount = 0;
  const checkpoints: Array<{ id: string; msgCount: number }> = [];

  for await (const snapshot of history) {
    historyCount++;
    const msgCount = snapshot.values.messages?.length || 0;
    const checkpointId = snapshot.config?.configurable?.checkpoint_id || "N/A";
    checkpoints.push({ id: checkpointId, msgCount });

    if (historyCount <= 5) {
      console.log(
        `  #${historyCount} checkpoint=${checkpointId.substring(0, 20)}... 消息数=${msgCount}`
      );
    }
  }
  if (historyCount > 5) {
    console.log(`  ... 共 ${historyCount} 个 checkpoint`);
  }

  // 演示回溯到早期状态
  if (checkpoints.length >= 3) {
    const targetCheckpoint = checkpoints[checkpoints.length - 3]; // 倒数第3个
    console.log(
      `\n🔄 回溯到 checkpoint #${historyCount - 2}（消息数: ${targetCheckpoint.msgCount}）`
    );
    console.log("   （回溯后，后续的对话历史将从该点重新开始）");

    // 在回溯点上继续对话
    const rollbackConfig = {
      configurable: {
        thread_id: thread1.configurable.thread_id,
        checkpoint_id: targetCheckpoint.id,
      },
    };

    const rollbackState = await agent.getState(rollbackConfig);
    console.log(`   回溯点消息数: ${rollbackState.values.messages?.length || 0}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Agent 记忆与状态管理 Demo 完成！");
  console.log("\n💡 核心知识点:");
  console.log("   1. MemorySaver — 内存级 checkpointer，保存 Agent 状态");
  console.log("   2. thread_id — 会话标识，不同 thread 互相隔离");
  console.log("   3. getState() — 获取当前状态快照（消息历史、checkpoint_id）");
  console.log("   4. getStateHistory() — 遍历所有历史 checkpoint，支持回溯");
  console.log("   5. checkpoint_id — 指定恢复到某个历史状态，实现「撤销」");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("memory-agent.ts");

if (isMainModule) {
  main().catch(console.error);
}
