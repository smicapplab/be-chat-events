import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { SqsUtil } from './utils/sqs-util';
import { OcrModule } from './ocr/ocr.module';
import { AwsModule } from './utils/aws.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    OcrModule,
    AwsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SqsUtil],
})
export class AppModule { }
