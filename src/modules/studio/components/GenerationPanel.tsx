import { Activity, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/shared/components/Badge';
import type { GenerationStatus } from '@/shared/types/generation';

interface GenerationPanelProps {
  status: GenerationStatus;
  traceId?: string;
}

const statusMap: Record<GenerationStatus, { label: string; tone: 'muted' | 'success' | 'warning' | 'danger'; icon: 'idle' | 'loading' | 'success' | 'danger' }> = {
  idle: { label: '等待输入', tone: 'muted', icon: 'idle' },
  queued: { label: '任务排队', tone: 'warning', icon: 'loading' },
  generating: { label: '模型生成', tone: 'warning', icon: 'loading' },
  validating: { label: '安全校验', tone: 'warning', icon: 'loading' },
  renderable: { label: '可预览', tone: 'success', icon: 'success' },
  failed: { label: '生成失败', tone: 'danger', icon: 'danger' },
};

export function GenerationPanel({ status, traceId }: GenerationPanelProps) {
  const config = statusMap[status];
  const Icon = config.icon === 'loading' ? Loader2 : config.icon === 'success' ? CheckCircle2 : config.icon === 'danger' ? XCircle : Activity;

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon className={config.icon === 'loading' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          <div>
            <div className="text-sm font-medium">生成状态</div>
          </div>
        </div>
        <Badge tone={config.tone}>{config.label}</Badge>
      </div>
      {traceId ? <div className="mt-3 font-mono text-xs text-muted-foreground">追踪编号：{traceId}</div> : null}
    </div>
  );
}
