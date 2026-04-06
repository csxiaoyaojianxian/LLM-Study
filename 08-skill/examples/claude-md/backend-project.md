# CLAUDE.md — 后端项目模板

> 本文件为 Claude Code 提供项目上下文，帮助 AI 更好地理解和操作本项目。

## 项目概述

这是一个基于 Node.js/Express 的后端 API 服务。

## 技术栈

- **运行时**: Node.js 20 LTS
- **框架**: Express / Fastify / NestJS
- **语言**: TypeScript 5
- **数据库**: PostgreSQL + Prisma ORM
- **缓存**: Redis
- **消息队列**: Bull / BullMQ
- **测试**: Jest + Supertest

## 开发命令

```bash
npm run dev       # 开发模式（热重载）
npm run build     # TypeScript 编译
npm run start     # 生产模式
npm run test      # 运行测试
npm run migrate   # 数据库迁移
npm run seed      # 数据库填充
```

## 项目结构

```
src/
├── controllers/    # 请求处理器
├── services/       # 业务逻辑层
├── models/         # 数据模型
├── middleware/      # 中间件
├── routes/         # 路由定义
├── utils/          # 工具函数
├── config/         # 配置管理
└── types/          # TypeScript 类型
```

## 编码规范

- 遵循三层架构: Controller → Service → Repository
- 所有接口使用 TypeScript 类型定义
- 错误处理统一通过错误中间件
- 数据校验使用 Zod schema
- 日志使用 winston/pino，不要使用 console.log

## API 规范

- RESTful 风格，使用 HTTP 动词
- 响应格式: `{ code: number, data: T, message: string }`
- 分页: `?page=1&pageSize=20`
- 认证: Bearer Token in Authorization header

## 注意事项

- 不要直接操作数据库，通过 Prisma Client
- 敏感配置通过环境变量，不要硬编码
- 所有异步操作需要错误处理
- SQL 查询必须参数化，防止注入
