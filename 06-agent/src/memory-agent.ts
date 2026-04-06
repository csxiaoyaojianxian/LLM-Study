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
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
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
  const agent = createAgent({
    model,
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

  // 📌 在第 2 轮结束后记录 checkpoint_id，作为"书签"供 Demo 4 回溯
  // 为什么不在 Demo 4 里盲猜？因为 Agent 使用工具时会产生额外的中间 checkpoint
  // （tool_use → tool_result），盲猜可能落在不完整的消息序列上导致 API 报错
  const stateAfterRound2 = await (agent as any).getState(thread1);
  const round2CheckpointId: string = stateAfterRound2.config?.configurable?.checkpoint_id;
  console.log(`  📌 记录第 2 轮 checkpoint: ${round2CheckpointId?.substring(0, 20)}...`);
  console.log();

  // 第三轮对话 — 使用工具 + 记忆
  console.log("--- 第 3 轮对话 ---");
  const r3 = await agent.invoke(
    { messages: [new HumanMessage("帮我算算 2026 - 1993 等于多少（这是我的年龄）")] },
    thread1
  );
  console.log("👤 用户: 帮我算算 2026 - 1993 等于多少（这是我的年龄）");
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

  const currentState = await (agent as any).getState(thread1);

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

  const history = (agent as any).getStateHistory(thread1);

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
  //
  // Demo 1 的对话轮次：
  //   第 1 轮：我叫小明，前端工程师
  //   第 2 轮：问名字和职业 ← 回溯到这里（round2CheckpointId）
  //   第 3 轮：算年龄（2026-1993=33）
  //   第 4 轮：总结所有信息
  //
  // 回溯到第 2 轮后，Agent 应该忘记第 3、4 轮的内容（年龄），
  // 但仍然记得第 1、2 轮（名字、职业）。
  //
  // ⚠️ 为什么用 round2CheckpointId 而不是从 history 里猜"倒数第 N 个"？
  // Agent 使用工具时会产生多个中间 checkpoint：
  //   LLM 决定调用工具 → checkpoint（含 tool_use）
  //   工具执行完毕 → checkpoint（含 tool_result）
  //   LLM 生成最终回复 → checkpoint
  // 如果回溯到 tool_use 之后、tool_result 之前的中间状态，
  // 消息序列不完整（有 tool_use 没有 tool_result），API 会报错：
  //   "tool_use ids were found without tool_result blocks"
  // 所以正确做法是：在安全的时间点主动记录 checkpoint_id 作为"书签"。

  if (round2CheckpointId) {
    // 用第 2 轮结束时的 checkpoint_id 构建回溯 config
    const rollbackConfig = {
      configurable: {
        thread_id: thread1.configurable.thread_id,
        checkpoint_id: round2CheckpointId,
      },
    };

    const rollbackState = await (agent as any).getState(rollbackConfig);
    console.log(
      `\n🔄 回溯到第 2 轮 checkpoint（消息数: ${rollbackState.values.messages?.length || 0}，当前: ${checkpoints[0]?.msgCount || "?"}）`
    );

    // 在回溯点上继续对话 — 验证 Agent 忘记了后续轮次
    console.log("\n--- 回溯后对话：Agent 还记得年龄吗？ ---");
    const rollbackResult = await agent.invoke(
      { messages: [new HumanMessage("我多大了？你知道我的年龄吗？")] },
      rollbackConfig  // 从第 2 轮的 checkpoint 开始
    );
    const rollbackAnswer = rollbackResult.messages[rollbackResult.messages.length - 1].content as string;
    console.log("👤 用户: 我多大了？你知道我的年龄吗？");
    console.log("🤖 Agent:", rollbackAnswer.substring(0, 200));
    console.log("   💡 预期：Agent 不知道年龄（第 3 轮的计算已被「撤销」）");

    // 第二次对话：不指定 checkpoint_id，沿着回溯后产生的新分支继续
    const continueConfig = {
      configurable: { 
        thread_id: thread1.configurable.thread_id,
      },
    };
    console.log("\n--- 回溯后对话：Agent 还记得名字吗？ ---");
    const rollbackResult2 = await agent.invoke(
      { messages: [new HumanMessage("那你还记得我叫什么名字吗？")] },
      continueConfig
    );
    const rollbackAnswer2 = rollbackResult2.messages[rollbackResult2.messages.length - 1].content as string;
    console.log("👤 用户: 那你还记得我叫什么名字吗？");
    console.log("🤖 Agent:", rollbackAnswer2.substring(0, 200));
    console.log("   💡 预期：Agent 仍记得名字（第 1 轮在回溯点之前，未被撤销）");
  }

  // ==========================================================
  // Demo 5: 状态导出与导入 — 跨进程迁移 Agent 状态
  // ==========================================================
  console.log("\n" + "=".repeat(60));
  console.log("📌 Demo 5: 状态导出与导入 — 跨进程迁移 Agent 状态\n");
  console.log("💡 用 getState() 导出消息历史到 JSON 文件，新建 Agent 通过 updateState() 导入\n");
  console.log("   模拟场景：服务 A 的 Agent 对话状态迁移到服务 B 继续\n");

  try {
    // ── Step 1: 导出当前状态到 JSON 文件 ──
    const exportState = await (agent as any).getState(thread1);
    const messages = exportState.values.messages || [];

    // 序列化消息：提取每条消息的类型和内容
    // 实际生产中可以用 LangChain 的 Serializable 接口，这里用简化版
    const serializedMessages = messages.map((msg: HumanMessage | AIMessage | ToolMessage) => ({
      type: msg instanceof HumanMessage ? "human"
        : msg instanceof AIMessage ? "ai"
        : msg instanceof ToolMessage ? "tool" : "unknown",
      content: msg.content,                    // 消息内容
      tool_calls: (msg as AIMessage).tool_calls || undefined,  // AI 消息的工具调用
      tool_call_id: (msg as ToolMessage).tool_call_id || undefined, // 工具消息的关联 ID
    }));

    const exportFile = path.resolve("data", "agent-state-export.json");
    fs.mkdirSync(path.dirname(exportFile), { recursive: true });
    fs.writeFileSync(exportFile, JSON.stringify({
      thread_id: thread1.configurable.thread_id,
      message_count: serializedMessages.length,
      messages: serializedMessages,
      exported_at: new Date().toISOString(),
    }, null, 2), "utf-8");

    console.log(`  💾 已导出 ${serializedMessages.length} 条消息到: ${exportFile}`);
    console.log(`  📄 文件大小: ${fs.statSync(exportFile).size} bytes`);
    console.log(`  ⏳ 暂停 5 秒，可以打开文件查看内容: ${exportFile}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // ── Step 2: 模拟新进程 — 创建全新的 Agent + MemorySaver ──
    console.log("\n  🔄 模拟新进程：创建全新 Agent（空 MemorySaver）...");
    const newMemory = new MemorySaver();
    const newAgent = createAgent({
      model,
      tools,
      checkpointer: newMemory,
    });
    const newThreadConfig = { configurable: { thread_id: "imported-session" } };

    // ── Step 3: 从文件读取并导入状态 ──
    const importData = JSON.parse(fs.readFileSync(exportFile, "utf-8"));
    console.log(`  📂 从文件读取 ${importData.message_count} 条消息`);

    // 反序列化消息
    const restoredMessages = importData.messages.map(
      (m: { type: string; content: string; tool_calls?: unknown[]; tool_call_id?: string }) => {
        if (m.type === "human") return new HumanMessage(m.content);
        if (m.type === "ai") {
          const aiMsg = new AIMessage(m.content);
          if (m.tool_calls) aiMsg.tool_calls = m.tool_calls as AIMessage["tool_calls"];
          return aiMsg;
        }
        if (m.type === "tool") {
          return new ToolMessage({ content: m.content, tool_call_id: m.tool_call_id || "" });
        }
        return new HumanMessage(m.content); // fallback
      }
    );

    // 用 updateState 将消息历史写入新 Agent 的 checkpointer
    await (newAgent as any).updateState(
      newThreadConfig,
      { messages: restoredMessages },
    );
    console.log("  ✅ 状态已导入到新 Agent");

    // ── Step 4: 验证 — 新 Agent 能否继续对话 ──
    console.log("\n--- 在新 Agent 上验证：还记得用户信息吗？ ---");
    const verifyResult = await newAgent.invoke(
      { messages: [new HumanMessage("你还记得我叫什么名字吗？我是做什么的？")] },
      newThreadConfig
    );
    const verifyAnswer = verifyResult.messages[verifyResult.messages.length - 1].content as string;
    console.log("👤 用户: 你还记得我叫什么名字吗？我是做什么的？");
    console.log("🤖 新 Agent:", verifyAnswer.substring(0, 200));
    console.log("   💡 预期：新 Agent 记得小明和前端工程师（状态成功迁移）");

    // 清理
    if (fs.existsSync(exportFile)) fs.unlinkSync(exportFile);
    try { fs.rmdirSync(path.resolve("data")); } catch { /* 目录非空则忽略 */ }
  } catch (error) {
    console.log("❌ 状态导出/导入失败:", (error as Error).message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Agent 记忆与状态管理 Demo 完成！");
  console.log("\n💡 核心知识点:");
  console.log("   1. MemorySaver — 内存级 checkpointer，保存 Agent 状态");
  console.log("   2. thread_id — 会话标识，不同 thread 互相隔离");
  console.log("   3. getState() — 获取当前状态快照（消息历史、checkpoint_id）");
  console.log("   4. getStateHistory() — 遍历所有历史 checkpoint，支持回溯");
  console.log("   5. checkpoint_id — 指定恢复到某个历史状态，实现「撤销」");
  console.log("   6. updateState() — 手动写入状态，配合 getState() 实现状态导出/导入");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("memory-agent.ts");

if (isMainModule) {
  main().catch(console.error);
}
