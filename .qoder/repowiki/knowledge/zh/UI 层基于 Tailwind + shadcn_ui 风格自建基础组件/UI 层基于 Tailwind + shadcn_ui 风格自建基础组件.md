---
kind: design
name: UI 层基于 Tailwind + shadcn/ui 风格自建基础组件
source: session
category: adr
---

# UI 层基于 Tailwind + shadcn/ui 风格自建基础组件

_来源：5d1eac0 → 1fe2b21 提交周期内记录的编码计划——内容为规划时意图，实现可能滞后或有出入。_

**状态：** accepted

## 背景
Studio 需要一套黑白灰主色调的基础 UI 组件（Button、Badge、Card、Textarea、Input），并要求图标体系统一、避免 emoji。

## 决策驱动
- 设计系统一致性
- 零运行时依赖
- 可定制性强

## 备选方案
- **Tailwind + 自实现 shadcn/ui 风格组件 + lucide-react 图标** — 优点：无额外运行时开销；样式完全可控；图标与主题一致
- **Ant Design / MUI 等完整组件库** _（已否决）_ — 优点：开箱即用；缺点：包体大、主题覆盖成本高；与黑白极简风格不一致

## 决策
通过 Tailwind 全局样式定义黑/白/灰阶主题，按 shadcn/ui 写法手写 Button、Badge、Card、Textarea、Input 等基础组件，并使用 lucide-react 作为唯一图标源。

## 影响
组件体积小、样式可控，但新增组件需自行维护；后续可通过引入 shadcn/cli 一键生成来降低重复劳动。