import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createId, createTraceId, parseJson, stringifyJson } from '../../common/json';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { TemplatesService } from '../templates/templates.service';
import { ValidationService } from '../validation/validation.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { GenerationHarnessService } from './generation-harness.service';

function matchCategoryKeyword(text: string) {
  if (['jewelry', 'necklace', 'pendant', 'bracelet', 'bangle', 'wristband', '首饰', '珠宝', '项链', '吊坠', '手链', '手镯'].some((keyword) => text.includes(keyword))) {
    return 'jewelry';
  }

  if (['watch', 'wristwatch', 'wearable', '手表', '腕表', '穿戴'].some((keyword) => text.includes(keyword))) {
    return 'watch';
  }

  if (['vehicle', 'car', 'sport-car', 'supercar', '跑车', '汽车', '车辆'].some((keyword) => text.includes(keyword))) {
    return 'vehicle';
  }

  if (['architecture', 'building', 'tower', '建筑', '楼'].some((keyword) => text.includes(keyword))) {
    return 'architecture';
  }

  if (['aircraft', 'drone', '飞行器', '无人机'].some((keyword) => text.includes(keyword))) {
    return 'aircraft';
  }

  if (['furniture', 'chair', '家具', '椅'].some((keyword) => text.includes(keyword))) {
    return 'furniture';
  }

  if (['prop', '道具', '信标'].some((keyword) => text.includes(keyword))) {
    return 'prop';
  }

  return '';
}

function extractOpenCategory(prompt: string) {
  const text = prompt.trim().toLowerCase();
  const directKeywords = ['收音机', '复古收音机', '智能收音机', 'radio', 'portable radio', 'speaker radio', '花瓶', '瓶子', '杯子', '水杯', '雕塑', '机器人', '手机', '平板', '电脑', '沙发', '桌子', '灯具', '玩具', '头盔', 'vase', 'bottle', 'cup', 'sculpture', 'robot', 'phone', 'tablet', 'computer', 'sofa', 'table', 'helmet', 'toy', '镜子', '化妆镜', '穿衣镜', '全身镜', '浴室镜', '智能镜', 'mirror', 'vanity mirror', 'standing mirror', '飞机', '客机', '战斗机', '喷气机', '耳机', '头戴耳机', '相机', '摄像机', '键盘', '鼠标', '音箱', '鞋子', '运动鞋', '背包', '手提包', '台灯', '咖啡机', '吹风机', '小家电', 'plane', 'airplane', 'jet', 'headphone', 'earphone', 'camera', 'keyboard', 'mouse', 'speaker', 'shoe', 'sneaker', 'bag', 'backpack', 'lamp', 'coffee machine', 'appliance'];
  const directMatch = directKeywords.find((keyword) => text.includes(keyword));
  if (directMatch) {
    return directMatch;
  }

  const phraseMatch = text.match(/(?:生成|创建|设计|做|制作)(?:一个|一台|一款|一只|一双|一条|一件|套)?\s*([^，。,.；;、\s]{1,16})/);
  return phraseMatch?.[1] ?? '';
}

function normalizeCategory(category: string) {
  const value = category.trim().toLowerCase();
  return matchCategoryKeyword(value) || 'product';
}

function inferCategoryFromPrompt(prompt: string, category: string) {
  const promptText = prompt.trim().toLowerCase();
  const categoryText = category.trim().toLowerCase();
  return matchCategoryKeyword(promptText) || extractOpenCategory(prompt) || matchCategoryKeyword(categoryText) || (categoryText === 'vehicle' ? 'product' : categoryText) || 'product';
}

function normalizeLlmProvider(provider?: string) {
  return provider === 'kimi' || provider === 'qwen' ? provider : 'deepseek';
}

function buildMetrics(category: string, complexity = 3, panelDensity = 3) {
  const normalizedCategory = normalizeCategory(category);
  const baseMeshes = normalizedCategory === 'vehicle' ? 42 : normalizedCategory === 'architecture' ? 30 : normalizedCategory === 'aircraft' ? 24 : normalizedCategory === 'watch' ? 54 : normalizedCategory === 'jewelry' ? 48 : 28;
  const meshBoost = complexity * 5 + panelDensity * 3;

  return {
    meshes: baseMeshes + meshBoost,
    vertices: 900 + (baseMeshes + meshBoost) * 72,
    materials: Math.min(8, 3 + complexity),
    score: Math.min(96, 82 + complexity + panelDensity),
  };
}

function buildGeneratedCode(category: string) {
  const safeCategory = JSON.stringify(category);
  return `function buildModel(params, THREE) {\n  const group = new THREE.Group();\n  group.userData = { category: ${safeCategory}, generatedBy: 'ApexForge API' };\n  return group;\n}`;
}

function createVariantSeed() {
  return Math.floor(Date.now() % 100000) + Math.floor(Math.random() * 9000);
}

function resolveMirrorVariant(seed: number) {
  return ['wall-mounted', 'freestanding', 'vanity', 'smart-panel'][seed % 4];
}

function resolveFrameStyle(seed: number) {
  return ['minimal-metal', 'rounded-ceramic', 'ornate-ribbed', 'industrial-slim'][Math.floor(seed / 3) % 4];
}

function toGenerationResult(task: any) {
  return {
    id: task.id,
    prompt: task.prompt,
    category: task.category,
    templateId: task.templateId,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    traceId: task.traceId,
    metrics: parseJson(task.metrics, { meshes: 0, vertices: 0, materials: 0, score: 0 }),
    explanation: task.explanation ?? '',
    generatedCode: task.generatedCode,
    generatedParams: parseJson(task.generatedParams, {}),
    validationReport: task.validationReport
      ? {
          passed: task.validationReport.passed,
          blockedReasons: parseJson(task.validationReport.blockedReasons, []),
          warnings: parseJson(task.validationReport.warnings, []),
          complexity: parseJson(task.validationReport.complexity, {}),
        }
      : null,
    qualityScore: task.qualityScore
      ? {
          totalScore: task.qualityScore.totalScore,
          renderabilityScore: task.qualityScore.renderabilityScore,
          structureScore: task.qualityScore.structureScore,
          promptMatchScore: task.qualityScore.promptMatchScore,
          performanceScore: task.qualityScore.performanceScore,
          details: parseJson(task.qualityScore.details, {}),
        }
      : null,
  };
}

@Injectable()
export class GenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templatesService: TemplatesService,
    private readonly validationService: ValidationService,
    private readonly llmService: LlmService,
    private readonly generationHarnessService: GenerationHarnessService,
  ) {}

  async create(dto: CreateGenerationDto) {
    const traceId = createTraceId();
    const normalizedPrompt = dto.prompt.trim();
    const promptValidation = this.validationService.validatePrompt(normalizedPrompt);

    if (!promptValidation.passed) {
      throw new BadRequestException({ traceId, code: 'PROMPT_VALIDATION_FAILED', details: promptValidation.blockedReasons });
    }

    const inferredCategory = inferCategoryFromPrompt(normalizedPrompt, dto.category);
    const template = await this.templatesService.findBestByCategory(inferredCategory);
    const generatedCode = buildGeneratedCode(inferredCategory);
    const codeValidation = this.validationService.validateCode(generatedCode);
    const validation = {
      passed: promptValidation.passed && codeValidation.passed,
      blockedReasons: [...promptValidation.blockedReasons, ...codeValidation.blockedReasons],
      warnings: [...promptValidation.warnings, ...codeValidation.warnings],
      complexity: {
        prompt: promptValidation.complexity,
        code: codeValidation.complexity,
      },
      astSummary: codeValidation.astSummary,
    };

    if (!validation.passed) {
      throw new BadRequestException({ traceId, code: 'GENERATION_VALIDATION_FAILED', details: validation.blockedReasons });
    }

    const llmProvider = normalizeLlmProvider(dto.llmProvider);
    const llmApiKey = typeof dto.llmApiKeys?.[llmProvider] === 'string' ? dto.llmApiKeys[llmProvider] : undefined;
    const harnessPlan = this.generationHarnessService.createPlan(normalizedPrompt, inferredCategory);
    const variantSeed = createVariantSeed();
    const aiIntent = this.generationHarnessService.applySkillChain(
      await this.llmService.generateIntent(`${harnessPlan.optimizedPrompt}\n本次生成变体种子：${variantSeed}。请基于该种子选择不同的结构比例、细节密度和材质组合，但必须保持目标物体一致。`, inferredCategory, llmProvider, llmApiKey),
      harnessPlan,
    );
    const metrics = buildMetrics(inferredCategory, aiIntent.complexity, aiIntent.panelDensity);
    const isMirrorCategory = ['镜子', '化妆镜', '穿衣镜', '全身镜', '浴室镜', '智能镜', 'mirror', 'vanity mirror', 'standing mirror'].some((keyword) => inferredCategory.toLowerCase().includes(keyword));
    const generatedParams = {
      bodyColor: aiIntent.bodyColor,
      accentColor: aiIntent.accentColor,
      secondaryColor: aiIntent.secondaryColor,
      scale: aiIntent.scale,
      detailLevel: aiIntent.detailLevel,
      complexity: aiIntent.complexity,
      panelDensity: aiIntent.panelDensity,
      materialPreset: aiIntent.materialPreset,
      silhouette: aiIntent.silhouette,
      style: aiIntent.style,
      provider: llmProvider,
      variantSeed,
      edgeStyle: 'filleted',
      chamferRadius: 0.055 + (variantSeed % 6) / 100,
      connectorDensity: Math.min(5, Math.max(2, aiIntent.complexity)),
      curveIntensity: 0.58 + (variantSeed % 24) / 100,
      smoothJoints: true,
      ...(isMirrorCategory
        ? {
            mirrorVariant: resolveMirrorVariant(variantSeed),
            frameStyle: resolveFrameStyle(variantSeed),
            reflectionOpacity: 0.58 + (variantSeed % 18) / 100,
          }
        : {}),
      optimizedPrompt: harnessPlan.optimizedPrompt,
      agents: harnessPlan.agents,
      skillsApplied: harnessPlan.skillChain,
      renderProfile: harnessPlan.renderProfile,
    };

    const taskId = createId('gen');
    const task = await this.prisma.generationTask.create({
      data: {
        id: taskId,
        traceId,
        prompt: dto.prompt,
        normalizedPrompt,
        category: inferredCategory,
        mode: dto.mode ?? 'template',
        status: 'renderable',
        templateId: template.id,
        generatedCode,
        generatedParams: stringifyJson(generatedParams),
        explanation: aiIntent.explanation || `已基于「${template.name}」模板生成可交互程序化模型。`,
        metrics: stringifyJson(metrics),
        startedAt: new Date(),
        completedAt: new Date(),
        validationReport: {
          create: {
            id: createId('val'),
            passed: validation.passed,
            blockedReasons: stringifyJson(validation.blockedReasons),
            warnings: stringifyJson(validation.warnings),
            complexity: stringifyJson(validation.complexity),
            astSummary: stringifyJson(validation.astSummary),
          },
        },
        qualityScore: {
          create: {
            id: createId('score'),
            totalScore: metrics.score,
            renderabilityScore: 92,
            structureScore: 86,
            promptMatchScore: 82,
            performanceScore: 90,
            details: stringifyJson({
              strategy: 'harness-multi-agent-skill-chain',
              templateId: template.id,
              provider: llmProvider,
              optimizedPrompt: harnessPlan.optimizedPrompt,
              variantSeed,
              edgeStyle: 'filleted',
              chamferRadius: 0.055 + (variantSeed % 6) / 100,
              connectorDensity: Math.min(5, Math.max(2, aiIntent.complexity)),
              curveIntensity: 0.58 + (variantSeed % 24) / 100,
              smoothJoints: true,
              agents: harnessPlan.agents.map((agent) => agent.name),
              skillsApplied: harnessPlan.skillChain.map((skill) => skill.name),
              renderProfile: harnessPlan.renderProfile,
              complexity: aiIntent.complexity,
              panelDensity: aiIntent.panelDensity,
              materialPreset: aiIntent.materialPreset,
            }),
          },
        },
      },
      include: {
        validationReport: true,
        qualityScore: true,
      },
    });

    return {
      traceId,
      data: toGenerationResult(task),
    };
  }

  async findAll() {
    const tasks = await this.prisma.generationTask.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { validationReport: true, qualityScore: true },
    });

    return {
      traceId: createTraceId(),
      data: tasks.map(toGenerationResult),
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.generationTask.findUnique({
      where: { id },
      include: { validationReport: true, qualityScore: true },
    });

    if (!task) {
      throw new NotFoundException({ code: 'GENERATION_NOT_FOUND', message: '生成任务不存在' });
    }

    return {
      traceId: createTraceId(),
      data: toGenerationResult(task),
    };
  }
}
