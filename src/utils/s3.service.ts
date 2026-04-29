import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'ap-southeast-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('PRI_AWS_ACCESS_KEY'),
        secretAccessKey: this.configService.get<string>('PRI_AWS_SECRET_KEY'),
      },
    });
  }

  async uploadDocument(
    bucket: string,
    fileName: string,
    buffer: Buffer,
    contentType = 'application/pdf',
  ): Promise<void> {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: bucket,
          Key: fileName,
          ContentType: contentType,
          Body: buffer,
        },
      });

      await upload.done();
      this.logger.log(`Upload successful: ${fileName}`);
    } catch (error) {
      this.logger.error(`Upload error for ${fileName}:`, error);
      throw error;
    }
  }

  async readJsonFileFromS3(bucket: string, key: string): Promise<any> {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;
      const data = await this.streamToString(stream);
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(
        `Error reading JSON from S3 (${bucket}/${key}):`,
        error,
      );
      throw error;
    }
  }

  async getFileBufferFromS3(bucket: string, key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      this.logger.error(
        `Error reading buffer from S3 (${bucket}/${key}):`,
        error,
      );
      throw error;
    }
  }

  private async streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', (error) => reject(error));
    });
  }
}
