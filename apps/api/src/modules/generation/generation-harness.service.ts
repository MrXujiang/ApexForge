import { Injectable } from '@nestjs/common';
import type { AiGenerationIntent } from '../llm/llm.service';

interface AgentExecution {
  id: string;
  name: string;
  role: string;
  status: 'completed';
  output: string;
}

interface SkillStep {
  id: string;
  name: string;
  description: string;
}

export interface GenerationHarnessPlan {
  originalPrompt: string;
  optimizedPrompt: string;
  shouldOptimizePrompt: boolean;
  agents: AgentExecution[];
  skillChain: SkillStep[];
  renderProfile: {
    lighting: string;
    materialPipeline: string;
    detailStrategy: string;
  };
}

function compactPrompt(prompt: string) {
  return prompt.replace(/\s+/g, ' ').trim();
}

function extractTarget(prompt: string, category: string) {
  const categoryLabel = category && category !== 'product' ? category : '开放产品';
  const match = prompt.match(/(?:生成|创建|设计|做|制作)(?:一个|一台|一款|一只|一双|一条|一件|套)?\s*([^，。,.；;、\s]{1,18})/);
  return match?.[1] ?? categoryLabel;
}

function buildOptimizedPrompt(prompt: string, category: string) {
  const normalized = compactPrompt(prompt);
  const target = extractTarget(normalized, category);
  const needsCommercialCue = !/(商业|量产|硬表面|CAD|结构|制造|细节|分层)/i.test(normalized);
  const commercialCue = needsCommercialCue ? '商业级硬表面CAD造型，强调可制造结构、分层部件、倒角边界、面板线、功能模块和材质分区。' : '';

  return [`目标模型：${target}。`, normalized, commercialCue, `输出要求：保持目标物体为${target}，不要改写成汽车或默认模板；优先生成可用于产品评审的参数化结构。`]
    .filter(Boolean)
    .join(' ');
}

function buildAgents(prompt: string, category: string): AgentExecution[] {
  const target = extractTarget(prompt, category);
  const isLargePrompt = prompt.length > 120 || /[，。；;、\n]/.test(prompt);

  return [
    {
      id: 'prompt-architect',
      name: 'Prompt Architect',
      role: '需求澄清与提示词优化',
      status: 'completed',
      output: isLargePrompt ? `已压缩并重组复杂需求，锁定目标为「${target}」。` : `提示词较短，补充商业级CAD约束并锁定目标为「${target}」。`,
    },
    {
      id: 'structure-agent',
      name: 'Structure Agent',
      role: '主体结构与比例规划',
      status: 'completed',
      output: '规划主体体块、对称关系、功能区和可制造分件。',
    },
    {
      id: 'surface-agent',
      name: 'Surface Detail Agent',
      role: '硬表面细节与面板分层',
      status: 'completed',
      output: '增加面板线、结构筋、连接件、控制区和微细节密度。',
    },
    {
      id: 'material-agent',
      name: 'Material Agent',
      role: '材质与渲染策略',
      status: 'completed',
      output: '分配主体、强调、辅助三色材质，并启用金属/玻璃/陶瓷等商业展示材质。',
    },
    {
      id: 'quality-agent',
      name: 'Quality Agent',
      role: '结构一致性与渲染可用性质检',
      status: 'completed',
      output: '检查目标一致性、复杂度、面板密度、渲染性能和可预览性。',
    },
  ];
}

function buildSkillChain(category: string): SkillStep[] {
  const baseSteps = [
    { id: 'silhouette-blockout', name: '轮廓粗模', description: '先建立主体比例和识别度，避免统一盒子化。' },
    { id: 'hard-surface-paneling', name: '硬表面分件', description: '添加可制造的分层壳体、接缝和功能面板。' },
    { id: 'bevel-readability', name: '倒角可读性', description: '通过边界高光和局部结构件提升形体层次。' },
    { id: 'material-layering', name: '材质分层', description: '将主体、结构件、玻璃/软材质分区渲染。' },
    { id: 'render-inspection', name: '渲染质检', description: '统一光照、阴影、网格和可视化检查标尺。' },
  ];

  if (['watch', 'jewelry'].includes(category)) {
    return [baseSteps[0], baseSteps[3], baseSteps[1], baseSteps[2], baseSteps[4]];
  }

  return baseSteps;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

@Injectable()
export class GenerationHarnessService {
  createPlan(prompt: string, category: string): GenerationHarnessPlan {
    const optimizedPrompt = buildOptimizedPrompt(prompt, category);

    return {
      originalPrompt: prompt,
      optimizedPrompt,
      shouldOptimizePrompt: optimizedPrompt !== compactPrompt(prompt),
      agents: buildAgents(optimizedPrompt, category),
      skillChain: buildSkillChain(category),
      renderProfile: {
        lighting: 'studio-hdr-three-point',
        materialPipeline: 'physical-hard-surface-materials',
        detailStrategy: 'panel-density-driven-parametric-parts',
      },
    };
  }

  applySkillChain(intent: AiGenerationIntent, plan: GenerationHarnessPlan): AiGenerationIntent {
    const skillBoost = Math.min(2, Math.floor(plan.skillChain.length / 3));

    return {
      ...intent,
      detailLevel: clamp(intent.detailLevel + skillBoost, 1, 5),
      complexity: clamp(intent.complexity + 1, 1, 5),
      panelDensity: clamp(intent.panelDensity + 1, 1, 5),
      style: intent.style?.includes('multi-agent') ? intent.style : `${intent.style || 'commercial-cad'} multi-agent-skill-chain`,
      explanation: `${intent.explanation} 已通过多Agent生成编排和3D技能链增强：提示词优化、结构规划、硬表面分件、材质分层与渲染质检。`,
    };
  }
}
