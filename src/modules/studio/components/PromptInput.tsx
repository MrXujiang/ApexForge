import { useState } from 'react';
import { Check, ChevronDown, KeyRound, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Textarea } from '@/shared/components/Textarea';
import type { ModelGenerationParams } from '@/shared/types/generation';

interface PromptInputProps {
  prompt: string;
  llmProvider: string;
  isGenerating: boolean;
  error: string | null;
  params: ModelGenerationParams;
  apiKeys: Record<string, string>;
  onPromptChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onParamChange: <K extends keyof ModelGenerationParams>(key: K, value: ModelGenerationParams[K]) => void;
  onApiKeyChange: (provider: string, value: string) => void;
  onSubmit: () => void;
}

const providerOptions = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'qwen', label: '千问' },
];

function ModelAssetUploader({ params, onParamChange }: { params: ModelGenerationParams; onParamChange: PromptInputProps['onParamChange'] }) {
  const handleModelUpload = (file?: File) => {
    if (!file) {
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'glb' && extension !== 'gltf' && extension !== 'obj' && extension !== 'stl') {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onParamChange('importedModelDataUrl', reader.result);
        onParamChange('importedModelName', file.name);
        onParamChange('importedModelFormat', extension);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-background/60 px-3 text-sm text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <Upload className="h-4 w-4 shrink-0" />
          <span className="truncate">{params.importedModelName ? `已导入：${params.importedModelName}` : '导入本地 3D 模型（GLB / GLTF / OBJ / STL）'}</span>
        </span>
        <span className="shrink-0 rounded bg-white/10 px-2 py-1 text-xs text-foreground">选择文件</span>
        <input type="file" accept=".glb,.gltf,.obj,.stl,model/gltf-binary,model/gltf+json" className="hidden" onChange={(event) => handleModelUpload(event.target.files?.[0])} />
      </label>
      {params.importedModelName ? (
        <button
          type="button"
          className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            onParamChange('importedModelDataUrl', undefined);
            onParamChange('importedModelName', undefined);
            onParamChange('importedModelFormat', undefined);
          }}
        >
          移除导入模型，恢复 AI 参数化预览
        </button>
      ) : null}
    </div>
  );
}

export function PromptInput({
  prompt,
  llmProvider,
  isGenerating,
  error,
  params,
  apiKeys,
  onPromptChange,
  onProviderChange,
  onParamChange,
  onApiKeyChange,
  onSubmit,
}: PromptInputProps) {
  const [providerOpen, setProviderOpen] = useState(false);
  const activeProvider = providerOptions.find((item) => item.value === llmProvider) ?? providerOptions[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground" htmlFor="prompt">
          建模需求
        </label>
        <span className="text-xs text-muted-foreground">{prompt.length}/2000</span>
      </div>
      <Textarea
        id="prompt"
        value={prompt}
        maxLength={2000}
        placeholder="例如：创建一款头戴式智能耳机，包含弧形头梁、分层耳罩、金属转轴、控制区和制造细节。也可以输入相机、鞋子、背包、小家电等任意模型。"
        onChange={(event) => onPromptChange(event.target.value)}
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_128px]">
        <div className="space-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">AI 模型</span>
          <div className="relative">
            <button
              type="button"
              disabled={isGenerating}
              className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-gradient-to-b from-background to-muted/40 px-3 text-left text-sm font-medium text-foreground shadow-inner transition-colors hover:border-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setProviderOpen((value) => !value)}
            >
              <span>{activeProvider.label}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${providerOpen ? 'rotate-180' : ''}`} />
            </button>
            {providerOpen ? (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-white/15 bg-[#0b0b0b] shadow-[0_18px_50px_rgba(0,0,0,0.65)] ring-1 ring-white/5">
                {providerOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${llmProvider === item.value ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/8 hover:text-white'}`}
                    onClick={() => {
                      onProviderChange(item.value);
                      setProviderOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    {llmProvider === item.value ? <Check className="h-4 w-4 text-white" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <Button type="button" className="h-11 whitespace-nowrap rounded-xl" disabled={isGenerating} onClick={onSubmit}>
          <Wand2 className="h-4 w-4" />
          {isGenerating ? '生成中' : '一键生成'}
        </Button>
      </div>

      <ModelAssetUploader params={params} onParamChange={onParamChange} />

      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-6 text-muted-foreground">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          在线模型配置
        </div>
        <div className="mb-3">API Key 会保存在当前浏览器本地，并在生成时安全传给后端使用；未填写时才回退到服务端环境变量。</div>
        <div className="space-y-2">
          {providerOptions.map((item) => (
            <label key={item.value} className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2">
              <span className="text-foreground/80">{item.label}</span>
              <input
                type="password"
                value={apiKeys[item.value] ?? ''}
                placeholder={`填写 ${item.label} API Key`}
                className="h-9 rounded-lg border border-border bg-background px-3 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-white/30"
                onChange={(event) => onApiKeyChange(item.value, event.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
