/**
 * dify-api.ts — Dify API 集成
 *
 * 本文件演示 Dify 平台的 API 集成：
 * - Dify 本地 Docker 部署指南
 * - Completion API / Chat API / Workflow API
 * - 知识库 API 操作
 * - 应用管理 API
 *
 * 需要部署 Dify（本地 Docker 或使用云端）+ 配置 DIFY_API_KEY
 */

import "dotenv/config";

// ============================================================
// 1. Dify 部署指南
// ============================================================

function showDeploymentGuide(): void {
  console.log("=".repeat(60));
  console.log("🐳 1. Dify 本地部署指南");
  console.log("=".repeat(60));

  console.log("\n📌 方式一：Docker Compose（推荐）");
  console.log("  ```bash");
  console.log("  # 克隆 Dify 源码");
  console.log("  git clone https://github.com/langgenius/dify.git");
  console.log("  cd dify/docker");
  console.log("  ");
  console.log("  # 复制环境变量配置");
  console.log("  cp .env.example .env");
  console.log("  ");
  console.log("  # 启动所有服务");
  console.log("  docker compose up -d");
  console.log("  ```");
  console.log("  启动后访问: http://localhost（默认端口 80）");
  console.log("  首次访问需要设置管理员账号");

  console.log("\n📌 方式二：Dify 云端（免部署）");
  console.log("  访问 https://cloud.dify.ai 注册账号");
  console.log("  免费版有一定额度限制");

  console.log("\n📌 获取 API Key:");
  console.log("  1. 在 Dify 中创建一个应用");
  console.log("  2. 进入应用设置 → API 密钥");
  console.log("  3. 生成 API Key（格式: app-xxxx）");
  console.log("  4. 填入 .env 的 DIFY_API_KEY");
}

// ============================================================
// 2. Dify API 客户端
// ============================================================

interface DifyConfig {
  baseUrl: string;
  apiKey: string;
}

interface DifyMessage {
  role: string;
  content: string;
}

interface DifyResponse {
  answer: string;
  conversation_id?: string;
  message_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Dify API 客户端
 * 封装常用的 API 调用
 */
class DifyClient {
  private config: DifyConfig;

  constructor(config: DifyConfig) {
    this.config = config;
  }

  /**
   * Chat API — 对话型应用
   * 对应 Dify 中的 "聊天助手" 应用类型
   */
  async chat(
    message: string,
    conversationId?: string,
    user: string = "demo-user"
  ): Promise<DifyResponse> {
    console.log(`\n📤 调用 Dify Chat API...`);

    const response = await fetch(`${this.config.baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: "blocking",
        conversation_id: conversationId || "",
        user,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dify API 错误 (${response.status}): ${error}`);
    }

    const data = (await response.json()) as DifyResponse;
    return data;
  }

  /**
   * Chat API — 流式响应
   * 用于实时展示 AI 回复
   */
  async chatStream(
    message: string,
    conversationId?: string,
    user: string = "demo-user"
  ): Promise<void> {
    console.log(`\n📤 调用 Dify Chat API（流式）...`);

    const response = await fetch(`${this.config.baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: "streaming",
        conversation_id: conversationId || "",
        user,
      }),
    });

    if (!response.ok) {
      throw new Error(`Dify API 错误 (${response.status})`);
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
      const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

      for (const line of lines) {
        const jsonStr = line.slice(6); // 移除 "data: "
        if (jsonStr === "[DONE]") continue;

        try {
          const data = JSON.parse(jsonStr) as { event: string; answer?: string };
          if (data.event === "message" && data.answer) {
            process.stdout.write(data.answer);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    console.log("");
  }

  /**
   * Completion API — 文本生成型应用
   * 对应 Dify 中的 "文本生成" 应用类型
   */
  async completion(
    inputs: Record<string, string>,
    user: string = "demo-user"
  ): Promise<string> {
    console.log(`\n📤 调用 Dify Completion API...`);

    const response = await fetch(`${this.config.baseUrl}/completion-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs,
        response_mode: "blocking",
        user,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dify API 错误 (${response.status}): ${error}`);
    }

    const data = (await response.json()) as { answer: string };
    return data.answer;
  }

  /**
   * Workflow API — 运行工作流
   * 对应 Dify 中的 "工作流" 应用类型
   */
  async runWorkflow(
    inputs: Record<string, string>,
    user: string = "demo-user"
  ): Promise<Record<string, unknown>> {
    console.log(`\n📤 调用 Dify Workflow API...`);

    const response = await fetch(`${this.config.baseUrl}/workflows/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs,
        response_mode: "blocking",
        user,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dify API 错误 (${response.status}): ${error}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  /**
   * 获取对话历史
   */
  async getConversationMessages(
    conversationId: string,
    user: string = "demo-user"
  ): Promise<DifyMessage[]> {
    const response = await fetch(
      `${this.config.baseUrl}/messages?conversation_id=${conversationId}&user=${user}`,
      {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      }
    );

    if (!response.ok) throw new Error(`API 错误 (${response.status})`);
    const data = (await response.json()) as { data: DifyMessage[] };
    return data.data;
  }
}

// ============================================================
// 3. Dify API 使用演示
// ============================================================

async function demonstrateDifyAPI(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔧 2. Dify API 使用演示");
  console.log("=".repeat(60));

  const baseUrl = process.env.DIFY_API_URL || "http://localhost/v1";
  const apiKey = process.env.DIFY_API_KEY || "";

  if (!apiKey || apiKey === "app-") {
    console.log("\n⚠️  未配置 DIFY_API_KEY，展示 API 调用代码示例\n");
    showCodeExamples();
    return;
  }

  const client = new DifyClient({ baseUrl, apiKey });

  // 对话测试
  try {
    console.log("\n📌 测试一: Chat API（对话）");
    const response = await client.chat("你好，介绍一下你自己");
    console.log(`  🤖 回答: ${response.answer.substring(0, 200)}`);

    // 多轮对话
    if (response.conversation_id) {
      console.log("\n📌 测试二: 多轮对话（使用 conversation_id）");
      const followUp = await client.chat(
        "你能做什么？",
        response.conversation_id
      );
      console.log(`  🤖 回答: ${followUp.answer.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`  ❌ 调用失败: ${error instanceof Error ? error.message : error}`);
    console.log("  请检查 Dify 是否正常运行，API Key 是否正确");
  }
}

function showCodeExamples(): void {
  console.log("📌 Chat API 调用示例:");
  console.log(`  const client = new DifyClient({`);
  console.log(`    baseUrl: "http://localhost/v1",`);
  console.log(`    apiKey: "app-xxxx"`);
  console.log(`  });`);
  console.log(`  const response = await client.chat("你好");`);
  console.log(`  console.log(response.answer);`);

  console.log("\n📌 Workflow API 调用示例:");
  console.log(`  const result = await client.runWorkflow({`);
  console.log(`    input_text: "需要处理的文本"`);
  console.log(`  });`);
  console.log(`  console.log(result);`);

  console.log("\n📌 流式响应示例:");
  console.log(`  await client.chatStream("讲个故事");`);
  console.log(`  // 输出会逐字显示在终端`);
}

// ============================================================
// 4. Dify 知识库 API
// ============================================================

function showKnowledgeBaseAPI(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📚 3. Dify 知识库 API");
  console.log("=".repeat(60));

  console.log("\n📌 知识库管理（需要使用 Dataset API Key）:");

  console.log("\n  创建知识库:");
  console.log(`  POST /datasets`);
  console.log(`  { "name": "产品文档", "permission": "only_me" }`);

  console.log("\n  上传文档:");
  console.log(`  POST /datasets/{dataset_id}/document/create_by_file`);
  console.log(`  Content-Type: multipart/form-data`);
  console.log(`  file: <文件内容>`);
  console.log(`  data: { "indexing_technique": "high_quality" }`);

  console.log("\n  查询知识库:");
  console.log(`  POST /datasets/{dataset_id}/retrieve`);
  console.log(`  { "query": "用户问题", "top_k": 3 }`);

  console.log("\n💡 对比 Module 04 RAG:");
  console.log("  Module 04: 手动 chunking → embedding → ChromaDB → 检索");
  console.log("  Dify: 上传文件 → 自动处理 → API 查询");
  console.log("  Dify 底层也是同样的 RAG 流程，只是封装为了 API");
}

// ============================================================
// 5. 最佳实践
// ============================================================

function showBestPractices(): void {
  console.log("\n" + "=".repeat(60));
  console.log("💡 4. Dify 集成最佳实践");
  console.log("=".repeat(60));

  console.log("\n📌 API 调用优化:");
  console.log("  - 使用流式响应（streaming）提升用户体验");
  console.log("  - 实现重试机制和超时处理");
  console.log("  - 缓存常见问题的回答（参考 Module 10 缓存策略）");

  console.log("\n📌 知识库优化:");
  console.log("  - 文档切分大小建议 500-1000 字符");
  console.log("  - 使用 high_quality 索引模式");
  console.log("  - 定期更新知识库内容");

  console.log("\n📌 安全建议:");
  console.log("  - API Key 只在服务端使用，不要暴露给前端");
  console.log("  - 设置 IP 白名单限制 API 访问");
  console.log("  - 监控 API 调用量，防止滥用");

  console.log("\n📌 与现有系统集成:");
  console.log("  - Dify 作为 AI 能力层，现有系统通过 API 调用");
  console.log("  - 可以配合 Module 02 的 Next.js 前端使用");
  console.log("  - 复杂场景可以混合使用：核心功能自研 + 辅助功能用 Dify");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 Dify API 集成教程\n");

  showDeploymentGuide();
  await demonstrateDifyAPI();
  showKnowledgeBaseAPI();
  showBestPractices();

  console.log("\n" + "=".repeat(60));
  console.log("🎓 Dify 教程完成！");
  console.log("=".repeat(60));
  console.log("📚 下一步:");
  console.log("  npm run coze-api → Coze API 集成");
  console.log("  npm run platform-vs-custom → 平台 vs 自研对比");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("dify-api.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { DifyClient, type DifyConfig, type DifyResponse };
