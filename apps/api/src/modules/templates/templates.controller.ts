import { Controller, Get, Query } from '@nestjs/common';
import { createTraceId } from '../../common/json';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async findAll(@Query('category') category?: string) {
    return {
      traceId: createTraceId(),
      data: await this.templatesService.findAll(category),
    };
  }
}
