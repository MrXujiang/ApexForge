import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  generationTaskId!: string;

  @IsIn(['satisfied', 'unsatisfied', 'violation'])
  rating!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
