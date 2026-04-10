/**
 * coze-api.ts — Coze API 集成
 *
 * 本文件演示 Coze（扣子）平台的 API 集成：
 * - Coze Bot 对话 API
 * - 流式响应处理
 * - 插件开发概念
 * - 工作流 API
 *
 * 需要 Coze 账号 + 配置 COZE_ACCESS_TOKEN 和 COZE_BOT_ID
 */

import "dotenv/config";

// ============================================================
// 1. Coze 平台介绍
// ============================================================

function showCozeIntro(): void {
  console.log("=".repeat(60));
  console.log("🤖 1. Coze（扣子）平台介绍");
  console.log("=".repeat(60));

  console.log("\n📌 Coze 是字节跳动推出的 AI 应用开发平台:");
  console.log("  - 国内版: https://www.coze.cn");
  console.log("  - 国际版: https://www.coze.com");
  console.log("  - API 文档: https://www.coze.cn/docs/developer_guides/coze_api_overview");

  console.log("\n📌 核心概念:");
  console.log("  - Bot（机器人）: AI 应用的基本单元");
  console.log("  - Plugin（插件）: 扩展 Bot 能力的工具");
  console.log("  - Workflow（工作流）: 多步骤自动化流程");
  console.log("  - Knowledge（知识库）: RAG 数据源");

  console.log("\n📌 获取 API 凭证:");
  console.log("  1. 访问 https://www.coze.cn 登录账号");
  console.log("  2. 创建一个 Bot 并配置好提示词");
  console.log("  3. 发布 Bot（选择 API 渠道）");
  console.log("  4. 在个人设置中生成 Access Token");
  console.log("  5. 记录 Bot ID 和 Access Token 填入 .env");
}

// ============================================================
// 2. Coze API 客户端
// ============================================================

interface CozeConfig {
  baseUrl: string;
  accessToken: string;
  botId: string;
}

interface CozeMessage {
  role: "user" | "assistant";
  content: string;
  content_type: "text";
}

interface CozeChatResponse {
  code: number;
  msg: string;
  data?: {
    id: string;
    conversation_id: string;
    status: string;
  };
}

/**
 * Coze API 客户端
 * 基于 Coze 官方 API 文档实现
 */
class CozeClient {
  private config: CozeConfig;

  constructor(config: CozeConfig) {
    this.config = config;
  }

  /**
   * Chat API — 发送对话消息
   * 非流式模式，返回完整回复
   */
  async chat(
    message: string,
    conversationId?: string,
    userId: string = "demo_user"
  ): Promise<{ answer: string; conversationId: string }> {
    console.log(`\n📤 调用 Coze Chat API...`);

    const body: Record<string, unknown> = {
      bot_id: this.config.botId,
      user_id: userId,
      stream: false,
      auto_save_history: true,
      additional_messages: [
        {
          role: "user",
          content: message,
          content_type: "text",
        },
      ],
    };

    if (conversationId) {
      body.conversation_id = conversationId;
    }

    const response = await fetch(`${this.config.baseUrl}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Coze API 错误 (${response.status}): ${error}`);
    }

    const data = (await response.json()) as CozeChatResponse;

    if (data.code !== 0) {
      throw new Error(`Coze API 业务错误: ${data.msg}`);
    }

    // 非流式模式下，需要轮询获取结果
    const chatId = data.data?.id || "";
    const convId = data.data?.conversation_id || conversationId || "";

    // 等待响应完成
    const answer = await this.pollChatResult(convId, chatId, userId);

    return { answer, conversationId: convId };
  }

  /**
   * 轮询获取对话结果
   */
  private async pollChatResult(
    conversationId: string,
    chatId: string,
    userId: string
  ): Promise<string> {
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      const response = await fetch(
        `${this.config.baseUrl}/chat/retrieve?conversation_id=${conversationId}&chat_id=${chatId}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
          },
        }
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        code: number;
        data?: { status: string };
      };
      if (data.data?.status === "completed") {
        // 获取消息列表
        const msgResponse = await fetch(
          `${this.config.baseUrl}/chat/message/list?conversation_id=${conversationId}&chat_id=${chatId}`,
          {
            headers: {
              Authorization: `Bearer ${this.config.accessToken}`,
            },
          }
        );
        if (msgResponse.ok) {
          const msgData = (await msgResponse.json()) as {
            data?: Array<{ role: string; type: string; content: string }>;
          };
          const assistantMsg = msgData.data?.find(
            (m) => m.role === "assistant" && m.type === "answer"
          );
          return assistantMsg?.content || "";
        }
      }

      if (data.data?.status === "failed") {
        throw new Error("对话处理失败");
      }
    }

    throw new Error("对话超时");
  }

  /**
   * Chat API — 流式响应
   */
  async chatStream(
    message: string,
    conversationId?: string,
    userId: string = "demo_user"
  ): Promise<void> {
    console.log(`\n📤 调用 Coze Chat API（流式）...`);

    const body: Record<string, unknown> = {
      bot_id: this.config.botId,
      user_id: userId,
      stream: true,
      auto_save_history: true,
      additional_messages: [
        {
          role: "user",
          content: message,
          content_type: "text",
        },
      ],
    };

    if (conversationId) {
      body.conversation_id = conversationId;
    }

    const response = await fetch(`${this.config.baseUrl}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Coze API 错误 (${response.status})`);
    }

    // 处理 SSE 流
    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法读取响应流");

    const decoder = new TextDecoder();
    process.stdout.write("🤖 ");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const jsonStr = line.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const data = JSON.parse(jsonStr) as {
              event: string;
              message?: { role: string; type: string; content: string };
            };
            if (
              data.event === "conversation.message.delta" &&
              data.message?.role === "assistant" &&
              data.message?.type === "answer"
            ) {
              process.stdout.write(data.message.content);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
    console.log("");
  }
}

// ============================================================
// 3. 插件开发概念
// ============================================================

function explainPluginDevelopment(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔌 3. Coze 插件开发");
  console.log("=".repeat(60));

  console.log("\n📌 Coze 插件 = 对应 Module 06 的 Agent Tools");
  console.log("  插件让 Bot 可以调用外部能力（API、数据库等）\n");

  console.log("📌 插件类型:");
  console.log("  1. 预置插件: Coze 提供的现成插件（搜索、天气、新闻等）");
  console.log("  2. 自定义插件: 开发者自己编写的插件");
  console.log("  3. 工作流插件: 将工作流封装为可复用的插件");

  console.log("\n📌 自定义插件开发流程:");
  console.log("  1. 定义插件 Schema（输入/输出参数）");
  console.log("  2. 实现 HTTP API 端点");
  console.log("  3. 在 Coze 平台注册插件");
  console.log("  4. 在 Bot 中启用插件");

  console.log("\n📌 插件 Schema 示例（类似 Module 07 MCP Tool）:");
  console.log("  ```json");
  console.log("  {");
  console.log('    "name": "weather_query",');
  console.log('    "description": "查询指定城市的天气",');
  console.log('    "parameters": {');
  console.log('      "type": "object",');
  console.log('      "properties": {');
  console.log('        "city": { "type": "string", "description": "城市名" }');
  console.log("      },");
  console.log('      "required": ["city"]');
  console.log("    }");
  console.log("  }");
  console.log("  ```");

  console.log("\n💡 对比:");
  console.log("  Module 06 Agent: 代码中定义 tool function");
  console.log("  Module 07 MCP: 标准化的 Tool 协议");
  console.log("  Coze Plugin: HTTP API + Schema 注册");
  console.log("  底层思想一致: 让 LLM 知道有哪些工具，以及如何调用");
}

// ============================================================
// 4. 工作流 API
// ============================================================

function showWorkflowAPI(): void {
  console.log("\n" + "=".repeat(60));
  console.log("⚡ 4. Coze 工作流 API");
  console.log("=".repeat(60));

  console.log("\n📌 工作流 = 对应 Module 06 的 StateGraph");
  console.log("  Coze 的可视化工作流编排 ↔ LangGraph 的代码编排\n");

  console.log("📌 工作流 API 调用:");
  console.log("  ```typescript");
  console.log("  // 触发工作流执行");
  console.log("  const response = await fetch('https://api.coze.cn/v1/workflow/run', {");
  console.log("    method: 'POST',");
  console.log("    headers: {");
  console.log("      'Authorization': 'Bearer <token>',");
  console.log("      'Content-Type': 'application/json'");
  console.log("    },");
  console.log("    body: JSON.stringify({");
  console.log("      workflow_id: '<workflow_id>',");
  console.log("      parameters: { input_text: '需要处理的内容' }");
  console.log("    })");
  console.log("  });");
  console.log("  ```");

  console.log("\n📌 工作流节点类型（对应自研概念）:");
  console.log("  ┌──────────────────┬──────────────────────────────┐");
  console.log("  │   Coze 节点      │      对应自研概念             │");
  console.log("  ├──────────────────┼──────────────────────────────┤");
  console.log("  │ LLM 节点         │ chatWithModel()              │");
  console.log("  │ 知识库检索节点    │ RAGPipeline.query()          │");
  console.log("  │ 代码节点         │ 自定义函数                    │");
  console.log("  │ 条件分支节点     │ StateGraph conditionalEdge   │");
  console.log("  │ 循环节点         │ StateGraph loop              │");
  console.log("  │ 插件调用节点     │ Agent tool call              │");
  console.log("  └──────────────────┴──────────────────────────────┘");
}

// ============================================================
// 5. API 调用演示
// ============================================================

async function demonstrateCozeAPI(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔧 5. Coze API 调用演示");
  console.log("=".repeat(60));

  const baseUrl = process.env.COZE_API_URL || "https://api.coze.cn/v1";
  const accessToken = process.env.COZE_ACCESS_TOKEN || "";
  const botId = process.env.COZE_BOT_ID || "";

  if (!accessToken || !botId) {
    console.log("\n⚠️  未配置 COZE_ACCESS_TOKEN 或 COZE_BOT_ID");
    console.log("  请在 .env 中配置后重试");
    console.log("  以下展示代码调用示例:\n");

    console.log("  ```typescript");
    console.log("  const client = new CozeClient({");
    console.log('    baseUrl: "https://api.coze.cn/v1",');
    console.log('    accessToken: "your_token",');
    console.log('    botId: "your_bot_id"');
    console.log("  });");
    console.log("");
    console.log("  // 非流式对话");
    console.log('  const result = await client.chat("你好");');
    console.log("  console.log(result.answer);");
    console.log("");
    console.log("  // 流式对话");
    console.log('  await client.chatStream("讲一个故事");');
    console.log("  ```");
    return;
  }

  const client = new CozeClient({ baseUrl, accessToken, botId });

  try {
    // 基础对话
    console.log("\n📌 测试: Coze Bot 对话");
    const result = await client.chat("你好，你是什么 Bot？");
    console.log(`  🤖 回答: ${result.answer.substring(0, 200)}`);

    // 多轮对话
    console.log("\n📌 测试: 多轮对话");
    const followUp = await client.chat(
      "你有什么能力？",
      result.conversationId
    );
    console.log(`  🤖 回答: ${followUp.answer.substring(0, 200)}`);
  } catch (error) {
    console.log(`  ❌ 调用失败: ${error instanceof Error ? error.message : error}`);
  }
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 Coze API 集成教程\n");

  showCozeIntro();
  await demonstrateCozeAPI();
  explainPluginDevelopment();
  showWorkflowAPI();

  console.log("\n" + "=".repeat(60));
  console.log("🎓 Coze 教程完成！");
  console.log("=".repeat(60));
  console.log("📚 下一步: npm run platform-vs-custom → 平台 vs 自研对比");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("coze-api.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { CozeClient, type CozeConfig };
