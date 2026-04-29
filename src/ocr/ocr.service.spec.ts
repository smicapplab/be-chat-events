import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OcrService } from './ocr.service';
import { DatabaseService } from '../database/database.service';
import { S3Service } from '../utils/s3.service';
import { TextractService } from '../utils/textract.service';
import { SqsService } from '../utils/sqs.service';
import { OpenAI } from 'openai';

jest.mock('openai');

describe('OcrService', () => {
  let service: OcrService;
  let s3Service: S3Service;
  let textractService: TextractService;
  let sqsService: SqsService;
  let openAI: jest.Mocked<OpenAI>;

  const mockKnex = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    andWhereNot: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    first: jest.fn(),
    update: jest.fn().mockReturnThis(),
    pluck: jest.fn().mockReturnThis(),
  };

  const knexFn = jest.fn(() => mockKnex);
  (knexFn as any).raw = jest.fn((str) => str);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'AWS_PORTAL_BUCKET') return 'test-bucket';
              if (key === 'SQS_CHAT_QUEUE') return 'test-queue';
              if (key === 'OPENAI_API_KEY') return 'test-key';
            }),
          },
        },
        {
          provide: DatabaseService,
          useValue: {
            getKnex: jest.fn(() => knexFn),
          },
        },
        {
          provide: S3Service,
          useValue: {
            uploadDocument: jest.fn(),
            readJsonFileFromS3: jest.fn(),
          },
        },
        {
          provide: TextractService,
          useValue: {
            getDocumentBlocks: jest.fn(),
            startTextExtractAsync: jest.fn(),
          },
        },
        {
          provide: SqsService,
          useValue: {
            sendSQSMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OcrService>(OcrService);
    s3Service = module.get<S3Service>(S3Service);
    textractService = module.get<TextractService>(TextractService);
    sqsService = module.get<SqsService>(SqsService);
    openAI = (service as any).openai;

    // Mock OpenAI structure
    (openAI as any).chat = {
      completions: {
        create: jest.fn(),
      },
    };
    (openAI as any).beta = {
      chat: {
        completions: {
          parse: jest.fn(),
        },
      },
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDocExtractByJobId', () => {
    it('should return doc extract record', async () => {
      const mockDoc = { id: 1 };
      mockKnex.first.mockResolvedValue(mockDoc);

      const result = await service.getDocExtractByJobId('job-1');

      expect(result).toEqual(mockDoc);
      expect(mockKnex.where).toHaveBeenCalledWith('job_id', 'job-1');
    });
  });

  describe('getDocumentAnalysis', () => {
    it('should fetch blocks, save to S3 and send SQS message', async () => {
      const dto = { jobId: 'job-1', docTrainingId: 10, description: 'desc' };
      const mockDoc = { id: 1 };
      mockKnex.first.mockResolvedValue(mockDoc);
      (textractService.getDocumentBlocks as jest.Mock).mockResolvedValue({
        data: [{ Id: 'b1' }],
        error: null,
      });

      const result = await service.getDocumentAnalysis(dto);

      expect(result.data).toContain('Blocks Saved');
      expect(s3Service.uploadDocument).toHaveBeenCalled();
      expect(mockKnex.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PARTIAL:BLOCKS',
        }),
      );
      expect(sqsService.sendSQSMessage).toHaveBeenCalledWith(
        dto,
        'generate-content',
        'test-queue',
      );
    });
  });

  describe('generateContent', () => {
    it('should generate content using OpenAI and update database', async () => {
      const dto = { jobId: 'job-1', docTrainingId: 10, description: 'desc' };
      const mockDoc = { id: 1, blocks: 'path/to/blocks' };
      const mockBlocks = [{ BlockType: 'LINE', Text: 'Hello world' }];
      const mockParsed = { summary: 'A summary', qa: [{ q: '?', a: '!' }] };

      mockKnex.first.mockResolvedValueOnce(mockDoc); // for getDocExtractByJobId
      mockKnex.first.mockResolvedValueOnce(null); // for incomplete check (marks as DONE)
      (s3Service.readJsonFileFromS3 as jest.Mock).mockResolvedValue(mockBlocks);

      // Mock OpenAI parse
      (openAI as any).beta = {
        chat: {
          completions: {
            parse: jest.fn().mockResolvedValue({
              choices: [{ message: { parsed: mockParsed } }],
            }),
          },
        },
      };
      mockKnex.pluck.mockResolvedValue(['summary1', 'summary2']);
      (openAI.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [{ message: { content: 'Collective Summary' } }],
      });

      const result = await service.generateContent(dto);

      expect(result.summary).toBe('A summary');
      expect(mockKnex.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DONE',
          summary: 'A summary',
        }),
      );
    });
  });

  describe('recoverErrors', () => {
    it('should retry textract and send SQS messages for unfinished records', async () => {
      const dto = { docTrainingId: 10 };
      const mockTraining = { id: 10, description: 'desc' };
      const mockExtracts = [{ id: 1, file_name: 'f1.pdf', job_id: 'j1' }];

      mockKnex.first.mockResolvedValue(mockTraining);
      mockKnex.andWhereNot.mockResolvedValue(mockExtracts);

      await service.recoverErrors(dto);

      expect(textractService.startTextExtractAsync).toHaveBeenCalled();
      expect(sqsService.sendSQSMessage).toHaveBeenCalled();
    });
  });
});
