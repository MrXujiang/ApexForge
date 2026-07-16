---
kind: design
name: 生成管线先本地模拟，再对接 /api/v1/generations
source: session
category: adr
---

# 生成管线先本地模拟，再对接 /api/v1/generations

_来源：5d1eac0 → 1fe2b21 提交周期内记录的编码计划——内容为规划时意图，实现可能滞后或有出入。_

**状态：** accepted

## 背景
MVP 前端需要可运行的 Studio 体验，而后端 API 尚未就绪，需在前后端之间建立清晰的契约边界。

## 决策驱动
- 前后端并行开发
- 接口契约先行
- 最小改动完成后端接入

## 备选方案
- **本地生成服务 + SandboxClient 抽象 + 预留 /api/v1/generations 调用点** — 优点：前端可独立运行；后端完成后只需替换实现
- **直接硬编码 fetch 到后端** _（已否决）_ — 优点：简单；缺点：后端未就绪时前端不可用；后期重构成本高

## 决策
在前端定义 Generation 相关 TypeScript 类型与本地生成服务，并通过 SandboxClient 抽象错误映射，后续以最小改动替换为对 `/api/v1/generations` 的真实 HTTP 调用。

## 影响
前端可独立联调与演示；后端上线后仅需替换客户端实现，不影响页面与状态管理。