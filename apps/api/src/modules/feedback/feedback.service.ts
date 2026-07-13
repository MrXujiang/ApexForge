import { Injectable, NotFoundException } from '@nestjs/common';
import { createId, createTraceId } from '../../common/json';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFeedbackDto) {
    const task = await this.prisma.generationTask.findUnique({ where: { id: dto.generationTaskId } });

    if (!task) {
      throw new NotFoundException({ code: 'GENERATION_NOT_FOUND', message: '生成任务不存在' });
    }

    const feedback = await this.prisma.feedback.create({
      data: {
        id: createId('fb'),
        generationTaskId: dto.generationTaskId,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    return {
      traceId: createTraceId(),
      data: {
        ...feedback,
        createdAt: feedback.createdAt.toISOString(),
      },
    };
  }
}
