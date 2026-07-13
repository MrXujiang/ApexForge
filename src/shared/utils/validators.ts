export function validatePrompt(prompt: string) {
  const normalized = prompt.trim();

  if (!normalized) {
    return '请输入模型描述。';
  }

  if (normalized.length > 2000) {
    return '模型描述不能超过 2000 个字符。';
  }

  return null;
}
