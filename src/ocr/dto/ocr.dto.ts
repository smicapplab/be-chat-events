import {
  IsNumber,
  IsString,
  IsOptional,
  IsNotEmpty,
  Min,
} from 'class-validator';

export class OcrAnalysisDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  docTrainingId: number;

  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class GenerateContentDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  docTrainingId: number;

  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class RecoverErrorsDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  docTrainingId: number;
}

export class SqsMessageDto {
  @IsString()
  @IsNotEmpty()
  action: 'process-pdf' | 'doc-analysis' | 'generate-content';

  @IsNotEmpty()
  data: OcrAnalysisDto | GenerateContentDto | RecoverErrorsDto;
}
