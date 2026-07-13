import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetsModule } from './modules/assets/assets.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { GenerationModule } from './modules/generation/generation.module';
import { HealthModule } from './modules/health/health.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ValidationModule } from './modules/validation/validation.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    TemplatesModule,
    ValidationModule,
    GenerationModule,
    AssetsModule,
    FeedbackModule,
  ],
})
export class AppModule {}
