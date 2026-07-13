本仓库为 ApexForge 产品技术需求与设计文档，尚未包含实际代码实现。以下错误处理方案来自《product-technical-design.md》中多处章节的约定，属于架构设计阶段的规范定义：

1. **统一 API 错误响应结构**
   - 所有 HTTP 错误必须返回固定 JSON 结构，包含 `traceId`、`error.code`、`error.message`、`error.details` 字段。
   - 示例见文档第 641–652 行。

2. **任务级错误码与持久化**
   - `generation_tasks` 表保留 `errorCode`（string）和 `errorMessage`（text）字段，用于记录每次生成任务的失败原因，便于后续分析与告警。

3. **沙箱运行时错误分类**
   - 前端 iframe 执行层定义了五类错误码：`SANDBOX_TIMEOUT`、`SANDBOX_RUNTIME_ERROR`、`MODEL_JSON_INVALID`、`MODEL_TOO_COMPLEX`、`MODEL_EMPTY`，并对应明确的中文用户提示。

4. **SSE 事件中的错误状态**
   - 生成链路通过 SSE 推送 `failed` 等事件，客户端据此更新 UI 状态。

5. **可观测性关联**
   - 日志字段强制包含 `traceId`、`taskId`、`errorCode`、`status`，使错误可跨服务追踪。

6. **校验失败与自动修复**
   - 服务端校验失败时进入 `repairing` 状态，由 RepairService 尝试自动修复后重新验证；仍失败则标记 `failed`。

7. **测试覆盖要求**
   - 单元测试需覆盖 SandboxClient 超时与错误映射；集成测试需覆盖 API 鉴权、限流与错误响应；安全测试需覆盖恶意输入与沙箱逃逸场景。

由于仓库目前仅含 PRD/技术设计文档，以上均为“应遵循”的设计约定，尚未落地到具体代码文件。