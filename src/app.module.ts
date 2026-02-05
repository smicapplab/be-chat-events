import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { SqsUtil } from './utils/sqs-util';
import { OcrModule } from './ocr/ocr.module';
import { TextractUtilService } from './utils/textract-util.service';

@Module({
  imports: [DatabaseModule, OcrModule,],
  controllers: [AppController],
  providers: [AppService, SqsUtil, TextractUtilService],
})
export class AppModule { }
