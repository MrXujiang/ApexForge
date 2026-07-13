import { ArrowDown, ArrowUp, Grid3X3, Moon, RotateCcw, Sun } from 'lucide-react';
import { Button } from '@/shared/components/Button';

interface ControlToolbarProps {
  showGrid: boolean;
  darkScene: boolean;
  onReset: () => void;
  onMoveModelY: (delta: number) => void;
  onToggleGrid: () => void;
  onToggleScene: () => void;
}

export function ControlToolbar({ showGrid, darkScene, onReset, onMoveModelY, onToggleGrid, onToggleScene }: ControlToolbarProps) {
  return (
    <div className="absolute right-4 top-4 z-10 flex gap-2 rounded-xl border border-border bg-background/80 p-2 backdrop-blur">
      <Button type="button" size="icon" variant="ghost" onClick={onReset} aria-label="重置视角">
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" onClick={() => onMoveModelY(0.25)} aria-label="上移模型">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" onClick={() => onMoveModelY(-0.25)} aria-label="下移模型">
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant={showGrid ? 'secondary' : 'ghost'} onClick={onToggleGrid} aria-label="切换网格">
        <Grid3X3 className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" onClick={onToggleScene} aria-label="切换背景">
        {darkScene ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
