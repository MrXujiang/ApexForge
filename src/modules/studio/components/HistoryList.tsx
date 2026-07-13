import { Clock3 } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import type { GenerationResult } from '@/shared/types/generation';
import { compactText, formatRelativeTime } from '@/shared/utils/format';

interface HistoryListProps {
  items: GenerationResult[];
  selectedId?: string;
  onSelect: (item: GenerationResult) => void;
}

export function HistoryList({ items, selectedId, onSelect }: HistoryListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无生成历史，完成一次生成后会自动保存到本地。</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`w-full rounded-xl border p-3 text-left transition-colors ${
            item.id === selectedId ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:bg-accent'
          }`}
          onClick={() => onSelect(item)}
        >
          <div className="text-sm font-medium">{compactText(item.prompt, 48)}</div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs opacity-70">
            <span className="flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {formatRelativeTime(item.createdAt)}
            </span>
            <span>{item.metrics.score} 分</span>
          </div>
        </button>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full" disabled>
        本地保留最近 20 条记录
      </Button>
    </div>
  );
}
