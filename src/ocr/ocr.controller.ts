import { Body, Controller, Post, Logger } from '@nestjs/common';
import { OcrService } from './ocr.service';
import {
  GenerateContentDto,
  OcrAnalysisDto,
  RecoverErrorsDto,
} from './dto/ocr.dto';

@Controller('ocr')
export class OcrController {
  private readonly logger = new Logger(OcrController.name);

  constructor(private readonly ocrService: OcrService) {}

  @Post('doc-analysis')
  async getDocumentAnalysis(@Body() dto: OcrAnalysisDto) {
    try {
      const result = await this.ocrService.getDocumentAnalysis(dto);
      return { ...result, message: '' };
    } catch (error) {
      this.logger.error('Document analysis failed', error);
      return {
        success: false,
        result: '',
        message: 'Something went wrong. Please try again.',
      };
    }
  }

  @Post('recover-errors')
  async recoverErrors(@Body() dto: RecoverErrorsDto) {
    try {
      await this.ocrService.recoverErrors(dto);
      return { success: true };
    } catch (error) {
      this.logger.error('Error recovery failed', error);
      return { error: error.message };
    }
  }

  @Post('generate-content')
  async generateContent(@Body() dto: GenerateContentDto) {
    try {
      const result = await this.ocrService.generateContent(dto);
      return { ...result, message: '' };
    } catch (error) {
      this.logger.error('Content generation failed', error);
      return {
        success: false,
        result: '',
        message: 'Something went wrong. Please try again.',
      };
    }
  }
}
