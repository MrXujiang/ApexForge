# AI 生成引擎

<cite>
**本文引用的文件**   
- [prd.md](file://prd.md)
- [product-technical-design.md](file://tech/product-technical-design.md)
</cite>

## 目录
1. [引言](#引言)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录](#附录)

## 引言
本文件面向 ApexForge 的 AI 生成引擎，聚焦多模式生成（模板、代码、混合）的实现原理与工程落地。内容涵盖 Prompt 编排策略、多供应商 LLM 适配器设计、生成质量控制与缓存机制、生成链路状态机流转、Prompt 版本管理、输出协议规范、错误处理策略，以及与前后端各模块的关系。文档同时提供来自仓库技术设计文档的具体示例路径，帮助初学者快速上手，并为有经验的开发者提供深入的技术细节。

## 项目结构
当前仓库包含产品需求与技术设计文档，用于定义平台级 AI 生成 3D 模型系统的目标、架构、数据模型、接口契约与安全策略等。MVP 阶段采用单体后端加模块化代码结构，后续演进为服务化架构；前端基于 React + Three.js，服务端使用 NestJS，数据库从 SQLite 平滑迁移到 PostgreSQL。

```mermaid
graph TB
subgraph "文档"
PRD["prd.md"]
TDD["tech/product-technical-design.md"]
end
PRD --> TDD
```

图表来源
- [prd.md:1-168](file://prd.md#L1-L168)
- [product-technical-design.md:1-120](file://tech/product-technical-design.md#L1-L120)

章节来源
- [prd.md:1-168](file://prd.md#L1-L168)
- [product-technical-design.md:1-120](file://tech/product-technical-design.md#L1-L120)

## 核心组件
AI 生成引擎由以下关键组件构成：
- 生成路由与编排：负责选择生成模式（模板/代码/混合）、构建 Prompt、协调缓存与 LLM 调用。
- 多供应商 LLM 适配器：统一抽象不同大模型的调用接口，支持失败重试与降级。
- 校验器与修复器：对输出进行协议校验、黑名单扫描、AST 白名单检查，必要时触发自动修复。
- 质量评分器：从可渲染性、匹配度、结构完整性、性能表现、可编辑性等维度评估结果。
- 沙箱执行器：在 iframe 中隔离执行生成的代码，返回序列化模型数据。
- 模板系统：分层模板（骨架、风格变体、细节包、材质预设），参数 Schema 驱动渲染。
- 缓存层：相似 Prompt 向量相似度命中直接复用结果，降低 LLM 成本与延迟。
- 任务队列与持久化：记录任务状态、Prompt 版本、校验报告、质量评分与资产版本。

章节来源
- [product-technical-design.md:327-426](file://tech/product-technical-design.md#L327-L426)
- [product-technical-design.md:428-518](file://tech/product-technical-design.md#L428-L518)
- [product-technical-design.md:594-630](file://tech/product-technical-design.md#L594-L630)
- [product-technical-design.md:760-804](file://tech/product-technical-design.md#L760-L804)
- [product-technical-design.md:807-841](file://tech/product-technical-design.md#L807-L841)

## 架构总览
整体逻辑架构将前端 Studio、API 网关、生成服务、模板服务、LLM 适配、校验与评分、数据库与缓存串联起来，形成端到端的生成流水线。

```mermaid
graph TB
U["用户"] --> FE["ApexForge Studio"]
FE --> API["API Gateway"]
API --> GEN["Model Generation Service"]
API --> ASSET["Asset Service"]
API --> TEMPLATE["Template Service"]
GEN --> PROMPT["Prompt Orchestrator"]
GEN --> LLM["LLM Adapter"]
GEN --> VALIDATOR["Code Validator"]
GEN --> SCORE["Quality Scorer"]
LLM --> P1["DeepSeek"]
LLM --> P2["Qwen"]
LLM --> P3["Other Models"]
FE --> SANDBOX["Sandbox iframe"]
SANDBOX --> RENDER["Three.js Renderer"]
ASSET --> DB["Database"]
TEMPLATE --> DB
GEN --> DB
GEN --> CACHE["Cache"]
GEN --> QUEUE["Task Queue"]
API --> OBS["Observability"]
GEN --> OBS
```

图表来源
- [product-technical-design.md:38-62](file://tech/product-technical-design.md#L38-L62)

章节来源
- [product-technical-design.md:38-62](file://tech/product-technical-design.md#L38-L62)

## 详细组件分析

### 多模式生成与 Prompt 编排
- 生成模式优先级：缓存命中优先，其次模板模式，再次混合模式，最后代码模式。
- Prompt 编排要点：
  - System Prompt 明确角色、约束与输出协议。
  - Few-shot 示例提升稳定性。
  - 根据模式动态注入模板摘要或编码规范。
- 输出协议：统一 JSON 结构，包含 mode、templateId、params、code、explanation、warnings 等字段。
- Prompt 版本管理：每次生成记录 promptVersion，便于回滚与回归测试。

```mermaid
flowchart TD
Start(["开始"]) --> ModeSelect["选择生成模式<br/>缓存/模板/混合/代码"]
ModeSelect --> CacheCheck{"是否命中相似 Prompt?"}
CacheCheck --> |是| ReturnCached["返回缓存结果"]
CacheCheck --> |否| BuildPrompt["构建 Prompt<br/>System + 上下文 + 示例"]
BuildPrompt --> CallLLM["调用 LLM 适配器"]
CallLLM --> ParseOutput["解析输出协议"]
ParseOutput --> Validate["安全与复杂度校验"]
Validate --> Score["质量评分"]
Score --> Persist["持久化任务与结果"]
Persist --> End(["结束"])
```

图表来源
- [product-technical-design.md:327-426](file://tech/product-technical-design.md#L327-L426)

章节来源
- [product-technical-design.md:327-426](file://tech/product-technical-design.md#L327-L426)

### 多供应商 LLM 适配器设计
- 统一接口：provider、generate、可选 stream。
- 选择策略：按任务类型、成本与响应速度选择供应商；支持失败重试与降级。
- 观测指标：token 用量、耗时、错误码、输出质量。

```mermaid
classDiagram
class LlmAdapter {
+string provider
+generate(request) Promise~LlmGenerateResponse~
+stream?(request) AsyncIterable~LlmStreamChunk~
}
class DeepSeekAdapter
class QwenAdapter
class OtherModelsAdapter
LlmAdapter <|.. DeepSeekAdapter
LlmAdapter <|.. QwenAdapter
LlmAdapter <|.. OtherModelsAdapter
```

图表来源
- [product-technical-design.md:611-630](file://tech/product-technical-design.md#L611-L630)

章节来源
- [product-technical-design.md:611-630](file://tech/product-technical-design.md#L611-L630)

### 生成质量控制与质量评分体系
- 评分维度：可渲染性、Prompt 匹配度、结构完整性、性能表现、可编辑性。
- 自动评分输入：模式与模板命中、AST 校验结果、几何体数量、顶点数、材质数、沙箱执行成功与否、边界盒尺寸、空模型检测、用户反馈与保存行为。
- 质量闭环：评分结果驱动 Prompt 优化、模板优化与回归数据集建设。

```mermaid
graph TD
G["生成结果"] --> S["质量评分"]
S --> F["用户反馈"]
F --> A["分析"]
A --> P["Prompt 优化"]
A --> T["模板优化"]
A --> R["回归数据集"]
R --> E["评估"]
E --> G
```

图表来源
- [product-technical-design.md:807-841](file://tech/product-technical-design.md#L807-L841)

章节来源
- [product-technical-design.md:807-841](file://tech/product-technical-design.md#L807-L841)

### 缓存机制与相似 Prompt 复用
- 缓存键：归一化 Prompt 的向量表示。
- 阈值：相似度大于阈值时直接复用结果。
- 收益：显著降低 LLM 调用成本与延迟，提高批量变体生成效率。

章节来源
- [product-technical-design.md:327-339](file://tech/product-technical-design.md#L327-L339)
- [product-technical-design.md:944-951](file://tech/product-technical-design.md#L944-L951)

### 生成链路的状态机流转
- 状态：queued、generating、validating、renderable、repairing、failed、retrying、saved、discarded。
- 流转：生成后进入校验，失败可修复并重试，最终保存或丢弃。

```mermaid
stateDiagram-v2
[*] --> queued
queued --> generating
generating --> validating
validating --> renderable
validating --> repairing
repairing --> validating
validating --> failed
renderable --> saved
renderable --> discarded
failed --> retrying
retrying --> generating
saved --> [*]
discarded --> [*]
```

图表来源
- [product-technical-design.md:342-357](file://tech/product-technical-design.md#L342-L357)

章节来源
- [product-technical-design.md:342-357](file://tech/product-technical-design.md#L342-L357)

### Prompt 版本管理与输出协议规范
- 版本管理：每次生成记录 promptVersion，System Prompt、Few-shot 示例、模板摘要均版本化，支持快速回滚。
- 输出协议：统一 JSON 结构，包含 mode、templateId、params、code、explanation、warnings 等字段，确保下游解析一致。

章节来源
- [product-technical-design.md:419-426](file://tech/product-technical-design.md#L419-L426)
- [product-technical-design.md:403-418](file://tech/product-technical-design.md#L403-L418)

### 代码安全校验与 AST 白名单
- 校验分层：输出协议校验、文本黑名单、AST 白名单、运行时沙箱、超时销毁、结果校验。
- 黑名单 API：动态执行、网络访问、DOM 访问、动态加载、原型污染、计算风险。
- 白名单策略：允许基础语法、Math 白名单方法、THREE 白名单构造器与安全方法；限制代码长度、AST 深度、循环层数、Mesh 数量与顶点估算。

章节来源
- [product-technical-design.md:428-470](file://tech/product-technical-design.md#L428-L470)

### 沙箱运行时设计与执行流程
- 方案：隐藏 iframe 完全隔离，CSP 限制脚本来源，sandbox 属性控制权限。
- 执行流程：主线程发送 execute 指令，iframe 包装并执行 buildModel(params, THREE)，成功后 group.toJSON() 返回结构化 JSON，主线程用 ObjectLoader 反序列化并挂载。
- 错误分类：超时、运行时报错、模型 JSON 非法、模型过于复杂、未生成有效对象。

```mermaid
sequenceDiagram
participant FE as "前端主线程"
participant IF as "沙箱 iframe"
participant RT as "Three.js Runtime"
FE->>IF : "postMessage execute(code, params)"
IF->>RT : "执行 buildModel(params, THREE)"
RT-->>IF : "group 对象"
IF->>IF : "group.toJSON()"
IF-->>FE : "postMessage result(JSON)"
FE->>FE : "THREE.ObjectLoader 反序列化并挂载"
```

图表来源
- [product-technical-design.md:478-507](file://tech/product-technical-design.md#L478-L507)

章节来源
- [product-technical-design.md:478-518](file://tech/product-technical-design.md#L478-L518)

### 模板系统与程序化建模
- 模板分层：Skeleton（骨架）、Style Variant（风格变体）、Detail Pack（细节包）、Material Preset（材质预设）、Param Schema（参数 Schema）。
- 匹配策略：类别识别与关键词抽取、标签与向量检索候选模板、LLM 选择最匹配模板并生成参数；置信度低则切换 Hybrid 或 Code Mode。
- 渲染函数：renderer 接收 params 与 THREE，返回 Group 或序列化数据。

```mermaid
flowchart TD
Input["用户 Prompt"] --> Classify["类别识别与关键词抽取"]
Classify --> Retrieve["标签与向量检索候选模板"]
Retrieve --> Select["LLM 选择最匹配模板"]
Select --> Params["生成参数对象"]
Params --> Render["renderer(params, THREE)"]
Render --> Output["Group / 序列化 JSON"]
```

图表来源
- [product-technical-design.md:760-804](file://tech/product-technical-design.md#L760-L804)

章节来源
- [product-technical-design.md:760-804](file://tech/product-technical-design.md#L760-L804)

### 完整时序与 API 交互
- 创建生成任务：POST /api/v1/generations，请求包含 projectId、prompt、category、mode、contextVersionId、preferences。
- 查询生成任务：GET /api/v1/generations/{taskId}。
- 保存为资产：POST /api/v1/assets。
- SSE 事件：/api/v1/generations/{taskId}/events，推送 queued、generating、validating、repairing、renderable、failed。

```mermaid
sequenceDiagram
participant FE as "前端"
participant API as "API 网关"
participant GEN as "生成服务"
participant CACHE as "缓存"
participant TPL as "模板服务"
participant LLM as "LLM 适配器"
participant VAL as "校验器"
participant DB as "数据库"
FE->>API : "POST /api/v1/generations"
API->>GEN : "createGenerationTask"
GEN->>CACHE : "querySimilarPrompt"
alt "缓存命中"
CACHE-->>GEN : "cached result"
else "缓存未命中"
GEN->>TPL : "findCandidateTemplate"
TPL-->>GEN : "template candidates"
GEN->>LLM : "generate code or params"
LLM-->>GEN : "generated output"
GEN->>VAL : "validate output"
VAL-->>GEN : "validation report"
end
GEN->>DB : "persist task and result"
GEN-->>API : "result"
API-->>FE : "generation payload"
```

图表来源
- [product-technical-design.md:361-390](file://tech/product-technical-design.md#L361-L390)

章节来源
- [product-technical-design.md:632-757](file://tech/product-technical-design.md#L632-L757)
- [product-technical-design.md:361-390](file://tech/product-technical-design.md#L361-L390)

## 依赖关系分析
- 生成服务依赖缓存、模板服务、LLM 适配器、校验器、评分器与数据库。
- 前端依赖沙箱 iframe 与 Three.js 渲染器。
- 模板服务与数据库关联，存储模板与版本信息。
- 可观测性贯穿全链路，记录 traceId、耗时、状态与错误码。

```mermaid
graph TB
GEN["生成服务"] --> CACHE["缓存"]
GEN --> TPL["模板服务"]
GEN --> LLM["LLM 适配器"]
GEN --> VAL["校验器"]
GEN --> SCORE["质量评分器"]
GEN --> DB["数据库"]
FE["前端"] --> SANDBOX["沙箱 iframe"]
SANDBOX --> RENDER["Three.js 渲染器"]
API["API 网关"] --> GEN
API --> OBS["可观测性"]
GEN --> OBS
```

图表来源
- [product-technical-design.md:38-62](file://tech/product-technical-design.md#L38-L62)

章节来源
- [product-technical-design.md:38-62](file://tech/product-technical-design.md#L38-L62)

## 性能考量
- 前端优化：按需加载 Three.js runtime、Worker 解析大模型 JSON、InstancedMesh 批量渲染、旧模型释放 geometry/material/texture、LOD 与相机状态解耦。
- 后端优化：相似 Prompt 缓存、模板模式跳过 LLM 代码生成、异步任务队列、供应商并发与熔断、热门模板与 Schema 缓存。
- 数据库优化：索引 traceId/workspaceId/createdAt、大字段迁移至对象存储、历史任务归档。

章节来源
- [product-technical-design.md:933-958](file://tech/product-technical-design.md#L933-L958)

## 故障排查指南
- 常见错误码与提示：
  - SANDBOX_TIMEOUT：执行超时，建议降低复杂度或使用模板模式。
  - SANDBOX_RUNTIME_ERROR：运行时报错，可重试或调整 Prompt。
  - MODEL_JSON_INVALID：返回结构非法，系统将重新生成。
  - MODEL_TOO_COMPLEX：模型复杂度超限，请降低细节或使用模板模式。
  - MODEL_EMPTY：未生成有效对象，补充描述主体。
- 日志与追踪：每个请求携带 traceId，记录 userId、workspaceId、taskId、provider、promptVersion、generationMode、latencyMs、status、errorCode、qualityScore。
- 告警规则：生成失败率过高、LLM 延迟过高、校验失败突增、沙箱超时突增、API 错误率过高。

章节来源
- [product-technical-design.md:508-518](file://tech/product-technical-design.md#L508-L518)
- [product-technical-design.md:882-907](file://tech/product-technical-design.md#L882-L907)

## 结论
ApexForge 的 AI 生成引擎以“模板优先、代码为辅”的策略实现稳定可控的程序化建模。通过统一的 Prompt 编排、多供应商 LLM 适配器、严格的安全校验与质量评分体系，以及高效的缓存与沙箱执行机制，系统在灵活性与安全性之间取得平衡。结合完整的状态机流转、版本管理与可观测性设计，平台具备从 MVP 到企业级部署的演进能力。

## 附录

### 配置选项与参数参考
- 生成模式：auto/template/code/hybrid/cache。
- 偏好设置：style、quality。
- 上下文版本：contextVersionId。
- 模板参数：依据 Param Schema 动态生成表单，支持默认值与范围校验。

章节来源
- [product-technical-design.md:654-695](file://tech/product-technical-design.md#L654-L695)
- [product-technical-design.md:760-785](file://tech/product-technical-design.md#L760-L785)

### 与其他组件的关系
- 前端 Studio：负责 Prompt 输入、历史展示、沙箱执行与渲染。
- API 网关：鉴权、限流、路由。
- 资产服务：保存模型资产与版本。
- 模板服务：管理模板与版本，提供匹配与渲染。
- 可观测性：记录全链路指标与告警。

章节来源
- [product-technical-design.md:38-62](file://tech/product-technical-design.md#L38-L62)
- [product-technical-design.md:574-593](file://tech/product-technical-design.md#L574-L593)