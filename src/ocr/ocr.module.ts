import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { DatabaseService } from 'src/database/database.service';

@Module({
  providers: [OcrService, DatabaseService],
  exports: [OcrService],
  controllers: [OcrController]
})
export class OcrModule { }
