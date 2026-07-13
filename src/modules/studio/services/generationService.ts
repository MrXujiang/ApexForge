import { apiRequest } from '@/shared/api/client';
import { findTemplateByCategory } from '@/modules/templates/templateData';
import type { GenerationResult, ModelCategory } from '@/shared/types/generation';

function createTraceId() {
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

export function inferCategoryFromPrompt(prompt: string, category: ModelCategory = 'product'): ModelCategory {
  const promptText = prompt.toLowerCase();
  const categoryText = category.trim().toLowerCase();
  const matchCategory = (text: string) => {
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
  };

  return matchCategory(promptText) || extractOpenCategory(prompt) || matchCategory(categoryText) || (categoryText === 'vehicle' ? 'product' : categoryText) || 'product';
}

async function createFallbackGeneration(prompt: string, category: ModelCategory, llmProvider = 'deepseek'): Promise<GenerationResult> {
  const inferredCategory = inferCategoryFromPrompt(prompt, category);
  const template = findTemplateByCategory(inferredCategory);

  await new Promise((resolve) => window.setTimeout(resolve, 900));

  return {
    id: `gen_${Date.now().toString(36)}`,
    prompt,
    category: inferredCategory,
    templateId: template.id,
    status: 'renderable',
    createdAt: new Date().toISOString(),
    traceId: createTraceId(),
    metrics: {
      meshes: inferredCategory === 'vehicle' ? 82 : inferredCategory === 'watch' ? 92 : inferredCategory === 'jewelry' ? 78 : 64,
      vertices: inferredCategory === 'watch' ? 7524 : inferredCategory === 'jewelry' ? 6800 : 5800,
      materials: 7,
      score: 92,
    },
    explanation: `后端不可用，已回退到本地「${template.name}」模板生成。`,
    generatedParams: {
      provider: llmProvider,
      variantSeed: Date.now() % 100000,
      edgeStyle: 'filleted',
      chamferRadius: 0.07,
      connectorDensity: 3,
      curveIntensity: 0.76,
      smoothJoints: true,
      optimizedPrompt: `目标模型：${inferredCategory}。${prompt} 商业级硬表面CAD造型，强调可制造结构、分层部件、倒角边界、面板线和材质分区。`,
      agents: [
        { id: 'prompt-architect', name: 'Prompt Architect', role: '需求澄清与提示词优化', status: 'completed', output: '本地回退模式下已补充商业级CAD约束。' },
        { id: 'structure-agent', name: 'Structure Agent', role: '主体结构与比例规划', status: 'completed', output: '规划主体比例、功能区和可制造分件。' },
        { id: 'quality-agent', name: 'Quality Agent', role: '结构一致性与渲染可用性质检', status: 'completed', output: '检查目标一致性、复杂度和可预览性。' },
      ],
      skillsApplied: [
        { id: 'silhouette-blockout', name: '轮廓粗模', description: '建立主体比例和识别度。' },
        { id: 'hard-surface-paneling', name: '硬表面分件', description: '添加分层壳体、接缝和功能面板。' },
        { id: 'material-layering', name: '材质分层', description: '区分主体、强调和辅助材质。' },
      ],
      renderProfile: {
        lighting: 'studio-hdr-three-point',
        materialPipeline: 'physical-hard-surface-materials',
        detailStrategy: 'panel-density-driven-parametric-parts',
      },
    },
  };
}

export async function createLocalGeneration(prompt: string, category: ModelCategory = 'product', llmProvider = 'deepseek', llmApiKeys: Record<string, string> = {}): Promise<GenerationResult> {
  const inferredCategory = inferCategoryFromPrompt(prompt, category);

  try {
    const response = await apiRequest<GenerationResult>('/generations', {
      method: 'POST',
      body: JSON.stringify({ prompt, category: inferredCategory, mode: 'template', llmProvider, llmApiKeys }),
    });

    return response.data;
  } catch (error) {
    console.warn('ApexForge API unavailable, using local fallback.', error);
    if (error instanceof TypeError) {
      return createFallbackGeneration(prompt, inferredCategory, llmProvider);
    }

    throw error;
  }
}

export async function fetchGenerationHistory(): Promise<GenerationResult[]> {
  const response = await apiRequest<GenerationResult[]>('/generations');
  return response.data;
}
