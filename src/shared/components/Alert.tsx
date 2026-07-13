import { AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface AlertProps {
  title: string;
  description?: string;
  className?: string;
}

export function Alert({ title, description, className }: AlertProps) {
  return (
    <div className={cn('flex gap-3 rounded-xl border border-border bg-muted/60 p-4 text-sm', className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <div className="font-medium text-foreground">{title}</div>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
