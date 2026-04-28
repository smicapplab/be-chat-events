import { Module, Global } from '@nestjs/common';
import { S3Service } from './s3.service';
import { TextractService } from './textract.service';
import { SqsService } from './sqs.service';

@Global()
@Module({
    providers: [S3Service, TextractService, SqsService],
    exports: [S3Service, TextractService, SqsService],
})
export class AwsModule { }
