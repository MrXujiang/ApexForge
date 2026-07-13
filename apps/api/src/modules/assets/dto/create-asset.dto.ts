import { IsString, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  generationTaskId!: string;

  @IsString()
  @MaxLength(80)
  name!: string;
}
