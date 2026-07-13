本仓库为 ApexForge 产品技术需求与设计文档，尚未包含实际后端/前端代码实现。关于日志系统的信息全部来自 `tech/product-technical-design.md` 中的架构与可观测性章节，属于“规划阶段”的设计约定，而非已落地的代码规范。

1. 使用的系统与工具
- 推荐在平台化阶段采用 **Pino**（NestJS 生态内高性能结构化日志）+ **OpenTelemetry**（链路追踪、指标上报）组合。
- MVP 阶段以 traceId 贯穿请求链路，记录关键状态和耗时；Beta/Scale 阶段接入 Prometheus/Grafana 做指标与告警。

2. 核心文件与位置
- 设计约定集中在 `tech/product-technical-design.md` 第 15 章「可观测性设计」及第 3 章「技术选型建议」。
- 目录结构规划中预留 `apps/api/src/modules/observability` 模块，用于集中承载日志、指标、trace 相关逻辑。

3. 架构与约定
- 全链路 traceId：每个生成请求创建 `traceId`，贯穿前端 → API Gateway → Generation Service → LLM Adapter → Validator → DB → Sandbox execution，并在所有日志中附带该字段。
- 结构化日志字段：统一要求包含 `traceId`、`userId`、`workspaceId`、`taskId`、`provider`、`promptVersion`、`generationMode`、`latencyMs`、`status`、`errorCode`、`qualityScore` 等，便于按任务维度聚合分析。
- 安全脱敏：敏感日志需脱敏，禁止记录完整密钥和鉴权头。
- 告警规则：围绕生成失败率、LLM 延迟 P95、校验失败突增、沙箱超时突增、API 错误率等定义阈值告警。
- 质量闭环：保存 `ValidationReport` 与 `QualityScore`，将日志与评估数据关联，驱动 Prompt/模板优化与回归测试。

4. 开发者应遵循的规则
- 所有服务层调用必须携带并透传 `traceId`，禁止使用裸 `console.log` / `print` 输出。
- 日志必须结构化，至少包含上述标准字段，避免纯文本拼接。
- 对 LLM 调用、AST 校验、沙箱执行等关键路径记录 `latencyMs`、`status`、`errorCode`，以便定位瓶颈与失败原因。
- 进入 Beta/Scale 后，通过 ObservabilityModule 统一接入 Pino 与 OpenTelemetry，不再在各模块自行初始化 logger。
- 任何涉及用户输入、模型代码、Prompt 的日志必须做脱敏处理，不得泄露密钥或鉴权头。
- 结合告警规则，对异常比率与延迟指标设置自动告警，确保问题早发现早定位。