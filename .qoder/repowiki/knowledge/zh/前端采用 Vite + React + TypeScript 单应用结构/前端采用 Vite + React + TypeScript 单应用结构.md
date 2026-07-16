---
kind: design
name: 前端采用 Vite + React + TypeScript 单应用结构
source: session
category: adr
---

# 前端采用 Vite + React + TypeScript 单应用结构

_来源：5d1eac0 → 1fe2b21 提交周期内记录的编码计划——内容为规划时意图，实现可能滞后或有出入。_

**状态：** accepted

## 背景
ApexForge 需要从零搭建 Web 前端，作为 Studio MVP 的载体，同时为未来可能的多应用 monorepo 演进预留空间。

## 决策驱动
- 快速启动与热更新体验
- 类型安全
- 未来向 apps/web monorepo 迁移的可扩展性

## 备选方案
- **Vite + React + TypeScript 单应用（src/）** — 优点：构建快、生态成熟、TS 支持好；保留未来拆分到 apps/web 的目录边界
- **Next.js 全栈框架** _（已否决）_ — 优点：SSR/路由内置；缺点：MVP 阶段不需要 SSR；与现有 Python 后端部署模型耦合更深

## 决策
在仓库根目录初始化 Vite + React + TypeScript 工程，使用 src/ 单应用布局，并在 package.json 和 tsconfig 中预留未来迁移至 apps/web monorepo 的模块边界。

## 影响
MVP 阶段构建与开发体验良好；后续若拆出多个前端应用，只需将 src/ 下代码平移至 apps/web 并调整路径别名，无需重构业务逻辑。