/**
 * platform-concepts.ts — AI 应用平台核心概念
 *
 * 本文件对比分析主流 AI 应用平台：
 * - AI 应用平台的三大支柱
 * - Coze vs Dify vs 自研的特性对比
 * - 平台架构解析
 * - 适用场景分析
 *
 * 无需 API Key 即可运行
 */

// ============================================================
// 1. AI 应用平台概述
// ============================================================

function explainPlatformOverview(): void {
  console.log("=".repeat(60));
  console.log("🏗️  1. AI 应用平台概述");
  console.log("=".repeat(60));

  console.log("\n📌 什么是 AI 应用平台？");
  console.log("  AI 应用平台是一种低代码/无代码工具，让用户无需编写代码");
  console.log("  即可构建 AI 应用。核心能力是将 LLM 的复杂技术封装为");
  console.log("  可视化的工作流，降低 AI 应用的开发门槛。");

  console.log("\n📌 主流平台:");
  console.log("  🔵 Coze（扣子）— 字节跳动出品");
  console.log("     - 国内版: coze.cn / 国际版: coze.com");
  console.log("     - 特点: 免费额度大、插件生态丰富、一键发布到多渠道");

  console.log("\n  🟢 Dify — 开源 AI 应用平台");
  console.log("     - 开源: github.com/langgenius/dify");
  console.log("     - 特点: 可本地部署、完全可控、API 完善、社区活跃");

  console.log("\n  🟡 其他平台:");
  console.log("     - FastGPT — 开源知识库问答平台");
  console.log("     - Flowise — 开源 LangChain 可视化编排");
  console.log("     - MaxKB — 开源知识库管理平台");
}

// ============================================================
// 2. 三大支柱
// ============================================================

function explainThreePillars(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🏛️  2. AI 应用平台的三大支柱");
  console.log("=".repeat(60));

  console.log("\n📌 支柱一：工作流编排（Workflow）");
  console.log("  ┌──────────┐    ┌──────────┐    ┌──────────┐");
  console.log("  │ 用户输入 │ →  │ LLM 处理 │ →  │ 输出结果 │");
  console.log("  └──────────┘    └──────────┘    └──────────┘");
  console.log("         │              │");
  console.log("         ▼              ▼");
  console.log("  ┌──────────┐    ┌──────────┐");
  console.log("  │ 条件判断 │    │ 工具调用 │");
  console.log("  └──────────┘    └──────────┘");
  console.log("  对应自研: Module 06 StateGraph（LangGraph 状态图）");
  console.log("  平台优势: 可视化拖拽编排，无需写代码");

  console.log("\n📌 支柱二：知识库管理（Knowledge Base）");
  console.log("  ┌──────────┐    ┌──────────┐    ┌──────────┐");
  console.log("  │ 文档上传 │ →  │ 自动切分 │ →  │ 向量存储 │");
  console.log("  └──────────┘    └──────────┘    └──────────┘");
  console.log("                                        │");
  console.log("  ┌──────────┐    ┌──────────┐          ▼");
  console.log("  │ LLM 回答 │ ←  │ 上下文   │ ←  ┌──────────┐");
  console.log("  └──────────┘    └──────────┘    │ 语义检索 │");
  console.log("                                  └──────────┘");
  console.log("  对应自研: Module 04 RAG Pipeline + Module 11 LlamaIndex");
  console.log("  平台优势: 上传文件即可用，自动处理切分和向量化");

  console.log("\n📌 支柱三：插件/工具系统（Plugins/Tools）");
  console.log("  ┌──────────┐    ┌──────────┐    ┌──────────┐");
  console.log("  │ 网页搜索 │    │ 代码执行 │    │ API 调用 │");
  console.log("  └──────────┘    └──────────┘    └──────────┘");
  console.log("  ┌──────────┐    ┌──────────┐    ┌──────────┐");
  console.log("  │ 数据库   │    │ 图片生成 │    │ 自定义   │");
  console.log("  └──────────┘    └──────────┘    └──────────┘");
  console.log("  对应自研: Module 06 Agent Tools + Module 07 MCP");
  console.log("  平台优势: 丰富的预置插件，即插即用");
}

// ============================================================
// 3. 平台特性对比
// ============================================================

function compareFeatures(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 3. Coze vs Dify vs 自研 特性对比");
  console.log("=".repeat(60));

  console.log("\n┌──────────────────┬──────────────┬──────────────┬──────────────┐");
  console.log("│       维度       │     Coze     │     Dify     │    自研      │");
  console.log("├──────────────────┼──────────────┼──────────────┼──────────────┤");
  console.log("│ 开发成本         │ ⭐ 最低      │ ⭐⭐ 低       │ ⭐⭐⭐⭐⭐ 高 │");
  console.log("│ 灵活性           │ ⭐⭐ 中等     │ ⭐⭐⭐ 较高   │ ⭐⭐⭐⭐⭐ 最高│");
  console.log("│ 数据安全         │ ⭐⭐ 云端     │ ⭐⭐⭐⭐⭐私部  │ ⭐⭐⭐⭐⭐完控│");
  console.log("│ 扩展性           │ ⭐⭐⭐ 插件   │ ⭐⭐⭐⭐ API  │ ⭐⭐⭐⭐⭐无限│");
  console.log("│ 运维成本         │ ⭐ 零运维    │ ⭐⭐⭐ 需运维  │ ⭐⭐⭐⭐ 需运维│");
  console.log("│ 多模型支持       │ ⭐⭐⭐⭐ 丰富 │ ⭐⭐⭐⭐⭐ 最全│ ⭐⭐⭐⭐⭐ 自定│");
  console.log("│ 团队协作         │ ⭐⭐⭐⭐ 好   │ ⭐⭐⭐ 基础   │ ⭐⭐ 需自建   │");
  console.log("│ 发布渠道         │ ⭐⭐⭐⭐⭐ 多  │ ⭐⭐⭐ API   │ ⭐⭐ 需自建   │");
  console.log("└──────────────────┴──────────────┴──────────────┴──────────────┘");

  console.log("\n📌 Coze 独特优势:");
  console.log("  - 一键发布到微信、飞书、Discord、Telegram 等");
  console.log("  - 丰富的预置插件市场");
  console.log("  - 免费额度充足，适合个人和小团队");

  console.log("\n📌 Dify 独特优势:");
  console.log("  - 开源可私有部署，数据完全可控");
  console.log("  - 完善的 API 接口，适合集成到现有系统");
  console.log("  - 支持 Workflow 可视化编排");
  console.log("  - 社区活跃，更新频繁");

  console.log("\n📌 自研独特优势:");
  console.log("  - 完全的技术控制权");
  console.log("  - 可以实现任何定制化需求");
  console.log("  - 深度优化性能和成本");
  console.log("  - 与现有技术栈无缝集成");
}

// ============================================================
// 4. 架构解析
// ============================================================

function explainArchitecture(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 4. 平台架构解析 — 底层都是什么？");
  console.log("=".repeat(60));

  console.log("\n📌 揭秘: AI 应用平台的底层架构");
  console.log("  无论是 Coze 还是 Dify，底层都是我们学过的技术组合！\n");

  console.log("  ┌─────────────────────────────────────────────────────┐");
  console.log("  │                   AI 应用平台                       │");
  console.log("  ├─────────────────────────────────────────────────────┤");
  console.log("  │  可视化编排层（拖拽式 UI）                           │");
  console.log("  ├──────────┬──────────┬──────────┬────────────────────┤");
  console.log("  │ Prompt   │   RAG    │  Agent   │  Workflow Engine  │");
  console.log("  │ 提示词   │ 检索增强  │ 工具调用  │  工作流引擎       │");
  console.log("  │ Module03 │ Module04 │ Module06 │  Module06         │");
  console.log("  ├──────────┴──────────┴──────────┴────────────────────┤");
  console.log("  │  LLM 调用层（多模型适配）                            │");
  console.log("  │  Module 03 model-adapter.ts                        │");
  console.log("  ├─────────────────────────────────────────────────────┤");
  console.log("  │  基础设施（向量数据库、缓存、监控）                    │");
  console.log("  │  Module 04 VectorStore + Module 10 缓存/监控        │");
  console.log("  └─────────────────────────────────────────────────────┘");

  console.log("\n💡 关键洞察:");
  console.log("  学完 Module 01-10，你已经掌握了 AI 平台的所有核心技术！");
  console.log("  平台只是在这些技术上加了一层可视化 UI 和工程化封装。");
  console.log("  理解底层原理后，使用平台会更得心应手，需要时也能自研。");
}

// ============================================================
// 5. 适用场景分析
// ============================================================

function analyzeUseCases(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🎯 5. 适用场景分析");
  console.log("=".repeat(60));

  console.log("\n📌 何时选择 Coze？");
  console.log("  ✅ 快速验证 AI 产品想法（MVP）");
  console.log("  ✅ 非技术人员构建 AI 应用");
  console.log("  ✅ 需要发布到社交平台（微信、飞书等）");
  console.log("  ✅ 预算有限，需要免费方案");
  console.log("  ❌ 需要深度定制化");
  console.log("  ❌ 数据安全要求高（金融、医疗）");

  console.log("\n📌 何时选择 Dify？");
  console.log("  ✅ 企业级 AI 应用（需要私有部署）");
  console.log("  ✅ 需要完善的 API 接口对接现有系统");
  console.log("  ✅ 团队有基础的运维能力（Docker 部署）");
  console.log("  ✅ 需要灵活的工作流编排");
  console.log("  ❌ 无运维能力的小团队");
  console.log("  ❌ 需要极致的性能优化");

  console.log("\n📌 何时选择自研？");
  console.log("  ✅ 核心业务系统（不能依赖第三方）");
  console.log("  ✅ 需要极致的性能和成本优化");
  console.log("  ✅ 特殊的定制需求（平台无法满足）");
  console.log("  ✅ 团队有充足的技术能力和资源");
  console.log("  ❌ 预算和时间紧张");
  console.log("  ❌ 只需要简单的 AI 功能");

  console.log("\n📌 推荐策略（渐进式）:");
  console.log("  1. 🟢 用 Coze/Dify 快速验证想法（1-2天）");
  console.log("  2. 🟡 验证通过后，用 Dify API 集成到系统（1-2周）");
  console.log("  3. 🔴 核心功能自研，边缘功能继续用平台（持续迭代）");
}

// ============================================================
// 6. 与前序模块的知识映射
// ============================================================

function showKnowledgeMapping(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🗺️  6. 知识映射 — 平台功能 ↔ 自研模块");
  console.log("=".repeat(60));

  console.log("\n┌────────────────────┬─────────────────────────────────────────┐");
  console.log("│   平台功能         │         对应自研模块                     │");
  console.log("├────────────────────┼─────────────────────────────────────────┤");
  console.log("│ 对话应用           │ Module 02 (Next.js Chat)                │");
  console.log("│ 提示词模板         │ Module 03 (Prompt Engineering)           │");
  console.log("│ 知识库             │ Module 04 (RAG) + Module 11 (LlamaIndex)│");
  console.log("│ 工作流             │ Module 06 (StateGraph)                  │");
  console.log("│ 插件/工具          │ Module 06 (Agent) + Module 07 (MCP)     │");
  console.log("│ 多模型切换         │ Module 03 (model-adapter.ts)            │");
  console.log("│ 对话记忆           │ Module 05 (Memory) + Module 06 (Memory) │");
  console.log("│ 结构化输出         │ Module 03 (Zod structured output)       │");
  console.log("│ 多模态             │ Module 09 (Vision/Speech/Image)         │");
  console.log("│ 本地部署           │ Module 10 (Ollama)                      │");
  console.log("│ 模型微调           │ Module 12 (Fine-tuning)                 │");
  console.log("└────────────────────┴─────────────────────────────────────────┘");

  console.log("\n✅ 总结: 掌握了 Module 01-12，你已经理解了 AI 平台的全部底层技术！");
}

// ============================================================
// 主入口
// ============================================================

async function main(): Promise<void> {
  console.log("🚀 AI 应用平台核心概念");
  console.log("本教程对比分析主流 AI 平台，无需 API Key\n");

  explainPlatformOverview();
  explainThreePillars();
  compareFeatures();
  explainArchitecture();
  analyzeUseCases();
  showKnowledgeMapping();

  console.log("\n" + "=".repeat(60));
  console.log("🎓 概念教程完成！");
  console.log("=".repeat(60));
  console.log("📚 下一步:");
  console.log("  npm run dify-api  → Dify API 集成实战");
  console.log("  npm run coze-api  → Coze API 集成实战");
  console.log("  npm run platform-vs-custom → 平台 vs 自研对比");
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("platform-concepts.ts");

if (isMainModule) {
  main().catch(console.error);
}

export {
  explainPlatformOverview,
  explainThreePillars,
  compareFeatures,
  explainArchitecture,
  analyzeUseCases,
};
