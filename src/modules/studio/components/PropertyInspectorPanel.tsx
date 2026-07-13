import type { ReactNode } from 'react';
import type { ModelGenerationParams, ModelMetrics } from '@/shared/types/generation';

interface PropertyInspectorPanelProps {
  params: ModelGenerationParams;
  metrics: ModelMetrics;
  category: string;
  onParamChange: <K extends keyof ModelGenerationParams>(key: K, value: ModelGenerationParams[K]) => void;
}

const materialOptions = [
  { value: 'brushed-metal', label: '拉丝金属' },
  { value: 'anodized-metal', label: '阳极金属' },
  { value: 'ceramic', label: '陶瓷高光' },
  { value: 'carbon-fiber', label: '碳纤维' },
  { value: 'glass', label: '玻璃镜面' },
  { value: 'matte-polymer', label: '哑光聚合物' },
];

const silhouetteOptions = [
  { value: 'technical-premium', label: '精密高级' },
  { value: 'sleek', label: '流线型' },
  { value: 'luxury', label: '奢华' },
  { value: 'modular', label: '模块化' },
  { value: 'industrial', label: '工业风' },
];

const edgeOptions = [
  { value: 'filleted', label: '圆角过渡' },
  { value: 'soft', label: '柔和边缘' },
  { value: 'chamfered', label: '机械倒角' },
  { value: 'sharp', label: '锐利硬边' },
];

function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border/80 pb-4 last:border-b-0 last:pb-0">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function RangeRow({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="grid grid-cols-[72px_minmax(0,1fr)_42px] items-center gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="h-1.5 accent-white"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="rounded border border-border bg-background px-2 py-1 text-center font-mono text-foreground">{value}</span>
    </label>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid grid-cols-[72px_minmax(0,1fr)_34px] items-center gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-muted-foreground">{value}</span>
      <input type="color" value={value} className="h-8 w-8 rounded border border-border bg-transparent" onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function OptionGrid({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`rounded border px-2 py-1.5 text-left text-xs transition-colors ${value === option.value ? 'border-white/40 bg-white/12 text-white' : 'border-border bg-background/60 text-muted-foreground hover:border-white/20 hover:text-foreground'}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TextureUploader({ params, onParamChange }: { params: ModelGenerationParams; onParamChange: PropertyInspectorPanelProps['onParamChange'] }) {
  const handleTextureUpload = (file?: File) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onParamChange('mainTextureDataUrl', reader.result);
        onParamChange('textureName', file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded border border-dashed border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground">
        <span>{params.textureName ? `当前贴图：${params.textureName}` : '上传自定义图片贴图'}</span>
        <span className="rounded bg-white/10 px-2 py-1 text-foreground">选择图片</span>
        <input type="file" accept="image/*" className="hidden" onChange={(event) => handleTextureUpload(event.target.files?.[0])} />
      </label>
      {params.mainTextureDataUrl ? (
        <div className="overflow-hidden rounded border border-border bg-background/60">
          <img src={params.mainTextureDataUrl} alt="自定义贴图预览" className="h-24 w-full object-cover" />
          <button
            type="button"
            className="w-full border-t border-border px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              onParamChange('mainTextureDataUrl', undefined);
              onParamChange('textureName', undefined);
            }}
          >
            移除贴图
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function PropertyInspectorPanel({ params, metrics, category, onParamChange }: PropertyInspectorPanelProps) {
  const bodyColor = params.bodyColor ?? '#f5f5f5';
  const accentColor = params.accentColor ?? '#111111';
  const secondaryColor = params.secondaryColor ?? '#8a8a8a';
  const scale = Number(params.scale ?? 1);
  const detailLevel = Number(params.detailLevel ?? 4);
  const complexity = Number(params.complexity ?? 4);
  const panelDensity = Number(params.panelDensity ?? 4);
  const materialPreset = params.materialPreset ?? 'brushed-metal';
  const silhouette = params.silhouette ?? 'technical-premium';
  const edgeStyle = params.edgeStyle ?? 'filleted';
  const chamferRadius = Number(params.chamferRadius ?? 0.065);
  const connectorDensity = Number(params.connectorDensity ?? 3);
  const curveIntensity = Number(params.curveIntensity ?? 0.72);
  const textureRepeatX = Number(params.textureRepeatX ?? 1);
  const textureRepeatY = Number(params.textureRepeatY ?? 1);
  const textureStrength = Number(params.textureStrength ?? 0.72);

  return (
    <div className="rounded-xl border border-border bg-[#0b0b0b] p-3 shadow-inner">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <div>
          <div className="text-sm font-semibold text-foreground">对象属性</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{category}</div>
        </div>
        <div className="rounded border border-border bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground">Seed {params.variantSeed ?? 'Manual'}</div>
      </div>

      <div className="space-y-4">
        <InspectorSection title="几何体">
          <RangeRow label="缩放" min={0.7} max={1.4} step={0.05} value={Number(scale.toFixed(2))} onChange={(value) => onParamChange('scale', value)} />
          <RangeRow label="细节" min={1} max={5} value={detailLevel} onChange={(value) => onParamChange('detailLevel', value)} />
          <RangeRow label="复杂度" min={1} max={5} value={complexity} onChange={(value) => onParamChange('complexity', value)} />
          <RangeRow label="面板" min={1} max={5} value={panelDensity} onChange={(value) => onParamChange('panelDensity', value)} />
        </InspectorSection>

        <InspectorSection title="材质通道">
          <ColorRow label="主体" value={bodyColor} onChange={(value) => onParamChange('bodyColor', value)} />
          <ColorRow label="强调" value={accentColor} onChange={(value) => onParamChange('accentColor', value)} />
          <ColorRow label="辅助" value={secondaryColor} onChange={(value) => onParamChange('secondaryColor', value)} />
          <OptionGrid value={materialPreset} options={materialOptions} onChange={(value) => onParamChange('materialPreset', value)} />
        </InspectorSection>

        <InspectorSection title="轮廓风格">
          <OptionGrid value={silhouette} options={silhouetteOptions} onChange={(value) => onParamChange('silhouette', value)} />
        </InspectorSection>

        <InspectorSection title="外观贴图">
          <TextureUploader params={params} onParamChange={onParamChange} />
          <RangeRow label="横向" min={0.5} max={4} step={0.5} value={textureRepeatX} onChange={(value) => onParamChange('textureRepeatX', value)} />
          <RangeRow label="纵向" min={0.5} max={4} step={0.5} value={textureRepeatY} onChange={(value) => onParamChange('textureRepeatY', value)} />
          <RangeRow label="强度" min={0.1} max={1} step={0.05} value={Number(textureStrength.toFixed(2))} onChange={(value) => onParamChange('textureStrength', value)} />
        </InspectorSection>

        <InspectorSection title="曲线与连接">
          <OptionGrid value={edgeStyle} options={edgeOptions} onChange={(value) => onParamChange('edgeStyle', value as ModelGenerationParams['edgeStyle'])} />
          <RangeRow label="倒角" min={0.01} max={0.14} step={0.01} value={Number(chamferRadius.toFixed(2))} onChange={(value) => onParamChange('chamferRadius', value)} />
          <RangeRow label="连接" min={1} max={5} value={connectorDensity} onChange={(value) => onParamChange('connectorDensity', value)} />
          <RangeRow label="曲线" min={0} max={1} step={0.05} value={Number(curveIntensity.toFixed(2))} onChange={(value) => onParamChange('curveIntensity', value)} />
        </InspectorSection>

        <InspectorSection title="网格统计">
          <div className="grid grid-cols-4 gap-2 text-center font-mono text-[10px] text-muted-foreground">
            <div className="rounded border border-border bg-background/60 p-2"><div className="text-foreground">{metrics.meshes}</div><div>网格</div></div>
            <div className="rounded border border-border bg-background/60 p-2"><div className="text-foreground">{metrics.vertices}</div><div>顶点</div></div>
            <div className="rounded border border-border bg-background/60 p-2"><div className="text-foreground">{metrics.materials}</div><div>材质</div></div>
            <div className="rounded border border-border bg-background/60 p-2"><div className="text-foreground">{metrics.score}</div><div>评分</div></div>
          </div>
        </InspectorSection>
      </div>
    </div>
  );
}
