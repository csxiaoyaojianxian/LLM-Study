/**
 * platform-vs-custom.ts — 平台方案 vs 自研方案对比实战
 *
 * 以"客服知识库问答"为实际场景，对比三种实现方式：
 * - Dify API 方案
 * - Coze API 方案
 * - 自研代码方案（基于 Module 04 RAG）
 *
 * 需要 API Key（自研方案需要）
 * Dify/Coze 方案需要配置对应的 API 凭证
 */

import "dotenv/config";
import {
  getDefaultProvider,
  chatWithModel,
  type Provider,
} from "./model-adapter.js";

// ============================================================
// 1. 场景定义
// ============================================================

function defineScenario(): void {
  console.log("=".repeat(60));
  console.log("🎯 场景：客服知识库问答系统");
  console.log("=".repeat(60));

  console.log("\n📌 需求描述:");
  console.log("  构建一个客服问答系统，能够:");
  console.log("  1. 理解用户的自然语言问题");
  console.log("  2. 从产品知识库中检索相关信息");
  console.log("  3. 生成准确、友好的回答");
  console.log("  4. 支持多轮对话（上下文理解）");

  console.log("\n📌 知识库内容（模拟）:");
  console.log("  - 产品功能介绍");
  console.log("  - 常见问题解答（FAQ）");
  console.log("  - 操作指南");
  console.log("  - 定价说明");

  console.log("\n📌 测试问题:");
  console.log('  Q1: "你们的产品有什么功能？"');
  console.log('  Q2: "价格是多少？"');
  console.log('  Q3: "怎么开始使用？"');
}

// ============================================================
// 2. 模拟知识库
// ============================================================

const KNOWLEDGE_BASE = [
  {
    title: "产品功能",
    content:
      "我们的 AI 助手产品支持以下功能：智能问答、文档分析、代码生成、图像理解、语音交互。核心优势是多模态理解能力和快速响应速度。",
  },
  {
    title: "定价方案",
    content:
      "我们提供三种定价方案：免费版（每月100次调用）、专业版（每月299元，不限调用次数）、企业版（按需定制，支持私有部署）。所有方案均包含基础客服支持。",
  },
  {
    title: "快速开始",
    content:
      "开始使用只需3步：1）注册账号并登录控制台；2）创建 AI 应用并配置模型和知识库；3）通过 API 或 SDK 集成到你的系统中。支持 TypeScript、Python、Java 等主流语言。",
  },
  {
    title: "常见问题",
    content:
      "Q: 支持哪些语言？A: 支持中文和英文。Q: 数据安全吗？A: 企业版支持私有部署，数据完全在您的服务器上。Q: 可以自定义模型吗？A: 支持微调和自定义提示词。",
  },
];

// ============================================================
// 3. 方案一：Dify API 实现
// ============================================================

async function difyApproach(): Promise<{
  success: boolean;
  answer: string;
  time: number;
}> {
  console.log("\n" + "=".repeat(60));
  console.log("🟢 方案一：Dify API");
  console.log("=".repeat(60));

  const startTime = Date.now();
  const apiUrl = process.env.DIFY_API_URL || "http://localhost/v1";
  const apiKey = process.env.DIFY_API_KEY || "";

  if (!apiKey || apiKey === "app-") {
    console.log("\n  ⚠️  未配置 DIFY_API_KEY，展示实现思路:");
    console.log("\n  📌 Dify 实现步骤:");
    console.log("  1. 在 Dify 中创建'聊天助手'应用");
    console.log("  2. 创建知识库，上传产品文档");
    console.log("  3. 在应用中关联知识库");
    console.log("  4. 配置提示词模板");
    console.log("  5. 通过 API 调用");
    console.log("\n  📌 代码量: ~10 行（仅 API 调用）");
    console.log("  📌 开发时间: ~30 分钟（含平台配置）");

    return {
      success: false,
      answer: "[需要配置 Dify]",
      time: Date.now() - startTime,
    };
  }

  try {
    const response = await fetch(`${apiUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},
        query: "你们的产品有什么功能？",
        response_mode: "blocking",
        user: "test",
      }),
    });

    const data = (await response.json()) as { answer: string };
    console.log(`  💬 回答: ${data.answer.substring(0, 200)}`);

    return {
      success: true,
      answer: data.answer,
      time: Date.now() - startTime,
    };
  } catch (error) {
    console.log(`  ❌ 失败: ${error instanceof Error ? error.message : error}`);
    return {
      success: false,
      answer: "",
      time: Date.now() - startTime,
    };
  }
}

// ============================================================
// 4. 方案二：Coze API 实现
// ============================================================

async function cozeApproach(): Promise<{
  success: boolean;
  answer: string;
  time: number;
}> {
  console.log("\n" + "=".repeat(60));
  console.log("🔵 方案二：Coze API");
  console.log("=".repeat(60));

  const startTime = Date.now();
  const accessToken = process.env.COZE_ACCESS_TOKEN || "";
  const botId = process.env.COZE_BOT_ID || "";

  if (!accessToken || !botId) {
    console.log("\n  ⚠️  未配置 Coze 凭证，展示实现思路:");
    console.log("\n  📌 Coze 实现步骤:");
    console.log("  1. 在 Coze 中创建 Bot");
    console.log("  2. 上传知识库文档");
    console.log("  3. 配置提示词和技能");
    console.log("  4. 发布为 API");
    console.log("  5. 调用 Chat API");
    console.log("\n  📌 代码量: ~10 行（仅 API 调用）");
    console.log("  📌 开发时间: ~20 分钟（平台操作更简单）");

    return {
      success: false,
      answer: "[需要配置 Coze]",
      time: Date.now() - startTime,
    };
  }

  try {
    const response = await fetch("https://api.coze.cn/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bot_id: botId,
        user_id: "test",
        stream: false,
        auto_save_history: false,
        additional_messages: [
          {
            role: "user",
            content: "你们的产品有什么功能？",
            content_type: "text",
          },
        ],
      }),
    });

    const data = (await response.json()) as { data?: { id: string } };
    console.log(`  📤 对话已发送，Chat ID: ${data.data?.id}`);

    return {
      success: true,
      answer: "对话已发送（异步获取结果）",
      time: Date.now() - startTime,
    };
  } catch (error) {
    console.log(`  ❌ 失败: ${error instanceof Error ? error.message : error}`);
    return {
      success: false,
      answer: "",
      time: Date.now() - startTime,
    };
  }
}

// ============================================================
// 5. 方案三：自研 RAG 实现
// ============================================================

/**
 * 简化版 RAG 实现
 * 完整版参见 Module 04 rag-pipeline.ts
 */
async function customRAGApproach(): Promise<{
  success: boolean;
  answer: string;
  time: number;
}> {
  console.log("\n" + "=".repeat(60));
  console.log("🔴 方案三：自研 RAG（Module 04 方案）");
  console.log("=".repeat(60));

  const startTime = Date.now();

  let provider: Provider;
  try {
    provider = getDefaultProvider();
  } catch {
    console.log("\n  ⚠️  未配置 API Key，展示实现思路:");
    console.log("\n  📌 自研 RAG 实现步骤:");
    console.log("  1. 知识库文档切分（chunking）");
    console.log("  2. 向量化存储（embedding + vector store）");
    console.log("  3. 语义检索（similarity search）");
    console.log("  4. 上下文组装 + LLM 生成");
    console.log("\n  📌 代码量: ~150-200 行");
    console.log("  📌 开发时间: 1-3 天");
    return {
      success: false,
      answer: "[需要配置 API Key]",
      time: Date.now() - startTime,
    };
  }

  console.log(`\n  📌 使用 ${provider} 模型`);

  // 简化版 RAG: 关键词匹配 + LLM 生成
  const question = "你们的产品有什么功能？";
  console.log(`  ❓ 问题: ${question}`);

  // 简化检索（实际应使用向量检索，参见 Module 04）
  console.log("  🔍 检索知识库...");
  const relevantDocs = KNOWLEDGE_BASE.filter(
    (doc) =>
      doc.title.includes("功能") ||
      doc.content.includes("功能") ||
      question.split("").some((char) => doc.content.includes(char))
  ).slice(0, 2);

  console.log(`  📄 找到 ${relevantDocs.length} 个相关文档`);

  // 组装上下文
  const context = relevantDocs
    .map((doc) => `【${doc.title}】${doc.content}`)
    .join("\n\n");

  // LLM 生成
  console.log("  🤖 LLM 生成回答...");
  try {
    const answer = await chatWithModel(
      provider,
      [{ role: "user", content: question }],
      {
        system: `你是一个友好的客服助手。请根据以下知识库内容回答用户问题。
如果知识库中没有相关信息，请诚实告知。

知识库内容：
${context}`,
      }
    );

    console.log(`  💬 回答: ${answer.substring(0, 200)}`);
    return {
      success: true,
      answer,
      time: Date.now() - startTime,
    };
  } catch (error) {
    console.log(`  ❌ 失败: ${error instanceof Error ? error.message : error}`);
    return {
      success: false,
      answer: "",
      time: Date.now() - startTime,
    };
  }
}

// ============================================================
// 6. 综合对比
// ============================================================

function showComparison(
  difyResult: { success: boolean; time: number },
  cozeResult: { success: boolean; time: number },
  customResult: { success: boolean; time: number }
): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 综合对比");
  console.log("=".repeat(60));

  console.log("\n┌──────────────────┬──────────────┬──────────────┬──────────────┐");
  console.log("│       维度       │   Dify API   │   Coze API   │   自研 RAG   │");
  console.log("├──────────────────┼──────────────┼──────────────┼──────────────┤");
  console.log("│ 开发时间         │ ~30 分钟     │ ~20 分钟     │ 1-3 天       │");
  console.log("│ 代码量           │ ~10 行       │ ~10 行       │ ~200 行      │");
  console.log("│ 灵活性           │ 中           │ 中           │ 高           │");
  console.log("│ 数据安全         │ 可私部署     │ 云端         │ 完全可控     │");
  console.log("│ 维护成本         │ 低           │ 最低         │ 中-高        │");
  console.log("│ 扩展性           │ API/Workflow │ Plugin       │ 无限         │");
  console.log("│ 学习曲线         │ 低           │ 最低         │ 高           │");
  console.log(`│ API 响应时间     │ ${difyResult.time.toString().padEnd(8)}ms  │ ${cozeResult.time.toString().padEnd(8)}ms  │ ${customResult.time.toString().padEnd(8)}ms  │`);
  console.log("└──────────────────┴──────────────┴──────────────┴──────────────┘");

  console.log("\n📌 决策树:");
  console.log("  快速验证 / 非核心功能 → Coze（最快上线）");
  console.log("  企业级 / 需要私部署  → Dify（开源可控）");
  console.log("  核心业务 / 深度定制  → 自研（完全掌控）");
  console.log("  混合方案（推荐）     → 核心自研 + 边缘用平台");

  console.log("\n📌 成本估算（月度，假设日均 1000 次对话）:");
  console.log("  Coze: 免费（在免费额度内）");
  console.log("  Dify 云端: ~100-300 元/月");
  console.log("  Dify 私部署: 服务器成本 + 模型 API 费用");
  console.log("  自研: 服务器成本 + 模型 API 费用 + 人力成本");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 平台方案 vs 自研方案对比实战\n");

  defineScenario();

  // 三种方案测试
  const difyResult = await difyApproach();
  const cozeResult = await cozeApproach();
  const customResult = await customRAGApproach();

  // 综合对比
  showComparison(difyResult, cozeResult, customResult);

  console.log("\n" + "=".repeat(60));
  console.log("🎓 Module 13 全部完成！");
  console.log("=".repeat(60));
  console.log("\n🎉 恭喜！你已完成 LLM-Study 全部 13 个模块的学习！");
  console.log("  Module 01-02: 基础入门 → AI 聊天应用");
  console.log("  Module 03:    提示工程 → 与 LLM 高效对话");
  console.log("  Module 04-05: RAG → 知识增强");
  console.log("  Module 06:    Agent → 自主行动");
  console.log("  Module 07:    MCP → 工具协议");
  console.log("  Module 08:    Skills → Claude 定制");
  console.log("  Module 09:    多模态 → 图像/语音");
  console.log("  Module 10:    部署 → 生产优化");
  console.log("  Module 11:    LlamaIndex → 知识管理");
  console.log("  Module 12:    Fine-tuning → 模型定制");
  console.log("  Module 13:    AI 平台 → 平台化部署");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("platform-vs-custom.ts");

if (isMainModule) {
  main().catch(console.error);
}

export { KNOWLEDGE_BASE };
