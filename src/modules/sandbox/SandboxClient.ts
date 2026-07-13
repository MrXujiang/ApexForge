import { mapSandboxError } from '@/modules/sandbox/errorMapper';

export interface SandboxExecuteRequest {
  code: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface SandboxExecuteResult {
  executionId: string;
  modelJson: unknown;
}

export class SandboxClient {
  async execute(_request: SandboxExecuteRequest): Promise<SandboxExecuteResult> {
    throw new Error(mapSandboxError('SANDBOX_RUNTIME_ERROR'));
  }
}
