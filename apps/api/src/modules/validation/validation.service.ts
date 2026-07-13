import { Injectable } from '@nestjs/common';

const blockedPatterns = [
  'eval',
  'Function',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'document',
  'window.top',
  'window.parent',
  'localStorage',
  'sessionStorage',
  'importScripts',
  'require',
  '__proto__',
];

@Injectable()
export class ValidationService {
  validatePrompt(prompt: string) {
    const normalized = prompt.trim();
    const blockedReasons: string[] = [];

    if (!normalized) {
      blockedReasons.push('PROMPT_EMPTY');
    }

    if (normalized.length > 2000) {
      blockedReasons.push('PROMPT_TOO_LONG');
    }

    return {
      passed: blockedReasons.length === 0,
      blockedReasons,
      warnings: normalized.length > 1000 ? ['PROMPT_LONG_TEXT'] : [],
      complexity: {
        promptLength: normalized.length,
        estimatedRisk: blockedReasons.length > 0 ? 'high' : 'low',
      },
    };
  }

  validateCode(code: string) {
    const blockedReasons = blockedPatterns.filter((pattern) => code.includes(pattern));

    return {
      passed: blockedReasons.length === 0,
      blockedReasons,
      warnings: code.length > 12000 ? ['CODE_SIZE_WARNING'] : [],
      complexity: {
        codeLength: code.length,
        estimatedMeshLimit: 80,
      },
      astSummary: {
        strategy: 'keyword-scan-mvp',
      },
    };
  }
}
