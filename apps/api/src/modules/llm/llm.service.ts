import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiGenerationIntent {
  category: string;
  bodyColor: string;
  accentColor: string;
  secondaryColor: string;
  scale: number;
  detailLevel: number;
  complexity: number;
  panelDensity: number;
  materialPreset: string;
  silhouette: string;
  style: string;
  explanation: string;
}

const fallbackIntent: AiGenerationIntent = {
  category: 'product',
  bodyColor: '#f5f5f5',
  accentColor: '#111111',
  secondaryColor: '#8a8a8a',
  scale: 1,
  detailLevel: 4,
  complexity: 4,
  panelDensity: 4,
  materialPreset: 'brushed-metal',
  silhouette: 'technical-premium',
  style: 'commercial-cad',
  explanation: '使用商业级本地模板参数生成模型。',
};

function extractJson(content: string) {
  const fenced = content.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }

  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return content.slice(first, last + 1);
  }

  return content;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value ?? fallback);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function normalizeIntent(value: Partial<AiGenerationIntent>, category: string): AiGenerationIntent {
  return {
    ...fallbackIntent,
    ...value,
    category,
    bodyColor: typeof value.bodyColor === 'string' ? value.bodyColor : fallbackIntent.bodyColor,
    accentColor: typeof value.accentColor === 'string' ? value.accentColor : fallbackIntent.accentColor,
    secondaryColor: typeof value.secondaryColor === 'string' ? value.secondaryColor : fallbackIntent.secondaryColor,
    scale: clampNumber(value.scale, fallbackIntent.scale, 0.7, 1.4),
    detailLevel: Math.round(clampNumber(value.detailLevel, fallbackIntent.detailLevel, 1, 5)),
    complexity: Math.round(clampNumber(value.complexity, fallbackIntent.complexity, 1, 5)),
    panelDensity: Math.round(clampNumber(value.panelDensity, fallbackIntent.panelDensity, 1, 5)),
    materialPreset: typeof value.materialPreset === 'string' ? value.materialPreset : fallbackIntent.materialPreset,
    silhouette: typeof value.silhouette === 'string' ? value.silhouette : fallbackIntent.silhouette,
    style: typeof value.style === 'string' ? value.style : fallbackIntent.style,
    explanation: typeof value.explanation === 'string' ? value.explanation : fallbackIntent.explanation,
  };
}

type LlmProvider = 'deepseek' | 'kimi' | 'qwen';

function normalizeProvider(provider?: string): LlmProvider {
  if (provider === 'kimi' || provider === 'qwen') {
    return provider;
  }

  return 'deepseek';
}

function resolveProviderConfig(configService: ConfigService, provider: LlmProvider) {
  if (provider === 'kimi') {
    return {
      label: 'Kimi',
      keyName: 'KIMI_API_KEY',
      apiKey: configService.get<string>('KIMI_API_KEY'),
      baseUrl: configService.get<string>('KIMI_BASE_URL') ?? 'https://api.moonshot.cn/v1',
      model: configService.get<string>('KIMI_MODEL') ?? 'moonshot-v1-8k',
    };
  }

  if (provider === 'qwen') {
    return {
      label: '千问',
      keyName: 'QWEN_API_KEY',
      apiKey: configService.get<string>('QWEN_API_KEY'),
      baseUrl: configService.get<string>('QWEN_BASE_URL') ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: configService.get<string>('QWEN_MODEL') ?? 'qwen-plus',
    };
  }

  return {
    label: 'DeepSeek',
    keyName: 'DEEPSEEK_API_KEY',
    apiKey: configService.get<string>('DEEPSEEK_API_KEY'),
    baseUrl: configService.get<string>('DEEPSEEK_BASE_URL') ?? 'https://api.deepseek.com',
    model: configService.get<string>('DEEPSEEK_MODEL') ?? 'deepseek-chat',
  };
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateIntent(prompt: string, category: string, provider = 'deepseek', apiKeyOverride?: string): Promise<AiGenerationIntent> {
    const normalizedProvider = normalizeProvider(provider);
    const providerConfig = resolveProviderConfig(this.configService, normalizedProvider);
    const apiKey = apiKeyOverride?.trim() || providerConfig.apiKey;

    if (!apiKey) {
      throw new BadRequestException(`未配置 ${providerConfig.label} API Key，请在左侧在线模型配置中填写，或在项目根目录 .env 中设置 ${providerConfig.keyName}。`);
    }

    try {
      const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: providerConfig.model,
          temperature: 0.68,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                '你是ApexForge的商业级AI CAD建模参数生成器。只返回JSON对象，不要返回Markdown。字段必须包含 bodyColor, accentColor, secondaryColor, scale, detailLevel, complexity, panelDensity, materialPreset, silhouette, style, explanation。颜色必须是十六进制。scale范围0.7到1.4，detailLevel、complexity、panelDensity范围1到5。materialPreset可取 matte-polymer、brushed-metal、anodized-metal、ceramic、carbon-fiber、glass。silhouette描述模型轮廓，例如 sleek、robust、aerodynamic、modular、luxury、industrial。目标物体可能是任意产品，不要把未知目标改写成汽车；如果用户要求镜子，必须围绕镜面、边框、支架、背板、灯带、反射材质和安装结构规划参数，不要生成收音机或通用盒体。每次请求都可能包含变体种子，请基于种子给出不同的比例、材质和细节密度。优先生成可商业展示的硬表面结构、分层部件、面板线、功能细节和制造感，不要生成品牌、商标或侵权内容。',
            },
            {
              role: 'user',
              content: `模型类别: ${category}\n用户需求: ${prompt}\n目标: 输出更接近商业产品展示的CAD硬表面模型参数，避免过于简单的概念块状体。`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`${providerConfig.label} request failed: ${response.status} ${errorText.slice(0, 160)}`);
        throw new BadRequestException(`${providerConfig.label} 请求失败，请检查 ${providerConfig.keyName}、模型名称或网络配置。`);
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(extractJson(content)) as Partial<AiGenerationIntent>;
      return normalizeIntent(parsed, category);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.warn(`${providerConfig.label} generation fallback: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadRequestException(`${providerConfig.label} 生成失败，请检查 ${providerConfig.keyName}、模型名称或网络配置。`);
    }
  }
}
