import { Injectable, NotFoundException } from '@nestjs/common';
import { createId, createTraceId, parseJson, stringifyJson } from '../../common/json';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';

function toAssetResult(asset: any) {
  return {
    ...asset,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    tags: parseJson<string[]>(asset.tags, []),
    versions: asset.versions?.map((version: any) => ({
      ...version,
      createdAt: version.createdAt.toISOString(),
      metrics: parseJson(version.metrics, {}),
      params: parseJson(version.params, {}),
    })),
  };
}

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssetDto) {
    const task = await this.prisma.generationTask.findUnique({ where: { id: dto.generationTaskId } });

    if (!task) {
      throw new NotFoundException({ code: 'GENERATION_NOT_FOUND', message: '生成任务不存在' });
    }

    const assetId = createId('asset');
    const versionId = createId('ver');
    const asset = await this.prisma.modelAsset.create({
      data: {
        id: assetId,
        name: dto.name,
        category: task.category,
        prompt: task.prompt,
        tags: stringifyJson([task.category]),
        currentVersionId: versionId,
        versions: {
          create: {
            id: versionId,
            generationTaskId: task.id,
            versionNo: 1,
            code: task.generatedCode,
            params: task.generatedParams,
            metrics: task.metrics,
          },
        },
      },
      include: { versions: true },
    });

    return {
      traceId: createTraceId(),
      data: toAssetResult(asset),
    };
  }

  async findAll() {
    const assets = await this.prisma.modelAsset.findMany({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
      include: { versions: true },
    });

    return {
      traceId: createTraceId(),
      data: assets.map(toAssetResult),
    };
  }

  async findVersions(assetId: string) {
    const asset = await this.prisma.modelAsset.findUnique({
      where: { id: assetId },
      include: { versions: { orderBy: { versionNo: 'desc' } } },
    });

    if (!asset) {
      throw new NotFoundException({ code: 'ASSET_NOT_FOUND', message: '资产不存在' });
    }

    return {
      traceId: createTraceId(),
      data: toAssetResult(asset),
    };
  }
}
