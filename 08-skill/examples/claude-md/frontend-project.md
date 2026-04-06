# CLAUDE.md — 前端项目模板

> 本文件为 Claude Code 提供项目上下文，帮助 AI 更好地理解和操作本项目。

## 项目概述

这是一个基于 React/Next.js 的前端项目。

## 技术栈

- **框架**: React 18 / Next.js 14 (App Router)
- **语言**: TypeScript 5
- **样式**: Tailwind CSS / CSS Modules
- **状态管理**: Zustand / React Context
- **数据请求**: SWR / React Query
- **测试**: Vitest + Testing Library

## 开发命令

```bash
npm run dev       # 开发服务器
npm run build     # 生产构建
npm run lint      # ESLint 检查
npm run test      # 运行测试
npm run test:e2e  # E2E 测试
```

## 项目结构

```
src/
├── app/              # Next.js App Router 页面
├── components/       # React 组件
│   ├── ui/          # 基础 UI 组件
│   └── features/    # 业务功能组件
├── hooks/           # 自定义 Hooks
├── lib/             # 工具函数
├── styles/          # 全局样式
└── types/           # TypeScript 类型定义
```

## 编码规范

- 组件使用函数式组件 + Hooks
- 命名: 组件 PascalCase，函数 camelCase，常量 UPPER_SNAKE_CASE
- 文件: 组件文件与组件同名，工具函数使用 kebab-case
- 每个组件目录包含: index.tsx, styles.module.css, types.ts
- 使用 `'use client'` 标记客户端组件

## 注意事项

- 不要修改 `next.config.js` 除非明确要求
- 所有 API 调用通过 `/api` 路由代理
- 图片资源放在 `public/` 目录
- 环境变量以 `NEXT_PUBLIC_` 前缀暴露给客户端
