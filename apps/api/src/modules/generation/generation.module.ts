import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { TemplatesModule } from '../templates/templates.module';
import { ValidationModule } from '../validation/validation.module';
import { GenerationController } from './generation.controller';
import { GenerationHarnessService } from './generation-harness.service';
import { GenerationService } from './generation.service';

@Module({
  imports: [TemplatesModule, ValidationModule, LlmModule],
  controllers: [GenerationController],
  providers: [GenerationService, GenerationHarnessService],
  exports: [GenerationService],
})
export class GenerationModule {}
