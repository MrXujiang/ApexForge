import type { ModelCategory } from '@/shared/types/generation';

export interface TemplateItem {
  id: string;
  name: string;
  category: ModelCategory;
  description: string;
  tags: string[];
  defaultPrompt: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface TemplateParams {
  bodyColor: string;
  accentColor: string;
  scale: number;
  detailLevel: number;
}
