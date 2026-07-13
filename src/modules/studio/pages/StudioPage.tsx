import { useMemo, useState } from 'react';
import { BookOpen, Boxes, Cpu, Database, ExternalLink, FileText, Github, History, MessageCircle, Palette, PanelLeft, SlidersHorizontal, TerminalSquare, X } from 'lucide-react';
import { AgentOrchestrationPanel } from '@/modules/studio/components/AgentOrchestrationPanel';
import { GenerationPanel } from '@/modules/studio/components/GenerationPanel';
import { HistoryList } from '@/modules/studio/components/HistoryList';
import { PromptInput } from '@/modules/studio/components/PromptInput';
import { PropertyInspectorPanel } from '@/modules/studio/components/PropertyInspectorPanel';
import { createLocalGeneration, inferCategoryFromPrompt } from '@/modules/studio/services/generationService';
import { findTemplateByCategory } from '@/modules/templates/templateData';
import { ModelViewer } from '@/modules/viewer/components/ModelViewer';
import { Button } from '@/shared/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/Card';
import { modelThemePresets } from '@/shared/styles/theme';
import type { GenerationResult, GenerationStatus, ModelCategory, ModelGenerationParams } from '@/shared/types/generation';
import { validatePrompt } from '@/shared/utils/validators';

const statusSequence: GenerationStatus[] = ['queued', 'generating', 'validating'];
const apiKeyStorageKey = 'apexforge.llmApiKeys';

function loadStoredApiKeys() {
  try {
    const raw = window.localStorage.getItem(apiKeyStorageKey);
    return raw ? (JSON.parse(raw) as Record<string, string>) : { deepseek: '', kimi: '', qwen: '' };
  } catch {
    return { deepseek: '', kimi: '', qwen: '' };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function StudioPage() {
  const [prompt, setPrompt] = useState('创建一款复古智能收音机，包含圆角木质机身、金属前面板、扬声器格栅、频段显示窗、双旋钮和顶部提手。');
  const [category, setCategory] = useState<ModelCategory>('product');
  const [llmProvider, setLlmProvider] = useState('deepseek');
  const [llmApiKeys, setLlmApiKeys] = useState<Record<string, string>>(loadStoredApiKeys);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [selected, setSelected] = useState<GenerationResult | null>(null);
  const [bodyColor, setBodyColor] = useState('#f5f5f5');
  const [accentColor, setAccentColor] = useState('#111111');
  const [secondaryColor, setSecondaryColor] = useState('#8a8a8a');
  const [paramOverrides, setParamOverrides] = useState<ModelGenerationParams>({});
  const [activeThemeId, setActiveThemeId] = useState(modelThemePresets[0]?.id ?? 'mono');
  const [contactOpen, setContactOpen] = useState(false);

  const activeCategory = selected?.category ?? category;
  const selectedTemplate = useMemo(
    () => (selected?.templateId ? findTemplateByCategory(selected.category) : findTemplateByCategory(activeCategory)),
    [activeCategory, selected?.category, selected?.templateId],
  );

  const viewerParams = useMemo<ModelGenerationParams>(() => {
    const baseParams =
      selected?.generatedParams ?? {
        bodyColor,
        accentColor,
        secondaryColor,
        scale: 1,
        detailLevel: 4,
        complexity: 4,
        panelDensity: 4,
        materialPreset: 'brushed-metal',
        silhouette: 'technical-premium',
        style: 'manual-commercial-cad',
        edgeStyle: 'filleted' as const,
        chamferRadius: 0.07,
        connectorDensity: 3,
        curveIntensity: 0.76,
        smoothJoints: true,
        textureRepeatX: 1,
        textureRepeatY: 1,
        textureStrength: 0.72,
      };

    return {
      ...baseParams,
      ...paramOverrides,
    };
  }, [accentColor, bodyColor, paramOverrides, secondaryColor, selected?.generatedParams]);

  const isGenerating = ['queued', 'generating', 'validating'].includes(status);

  const applyThemePreset = (themeId: string) => {
    const preset = modelThemePresets.find((item) => item.id === themeId);
    if (!preset) {
      return;
    }

    setActiveThemeId(preset.id);
    setBodyColor(preset.colors.bodyColor);
    setAccentColor(preset.colors.accentColor);
    setSecondaryColor(preset.colors.secondaryColor);
    setParamOverrides((current) => ({
      ...current,
      bodyColor: preset.colors.bodyColor,
      accentColor: preset.colors.accentColor,
      secondaryColor: preset.colors.secondaryColor,
    }));
    setSelected((current) =>
      current
        ? {
            ...current,
            generatedParams: {
              ...current.generatedParams,
              bodyColor: preset.colors.bodyColor,
              accentColor: preset.colors.accentColor,
              secondaryColor: preset.colors.secondaryColor,
            },
          }
        : current,
    );
  };

  const updateViewerParam = <K extends keyof ModelGenerationParams>(key: K, value: ModelGenerationParams[K]) => {
    if (key === 'bodyColor' && typeof value === 'string') {
      setBodyColor(value);
    }

    if (key === 'accentColor' && typeof value === 'string') {
      setAccentColor(value);
    }

    if (key === 'secondaryColor' && typeof value === 'string') {
      setSecondaryColor(value);
    }

    setParamOverrides((current) => ({
      ...current,
      [key]: value,
    }));

    setSelected((current) =>
      current
        ? {
            ...current,
            generatedParams: {
              ...current.generatedParams,
              [key]: value,
            },
          }
        : current,
    );
  };

  const updateApiKey = (provider: string, value: string) => {
    setLlmApiKeys((current) => {
      const next = {
        ...current,
        [provider]: value,
      };
      window.localStorage.setItem(apiKeyStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
  };

  const handleGenerate = async () => {
    const validationError = validatePrompt(prompt);
    if (validationError) {
      setError(validationError);
      return;
    }

    const inferredCategory = inferCategoryFromPrompt(prompt, 'product');

    setError(null);
    setSelected(null);

    try {
      for (const nextStatus of statusSequence) {
        setStatus(nextStatus);
        await sleep(260);
      }

      const result = await createLocalGeneration(prompt, inferredCategory, llmProvider, llmApiKeys);
      setStatus('renderable');
      setCategory(result.category);
      setSelected(result);
      setHistory((items) => [result, ...items].slice(0, 20));
    } catch (error) {
      setStatus('failed');
      setError(error instanceof Error ? error.message : '生成失败，请检查模型配置。');
    }
  };

  const currentMetrics = selected?.metrics ?? {
    meshes: activeCategory === 'vehicle' ? 58 : activeCategory === 'watch' ? 72 : activeCategory === 'jewelry' ? 64 : activeCategory === 'architecture' ? 72 : 52,
    vertices: activeCategory === 'watch' ? 6200 : activeCategory === 'jewelry' ? 5400 : activeCategory === 'architecture' ? 6084 : 4932,
    materials: 7,
    score: 92,
  };

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#060606] text-foreground dark">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-border bg-background">
            <Boxes className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">ApexForge CAD</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI 参数化建模工作台</div>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <a
            href="https://aibook.mvtable.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-3 text-sm font-medium text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.16)] transition-colors hover:border-cyan-200/70 hover:bg-cyan-400/25 hover:text-white"
          >
            <BookOpen className="h-4 w-4" />
            AI实战学习手册
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://jitword.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-300/40 bg-violet-400/15 px-3 text-sm font-medium text-violet-100 shadow-[0_0_24px_rgba(167,139,250,0.16)] transition-colors hover:border-violet-200/70 hover:bg-violet-400/25 hover:text-white"
          >
            <FileText className="h-4 w-4" />
            AI文档
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://github.com/MrXujiang/ApexForge"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-white/35 hover:text-foreground"
          >
            <Github className="h-4 w-4" />
            GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300/45 bg-amber-400/15 px-3 text-sm font-medium text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.16)] transition-colors hover:border-amber-200/70 hover:bg-amber-400/25 hover:text-white"
            onClick={() => setContactOpen(true)}
          >
            <MessageCircle className="h-4 w-4" />
            联系作者
          </button>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)_340px]">
        <aside className="min-h-0 overflow-y-auto border-r border-border bg-card/75 p-4">
          <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <PanelLeft className="h-4 w-4" />
            建模控制
          </div>

          <Card className="rounded-lg">
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TerminalSquare className="h-4 w-4" />
                建模指令
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <PromptInput
                prompt={prompt}
                llmProvider={llmProvider}
                isGenerating={isGenerating}
                error={error}
                params={viewerParams}
                apiKeys={llmApiKeys}
                onPromptChange={handlePromptChange}
                onProviderChange={setLlmProvider}
                onParamChange={updateViewerParam}
                onApiKeyChange={updateApiKey}
                onSubmit={handleGenerate}
              />
            </CardContent>
          </Card>

          <div className="mt-4">
            <GenerationPanel status={status} traceId={selected?.traceId} />
          </div>

          <Card className="mt-4 rounded-lg">
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" />
                版本历史
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[320px] overflow-auto p-4 pt-0">
              <HistoryList
                items={history}
                selectedId={selected?.id}
                onSelect={(item) => {
                  setSelected(item);
                  setCategory(item.category);
                  setPrompt(item.prompt);
                  setStatus('renderable');
                }}
              />
            </CardContent>
          </Card>
        </aside>

        <section className="flex min-h-0 flex-col bg-black">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#0b0b0b] px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
            <span>模型预览</span>
            <span>{selectedTemplate?.name ?? '未命名模型'}</span>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <ModelViewer category={activeCategory} generationId={selected?.id} params={viewerParams} status={status} />
          </div>
          <div className="grid h-10 shrink-0 grid-cols-3 border-t border-white/10 bg-[#0b0b0b] px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
            <div className="flex items-center">网格：开启</div>
            <div className="flex items-center justify-center">模式：AI 参数化</div>
            <div className="flex items-center justify-end">追踪：{selected?.traceId ? selected.traceId.slice(0, 12) : '无'}</div>
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto border-l border-border bg-card/75 p-4">
          <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            参数面板
          </div>

          <PropertyInspectorPanel params={viewerParams} metrics={currentMetrics} category={activeCategory} onParamChange={updateViewerParam} />

          <Card className="mt-4 rounded-lg">
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cpu className="h-4 w-4" />
                生成编排
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <AgentOrchestrationPanel
                agents={viewerParams.agents}
                skills={viewerParams.skillsApplied}
                renderProfile={viewerParams.renderProfile}
                optimizedPrompt={viewerParams.optimizedPrompt}
              />
            </CardContent>
          </Card>

          <Card className="mt-4 rounded-lg">
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Palette className="h-4 w-4" />
                主题色
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 p-4 pt-0">
              {modelThemePresets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant={activeThemeId === preset.id ? 'secondary' : 'outline'}
                  className="justify-start gap-2"
                  onClick={() => applyThemePreset(preset.id)}
                >
                  <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: preset.colors.bodyColor }} />
                  {preset.name}
                </Button>
              ))}
            </CardContent>
          </Card>


          <Card className="mt-4 rounded-lg">
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cpu className="h-4 w-4" />
                生成结果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 text-sm text-muted-foreground">
              <p className="leading-6">{selected?.explanation ?? '等待建模指令。生成完成后，这里会显示 AI 对结构方案的解释。'}</p>
              <Button type="button" variant="outline" className="w-full" disabled={!selected}>
                保存为资产
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-4 rounded-lg">
            <CardHeader className="p-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4" />
                连接状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 font-mono text-xs text-muted-foreground">
              <div>接口：/api/v1/generations</div>
              <div>数据库：SQLite</div>
              <div>模型：{llmProvider === 'deepseek' ? 'DeepSeek' : llmProvider === 'kimi' ? 'Kimi' : '千问'}</div>
              <div>编排：Harness 多 Agent</div>
              <div>渲染：Three.js 物理材质</div>
            </CardContent>
          </Card>
        </aside>
      </section>
      {contactOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="联系作者">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/12 bg-[#0b0b0b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-base font-semibold text-white">联系作者</div>
                <div className="mt-1 text-xs text-white/50">扫码添加作者微信，交流 AI 建模与产品方案</div>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60 transition-colors hover:border-white/25 hover:text-white"
                onClick={() => setContactOpen(false)}
                aria-label="关闭弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="rounded-xl border border-white/10 bg-white p-3">
                <img
                  src="https://next.jitword.com/uploads/WechatIMG246_19d428a664c.jpg"
                  alt="联系作者二维码"
                  className="h-auto w-full rounded-lg"
                />
              </div>
              <button
                type="button"
                className="mt-4 h-10 w-full rounded-lg border border-white/12 bg-white/10 text-sm font-medium text-white transition-colors hover:bg-white/15"
                onClick={() => setContactOpen(false)}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
