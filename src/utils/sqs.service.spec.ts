import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SqsService } from './sqs.service';
import { SendMessageCommand } from '@aws-sdk/client-sqs';

jest.mock('@aws-sdk/client-sqs');

describe('SqsService', () => {
  let service: SqsService;
  let sqsClient: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsService,
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

    service = module.get<SqsService>(SqsService);
    sqsClient = (service as any).sqsClient;
    sqsClient.send = jest.fn();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendSQSMessage', () => {
    it('should send a message to SQS', async () => {
      sqsClient.send.mockResolvedValue({});

      const result = await service.sendSQSMessage(
        { foo: 'bar' },
        'test-action',
        'queue-url',
      );

      expect(result).toBe(true);
      expect(sqsClient.send).toHaveBeenCalledWith(
        expect.any(SendMessageCommand),
      );
    });

    it('should throw error if sending fails', async () => {
      sqsClient.send.mockRejectedValue(new Error('SQS failed'));

      await expect(service.sendSQSMessage({}, 'action', 'url')).rejects.toThrow(
        'SQS failed',
      );
    });
  });
});
