## 1. 系统与方法论
- **原子化样式框架**：Tailwind CSS（PostCSS 插件链），通过 `tailwind.config.js` 与 `postcss.config.js` 统一构建。
- **组件库**：基于 shadcn/ui（`components.json` 中 style=「new-york」，RSC=false，TSX=true），组件源码位于 `src/shared/components/`，通过 `@/shared/components` 别名引用。
- **变体引擎**：使用 `class-variance-authority`（cva）管理组件多态（variant/size），配合 `@/shared/utils/cn` 合并 className。
- **主题系统**：以 CSS 自定义属性（HSL）为设计令牌，在 `:root` 与 `.dark` 两套变量集中定义，Tailwind 通过 `hsl(var(--xxx))` 引用，实现亮/暗色切换。
- **3D 渲染主题**：`src/shared/styles/theme.ts` 提供模型渲染配色预设（mono、obsidian、champagne、midnight、ruby），与 UI 主题解耦。

## 2. 核心文件与包
- `tailwind.config.js` — Tailwind 扩展：颜色映射、圆角、字体族、阴影等。
- `postcss.config.js` — PostCSS 插件：tailwindcss + autoprefixer。
- `src/shared/styles/globals.css` — Tailwind 指令入口 + 全局 CSS 变量（light/dark）+ 基础 reset。
- `components.json` — shadcn/ui 配置：路径别名、baseColor=neutral、启用 cssVariables。
- `src/shared/styles/theme.ts` — 业务级 3D 模型主题预设常量。
- `src/shared/components/Button.tsx` / `Card.tsx` — 示例 shadcn 风格组件，展示 cva + cn 用法。

## 3. 架构与约定
- **令牌分层**：`globals.css` 中的 `--primary/--destructive/--border` 等 HSL 值即“设计令牌”，Tailwind 的 `colors.*` 仅做映射层，不直接写死色值。
- **Dark Mode 策略**：通过 `darkMode: ['class']` 与 `.dark` 类切换，所有语义色均通过 `var(--xxx)` 响应式变化。
- **组件样式组织**：每个 UI 组件独立 TSX 文件，内部用 cva 声明 variant/size，className 经 `cn()` 合并后注入；布局类由 Tailwind 原子类组合，避免额外 CSS 文件。
- **共享层隔离**：`src/shared/` 下 components、styles、utils、types 被 studio/viewer/templates/sandbox 四个模块复用，保证视觉一致性。
- **3D 主题与 UI 主题解耦**：`theme.ts` 的 `modelThemePresets` 用于 Three.js 材质着色，不影响 UI 的 HSL 令牌。

## 4. 开发者应遵循的规则
- **禁止硬编码色值**：UI 颜色一律使用 Tailwind 语义类（如 `bg-primary`、`text-muted-foreground`、`border-border`），新增颜色应在 `globals.css` 中补充 `--xxx` 并在 `tailwind.config.js` 中映射。
- **组件变体优先 cva**：可复用的交互组件必须用 `cva` 声明 variant/size，并通过 `VariantProps<typeof xxx>` 暴露类型。
- **className 合并**：始终通过 `cn(base, props.className)` 合并外部传入的类名，避免覆盖默认样式。
- **暗色适配**：新组件需验证在 `.dark` 下的可读性，必要时调整 `muted-foreground`、`border` 等令牌的使用比例。
- **3D 主题变更**：修改模型配色只动 `theme.ts` 的 `modelThemePresets`，不要混入 UI 令牌。
- **shadcn 组件生成**：新增 UI 组件建议通过 `npx shadcn add <name>` 生成，保持与现有 `components.json` 别名一致。