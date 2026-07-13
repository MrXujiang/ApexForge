import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGenerationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  category!: string;

  @IsOptional()
  @IsString()
  @IsIn(['deepseek', 'kimi', 'qwen'])
  llmProvider?: string;

  @IsOptional()
  @IsIn(['auto', 'template', 'code', 'hybrid'])
  mode?: string;

  @IsOptional()
  @IsObject()
  llmApiKeys?: Record<string, string>;

  @IsOptional()
  @IsString()
  projectId?: string;
}
