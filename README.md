# LLM-Study
大语言模型学习实践案例


🗺️ 全栈开发者AI学习路线图
阶段一：AI基础认知（第1-2周）
目标： 建立对AI的核心概念理解，不急于动手
主题	内容	输出	大模型原理	Transformer架构、Token、上下文窗口	用自己的话画图解释	Prompt工程	角色设定、Few-shot、Chain-of-Thought	整理Prompt模板库	主流模型对比	GPT/Claude/Gemini/DeepSeek特点	选型决策表	AI应用形态	Chatbot、Copilot、Agent、Workflow	产品形态分类	
本周实践： 深度使用Claude/GPT，记录高质量Prompt案例

阶段二：AI开发入门（第3-4周）
目标： 调用API，构建第一个AI应用
主题	技术栈	项目	LLM API调用	OpenAI/Claude API、流式输出	智能聊天界面	前端AI组件	AI SDK、流式UI、思维链展示	类ChatGPT的Web界面	Embedding & 向量	文本向量化、相似度计算	简单语义搜索	Function Calling	工具调用、结构化输出	能查天气的AI助手	
本周实践： 用Next.js + AI SDK做一个支持工具调用的Chat界面

阶段三：RAG系统（第5-6周）
目标： 实现知识库问答系统
主题	关键技术	输出	RAG架构	检索-重排-生成流程	架构图	向量数据库	Pinecone/Milvus/Chroma选型	对比表格	文档处理	分块策略、PDF解析、元数据	文档处理Pipeline	高级RAG	多路召回、查询重写、重排序	优化后的搜索系统	本周实践： 搭建个人知识库问答系统，支持PDF/网页导入			

阶段四：AI Agent（第7-8周）
目标： 理解并构建能执行任务的Agent
主题	核心概念	实践	Agent架构	Planning、Memory、Tools、Action	拆解开源Agent代码	ReAct模式	推理-行动循环	实现简单ReAct Agent	MCP协议	工具调用标准化	开发MCP Server	Multi-Agent	多Agent协作、编排	尝试Coze/Dify框架	本周实践： 开发一个MCP Server（如GitHub操作工具），集成到Claude Code			

阶段五：AI工程化（第9-10周）
目标： 生产级AI应用开发
主题	关注点	技能	模型微调	LoRA、数据集准备、评估	小模型微调实验	成本优化	Token优化、缓存、模型路由	成本对比分析	可靠性	错误处理、Fallback、限流	鲁棒性设计	部署运维	推理服务、监控、A/B测试	Docker化部署	本周实践： 构建一个带成本控制的AI应用，含错误处理和监控			

阶段六：前沿探索（持续）
 ●多模态（图像/音频理解）
 ●AI代码生成工具（Cursor/Windsurf深度使用）
 ●本地模型部署（Ollama/LM Studio）
 ●AI安全与对齐




前端 AI 工程化	在 React/Vue 中接入 LLM、流式输出实现	
AI 辅助开发	Cursor/Copilot 实战、Prompt 工程技巧	
浏览器端 AI	WebLLM、Transformers.js 跑模型	
AI Agent 实践	用 JS/TS 构建 Agent、工具调用	
多模态 & 视觉	前端图像处理 + AI 结合	
RAG & 知识库	构建自己的 AI 知识问答系统	


第一阶段：打基础（1-2周）
1. 理解核心概念：LLM / Prompt / Tool Calling / RAG
2. 跑通 Vercel AI SDK + Next.js 的流式对话
3. 实现一个带工具调用的简单Agent
第二阶段：上手框架（2-3周）
1. LangChain.js 或 LangGraph —— 学Chain/Graph思维
2. 用 Dify/Flowise 可视化理解Agent结构
3. 实战：RAG知识库问答 / 搜索Agent
第三阶段：进阶实践（持续）
1. 多Agent协作（AutoGen/CrewAI）
2. Agent记忆（短期/长期Memory）
3. MCP协议（Model Context Protocol）—— 2026最热新标准


1. 先用 Vercel AI SDK —— 最低成本上手，直接在Next.js里跑
2. 再学 LangGraph —— 理解Agent工作流的本质
3. 了解 MCP协议 —— 这是AI工具调用的新标准，趋势很猛
其实你现在用的 OpenClaw 本身就是一个Agent系统，它用的就是MCP协议（mcporter就是MCP客户端）。你每天都在和Agent交互，理解起来会更直观 😄