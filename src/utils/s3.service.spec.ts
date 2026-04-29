import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/lib-storage');

describe('S3Service', () => {
  let service: S3Service;
  let s3Client: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'AWS_REGION') return 'ap-southeast-1';
              if (key === 'PRI_AWS_ACCESS_KEY') return 'test-access-key';
              if (key === 'PRI_AWS_SECRET_KEY') return 'test-secret-key';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
    s3Client = (service as any).s3Client;
    s3Client.send = jest.fn();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadDocument', () => {
    it('should upload a document successfully', async () => {
      const mockUploadDone = jest.fn().mockResolvedValue({});
      (Upload as unknown as jest.Mock).mockImplementation(() => ({
        done: mockUploadDone,
      }));

      await service.uploadDocument(
        'test-bucket',
        'test-file.pdf',
        Buffer.from('test'),
      );

      expect(Upload).toHaveBeenCalled();
      expect(mockUploadDone).toHaveBeenCalled();
    });
  });

  describe('readJsonFileFromS3', () => {
    it('should read and parse JSON from S3', async () => {
      const mockJson = { key: 'value' };
      const mockStream = new Readable();
      mockStream.push(JSON.stringify(mockJson));
      mockStream.push(null);

      s3Client.send.mockResolvedValue({ Body: mockStream });

      const result = await service.readJsonFileFromS3(
        'test-bucket',
        'test.json',
      );

      expect(result).toEqual(mockJson);
    });
  });

  describe('getFileBufferFromS3', () => {
    it('should return a buffer from S3 object', async () => {
      const mockData = Buffer.from('test-data');
      const mockStream = new Readable();
      mockStream.push(mockData);
      mockStream.push(null);

      s3Client.send.mockResolvedValue({ Body: mockStream });

      const result = await service.getFileBufferFromS3(
        'test-bucket',
        'test.pdf',
      );

      expect(result).toEqual(mockData);
    });
  });
});
