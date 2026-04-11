/**
 * memory-chat.ts — Memory 对话记忆
 *
 * LangChain 提供多种 Memory 机制，让 LLM 具备多轮对话能力。
 * 本文件演示从手动管理到框架自动管理的演进。
 *
 * 核心知识点：
 * - 手动维护消息历史（最基础）
 * - 滑动窗口记忆（仅保留最近 k 轮）
 * - RunnableWithMessageHistory + InMemoryChatMessageHistory（LCEL 方式）
 * - LangGraph MemorySaver + createReactAgent（v1 推荐方式）
 * - 有/无记忆对比
 *
 * 运行: npm run memory-chat
 */

import "dotenv/config";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createChatModel } from "./model-chat.js";

async function main() {
  console.log("🧠 memory-chat.ts — Memory 对话记忆 Demo\n");

  const model = createChatModel({ temperature: 0.7 });
  const parser = new StringOutputParser();

  // --- Demo 1: 手动维护消息历史（最基础） ---
  console.log("=".repeat(60));
  console.log("📌 Demo 1: 手动维护消息历史（最基础的方式）\n");

  const history: BaseMessage[] = [];
  const conversations1 = [
    "我叫小明，我是一名前端开发者",
    "我最近在学什么技术？",
    "我叫什么名字？",
  ];

  const prompt1 = ChatPromptTemplate.fromMessages([
    ["system", "你是一个友好的 AI 助手，请记住用户告诉你的信息。"],
    new MessagesPlaceholder("history"),
    ["human", "{input}"],
  ]);

  const chain1 = prompt1.pipe(model).pipe(parser);

  for (const userMsg of conversations1) {
    console.log(`👤 用户: ${userMsg}`);
    const result = await chain1.invoke({
      history,
      input: userMsg,
    });
    console.log(`🤖 AI: ${result}\n`);

    // 手动维护历史
    history.push(new HumanMessage(userMsg));
    history.push(new AIMessage(result));
  }

  // --- Demo 2: BufferWindowMemory — 滑动窗口记忆 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 2: 滑动窗口记忆（仅保留最近 k 轮）\n");

  const windowSize = 2; // 只记住最近 2 轮
  const windowHistory: BaseMessage[] = [];

  const conversations2 = [
    "我的名字是张三",
    "我住在北京",
    "我喜欢吃火锅",
    "我今年 25 岁",
    "我叫什么名字？住在哪里？", // 超出窗口，应该忘记名字
  ];

  console.log(`窗口大小: k=${windowSize}（仅保留最近 ${windowSize} 轮对话）\n`);

  for (const userMsg of conversations2) {
    console.log(`👤 用户: ${userMsg}`);

    // 只取最近 k 轮（每轮 = Human + AI = 2条消息）
    const recentHistory = windowHistory.slice(-(windowSize * 2));

    const result = await chain1.invoke({
      history: recentHistory,
      input: userMsg,
    });
    console.log(`🤖 AI: ${result}`);
    console.log(`   📊 当前历史长度: ${windowHistory.length + 2} 条消息，窗口内: ${Math.min(windowHistory.length + 2, windowSize * 2)} 条\n`);

    windowHistory.push(new HumanMessage(userMsg));
    windowHistory.push(new AIMessage(result));
  }

  // --- Demo 3: RunnableWithMessageHistory（LCEL 方式） ---
  console.log("=".repeat(60));
  console.log("📌 Demo 3: RunnableWithMessageHistory（LCEL 方式）\n");

  // ────────────────────────────────────────────────────────
  // 🔑 核心理解：RunnableWithMessageHistory 是什么？
  //
  // 对比 Demo 1 手动方式，你每轮对话要自己做 3 件事：
  //   ① 把 history 数组传进 chain.invoke()
  //   ② 调用后手动 history.push(new HumanMessage(...))
  //   ③ 调用后手动 history.push(new AIMessage(...))
  //
  // RunnableWithMessageHistory 就是一个"装饰器"，把你的 chain 包一层：
  //   - 调用前：自动从 store 取出历史 → 注入到 chain 的 "history" 参数
  //   - 调用后：自动把本轮的 Human + AI 消息存回 store
  //
  // 你只需要 withHistory.invoke({ input: "你好" })，历史管理全自动。
  //
  // ⚠️ 注意：LangChain v1 中此 API 仍可用但已不是首选方案，
  //    v1 推荐使用 LangGraph 的 MemorySaver（见 Demo 4）。
  //    但理解此 API 对掌握 LCEL 数据流很有价值。
  // ────────────────────────────────────────────────────────

  // Step 1: 准备一条普通的 LCEL 链（和 Demo 1 完全一样）
  // 注意 Prompt 里有 "history" 占位符，后面 RunnableWithMessageHistory 会自动填充它
  const prompt3 = ChatPromptTemplate.fromMessages([
    ["system", "你是一个友好的 AI 助手。请记住用户的信息并在后续对话中使用。"],
    new MessagesPlaceholder("history"),  // ← 历史消息会被自动注入到这里
    ["human", "{input}"],
  ]);

  const chain3 = prompt3.pipe(model).pipe(parser);
  // 到这里，chain3 和 Demo 1 的 chain1 没有任何区别
  // 它本身不具备记忆能力，只是接收 { history, input } 参数的普通链

  // Step 2: 创建"历史存储"
  // 用 Map 存储多个 session 的历史（key=sessionId, value=InMemoryChatMessageHistory）
  // InMemoryChatMessageHistory 就是一个内存中的消息列表，封装了 addMessage/getMessages 方法
  //
  // 💡 v1 变更：ChatMessageHistory → InMemoryChatMessageHistory
  //    import 路径：langchain/stores/message/in_memory → @langchain/core/chat_history
  //
  // 为什么要用 sessionId？想象一个多用户聊天应用：
  //   "user-alice" → Alice 的对话历史
  //   "user-bob"   → Bob 的对话历史
  //   各自独立，互不干扰
  const messageHistories = new Map<string, InMemoryChatMessageHistory>();

  const getMessageHistory = (sessionId: string) => {
    if (!messageHistories.has(sessionId)) {
      messageHistories.set(sessionId, new InMemoryChatMessageHistory());
    }
    return messageHistories.get(sessionId)!;
  };
  // getMessageHistory("session-1") → 返回 session-1 的 InMemoryChatMessageHistory 实例
  // 首次调用时自动创建空的历史，后续调用返回已有的（里面已经积累了消息）

  // Step 3: 用 RunnableWithMessageHistory 把"普通链"升级为"带记忆的链"
  const withHistory = new RunnableWithMessageHistory({
    runnable: chain3,               // 被包装的普通链
    getMessageHistory,              // 告诉它怎么获取历史存储（根据 sessionId）
    inputMessagesKey: "input",      // chain 的哪个参数是用户输入？→ "input"
    historyMessagesKey: "history",  // chain 的哪个参数是历史消息？→ "history"（对应 Prompt 里的 MessagesPlaceholder("history")）
  });
  // 现在 withHistory 具备了自动读写历史的能力

  // Step 4: 调用时通过 config 传入 sessionId
  // sessionId 告诉它"用哪个会话的历史"
  const config = { configurable: { sessionId: "session-1" } };

  // ────────────────────────────────────────────────────────
  // 🔍 每次 withHistory.invoke() 内部发生了什么？
  //
  // 以第 2 轮对话为例（"我之前学了哪些技术栈？"）：
  //
  //   1. 从 config 取出 sessionId = "session-1"
  //   2. 调用 getMessageHistory("session-1") 拿到历史 store
  //   3. 从 store 取出已有消息: [HumanMessage("我是一名全栈开发者..."), AIMessage("...")]
  //   4. 组装参数: { history: [上面的消息], input: "我之前学了哪些技术栈？" }
  //   5. 调用 chain3.invoke(上面的参数) → 得到 AI 回复
  //   6. 自动把 HumanMessage("我之前学了哪些技术栈？") 存入 store
  //   7. 自动把 AIMessage(回复内容) 存入 store
  //   8. 返回结果
  //
  // 对比 Demo 1，步骤 3、6、7 都是你手动写的，现在全自动了。
  // ────────────────────────────────────────────────────────

  const conversations3 = [
    "我是一名全栈开发者，正在学习 LangChain",
    "我之前学了哪些技术栈？",
    "根据我的背景，你推荐我接下来学什么？",
  ];

  for (const userMsg of conversations3) {
    console.log(`👤 用户: ${userMsg}`);
    const result = await withHistory.invoke(
      { input: userMsg },   // ← 注意：不需要传 history 了！自动注入
      config                // ← 指定 sessionId，它就知道去找哪个会话的历史
    );
    console.log(`🤖 AI: ${result}\n`);
    // ← 注意：不需要手动 push 消息了！自动存储
  }

  // 验证：查看 store 中实际存储了多少消息
  const storedMessages = await getMessageHistory("session-1").getMessages();
  console.log(`📊 session-1 中自动存储了 ${storedMessages.length} 条消息（${conversations3.length} 轮对话 × 2）`);
  for (const msg of storedMessages) {
    const role = msg._getType() === "human" ? "👤" : "🤖";
    const content = (msg.content as string).slice(0, 50);
    console.log(`   ${role} ${content}${(msg.content as string).length > 50 ? "..." : ""}`);
  }
  console.log();

  // --- Demo 4: LangGraph MemorySaver（v1 推荐方式） ---
  console.log("=".repeat(60));
  console.log("📌 Demo 4: LangGraph MemorySaver（v1 推荐方式）\n");

  // ────────────────────────────────────────────────────────
  // 🔑 v1 的记忆新范式：LangGraph Checkpointer
  //
  // LangChain v1 推荐用 LangGraph 的"状态检查点"来管理记忆，
  // 而不是 RunnableWithMessageHistory。
  //
  // 核心区别：
  //   RunnableWithMessageHistory — 只存消息历史，包装普通 chain
  //   LangGraph MemorySaver      — 存完整状态（消息 + 任何自定义数据），
  //                                  与 Agent 深度集成，支持断点恢复
  //
  // 使用方式：
  //   1. 创建 MemorySaver 实例（内存版）
  //   2. 把它传给 createReactAgent 的 checkpointSaver 参数
  //   3. 调用时传 thread_id 区分不同会话
  //   4. Agent 会自动在每一步保存/恢复状态
  //
  // 类比理解：
  //   RunnableWithMessageHistory ≈ 浏览器的 sessionStorage
  //   MemorySaver               ≈ 数据库 + 事务日志（可回溯、可恢复）
  // ────────────────────────────────────────────────────────

  console.log("⚠️  提示：此 Demo 使用 createReactAgent + MemorySaver");
  console.log("   需要模型支持 function calling，推荐 OpenAI Key\n");

  try {
    // Step 1: 创建 MemorySaver（内存版，开发用；生产可换 PostgresSaver 等）
    const memorySaver = new MemorySaver();

    // Step 2: 创建带记忆的 Agent
    const agentWithMemory = createReactAgent({
      llm: model,
      tools: [],  // 本 demo 不需要工具，只演示记忆
      checkpointSaver: memorySaver,
    });

    // Step 3: 通过 thread_id 区分会话（类似 Demo 3 的 sessionId）
    const threadConfig = { configurable: { thread_id: "memory-demo-1" } };

    const conversations4 = [
      "我叫李四，我是一名后端开发者，主要用 Go 语言",
      "我擅长什么编程语言？",
      "根据我的技术背景，推荐一个适合我的 AI 框架",
    ];

    for (const userMsg of conversations4) {
      console.log(`👤 用户: ${userMsg}`);
      const result = await agentWithMemory.invoke(
        { messages: [new HumanMessage(userMsg)] },
        threadConfig  // ← thread_id 替代了 sessionId
      );
      const lastMsg = result.messages[result.messages.length - 1];
      console.log(`🤖 AI: ${lastMsg.content}\n`);
    }

    // 验证：查看 checkpoint 中的状态
    const checkpoint = await memorySaver.get(threadConfig);
    if (checkpoint) {
      const msgCount = (checkpoint.channel_values as { messages?: BaseMessage[] }).messages?.length ?? 0;
      console.log(`📊 thread "memory-demo-1" 的 checkpoint 中有 ${msgCount} 条消息`);
    }

    // 🔗 进阶提示：LangGraph 的 MemorySaver 在本 Demo 中只用了最基础的功能。
    //    在 06-agent 模块中，你将看到 MemorySaver 的更多能力：
    //    - StateGraph 自定义状态图：条件分支、循环、人机交互审批（interrupt）
    //    - 多会话管理：同一 Agent 同时维护多个独立会话
    //    - 检查点恢复：从任意历史状态恢复执行（"时间旅行"调试）
    //    → 运行 06-agent: npm run memory-agent / npm run state-graph
    console.log("\n🔗 进阶: 本 Demo 仅展示了 MemorySaver 的基础用法");
    console.log("   06-agent 模块将深入讲解 StateGraph 状态图、多会话管理、断点恢复等高级模式");
    console.log("   → cd ../06-agent && npm run state-graph");
  } catch (error) {
    console.log("❌ LangGraph Agent 执行失败（可能是模型不支持 function calling）");
    console.log("   建议：配置 OPENAI_API_KEY 后重试");
    console.log("   错误:", (error as Error).message);
  }
  console.log();

  // --- Demo 5: 有/无记忆对比 ---
  console.log("=".repeat(60));
  console.log("📌 Demo 5: 有/无记忆对比\n");

  const simpleChain = ChatPromptTemplate.fromMessages([
    ["human", "{input}"],
  ]).pipe(model).pipe(parser);

  const testQuestion = "我刚才说我叫什么名字？";

  // 无记忆
  console.log("--- 无记忆（单次调用） ---");
  console.log(`👤 用户: ${testQuestion}`);
  const noMemoryResult = await simpleChain.invoke({ input: testQuestion });
  console.log(`🤖 AI: ${noMemoryResult}\n`);

  // 有记忆（复用 session-1）
  console.log("--- 有记忆（Demo 3 的 session-1） ---");
  console.log(`👤 用户: ${testQuestion}`);
  const withMemoryResult = await withHistory.invoke(
    { input: testQuestion },
    config
  );
  console.log(`🤖 AI: ${withMemoryResult}\n`);

  console.log("💡 对比结论：");
  console.log("  - 无记忆：模型无法知道之前的对话内容，会表示不知道");
  console.log("  - 有记忆：模型能回忆起之前的对话，正确回答用户信息");

  // --- 方案总结 ---
  console.log("\n" + "=".repeat(60));
  console.log("📊 Memory 方案演进总结：\n");
  console.log("┌───────────────────────────┬────────────┬──────────────────────┐");
  console.log("│ 方案                      │ 版本       │ 特点                 │");
  console.log("├───────────────────────────┼────────────┼──────────────────────┤");
  console.log("│ 手动 push messages        │ 通用       │ 完全可控，代码多     │");
  console.log("│ RunnableWithMessageHistory │ v0.2+      │ LCEL 集成，自动管理  │");
  console.log("│ LangGraph MemorySaver     │ v1 推荐    │ 状态持久化，可恢复   │");
  console.log("└───────────────────────────┴────────────┴──────────────────────┘");

  console.log("\n" + "=".repeat(60));
  console.log("✅ Memory 对话记忆 Demo 完成！");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("memory-chat.ts");

if (isMainModule) {
  main().catch(console.error);
}
