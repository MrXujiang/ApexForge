import { Box } from 'lucide-react';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Card, CardContent } from '@/shared/components/Card';
import type { TemplateItem } from '@/shared/types/template';

interface TemplateLibraryProps {
  templates: TemplateItem[];
  selectedTemplateId?: string;
  onUseTemplate: (template: TemplateItem) => void;
}

export function TemplateLibrary({ templates, selectedTemplateId, onUseTemplate }: TemplateLibraryProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {templates.map((template) => (
        <Card key={template.id} className={selectedTemplateId === template.id ? 'border-foreground' : undefined}>
          <CardContent className="p-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
              <Box className="h-5 w-5" />
            </div>
            <div className="font-medium">{template.name}</div>
            <p className="mt-2 min-h-12 text-xs leading-5 text-muted-foreground">{template.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {template.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-4 w-full" onClick={() => onUseTemplate(template)}>
              使用模板
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
