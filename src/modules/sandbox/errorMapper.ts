export type SandboxErrorCode = 'SANDBOX_TIMEOUT' | 'SANDBOX_RUNTIME_ERROR' | 'MODEL_JSON_INVALID';

export function mapSandboxError(code: SandboxErrorCode) {
  const messages: Record<SandboxErrorCode, string> = {
    SANDBOX_TIMEOUT: '模型执行超时，已安全终止。',
    SANDBOX_RUNTIME_ERROR: '生成代码执行失败，请重试或降低复杂度。',
    MODEL_JSON_INVALID: '模型数据结构无效，无法加载到场景。',
  };

  return messages[code];
}
