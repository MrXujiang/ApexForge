import { Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { GenerationService } from './generation.service';

@Controller('generations')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post()
  create(@Body() dto: CreateGenerationDto) {
    return this.generationService.create(dto);
  }

  @Get()
  findAll() {
    return this.generationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.generationService.findOne(id);
  }

  @Sse(':id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return of({
      data: {
        event: 'renderable',
        taskId: id,
        message: '生成任务已完成，可进行前端沙箱渲染。',
      },
    } as MessageEvent);
  }
}
