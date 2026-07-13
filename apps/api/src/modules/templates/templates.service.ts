import { Injectable, OnModuleInit } from '@nestjs/common';
import { parseJson, stringifyJson } from '../../common/json';
import { PrismaService } from '../../prisma/prisma.service';
import { seedTemplates } from './template.seed';

function normalizeTemplateCategory(category: string) {
  const value = category.trim().toLowerCase();

  if (['vehicle', 'car', 'sport-car', 'supercar', '跑车', '汽车', '车辆'].some((keyword) => value.includes(keyword))) {
    return 'vehicle';
  }

  if (['jewelry', 'necklace', 'pendant', 'bracelet', 'bangle', 'wristband', '首饰', '珠宝', '项链', '吊坠', '手链', '手镯'].some((keyword) => value.includes(keyword))) {
    return 'jewelry';
  }

  if (['watch', 'wristwatch', 'wearable', '手表', '腕表', '穿戴'].some((keyword) => value.includes(keyword))) {
    return 'watch';
  }

  if (['architecture', 'building', 'tower', '建筑', '楼'].some((keyword) => value.includes(keyword))) {
    return 'architecture';
  }

  if (['aircraft', 'drone', '飞行器', '无人机'].some((keyword) => value.includes(keyword))) {
    return 'aircraft';
  }

  if (['furniture', 'chair', '家具', '椅'].some((keyword) => value.includes(keyword))) {
    return 'furniture';
  }

  if (['prop', '道具', '信标'].some((keyword) => value.includes(keyword))) {
    return 'prop';
  }

  return 'product';
}

@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeedTemplates();
  }

  async ensureSeedTemplates() {
    await Promise.all(
      seedTemplates.map((template) =>
        this.prisma.template.upsert({
          where: { id: template.id },
          update: {
            name: template.name,
            category: template.category,
            description: template.description,
            tags: stringifyJson(template.tags),
            defaultPrompt: template.defaultPrompt,
            complexity: template.complexity,
            status: 'published',
          },
          create: {
            ...template,
            tags: stringifyJson(template.tags),
            status: 'published',
          },
        }),
      ),
    );
  }

  async findAll(category?: string) {
    await this.ensureSeedTemplates();
    const normalizedCategory = category ? normalizeTemplateCategory(category) : undefined;
    const templates = await this.prisma.template.findMany({
      where: normalizedCategory ? { category: normalizedCategory, status: 'published' } : { status: 'published' },
      orderBy: { createdAt: 'asc' },
    });

    return templates.map((template) => ({
      ...template,
      tags: parseJson<string[]>(template.tags, []),
    }));
  }

  async findBestByCategory(category: string) {
    await this.ensureSeedTemplates();
    const template = await this.prisma.template.findFirst({
      where: { category: normalizeTemplateCategory(category), status: 'published' },
    });

    if (template) {
      return template;
    }

    return this.prisma.template.findFirstOrThrow({ where: { status: 'published' } });
  }
}
