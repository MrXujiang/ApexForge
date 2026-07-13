import { CheckCircle2, GitBranch, Layers3 } from 'lucide-react';
import type { ModelGenerationAgent, ModelGenerationSkill, ModelRenderProfile } from '@/shared/types/generation';

interface AgentOrchestrationPanelProps {
  agents?: ModelGenerationAgent[];
  skills?: ModelGenerationSkill[];
  renderProfile?: ModelRenderProfile;
  optimizedPrompt?: string;
}

const defaultAgents: ModelGenerationAgent[] = [
  {
    id: 'prompt-architect',
    name: 'Prompt Architect',
    role: '需求澄清与提示词优化',
    status: 'idle',
    output: '等待生成任务。',
  },
  {
    id: 'structure-agent',
    name: 'Structure Agent',
    role: '主体结构与比例规划',
    status: 'idle',
    output: '等待生成任务。',
  },
  {
    id: 'quality-agent',
    name: 'Quality Agent',
    role: '结构一致性与渲染可用性质检',
    status: 'idle',
    output: '等待生成任务。',
  },
];

export function AgentOrchestrationPanel({ agents, skills, renderProfile, optimizedPrompt }: AgentOrchestrationPanelProps) {
  const activeAgents = agents?.length ? agents : defaultAgents;
  const activeSkills = skills?.length ? skills : [];

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <GitBranch className="h-4 w-4" />
          多 Agent 编排
        </div>
        <div className="space-y-2">
          {activeAgents.map((agent) => (
            <div key={agent.id} className="rounded border border-border bg-background/50 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-foreground">{agent.name}</div>
                <CheckCircle2 className={agent.status === 'completed' ? 'h-3.5 w-3.5 text-green-300' : 'h-3.5 w-3.5 text-muted-foreground'} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{agent.role}</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">{agent.output}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <Layers3 className="h-4 w-4" />
          3D 技能链
        </div>
        {activeSkills.length ? (
          <div className="space-y-2">
            {activeSkills.map((skill) => (
              <div key={skill.id} className="rounded border border-border bg-background/50 p-2">
                <div className="font-medium text-foreground">{skill.name}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{skill.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs leading-5 text-muted-foreground">生成完成后展示轮廓粗模、硬表面分件、材质分层和渲染质检等技能步骤。</div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-6 text-muted-foreground">
        <div className="font-medium text-foreground">渲染策略</div>
        <div>灯光：{renderProfile?.lighting ?? '等待生成'}</div>
        <div>材质：{renderProfile?.materialPipeline ?? '等待生成'}</div>
        <div>细节：{renderProfile?.detailStrategy ?? '等待生成'}</div>
      </div>

      {optimizedPrompt ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">优化后的建模需求</div>
          <div className="max-h-28 overflow-auto">{optimizedPrompt}</div>
        </div>
      ) : null}
    </div>
  );
}
